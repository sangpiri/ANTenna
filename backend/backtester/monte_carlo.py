"""
Monte Carlo Simulation — 강건성 검증
동일한 승률/손익비라도 운에 따른 성과 왜곡을 제거
매매 손익 순서를 n번 랜덤 셔플하여 성과 분포 반환
"""
import random
import pandas as pd


def monte_carlo(trades: list, initial_cash: float, n: int = 1000) -> dict:
    """
    trades: [{pnl, ...}, ...]
    반환: median, percentile_5 (최악), percentile_95 (최선), loss_probability
    """
    if not trades:
        return {
            'median':           None,
            'percentile_5':     None,
            'percentile_95':    None,
            'loss_probability': None,
        }

    pnls = [t['pnl'] for t in trades]
    final_values = []

    for _ in range(n):
        # 복원 추출(bootstrap): 중복 허용으로 실제 분산 발생
        resampled = random.choices(pnls, k=len(pnls))
        equity = initial_cash
        for pnl in resampled:
            equity += pnl
        final_values.append(equity)

    series = pd.Series(final_values)
    return {
        'median':           round(float(series.median()), 0),
        'percentile_5':     round(float(series.quantile(0.05)), 0),
        'percentile_95':    round(float(series.quantile(0.95)), 0),
        'loss_probability': round(float((series < initial_cash).mean() * 100), 1),
    }
