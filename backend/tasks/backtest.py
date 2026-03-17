"""
백테스팅 Celery 태스크
- run_backtest          : 지표 기반 (기존, 하위 호환 유지)
- run_screening_backtest: 스크리닝 기반 (신규)
"""
import os
import sys

# backend/ 폴더를 sys.path에 추가 (celery worker 실행 시 필요)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sqlalchemy import create_engine as sa_create_engine, text
from dotenv import load_dotenv

from celery_app import celery_app
from backtester.engine import BacktestEngine
from backtester.presets import PRESETS
from backtester.walk_forward import walk_forward
from backtester.monte_carlo import monte_carlo
from backtester.screening_engine import ScreeningBacktestEngine

load_dotenv()

DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://antenna:localdev@localhost:5432/antenna'
)

engine = BacktestEngine()


# ─── 기존 지표 기반 태스크 (하위 호환) ──────────────────────────────────────

@celery_app.task(bind=True)
def run_backtest(
    self,
    market: str,
    conditions,
    exit_params: dict | None,
    initial_cash: float,
    start_date: str,
    end_date: str,
    ticker: str | None = None,
    run_walk_forward: bool = False,
    run_monte_carlo: bool = False,
):
    """
    지표 기반 백테스팅 실행 태스크

    conditions: 조건 빌더 JSON 리스트 또는 프리셋 이름(문자열)
    ticker: None → 조건 기반 다중 종목 모드
            'AAPL' → 개별 종목 모드
    """
    # 프리셋 이름인 경우 JSON으로 변환
    if isinstance(conditions, str) and conditions in PRESETS:
        preset = PRESETS[conditions]
        conditions = preset['conditions']
        if exit_params is None:
            exit_params = preset['exit']

    if exit_params is None:
        exit_params = {'hold_days': 5, 'stop_loss': -5, 'take_profit': 10}

    self.update_state(state='PROGRESS', meta={'current': 0, 'total': 100, 'step': 'DB 조회 중'})

    sa_engine = sa_create_engine(DATABASE_URL)
    table    = 'kr_stock_daily' if market == 'kr' else 'us_stock_daily'
    code_col = 'code' if market == 'kr' else 'ticker'

    query = f"""
        SELECT date, {code_col} AS ticker, name, open, high, low, close, volume
        FROM {table}
        WHERE date BETWEEN :start_date AND :end_date
    """
    params_dict: dict = {'start_date': start_date, 'end_date': end_date}

    if ticker:
        query += f" AND {code_col} = :ticker_val"
        params_dict['ticker_val'] = ticker

    query += " ORDER BY ticker, date"

    with sa_engine.connect() as conn:
        df = pd.read_sql(text(query), conn, params=params_dict)

    if df.empty:
        return {
            'equity_curve': [],
            'trades': [],
            'metrics': {},
            'walk_forward': None,
            'monte_carlo': None,
            'error': '해당 기간에 데이터가 없습니다.',
        }

    self.update_state(state='PROGRESS', meta={'current': 10, 'total': 100, 'step': '백테스팅 실행 중'})

    def on_progress(current: int, total: int):
        pct = 10 + int(current / max(total, 1) * 70)
        self.update_state(
            state='PROGRESS',
            meta={'current': pct, 'total': 100, 'step': f'종목 분석 중 ({current}/{total})'}
        )

    result = engine.run(
        df=df,
        conditions=conditions,
        exit_rules=exit_params,
        initial_cash=initial_cash,
        market=market,
        ticker=ticker,
        progress_callback=on_progress,
    )

    wf_result = None
    if run_walk_forward:
        self.update_state(state='PROGRESS', meta={'current': 80, 'total': 100, 'step': 'Walk-Forward 분석 중'})
        wf_result = walk_forward(
            df=df,
            conditions=conditions,
            exit_rules=exit_params,
            initial_cash=initial_cash,
            market=market,
        )

    mc_result = None
    if run_monte_carlo and result.get('trades'):
        self.update_state(state='PROGRESS', meta={'current': 92, 'total': 100, 'step': 'Monte Carlo 시뮬레이션 중'})
        mc_result = monte_carlo(result['trades'], initial_cash)

    self.update_state(state='PROGRESS', meta={'current': 100, 'total': 100, 'step': '완료'})

    return {
        'equity_curve':  result['equity_curve'],
        'trades':        result['trades'],
        'metrics':       result['metrics'],
        'walk_forward':  wf_result,
        'monte_carlo':   mc_result,
    }


# ─── 스크리닝 기반 태스크 ────────────────────────────────────────────────────

