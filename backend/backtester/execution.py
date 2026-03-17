"""
체결 현실성 처리: 슬리피지, 수수료, 매도세, 체결 가능 수량
"""


def calculate_execution_price(price: float, action: str, slippage_pct: float = 0.1) -> float:
    """슬리피지 반영 체결 가격 (시가 기준)"""
    if action == 'BUY':
        return price * (1 + slippage_pct / 100)
    else:
        return price * (1 - slippage_pct / 100)


def calculate_commission(price: float, shares: int, market: str = 'kr') -> float:
    """수수료 계산"""
    if market == 'kr':
        return price * shares * 0.00015   # 매수/매도 각각 0.015%
    return 0.0                            # 미국 무료 가정


def calculate_sell_tax(price: float, shares: int, market: str = 'kr') -> float:
    """매도세 (한국만)"""
    if market == 'kr':
        return price * shares * 0.0018   # 0.18%
    return 0.0


def max_executable_shares(volume: int, participation_rate: float = 0.1) -> int:
    """일 거래량의 10%까지만 체결 가능하다고 가정"""
    return max(1, int(volume * participation_rate))
