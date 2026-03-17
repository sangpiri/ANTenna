"""
성과 지표 계산: Sharpe, Sortino, MDD, CAGR, Volatility, Calmar, Win Rate,
Profit Factor, Information Ratio, 기대값(EV), 샘플 신뢰도
"""
import pandas as pd
from statistics import mean

MIN_TRADES_MEDIUM = 30
MIN_TRADES_HIGH = 100


def calculate_metrics(
    daily_values: list,
    trades: list,
    initial_cash: float,
    benchmark_returns: pd.Series | None = None,
) -> dict:
    """
    daily_values: [{date, value}, ...]
    trades: [{ticker, entry_date, exit_date, entry_price, exit_price, pnl, pnl_pct, reason}, ...]
    initial_cash: 초기 자본
    benchmark_returns: 동일 기간 벤치마크 일별 수익률 pd.Series (없으면 None)
    """
    if not daily_values:
        return {}

    values = pd.Series([d['value'] for d in daily_values])
    returns = values.pct_change().dropna()
    total_days = len(values)
    years = max(total_days / 252, 1 / 252)  # 0 방지

    final_value = values.iloc[-1]

    # CAGR
    cagr = (final_value / initial_cash) ** (1 / years) - 1

    # Sharpe
    sharpe = (
        (returns.mean() / returns.std()) * (252 ** 0.5)
        if returns.std() > 0 else 0
    )

    # Sortino
    downside = returns[returns < 0]
    downside_std = downside.std()
    sortino = (
        (returns.mean() / downside_std) * (252 ** 0.5)
        if downside_std > 0 else 0
    )

    # Max Drawdown
    peak = values.cummax()
    drawdown = (values - peak) / peak
    max_drawdown = drawdown.min()

    # Volatility
    volatility = returns.std() * (252 ** 0.5)

    # Calmar
    calmar = cagr / abs(max_drawdown) if max_drawdown != 0 else 0

    # Win Rate
    winning_trades = [t for t in trades if t.get('pnl', 0) > 0]
    win_rate = len(winning_trades) / len(trades) * 100 if trades else 0

    # Profit Factor
    total_profit = sum(t['pnl'] for t in trades if t.get('pnl', 0) > 0)
    total_loss = abs(sum(t['pnl'] for t in trades if t.get('pnl', 0) < 0))
    profit_factor = total_profit / total_loss if total_loss > 0 else float('inf')

    # Information Ratio
    information_ratio = None
    if benchmark_returns is not None and len(benchmark_returns) == len(returns):
        active = returns.values - benchmark_returns.values
        te = pd.Series(active).std()
        if te > 0:
            information_ratio = round(pd.Series(active).mean() / te * (252 ** 0.5), 2)

    # 기대값 (EV)
    expected_value = 0.0
    if trades:
        pnls = [t['pnl'] for t in trades]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p < 0]
        avg_win = mean(wins) if wins else 0
        avg_loss = mean(losses) if losses else 0
        wr = win_rate / 100
        expected_value = wr * avg_win + (1 - wr) * avg_loss

    # 샘플 신뢰도
    n = len(trades)
    if n < MIN_TRADES_MEDIUM:
        reliability = 'low'
    elif n < MIN_TRADES_HIGH:
        reliability = 'medium'
    else:
        reliability = 'high'

    return {
        'total_return':      round((final_value / initial_cash - 1) * 100, 2),
        'cagr':              round(cagr * 100, 2),
        'sharpe_ratio':      round(sharpe, 2),
        'sortino_ratio':     round(sortino, 2),
        'max_drawdown':      round(max_drawdown * 100, 2),
        'volatility':        round(volatility * 100, 2),
        'calmar_ratio':      round(calmar, 2),
        'total_trades':      n,
        'win_rate':          round(win_rate, 2),
        'profit_factor':     round(profit_factor, 2) if profit_factor != float('inf') else None,
        'information_ratio': information_ratio,
        'expected_value':    round(expected_value, 0),
        'reliability':       reliability,
    }
