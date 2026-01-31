"""
한국주식 API 라우터
"""
from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()

# data_manager는 main.py에서 주입됨
kr_data_manager = None


def set_data_manager(manager):
    """데이터 매니저 설정 (main.py에서 호출)"""
    global kr_data_manager
    kr_data_manager = manager


@router.get("/dates")
async def get_dates():
    """사용 가능한 날짜 목록 반환"""
    if kr_data_manager is None:
        return {"dates": [], "initial_year": 2024, "initial_month": 1, "min_year": 2024, "max_year": 2024}

    dates = kr_data_manager.get_available_dates()
    return {
        "dates": dates,
        "initial_year": kr_data_manager.initial_year,
        "initial_month": kr_data_manager.initial_month,
        "min_year": kr_data_manager.min_year,
        "max_year": kr_data_manager.max_year
    }


@router.get("/data")
async def get_data(date: str = Query(..., description="날짜 (YYYY-MM-DD)")):
    """특정 날짜의 데이터 반환"""
    if kr_data_manager is None:
        return {"trading_value": [], "change_rate": []}

    return kr_data_manager.get_kr_day_data(date)


@router.get("/frequent")
async def get_frequent_stocks(
    date: str = Query(..., description="기준 날짜"),
    weeks: int = Query(4, description="조회 기간 (주)"),
    category: str = Query("trading_value", description="카테고리")
):
    """빈출 종목 반환"""
    if kr_data_manager is None:
        return []

    return kr_data_manager.get_frequent_stocks(date, weeks, category)


@router.get("/pullback")
async def get_pullback_stocks(
    date: str = Query(..., description="기준 날짜"),
    days_ago: int = Query(1, description="몇 일 전 (1~5)"),
    category: str = Query("trading_value", description="카테고리")
):
    """눌림목 종목 반환"""
    if kr_data_manager is None:
        return []

    return kr_data_manager.get_pullback_stocks(date, days_ago, category)


@router.get("/consecutive")
async def get_consecutive_rise_stocks(
    date: str = Query(..., description="기준 날짜"),
    days: int = Query(2, description="연속 상승 일수 (2~4)"),
    category: str = Query("trading_value", description="카테고리")
):
    """연속 상승 종목 반환"""
    if kr_data_manager is None:
        return []

    return kr_data_manager.get_consecutive_rise_stocks(date, days, category)


@router.get("/history")
async def get_stock_history(
    code: str = Query(..., description="종목코드"),
    days: int = Query(90, description="조회 기간 (일)"),
    end_date: Optional[str] = Query(None, description="기준 날짜")
):
    """종목 차트 데이터 반환"""
    if kr_data_manager is None:
        return {"line": [], "candle": [], "volume": [], "change": {}, "ma20": [], "ma240": [], "end_date": end_date}

    return kr_data_manager.get_stock_history(code, days, end_date)


@router.get("/search")
async def search_stock(
    q: str = Query(..., description="검색어"),
    limit: int = Query(50, description="최대 결과 수")
):
    """종목 검색"""
    if kr_data_manager is None:
        return []

    return kr_data_manager.search_stocks(q, limit)
