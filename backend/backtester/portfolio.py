"""
포트폴리오 포지션 관리, 현금, 매매 이력, 자산곡선
"""
from .execution import calculate_commission, calculate_sell_tax


class Portfolio:
    def __init__(self, initial_cash: float, market: str = 'kr'):
        self.initial_cash = initial_cash
        self.cash = initial_cash
        self.market = market
        self.positions: dict = {}      # {ticker: {shares, avg_price, entry_date, entry_price}}
        self.trade_history: list = []  # 완료된 매매 이력
        self.daily_values: list = []   # 자산곡선용 [{date, value}]

    def buy(self, ticker: str, date, price: float, volume: int, weight: float = 1.0):
        """
        매수: 잔여 자산의 weight% 만큼 (이미 보유 종목은 추가 매수 안 함)
        """
        if ticker in self.positions:
            return  # 이미 보유 중이면 스킵

        invest_amount = self.cash * weight
        if invest_amount <= 0:
            return

        commission = calculate_commission(price, 1, self.market)
        shares = int(invest_amount / (price + commission))
        if shares <= 0:
            return

        total_cost = price * shares + calculate_commission(price, shares, self.market)
        if total_cost > self.cash:
            shares -= 1
            total_cost = price * shares + calculate_commission(price, shares, self.market)
        if shares <= 0:
            return

        self.cash -= total_cost
        self.positions[ticker] = {
            'shares': shares,
            'avg_price': price,
            'entry_date': str(date),
            'entry_price': price,
        }

    def sell(self, ticker: str, date, price: float, reason: str = 'hold'):
        """매도: 해당 종목 전량 청산"""
        if ticker not in self.positions:
            return

        pos = self.positions.pop(ticker)
        shares = pos['shares']
        exec_price = price

        commission = calculate_commission(exec_price, shares, self.market)
        sell_tax = calculate_sell_tax(exec_price, shares, self.market)
        proceeds = exec_price * shares - commission - sell_tax

        self.cash += proceeds

        pnl = (exec_price - pos['entry_price']) * shares - commission - sell_tax
        pnl_pct = (exec_price / pos['entry_price'] - 1) * 100

        self.trade_history.append({
            'ticker':       ticker,
            'entry_date':   pos['entry_date'],
            'exit_date':    str(date),
            'entry_price':  round(pos['entry_price'], 4),
            'exit_price':   round(exec_price, 4),
            'shares':       shares,
            'pnl':          round(pnl, 2),
            'pnl_pct':      round(pnl_pct, 2),
            'reason':       reason,
        })

    def check_exits(self, date, row: dict, exit_rules: dict, hold_days: dict):
        """
        청산 조건 확인:
          - hold_days: 보유 기간 초과
          - stop_loss: 손절 (%)
          - take_profit: 익절 (%)
        hold_days: {ticker: entry_day_index} — 매수 당시 인덱스
        """
        current_close = row.get('close', 0)
        to_sell = []

        for ticker, pos in list(self.positions.items()):
            entry_price = pos['entry_price']
            pnl_pct = (current_close / entry_price - 1) * 100

            # 손절
            if 'stop_loss' in exit_rules and exit_rules['stop_loss'] is not None:
                if pnl_pct <= exit_rules['stop_loss']:
                    to_sell.append((ticker, 'stop_loss'))
                    continue

            # 익절
            if 'take_profit' in exit_rules and exit_rules['take_profit'] is not None:
                if pnl_pct >= exit_rules['take_profit']:
                    to_sell.append((ticker, 'take_profit'))
                    continue

            # 보유 기간 초과
            if 'hold_days' in exit_rules and exit_rules['hold_days'] is not None:
                days_held = hold_days.get(ticker, 0)
                if days_held >= exit_rules['hold_days']:
                    to_sell.append((ticker, 'hold'))
                    continue

        for ticker, reason in to_sell:
            self.sell(ticker, date, current_close, reason)
            hold_days.pop(ticker, None)

    def evaluate(self, current_prices: dict) -> float:
        """현재 총 자산 = 현금 + 보유 주식 시가"""
        stock_value = sum(
            pos['shares'] * current_prices.get(ticker, pos['avg_price'])
            for ticker, pos in self.positions.items()
        )
        return self.cash + stock_value

    def record_daily(self, date, current_prices: dict):
        """일별 포트폴리오 가치 기록 (자산곡선용)"""
        self.daily_values.append({
            'date': str(date),
            'value': round(self.evaluate(current_prices), 2),
        })
