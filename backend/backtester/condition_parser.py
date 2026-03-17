"""
사용자 JSON 조건 → 날짜별 True/False 시리즈 변환

조건 JSON 예시:
[
  {"left": "close", "op": "crosses_above", "right": "ma", "right_param": 20},
  {"logic": "AND"},
  {"left": "volume", "op": ">", "right": "prev_volume", "multiplier": 2.0}
]

프리셋 이름(문자열)을 받으면 PRESETS에서 조건을 가져옴:
  "ma_crossover" → PRESETS['ma_crossover']['conditions']
"""
import pandas as pd
from .indicators import INDICATORS
from .operators import OPERATORS


def parse_conditions(df: pd.DataFrame, conditions: list) -> pd.Series:
    """
    df: 단일 종목 OHLCV DataFrame (date, ticker, open, high, low, close, volume)
    conditions: 조건 리스트 (DEPLOYMENT_GUIDE 형식)
    반환: 룩어헤드 방지를 위해 1일 shift된 True/False 시리즈
    """
    result: pd.Series | None = None

    i = 0
    pending_logic = 'AND'

    while i < len(conditions):
        item = conditions[i]

        if 'logic' in item:
            pending_logic = item['logic'].upper()
            i += 1
            continue

        # 좌변 지표 계산
        left_fn = INDICATORS.get(item['left'])
        if left_fn is None:
            raise ValueError(f"알 수 없는 지표: {item['left']}")

        left_kwargs: dict = {}
        if 'left_param' in item and item['left_param'] is not None:
            left_kwargs['period'] = item['left_param']
        if 'left_val' in item:
            left_kwargs['val'] = item['left_val']

        left_series = left_fn(df, **left_kwargs)

        # 우변 지표 계산
        right_fn = INDICATORS.get(item['right'])
        if right_fn is None:
            raise ValueError(f"알 수 없는 지표: {item['right']}")

        right_kwargs: dict = {}
        if 'right_param' in item and item['right_param'] is not None:
            right_kwargs['period'] = item['right_param']
        if 'right_val' in item:
            right_kwargs['val'] = item['right_val']

        right_series = right_fn(df, **right_kwargs)

        # 배수 적용 (예: volume > prev_volume * 2.0)
        if 'multiplier' in item:
            right_series = right_series * float(item['multiplier'])

        # 비교 연산
        op_fn = OPERATORS.get(item['op'])
        if op_fn is None:
            raise ValueError(f"알 수 없는 연산자: {item['op']}")

        mask: pd.Series = op_fn(left_series, right_series)

        if result is None:
            result = mask
        else:
            if pending_logic == 'AND':
                result = result & mask
            else:
                result = result | mask

        pending_logic = 'AND'  # 기본값 리셋
        i += 1

    if result is None:
        return pd.Series(False, index=df.index)

    # 룩어헤드 방지: 신호를 1일 뒤로 밀기 (당일 데이터로 다음날 매수)
    # fill_value=False: shift 시 NaN 없이 바로 False로 채워 FutureWarning 방지
    return result.shift(1, fill_value=False)
