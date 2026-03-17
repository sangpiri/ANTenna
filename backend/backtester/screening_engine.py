"""
스크리닝 기반 백테스팅 엔진 (최적화)
조건 검색(빈출/눌림목/갭상승 등)에 등장한 종목을
등장일로부터 N영업일 후 매수 → M영업일 후(또는 손절/익절 시) 청산

최적화:
  1. OHLCV 룩업: itertuples → groupby + to_dict (C 레벨 변환)
  2. 청산 로직 벡터화: 진입 시점에 numpy로 손절/익절/보유기간 만료일을
     미리 계산 → 메인 루프에서 date >= exit_date 비교만 수행
"""
import bisect
import numpy as np
import pandas as pd
from .metrics import calculate_metrics


class ScreeningBacktestEngine:
    """
    Parameters
    ----------
    entry_signals   : [{ticker, screening_date}, ...]
    available_dates : 영업일 목록 (내/오름차순 모두 허용, 자동 정렬)
    ohlcv_df        : pandas DataFrame (date, ticker, open, high, low, close)
    entry_config    : {days_after: int, price: 'open'|'close'}
    exit_rules      : {hold_days: int, stop_loss: float|None, take_profit: float|None}
    initial_cash    : float
    market          : 'kr' | 'us'
    top_n           : int  (포지션 사이징 기준 — initial_cash / top_n 이 per-trade 금액)
    """

    def run(self, entry_signals, available_dates, ohlcv_df,
            entry_config, exit_rules, initial_cash, market, top_n=10,
            ticker_names: dict | None = None):

        if not entry_signals or not available_dates:
            return {'equity_curve': [], 'trades': [], 'metrics': {}}

        # ── 날짜 인덱스 구성 (오름차순) ──────────────────────────────────
        dates_asc = sorted(set(available_dates))
        date_to_idx = {d: i for i, d in enumerate(dates_asc)}

        # ── 최적화 1: OHLCV 룩업 (groupby + to_dict) ─────────────────────
        # date_str 컬럼 확보
        if 'date_str' not in ohlcv_df.columns:
            ohlcv_df = ohlcv_df.copy()
            ohlcv_df['date_str'] = ohlcv_df['date'].apply(
                lambda d: d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d)
            )

        # {ticker: {date_str: {open, high, low, close}}}
        ohlcv: dict = {}
        for ticker_val, group in ohlcv_df.groupby('ticker'):
            ohlcv[str(ticker_val)] = (
                group.set_index('date_str')[['open', 'high', 'low', 'close']]
                .to_dict('index')
            )

        # ── 최적화 2: 종목별 numpy 배열 (벡터화 청산 계산용) ─────────────
        ticker_arrays: dict = {}
        for ticker_val, t_ohlcv in ohlcv.items():
            sorted_dates = sorted(t_ohlcv.keys())
            if not sorted_dates:
                continue
            ticker_arrays[ticker_val] = {
                'dates':    np.array(sorted_dates),
                'date_to_i': {d: i for i, d in enumerate(sorted_dates)},
                'open':  np.array([t_ohlcv[d]['open']  for d in sorted_dates], dtype=float),
                'high':  np.array([t_ohlcv[d]['high']  for d in sorted_dates], dtype=float),
                'low':   np.array([t_ohlcv[d]['low']   for d in sorted_dates], dtype=float),
                'close': np.array([t_ohlcv[d]['close'] for d in sorted_dates], dtype=float),
            }

        # ── N 영업일 후 날짜 계산 ─────────────────────────────────────────
        def get_nth_biz_day(date_str: str, n: int):
            if date_str in date_to_idx:
                base_idx = date_to_idx[date_str]
            else:
                base_idx = bisect.bisect_left(dates_asc, date_str)
                if base_idx >= len(dates_asc):
                    return None
            target_idx = base_idx + n
            return dates_asc[target_idx] if target_idx < len(dates_asc) else None

        def get_calendar_exit_date(date_str: str, n: int, unit: str) -> str:
            """월/연 기준으로 진입일 이후 첫 영업일 반환"""
            entry_dt = pd.Timestamp(date_str)
            if unit == 'months':
                exit_dt = entry_dt + pd.DateOffset(months=n)
            else:  # years
                exit_dt = entry_dt + pd.DateOffset(years=n)
            exit_str = exit_dt.strftime('%Y-%m-%d')
            idx = bisect.bisect_left(dates_asc, exit_str)
            return dates_asc[idx] if idx < len(dates_asc) else dates_asc[-1]

        # ── 청산 파라미터 ─────────────────────────────────────────────────
        hold_days_max    = int(exit_rules.get('hold_days', 5))
        hold_unit        = exit_rules.get('hold_unit', 'days')
        stop_loss_pct    = exit_rules.get('stop_loss')     # 음수 (예: -5)
        take_profit_pct  = exit_rules.get('take_profit')   # 양수 (예: 10)
        entry_price_type = entry_config.get('price', 'open')

        # ── 최적화 3: 진입 시점에 numpy로 청산일/가격/사유 사전 계산 ──────
        def compute_exit(ticker: str, entry_date_str: str, entry_price: float) -> dict:
            """
            진입일·진입가 기준으로 numpy 슬라이싱으로 청산 정보를 미리 결정.
            메인 루프에서 매일 조건을 확인할 필요 없이 date >= exit_date 비교만 남음.
            """
            # 보유 기간 만료일 계산 (영업일 or 월/연 기준)
            if hold_unit == 'days':
                planned_exit_date = get_nth_biz_day(entry_date_str, hold_days_max) or dates_asc[-1]
            else:
                planned_exit_date = get_calendar_exit_date(entry_date_str, hold_days_max, hold_unit)

            arr = ticker_arrays.get(ticker)
            if arr is None:
                return {'exit_date': planned_exit_date, 'exit_price': None, 'reason': 'hold_days'}

            d_to_i = arr['date_to_i']
            entry_arr_idx = d_to_i.get(entry_date_str)
            if entry_arr_idx is None:
                entry_arr_idx = bisect.bisect_left(arr['dates'].tolist(), entry_date_str)
                if entry_arr_idx >= len(arr['dates']):
                    return {'exit_date': planned_exit_date, 'exit_price': None, 'reason': 'hold_days'}

            # 만료일의 배열 인덱스 찾기
            planned_arr_idx = d_to_i.get(planned_exit_date)
            if planned_arr_idx is None:
                planned_arr_idx = bisect.bisect_left(arr['dates'].tolist(), planned_exit_date)
            end_arr_idx = min(planned_arr_idx, len(arr['dates']) - 1)

            # 진입 당일에는 청산 체크 없음 → 다음날(+1)부터 슬라이싱
            check_start = entry_arr_idx + 1

            if check_start > end_arr_idx:
                # 미래 데이터 없음 → 진입일 그대로 반환
                return {
                    'exit_date':  str(arr['dates'][entry_arr_idx]),
                    'exit_price': None,
                    'reason':     'hold_days',
                }

            future_dates = arr['dates'][check_start:end_arr_idx + 1]
            future_high  = arr['high'] [check_start:end_arr_idx + 1]
            future_low   = arr['low']  [check_start:end_arr_idx + 1]
            future_open  = arr['open'] [check_start:end_arr_idx + 1]
            future_close = arr['close'][check_start:end_arr_idx + 1]

            exit_rel    = len(future_dates) - 1   # 기본: 보유기간 만료
            exit_reason = 'hold_days'

            # 손절: 저가 <= stop_price 인 첫 번째 날
            if stop_loss_pct is not None:
                stop_price = entry_price * (1 + stop_loss_pct / 100)
                sl_hits = np.where((future_low > 0) & (future_low <= stop_price))[0]
                if len(sl_hits) > 0 and sl_hits[0] < exit_rel:
                    exit_rel    = int(sl_hits[0])
                    exit_reason = 'stop_loss'

            # 익절: 고가 >= take_price 인 첫 번째 날 (손절보다 이른 경우만)
            if take_profit_pct is not None:
                tp_price = entry_price * (1 + take_profit_pct / 100)
                tp_hits = np.where(future_high >= tp_price)[0]
                if len(tp_hits) > 0 and tp_hits[0] < exit_rel:
                    exit_rel    = int(tp_hits[0])
                    exit_reason = 'take_profit'

            exit_date_str = str(future_dates[exit_rel])

            # 청산 가격 결정
            if exit_reason == 'stop_loss':
                stop_price = entry_price * (1 + stop_loss_pct / 100)
                exit_price = float(max(stop_price, float(future_low[exit_rel])))
            elif exit_reason == 'take_profit':
                exit_price = float(entry_price * (1 + take_profit_pct / 100))
            else:  # hold_days
                ep = float(future_open[exit_rel])
                exit_price = ep if (entry_price_type == 'open' and ep > 0) else float(future_close[exit_rel])

            return {'exit_date': exit_date_str, 'exit_price': exit_price, 'reason': exit_reason}

        # ── 진입 신호 맵 구성 ─────────────────────────────────────────────
        days_after  = int(entry_config.get('days_after', 0))
        signal_map: dict = {}   # {entry_date: [ticker, ...]}
        for sig in entry_signals:
            entry_date = get_nth_biz_day(sig['screening_date'], days_after)
            if entry_date:
                signal_map.setdefault(entry_date, []).append(sig['ticker'])

        if not signal_map:
            return {'equity_curve': [], 'trades': [], 'metrics': {}}

        # ── 포지션 사이징 ─────────────────────────────────────────────────
        per_trade_amount = float(initial_cash) / max(int(top_n or 10), 1)
        available_cash   = float(initial_cash)

        # holdings: {ticker: {entry_date, entry_price, shares, invested,
        #                      exit_date, exit_price, exit_reason}}
        holdings: dict = {}
        trades:   list = []
        daily_values: list = []

        first_signal_date = min(signal_map.keys())
        relevant_dates = [d for d in dates_asc if d >= first_signal_date]

        for date_str in relevant_dates:

            # ── 1. 청산 처리 (precomputed exit_date 비교만) ───────────────
            to_exit = [t for t, pos in holdings.items() if date_str >= pos['exit_date']]

            for ticker in to_exit:
                pos        = holdings.pop(ticker)
                exit_price = pos['exit_price']

                # exit_price 미정(폴백)이면 실제 종가 사용
                if exit_price is None:
                    pdata = ohlcv.get(ticker, {}).get(date_str)
                    exit_price = (
                        pdata['close'] if (pdata and pdata['close'] > 0)
                        else pos['entry_price']
                    )

                proceeds = exit_price * pos['shares']
                pnl      = proceeds - pos['invested']
                pnl_pct  = (exit_price / pos['entry_price'] - 1) * 100
                available_cash += proceeds

                trades.append({
                    'ticker':      ticker,
                    'name':        (ticker_names or {}).get(ticker, ''),
                    'entry_date':  pos['entry_date'],
                    'exit_date':   date_str,
                    'entry_price': round(pos['entry_price'], 4),
                    'exit_price':  round(exit_price, 4),
                    'shares':      round(pos['shares'], 6),
                    'pnl':         round(pnl, 2),
                    'pnl_pct':     round(pnl_pct, 2),
                    'reason':      pos['exit_reason'],
                })

            # ── 2. 진입 처리 ──────────────────────────────────────────────
            if date_str in signal_map:
                for ticker in signal_map[date_str]:
                    if ticker in holdings:
                        continue
                    pdata = ohlcv.get(ticker, {}).get(date_str)
                    if pdata is None:
                        continue

                    ep = (pdata['open']
                          if entry_price_type == 'open' and pdata['open'] > 0
                          else pdata['close'])
                    if ep <= 0:
                        continue

                    trade_amt = min(per_trade_amount, available_cash)
                    if trade_amt < ep:
                        continue

                    shares = trade_amt / ep
                    available_cash -= trade_amt

                    # numpy로 청산일/가격 사전 계산 (핵심 최적화)
                    exit_info = compute_exit(ticker, date_str, ep)

                    holdings[ticker] = {
                        'entry_date':  date_str,
                        'entry_price': ep,
                        'shares':      shares,
                        'invested':    trade_amt,
                        'exit_date':   exit_info['exit_date'],
                        'exit_price':  exit_info['exit_price'],
                        'exit_reason': exit_info['reason'],
                    }

            # ── 3. 일별 포트폴리오 가치 ───────────────────────────────────
            portfolio_value = available_cash
            for ticker, pos in holdings.items():
                pdata = ohlcv.get(ticker, {}).get(date_str)
                if pdata and pdata['close'] > 0:
                    portfolio_value += pdata['close'] * pos['shares']
                else:
                    portfolio_value += pos['invested']
            daily_values.append({'date': date_str, 'value': round(portfolio_value, 2)})

        # ── 잔여 포지션 강제 청산 ─────────────────────────────────────────
        if relevant_dates and holdings:
            last_date = relevant_dates[-1]
            for ticker, pos in list(holdings.items()):
                pdata    = ohlcv.get(ticker, {}).get(last_date)
                ep_exit  = pdata['close'] if (pdata and pdata['close'] > 0) else pos['entry_price']
                proceeds = ep_exit * pos['shares']
                pnl      = proceeds - pos['invested']
                pnl_pct  = (ep_exit / pos['entry_price'] - 1) * 100
                trades.append({
                    'ticker':      ticker,
                    'name':        (ticker_names or {}).get(ticker, ''),
                    'entry_date':  pos['entry_date'],
                    'exit_date':   last_date,
                    'entry_price': round(pos['entry_price'], 4),
                    'exit_price':  round(ep_exit, 4),
                    'shares':      round(pos['shares'], 6),
                    'pnl':         round(pnl, 2),
                    'pnl_pct':     round(pnl_pct, 2),
                    'reason':      'end_of_period',
                })

        if not daily_values:
            return {'equity_curve': [], 'trades': trades, 'metrics': {}}

        metrics = calculate_metrics(daily_values, trades, initial_cash)
        return {
            'equity_curve': daily_values,
            'trades':       trades,
            'metrics':      metrics,
        }
