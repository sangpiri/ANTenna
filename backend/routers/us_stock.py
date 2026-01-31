"""
미국주식 API 라우터
"""
from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()

# data_manager는 main.py에서 주입됨
us_data_manager = None


def set_data_manager(manager):
    """데이터 매니저 설정 (main.py에서 호출)"""
    global us_data_manager
    us_data_manager = manager


@router.get("/dates")
async def get_dates():
    """사용 가능한 날짜 목록 반환"""
    if us_data_manager is None:
        return {"dates": [], "initial_year": 2024, "initial_month": 1, "min_year": 2024, "max_year": 2024}

    dates = us_data_manager.get_available_dates()
    return {
        "dates": dates,
        "initial_year": us_data_manager.initial_year,
        "initial_month": us_data_manager.initial_month,
        "min_year": us_data_manager.min_year,
        "max_year": us_data_manager.max_year
    }


@router.get("/data")
async def get_data(date: str = Query(..., description="날짜 (YYYY-MM-DD)")):
    """특정 날짜의 가격대별 데이터 반환"""
    if us_data_manager is None:
        return {
            "high_price_volume": [], "high_price_rate": [],
            "mid_price_volume": [], "mid_price_rate": [],
            "low_price_volume": [], "low_price_rate": []
        }

    return us_data_manager.get_us_day_data(date)


@router.get("/frequent")
async def get_frequent_stocks(
    date: str = Query(..., description="기준 날짜"),
    weeks: int = Query(4, description="조회 기간 (주)"),
    category: str = Query("high_price_volume", description="카테고리")
):
    """빈출 종목 반환"""
    if us_data_manager is None:
        return []

    return us_data_manager.get_frequent_stocks(date, weeks, category)


@router.get("/pullback")
async def get_pullback_stocks(
    date: str = Query(..., description="기준 날짜"),
    days_ago: int = Query(1, description="몇 일 전 (1~5)"),
    category: str = Query("high_price_volume", description="카테고리")
):
    """눌림목 종목 반환"""
    if us_data_manager is None:
        return []

    return us_data_manager.get_pullback_stocks(date, days_ago, category)


@router.get("/consecutive")
async def get_consecutive_rise_stocks(
    date: str = Query(..., description="기준 날짜"),
    days: int = Query(2, description="연속 상승 일수 (2~4)"),
    category: str = Query("high_price_volume", description="카테고리")
):
    """연속 상승 종목 반환"""
    if us_data_manager is None:
        return []

    return us_data_manager.get_consecutive_rise_stocks(date, days, category)


@router.get("/history")
async def get_stock_history(
    ticker: str = Query(..., description="티커"),
    days: int = Query(90, description="조회 기간 (일)"),
    end_date: Optional[str] = Query(None, description="기준 날짜")
):
    """종목 차트 데이터 반환"""
    if us_data_manager is None:
        return {"line": [], "candle": [], "volume": [], "change": {}, "ma20": [], "ma240": [], "end_date": end_date}

    return us_data_manager.get_stock_history(ticker, days, end_date)


@router.get("/search")
async def search_stock(
    q: str = Query(..., description="검색어"),
    limit: int = Query(50, description="최대 결과 수")
):
    """종목 검색"""
    if us_data_manager is None:
        return []

    return us_data_manager.search_stocks(q, limit)


@router.get("/gap-analysis")
async def get_gap_analysis(
    start_date: str = Query(..., description="시작일 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="종료일 (YYYY-MM-DD)"),
    base_price: str = Query("prev_close", description="기준 가격 (prev_close, open, close)"),
    compare_price: str = Query("open", description="비교 가격 (open, close, next_open, next_close)"),
    min_rate: float = Query(3.0, description="최소 상승률 (%)"),
    max_rate: float = Query(99999.0, description="최대 상승률 (%)"),
    extra_base: Optional[str] = Query(None, description="추가 기준 기준 가격 (open, close)"),
    extra_compare: Optional[str] = Query(None, description="추가 기준 비교 가격 (close, next_open, next_close)"),
    extra_direction: Optional[str] = Query(None, description="추가 기준 방향 (up, down)"),
    detail_base: Optional[str] = Query(None, description="세부 기준 기준 가격 (open, close)"),
    detail_compare: Optional[str] = Query(None, description="세부 기준 비교 가격 (next_open, next_close)"),
    detail_direction: Optional[str] = Query(None, description="세부 기준 방향 (up, down)"),
    ticker_filter: Optional[str] = Query(None, description="종목 필터 (티커/종목명)")
):
    """갭 상승 분석 데이터 조회"""
    if us_data_manager is None:
        return []

    return us_data_manager.get_gap_analysis(
        start_date, end_date, base_price, compare_price, min_rate, max_rate,
        extra_base, extra_compare, extra_direction,
        detail_base, detail_compare, detail_direction,
        ticker_filter
    )
