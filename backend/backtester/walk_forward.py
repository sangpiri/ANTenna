"""
Walk-Forward Analysis — 과적합 방지
전체 기간을 In-sample(최적화)과 Out-of-sample(검증)으로 분리해 롤링 테스트
"""
import pandas as pd
from .engine import BacktestEngine


def walk_forward(
    df: pd.DataFrame,
    conditions: list,
    exit_rules: dict,
    initial_cash: float,
    market: str,
    train_years: int = 3,
    test_years: int = 1,
) -> dict:
    """
    반환:
      in_sample_avg, out_of_sample_avg, overfitting_gap, windows
    """
    engine = BacktestEngine()
    results = []

    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    start = df['date'].min()
    end = df['date'].max()

    window_start = start
    while True:
        train_end = window_start + pd.DateOffset(years=train_years)
        test_end = train_end + pd.DateOffset(years=test_years)
        if test_end > end:
            break

        train_df = df[(df['date'] >= window_start) & (df['date'] < train_end)].copy()
        test_df = df[(df['date'] >= train_end) & (df['date'] < test_end)].copy()

        if train_df.empty or test_df.empty:
            window_start += pd.DateOffset(years=test_years)
            continue

        # date를 문자열로 되돌리기 (engine이 문자열 비교 사용)
        train_df['date'] = train_df['date'].astype(str)
        test_df['date'] = test_df['date'].astype(str)

        in_result = engine.run(train_df, conditions, exit_rules, initial_cash, market)
        out_result = engine.run(test_df, conditions, exit_rules, initial_cash, market)

        in_return = in_result.get('metrics', {}).get('total_return', 0) or 0
        out_return = out_result.get('metrics', {}).get('total_return', 0) or 0

        results.append({
            'train_period': f"{window_start.date()} ~ {train_end.date()}",
            'test_period':  f"{train_end.date()} ~ {test_end.date()}",
            'in_sample_return':     round(in_return, 2),
            'out_of_sample_return': round(out_return, 2),
        })

        window_start += pd.DateOffset(years=test_years)

    if not results:
        return {
            'in_sample_avg':     None,
            'out_of_sample_avg': None,
            'overfitting_gap':   None,
            'windows':           [],
        }

    in_avg = sum(r['in_sample_return'] for r in results) / len(results)
    out_avg = sum(r['out_of_sample_return'] for r in results) / len(results)

    return {
        'in_sample_avg':     round(in_avg, 2),
        'out_of_sample_avg': round(out_avg, 2),
        'overfitting_gap':   round(in_avg - out_avg, 2),
        'windows':           results,
    }
