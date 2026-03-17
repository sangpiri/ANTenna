"""
기술 지표 계산 함수 모음
새 지표 추가 = INDICATORS 딕셔너리에 함수 1개 추가
"""
import pandas as pd


def ma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(period).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(period).mean()
    rs = gain / loss.replace(0, float('nan'))
    return 100 - (100 / (1 + rs))


def bollinger_upper(series: pd.Series, period: int = 20, std_mult: float = 2) -> pd.Series:
    mid = series.rolling(period).mean()
    std = series.rolling(period).std()
    return mid + std_mult * std


def bollinger_lower(series: pd.Series, period: int = 20, std_mult: float = 2) -> pd.Series:
    mid = series.rolling(period).mean()
    std = series.rolling(period).std()
    return mid - std_mult * std


# 레지스트리: condition_parser에서 지표 이름으로 참조
INDICATORS: dict = {
    'close':        lambda df, **_: df['close'],
    'open':         lambda df, **_: df['open'],
    'high':         lambda df, **_: df['high'],
    'low':          lambda df, **_: df['low'],
    'volume':       lambda df, **_: df['volume'],
    'ma':           lambda df, period=20, **_: ma(df['close'], int(period)),
    'ema':          lambda df, period=20, **_: ema(df['close'], int(period)),
    'rsi':          lambda df, period=14, **_: rsi(df['close'], int(period)),
    'boll_upper':   lambda df, period=20, **_: bollinger_upper(df['close'], int(period)),
    'boll_lower':   lambda df, period=20, **_: bollinger_lower(df['close'], int(period)),
    'prev_close':   lambda df, **_: df['close'].shift(1),
    'prev_volume':  lambda df, **_: df['volume'].shift(1),
    'high_52w':     lambda df, **_: df['high'].rolling(252).max(),
    'low_52w':      lambda df, **_: df['low'].rolling(252).min(),
    'value':        lambda df, val=0, **_: pd.Series(float(val), index=df.index),
}
