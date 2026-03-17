"""
비교 연산자 정의
새 연산자 추가 = OPERATORS 딕셔너리에 람다 1개 추가
"""
import pandas as pd

OPERATORS: dict = {
    '>':              lambda a, b: a > b,
    '<':              lambda a, b: a < b,
    '>=':             lambda a, b: a >= b,
    '<=':             lambda a, b: a <= b,
    '==':             lambda a, b: (a - b).abs() < 1e-9,
    'crosses_above':  lambda a, b: (a.shift(1) <= b.shift(1)) & (a > b),
    'crosses_below':  lambda a, b: (a.shift(1) >= b.shift(1)) & (a < b),
}
