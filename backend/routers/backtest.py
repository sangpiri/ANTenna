"""
백테스팅 API 라우터
POST /api/backtest              → 지표 기반 태스크 실행 (하위 호환 유지)
POST /api/backtest/screening    → 스크리닝 기반 태스크 실행
GET  /api/backtest/{id}         → 진행 상태 / 결과 조회
GET  /api/backtest/presets      → 프리셋 목록 조회
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from celery.result import AsyncResult

from celery_app import celery_app
from tasks.backtest import run_backtest, run_screening_backtest
from routers.auth import get_current_user
from backtester.presets import PRESETS

router = APIRouter()

# data_manager 인스턴스 (main.py에서 주입)
_kr_dm = None
_us_dm = None


def set_data_managers(kr_dm, us_dm):
    global _kr_dm, _us_dm
    _kr_dm = kr_dm
    _us_dm = us_dm


def require_premium(user=Depends(get_current_user)):
    """premium 이상 사용자만 허용"""
    if user['role'] not in ('premium', 'admin'):
        raise HTTPException(
            status_code=403,
            detail="premium 이상 사용자만 이용 가능합니다."
        )
    return user


# ─── 스크리닝 헬퍼 ───────────────────────────────────────────────────────────

async def _get_condition_stocks(dm, screening: dict, date: str) -> list[dict]:
    """
    조건(condition)에 따라 해당 날짜의 스크리닝 결과 반환.
    반환 형식: [{code, ma240_position, trading_value}, ...]
    """
    condition = screening.get('condition')
    market    = dm.market

    # 기본 카테고리: KR → trading_value, US → high_price_volume
    default_cat = 'trading_value' if market == 'kr' else 'high_price_volume'
    category    = screening.get('category') or default_cat

    def _norm(raw: list[dict]) -> list[dict]:
        """스크리닝 결과를 공통 포맷({code, name, ma240_position, trading_value})으로 변환"""
        code_key = '종목코드' if market == 'kr' else '티커'
        out = []
        for r in raw:
            code = r.get(code_key) or r.get('티커', '')
            if code:
                out.append({
                    'code':            str(code),
                    'name':            r.get('종목명', ''),
                    'ma240_position':  r.get('ma240_position'),
                    'trading_value':   r.get('거래대금', 0) or r.get('최근거래대금', 0),
                })
        return out

    try:
        if condition == 'frequent':
            weeks = int(screening.get('weeks') or 4)
            raw   = await dm.get_frequent_stocks(date, weeks, category)

        elif condition == 'pullback':
            days_ago = int(screening.get('days_ago') or 1)
            raw      = await dm.get_pullback_stocks(date, days_ago, category)

        elif condition == 'consecutive':
            days = int(screening.get('consecutive_days') or 2)
            raw  = await dm.get_consecutive_rise_stocks(date, days, category)

        elif condition == '52week_high':
            consol = int(screening.get('consolidation_days') or 0)
            rng    = float(screening.get('range_pct') or 0)
            raw    = await dm.get_52week_high_stocks(date, consol, rng, category)

        elif condition in ('gap_up', 'gap_down'):
            direction = 'up' if condition == 'gap_up' else 'down'
            gap_stocks = await dm.get_gap_analysis(
                start_date=date,
                end_date=date,
                base_price=screening.get('base_price', 'prev_close'),
                compare_price=screening.get('compare_price', 'open'),
                min_rate=float(screening.get('min_rate') or 3.0),
                max_rate=float(screening.get('max_rate') or 99999),
                extra_base=screening.get('extra_base') or None,
                extra_compare=screening.get('extra_compare') or None,
                extra_direction=screening.get('extra_direction') or None,
                detail_base=screening.get('detail_base') or None,
                detail_compare=screening.get('detail_compare') or None,
                detail_direction=screening.get('detail_direction') or None,
                ticker_filter=None,
                direction=direction,
            )
            # 52주 신고가 필터 (갭 상승만)
            high_filter = screening.get('high_filter', 'all')
            if condition == 'gap_up' and high_filter != 'all':
                if high_filter == 'high':
                    gap_stocks = [r for r in gap_stocks if r.get('is_52week_high')]
                elif high_filter == 'not_high':
                    gap_stocks = [r for r in gap_stocks if not r.get('is_52week_high')]
            # 공통 포맷으로 변환 (gap_analysis 결과는 '티커' key 사용)
            raw = []
            for r in gap_stocks:
                raw.append({
                    '티커':           r['티커'],
                    '종목명':         r.get('종목명', ''),
                    'ma240_position': r.get('ma240_position'),
                    '거래대금':       r.get('거래대금', 0),
                })
            return _norm(raw)  # gap은 이미 '티커'가 들어있어 _norm이 그대로 처리

        elif condition == 'ipo':
            ipo_stocks = await dm.get_new_listings(date, date)
            raw = []
            for r in ipo_stocks:
                raw.append({
                    '티커':           r['티커'],
                    '종목명':         r.get('종목명', ''),
                    'ma240_position': None,
                    '거래대금':       r.get('거래대금', 0),
                })
            return _norm(raw)

        else:
            return []

    except Exception:
        return []

    return _norm(raw)


async def _collect_entry_signals(
    dm, screening: dict, dates: list[str]
) -> list[dict]:
    """
    주어진 날짜 목록 각각에 대해 스크리닝을 실행하고
    entry_signals = [{ticker, screening_date}, ...] 반환
    """
    ma_filter   = screening.get('ma_filter', 'all')
    price_range = screening.get('price_range', 'all')   # US only
    top_n       = screening.get('top_n') or 10
    tickers_input = [t.strip().upper() for t in (screening.get('tickers') or []) if t.strip()]

    # US + price_range 'all': 세 가지 가격대를 모두 쿼리
    # (same condition으로 세 번 호출하면 데이터매니저가 각각 필터링해줌)
    async def _query_with_price_range(date: str) -> list[dict]:
        condition = screening.get('condition')
        if dm.market == 'us' and price_range == 'all' and condition not in ('gap_up', 'gap_down', 'ipo'):
            # trading_value sort 기준: 세 가지 가격대 병합
            base_cat = 'volume' if (screening.get('category') or '').endswith('volume') or not screening.get('category') else 'rate'
            high_scr = {**screening, 'category': f'high_price_{base_cat}'}
            mid_scr  = {**screening, 'category': f'mid_price_{base_cat}'}
            low_scr  = {**screening, 'category': f'low_price_{base_cat}'}
            r_high, r_mid, r_low = await asyncio.gather(
                _get_condition_stocks(dm, high_scr, date),
                _get_condition_stocks(dm, mid_scr, date),
                _get_condition_stocks(dm, low_scr, date),
            )
            merged = {s['code']: s for s in r_high + r_mid + r_low}
            return list(merged.values())
        elif dm.market == 'us' and price_range != 'all' and condition not in ('gap_up', 'gap_down', 'ipo'):
            prefix_map = {'high': 'high_price', 'mid': 'mid_price', 'low': 'low_price'}
            prefix = prefix_map.get(price_range, 'high_price')
            base_cat = 'volume' if (screening.get('category') or '').endswith('volume') or not screening.get('category') else 'rate'
            modified = {**screening, 'category': f'{prefix}_{base_cat}'}
            return await _get_condition_stocks(dm, modified, date)
        else:
            return await _get_condition_stocks(dm, screening, date)

    tasks = [_query_with_price_range(d) for d in dates]
    results = await asyncio.gather(*tasks)

    entry_signals = []
    for date, stocks in zip(dates, results):
        # MA 필터
        if ma_filter != 'all':
            target_pos = 'above' if ma_filter == 'above' else 'below'
            stocks = [s for s in stocks if s.get('ma240_position') == target_pos]

        # 특정 종목 필터
        if tickers_input:
            stocks = [s for s in stocks if s['code'].upper() in tickers_input]
        else:
            # top_n 제한
            stocks = stocks[:int(top_n)]

        for s in stocks:
            if s['code']:
                entry_signals.append({
                    'ticker':         s['code'],
                    'name':           s.get('name', ''),
                    'screening_date': date,
                })

    return entry_signals


# ─── 엔드포인트 ──────────────────────────────────────────────────────────────

@router.get("/presets")
async def get_presets():
    """프리셋 전략 목록 반환 (로그인 불필요)"""
    return [
        {
            'id':          key,
            'label':       val['label'],
            'description': val['description'],
            'exit':        val['exit'],
            'editable_params': val.get('editable_params', {}),
        }
        for key, val in PRESETS.items()
    ]


@router.post("/screening")
async def request_screening_backtest(body: dict, user=Depends(require_premium)):
    """
    스크리닝 기반 백테스팅 요청 → task_id 반환 (premium/admin만)

    body: BacktestScreeningRequest (frontend types 참고)
    """
    market = body.get('market', 'kr')
    if market not in ('kr', 'us'):
        raise HTTPException(status_code=400, detail="market은 'kr' 또는 'us'여야 합니다.")

    dm = _kr_dm if market == 'kr' else _us_dm
    if dm is None:
        raise HTTPException(status_code=503, detail="데이터 매니저가 초기화되지 않았습니다.")

    screening = body.get('screening', {})
    condition = screening.get('condition')
    if not condition:
        raise HTTPException(status_code=400, detail="screening.condition이 필요합니다.")

    exit_rules = body.get('exit', {})
    if not exit_rules.get('hold_days'):
        raise HTTPException(status_code=400, detail="exit.hold_days가 필요합니다.")

    # 날짜 목록 결정
    date_mode = screening.get('date_mode', 'single')
    if date_mode == 'single':
        date = screening.get('date')
        if not date:
            raise HTTPException(status_code=400, detail="date_mode=single일 때 date가 필요합니다.")
        dates_to_screen = [date]
    else:
        start_date = screening.get('start_date')
        end_date   = screening.get('end_date')
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="date_mode=range일 때 start_date, end_date가 필요합니다.")
        dates_info     = await dm.get_available_dates()
        dates_to_screen = [d for d in dates_info['dates'] if start_date <= d <= end_date]
        dates_to_screen.sort()  # 오름차순

    if not dates_to_screen:
        raise HTTPException(status_code=400, detail="해당 기간에 데이터가 없습니다.")

    # 스크리닝 실행 → entry_signals 수집
    entry_signals = await _collect_entry_signals(dm, screening, dates_to_screen)

    if not entry_signals:
        raise HTTPException(status_code=400, detail="조건에 맞는 종목이 없습니다.")

    # Redis 메시지 크기 경고 (12,600건 초과)
    if len(entry_signals) > 10_000:
        entry_signals = entry_signals[:10_000]

    tickers_manual = [t.strip().upper() for t in (screening.get('tickers') or []) if t.strip()]
    top_n = len(tickers_manual) if tickers_manual else (screening.get('top_n') or 10)

    task = run_screening_backtest.delay(
        market=market,
        entry_signals=entry_signals,
        entry_config=body.get('entry', {'days_after': 0, 'price': 'open'}),
        exit_rules=exit_rules,
        initial_cash=body.get('initial_cash', 10_000_000),
        run_walk_forward=body.get('run_walk_forward', False),
        run_monte_carlo=body.get('run_monte_carlo', False),
        top_n=int(top_n),
        wf_train_years=int(body.get('wf_train_years') or 3),
        wf_test_years=int(body.get('wf_test_years') or 1),
    )
    return {"task_id": task.id}


@router.post("")
async def request_backtest(body: dict, user=Depends(require_premium)):
    """
    지표 기반 백테스팅 요청 (하위 호환 유지)
    """
    market = body.get('market', 'kr')
    if market not in ('kr', 'us'):
        raise HTTPException(status_code=400, detail="market은 'kr' 또는 'us'여야 합니다.")

    conditions = body.get('conditions')
    if not conditions:
        raise HTTPException(status_code=400, detail="conditions가 필요합니다.")

    start_date = body.get('start_date')
    end_date   = body.get('end_date')
    if not start_date or not end_date:
        raise HTTPException(status_code=400, detail="start_date와 end_date가 필요합니다.")

    task = run_backtest.delay(
        market=market,
        conditions=conditions,
        exit_params=body.get('exit_params'),
        initial_cash=body.get('initial_cash', 10_000_000),
        start_date=start_date,
        end_date=end_date,
        ticker=body.get('ticker'),
        run_walk_forward=body.get('run_walk_forward', False),
        run_monte_carlo=body.get('run_monte_carlo', False),
    )
    return {"task_id": task.id}


@router.get("/{task_id}")
async def get_backtest_result(task_id: str, user=Depends(get_current_user)):
    """
    진행 중: {"status": "PROGRESS", "current": 60, "total": 100, "step": "..."}
    완료:   {"status": "SUCCESS", "result": {...}}
    실패:   {"status": "FAILURE", "error": "..."}
    """
    result = AsyncResult(task_id, app=celery_app)

    if result.state == 'PENDING':
        return {"status": "PENDING"}
    elif result.state == 'STARTED':
        return {"status": "STARTED"}
    elif result.state == 'PROGRESS':
        info = result.info or {}
        return {
            "status":  "PROGRESS",
            "current": info.get('current', 0),
            "total":   info.get('total', 100),
            "step":    info.get('step', ''),
        }
    elif result.state == 'SUCCESS':
        return {"status": "SUCCESS", "result": result.result}
    elif result.state == 'FAILURE':
        return {"status": "FAILURE", "error": str(result.result)}

    return {"status": result.state}