def _walk_forward_screening(
    entry_signals: list,
    available_dates: list,
    ohlcv_df: pd.DataFrame,
    entry_config: dict,
    exit_rules: dict,
    initial_cash: float,
    market: str,
    top_n: int,
    train_years: int = 3,
    test_years: int = 1,
) -> dict:
    """
    스크리닝 엔진용 Walk-Forward 분석.
    entry_signals를 날짜 기준 서브윈도우로 분리해 In/Out-sample 비교.
    """
    screening_eng = ScreeningBacktestEngine()
    results = []

    dates_asc = sorted(set(available_dates))
    if not dates_asc:
        return {'in_sample_avg': None, 'out_of_sample_avg': None,
                'overfitting_gap': None, 'windows': []}

    start_dt = pd.Timestamp(dates_asc[0])
    end_dt   = pd.Timestamp(dates_asc[-1])

    window_start = start_dt
    while True:
        train_end = window_start + pd.DateOffset(years=train_years)
        test_end  = train_end  + pd.DateOffset(years=test_years)
        if test_end > end_dt:
            break

        train_start_str = window_start.strftime('%Y-%m-%d')
        train_end_str   = train_end.strftime('%Y-%m-%d')
        test_end_str    = test_end.strftime('%Y-%m-%d')

        train_dates = [d for d in dates_asc if train_start_str <= d < train_end_str]
        test_dates  = [d for d in dates_asc if train_end_str   <= d < test_end_str]

        if not train_dates or not test_dates:
            window_start += pd.DateOffset(years=test_years)
            continue

        # 날짜 범위에 해당하는 신호 필터
        train_sigs = [s for s in entry_signals if s['screening_date'] in set(train_dates)]
        test_sigs  = [s for s in entry_signals if s['screening_date'] in set(test_dates)]

        train_ohlcv = ohlcv_df[ohlcv_df['date_str'].between(train_start_str, train_end_str)]
        test_ohlcv  = ohlcv_df[ohlcv_df['date_str'].between(train_end_str, test_end_str)]

        if train_sigs:
            in_res  = screening_eng.run(train_sigs, train_dates, train_ohlcv,
                                        entry_config, exit_rules, initial_cash, market, top_n,
                                        ticker_names={s['ticker']: s.get('name','') for s in train_sigs})
        else:
            in_res  = {'metrics': {'total_return': 0}}

        if test_sigs:
            out_res = screening_eng.run(test_sigs, test_dates, test_ohlcv,
                                        entry_config, exit_rules, initial_cash, market, top_n,
                                        ticker_names={s['ticker']: s.get('name','') for s in test_sigs})
        else:
            out_res = {'metrics': {'total_return': 0}}

        in_return  = in_res.get('metrics',  {}).get('total_return', 0) or 0
        out_return = out_res.get('metrics', {}).get('total_return', 0) or 0

        results.append({
            'train_period':         f"{train_start_str} ~ {train_end_str}",
            'test_period':          f"{train_end_str} ~ {test_end_str}",
            'in_sample_return':     round(in_return, 2),
            'out_of_sample_return': round(out_return, 2),
        })

        window_start += pd.DateOffset(years=test_years)

    if not results:
        return {'in_sample_avg': None, 'out_of_sample_avg': None,
                'overfitting_gap': None, 'windows': []}

    in_avg  = sum(r['in_sample_return']     for r in results) / len(results)
    out_avg = sum(r['out_of_sample_return'] for r in results) / len(results)

    return {
        'in_sample_avg':     round(in_avg, 2),
        'out_of_sample_avg': round(out_avg, 2),
        'overfitting_gap':   round(in_avg - out_avg, 2),
        'windows':           results,
    }


