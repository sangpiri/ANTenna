"""
백테스팅 코어 엔진
신호 → 주문 → 포트폴리오 루프 → 성과 지표 반환

최적화:
  1. O(1) OHLCV 조회 테이블: records[(ticker, date_str)] dict
  2. signal_dates 인덱스: 신호 있는 종목만 순회 (전체 종목 루프 제거)
  3. 보유 종목만 current_prices 조회 (불필요한 전종목 루프 제거)
"""
import bisect
import pandas as pd
from typing import Callable

from .condition_parser import parse_conditions
from .portfolio import Portfolio
from .execution import calculate_execution_price
from .metrics import calculate_metrics


class BacktestEngine:
    def run(
        self,
        df: pd.DataFrame,
        conditions: list,
        exit_rules: dict,
        initial_cash: float = 10_000_000,
        market: str = 'kr',
        ticker: str | None = None,
        progress_callback: Callable | None = None,
    ) -> dict:
        """
        df: 전체 OHLCV DataFrame
            컬럼: date, ticker, name, open, high, low, close, volume
            date 오름차순 정렬 전제
        conditions: 진입 조건 JSON 리스트
        exit_rules: {'hold_days': 5, 'stop_loss': -5, 'take_profit': 10}
        ticker: None → 조건 기반 다중 종목 모드
                'AAPL' → 개별 종목 모드
        """
        if ticker:
            df = df[df['ticker'] == ticker].copy()

        # ── 1단계: 날짜 문자열 정규화 ─────────────────────────────────────
        df = df.copy()
        df['date_str'] = df['date'].astype(str).str[:10]

        tickers = df['ticker'].unique()
        total = len(tickers)

        # ── 2단계: 신호 계산 + signal_dates 인덱스 ────────────────────────
        # signal_dates[date_str] = [ticker, ...] — 그날 매수 신호 있는 종목만
        signal_dates: dict = {}
        for idx, (t, group) in enumerate(df.groupby('ticker', sort=False)):
            group = group.reset_index(drop=True)
            try:
                sig = parse_conditions(group, conditions)
            except Exception:
                sig = pd.Series(False, index=group.index)

            # NaN 방지 후 True인 날짜만 인덱싱
            sig_mask = sig.fillna(False).astype(bool)
            for d in group.loc[sig_mask, 'date_str']:
                signal_dates.setdefault(d, []).append(t)

            if progress_callback and idx % max(1, total // 20) == 0:
                progress_callback(idx, total)

        # ── 3단계: O(1) OHLCV 조회 테이블 ────────────────────────────────
        # records[(ticker, date_str)] = {'open': ..., 'close': ..., 'volume': ...}
        records: dict = (
            df.set_index(['ticker', 'date_str'])[['open', 'close', 'volume']]
            .to_dict('index')
        )

        # ── 4단계: 보유기간 단위 설정 ────────────────────────────────────
        hold_n    = int(exit_rules.get('hold_days', 5))
        hold_unit = exit_rules.get('hold_unit', 'days')

        # ── 5단계: 날짜별 포트폴리오 시뮬레이션 ──────────────────────────
        dates = sorted(df['date_str'].unique())

        def _calendar_exit_date(entry_date: str) -> str:
            """월/연 기준 만료일 → 해당 날짜 이후 첫 영업일"""
            entry_dt = pd.Timestamp(entry_date)
            if hold_unit == 'months':
                exit_dt = entry_dt + pd.DateOffset(months=hold_n)
            else:  # years
                exit_dt = entry_dt + pd.DateOffset(years=hold_n)
            exit_str = exit_dt.strftime('%Y-%m-%d')
            idx = bisect.bisect_left(dates, exit_str)
            return dates[idx] if idx < len(dates) else dates[-1]
        portfolio = Portfolio(initial_cash, market)
        hold_days: dict = {}        # {ticker: 보유 영업일 수} — days 모드용
        planned_exits: dict = {}    # {ticker: exit_date_str} — months/years 모드용

        for date in dates:
            # 보유 기간 증가 (days 모드만)
            if hold_unit == 'days':
                for t in portfolio.positions:
                    hold_days[t] = hold_days.get(t, 0) + 1

            # ── 청산 체크 ─────────────────────────────────────────────────
            to_sell: list = []
            for t in list(portfolio.positions.keys()):
                row = records.get((t, date))
                if row is None:
                    continue

                row_close   = float(row['close'])
                entry_price = portfolio.positions[t]['entry_price']
                pnl_pct     = (row_close / entry_price - 1) * 100
                reason      = None

                if exit_rules.get('stop_loss') is not None and pnl_pct <= exit_rules['stop_loss']:
                    reason = 'stop_loss'
                elif exit_rules.get('take_profit') is not None and pnl_pct >= exit_rules['take_profit']:
                    reason = 'take_profit'
                elif exit_rules.get('hold_days') is not None:
                    if hold_unit == 'days':
                        if hold_days.get(t, 0) >= hold_n:
                            reason = 'hold'
                    else:
                        if date >= planned_exits.get(t, '9999-12-31'):
                            reason = 'hold'

                if reason:
                    to_sell.append((t, row_close, reason))

            for t, price, reason in to_sell:
                exec_price = calculate_execution_price(price, 'SELL')
                portfolio.sell(t, date, exec_price, reason)
                hold_days.pop(t, None)
                planned_exits.pop(t, None)

            # ── 진입 처리 (신호 있는 종목만 순회) ────────────────────────
            for t in signal_dates.get(date, []):
                if t in portfolio.positions:
                    continue
                row = records.get((t, date))
                if row is None:
                    continue
                exec_price = calculate_execution_price(float(row['open']), 'BUY')
                vol = int(row.get('volume', 1))
                portfolio.buy(t, date, exec_price, vol)
                if t in portfolio.positions:
                    hold_days[t] = 0
                    if hold_unit != 'days':
                        planned_exits[t] = _calendar_exit_date(date)

            # ── 자산 평가 (보유 종목만 조회) ──────────────────────────────
            current_prices: dict = {}
            for t in portfolio.positions:
                row = records.get((t, date))
                if row:
                    current_prices[t] = float(row['close'])

            portfolio.record_daily(date, current_prices)

        # ── 남은 포지션 강제 청산 (마지막 날 종가) ────────────────────────
        if dates:
            last_date = dates[-1]
            for t in list(portfolio.positions.keys()):
                row = records.get((t, last_date))
                if row:
                    exec_price = calculate_execution_price(float(row['close']), 'SELL')
                    portfolio.sell(t, last_date, exec_price, 'end_of_period')

        metrics = calculate_metrics(
            portfolio.daily_values,
            portfolio.trade_history,
            initial_cash,
        )

        return {
            'equity_curve': portfolio.daily_values,
            'trades':       portfolio.trade_history,
            'metrics':      metrics,
        }
