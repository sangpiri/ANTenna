"""
프리셋 전략 (JSON 형태)
새 프리셋 = 딕셔너리에 항목 1개 추가
"""

PRESETS: dict = {
    'ma_crossover': {
        'label': '이동평균 교차',
        'description': '단기 MA가 장기 MA를 상향 돌파하면 매수',
        'conditions': [
            {
                'left': 'ma', 'left_param': 20,
                'op': 'crosses_above',
                'right': 'ma', 'right_param': 60,
            }
        ],
        'exit': {'hold_days': 10, 'stop_loss': -5, 'take_profit': 10},
        'editable_params': {
            'left_param':  {'label': '단기 MA', 'default': 20, 'min': 5,  'max': 100},
            'right_param': {'label': '장기 MA', 'default': 60, 'min': 20, 'max': 300},
        },
    },
    'rsi_reversal': {
        'label': 'RSI 과매도 반등',
        'description': 'RSI가 30 이하에서 반등하면 매수',
        'conditions': [
            {
                'left': 'rsi', 'left_param': 14,
                'op': 'crosses_above',
                'right': 'value', 'right_val': 30,
            }
        ],
        'exit': {'hold_days': 5, 'stop_loss': -3, 'take_profit': 8},
        'editable_params': {
            'left_param':  {'label': 'RSI 기간',     'default': 14, 'min': 5,  'max': 30},
            'right_val':   {'label': '과매도 기준', 'default': 30, 'min': 10, 'max': 40},
        },
    },
    'volume_breakout': {
        'label': '거래량 급증 돌파',
        'description': '거래량이 전일 대비 N배 이상 급증하면 매수',
        'conditions': [
            {
                'left': 'volume',
                'op': '>',
                'right': 'prev_volume', 'multiplier': 2.0,
            }
        ],
        'exit': {'hold_days': 3, 'stop_loss': -5, 'take_profit': 10},
        'editable_params': {
            'multiplier': {'label': '거래량 배수', 'default': 2.0, 'min': 1.5, 'max': 5.0},
        },
    },
    'high_52w_breakout': {
        'label': '52주 신고가 돌파',
        'description': '현재 주가가 52주 신고가를 돌파하면 매수',
        'conditions': [
            {
                'left': 'close',
                'op': 'crosses_above',
                'right': 'high_52w',
            }
        ],
        'exit': {'hold_days': 10, 'stop_loss': -7, 'take_profit': 20},
        'editable_params': {},
    },
}