@celery_app.task(bind=True)
def run_screening_backtest(
    self,
    market: str,
    entry_signals: list,
    entry_config: dict,
    exit_rules: dict,
    initial_cash: float,
    run_walk_forward: bool = False,
    run_monte_carlo: bool = False,
    top_n: int = 10,
    wf_train_years: int = 3,
    wf_test_years: int = 1,
):
    """
    스크리닝 기반 백테스팅 실행 태스크

    entry_signals: [{ticker, screening_date}, ...]
    entry_config:  {days_after, price}
    exit_rules:    {hold_days, stop_loss, take_profit}
    """
    self.update_state(state='PROGRESS', meta={'current': 0, 'total': 100, 'step': 'DB 조회 중'})

    sa_engine = sa_create_engine(DATABASE_URL)
    table    = 'kr_stock_daily' if market == 'kr' else 'us_stock_daily'
    code_col = 'code' if market == 'kr' else 'ticker'

    # 1. 영업일 캘린더 조회
    with sa_engine.connect() as conn:
        date_rows = conn.execute(
            text(f"SELECT DISTINCT date FROM {table} ORDER BY date ASC")
        ).fetchall()
    available_dates = [r[0].strftime('%Y-%m-%d') for r in date_rows]

    if not available_dates:
        return {
            'equity_curve': [], 'trades': [], 'metrics': {},
            'walk_forward': None, 'monte_carlo': None,
            'error': '영업일 데이터가 없습니다.',
        }

    # 2. OHLCV 조회 범위 결정
    #    screening_date 중 최소값 부터, 마지막 exit 가능 날짜(+hold_days 여유) 까지
    screening_dates = sorted({s['screening_date'] for s in entry_signals})
    start_range = screening_dates[0]
    # hold_days 이후까지 여유있게 조회 (영업일 기준 hold_days * 2일 달력)
    hold_n     = int(exit_rules.get('hold_days', 5))
    hold_unit  = exit_rules.get('hold_unit', 'days')
    days_after = int(entry_config.get('days_after', 0))

    # hold_unit에 따라 캘린더 일수로 변환
    if hold_unit == 'years':
        hold_calendar_days = hold_n * 365
    elif hold_unit == 'months':
        hold_calendar_days = hold_n * 31
    else:  # days (영업일 기준 → 캘린더로 환산)
        hold_calendar_days = hold_n * 2

    buffer_days = hold_calendar_days + (days_after + 5) * 2

    # end_range: available_dates에서 last screening date 이후 buffer_days 날짜 찾기
    from datetime import datetime, timedelta
    last_screening_dt = datetime.strptime(screening_dates[-1], '%Y-%m-%d')
    end_dt = last_screening_dt + timedelta(days=buffer_days)
    end_range = end_dt.strftime('%Y-%m-%d')

    # 3. OHLCV 데이터 로드 (해당 ticker들, 날짜 범위)
    tickers_needed = list({s['ticker'] for s in entry_signals})

    self.update_state(state='PROGRESS', meta={'current': 5, 'total': 100, 'step': 'OHLCV 데이터 조회 중'})

    with sa_engine.connect() as conn:
        ohlcv_df = pd.read_sql(
            text(f"""
                SELECT date, {code_col} AS ticker, open, high, low, close
                FROM {table}
                WHERE date BETWEEN :start AND :end
                  AND {code_col} = ANY(:tickers)
                ORDER BY ticker, date
            """),
            conn,
            params={
                'start':   start_range,
                'end':     end_range,
                'tickers': tickers_needed,
            }
        )

    if ohlcv_df.empty:
        return {
            'equity_curve': [], 'trades': [], 'metrics': {},
            'walk_forward': None, 'monte_carlo': None,
            'error': '해당 기간/종목의 OHLCV 데이터가 없습니다.',
        }

    # date_str 컬럼 추가 (Walk-Forward용)
    ohlcv_df['date_str'] = ohlcv_df['date'].apply(
        lambda d: d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d)
    )

    self.update_state(state='PROGRESS', meta={'current': 15, 'total': 100, 'step': '백테스팅 실행 중'})

    # 4. ticker → name 맵 구성 (entry_signals에 name 포함 시)
    ticker_names = {s['ticker']: s.get('name', '') for s in entry_signals if s.get('name')}

    # 5. 엔진 실행
    screening_eng = ScreeningBacktestEngine()
    result = screening_eng.run(
        entry_signals=entry_signals,
        available_dates=available_dates,
        ohlcv_df=ohlcv_df,
        entry_config=entry_config,
        exit_rules=exit_rules,
        initial_cash=initial_cash,
        market=market,
        top_n=top_n,
        ticker_names=ticker_names,
    )

    # 5. Walk-Forward (선택)
    wf_result = None
    if run_walk_forward:
        self.update_state(state='PROGRESS', meta={'current': 75, 'total': 100, 'step': 'Walk-Forward 분석 중'})
        wf_result = _walk_forward_screening(
            entry_signals=entry_signals,
            available_dates=available_dates,
            ohlcv_df=ohlcv_df,
            entry_config=entry_config,
            exit_rules=exit_rules,
            initial_cash=initial_cash,
            market=market,
            top_n=top_n,
            train_years=wf_train_years,
            test_years=wf_test_years,
        )

    # 6. Monte Carlo (선택)
    mc_result = None
    if run_monte_carlo and result.get('trades'):
        self.update_state(state='PROGRESS', meta={'current': 90, 'total': 100, 'step': 'Monte Carlo 시뮬레이션 중'})
        mc_result = monte_carlo(result['trades'], initial_cash)

    self.update_state(state='PROGRESS', meta={'current': 100, 'total': 100, 'step': '완료'})

    return {
        'equity_curve': result['equity_curve'],
        'trades':       result['trades'],
        'metrics':      result['metrics'],
        'walk_forward': wf_result,
        'monte_carlo':  mc_result,
    }
