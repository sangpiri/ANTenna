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
        return {"dates": [], "initial_year": 2024, "initial_month": 1,
                "min_year": 2024, "max_year": 2024}
    return await kr_data_manager.get_available_dates()


@router.get("/data")
async def get_data(date: str = Query(..., description="날짜 (YYYY-MM-DD)")):
    """특정 날짜의 데이터 반환"""
    if kr_data_manager is None:
        return {"trading_value": [], "change_rate": []}
    return await kr_data_manager.get_kr_day_data(date)


@router.get("/frequent")
async def get_frequent_stocks(
    date: str = Query(..., description="기준 날짜"),
    weeks: int = Query(4, description="조회 기간 (주)"),
    category: str = Query("trading_value", description="카테고리")
):
    """빈출 종목 반환"""
    if kr_data_manager is None:
        return []
    return await kr_data_manager.get_frequent_stocks(date, weeks, category)


@router.get("/pullback")
async def get_pullback_stocks(
    date: str = Query(..., description="기준 날짜"),
    days_ago: int = Query(1, description="몇 일 전 (1~5)"),
    category: str = Query("trading_value", description="카테고리")
):
    """눌림목 종목 반환"""
    if kr_data_manager is None:
        return []
    return await kr_data_manager.get_pullback_stocks(date, days_ago, category)


@router.get("/consecutive")
async def get_consecutive_rise_stocks(
    date: str = Query(..., description="기준 날짜"),
    days: int = Query(2, description="연속 상승 일수 (2~4)"),
    category: str = Query("trading_value", description="카테고리")
):
    """연속 상승 종목 반환"""
    if kr_data_manager is None:
        return []
    return await kr_data_manager.get_consecutive_rise_stocks(date, days, category)


@router.get("/52week-high")
async def get_52week_high_stocks(
    date: str = Query(..., description="기준 날짜"),
    consolidation_days: int = Query(0, description="횡보 기간 (영업일, 0=필터 없음)"),
    range_pct: float = Query(0.0, description="진폭 상한 (%)"),
    category: str = Query("trading_value", description="카테고리"),
):
    """처음으로 52주 신고가를 달성한 종목 반환"""
    if kr_data_manager is None:
        return []
    return await kr_data_manager.get_52week_high_stocks(
        date, consolidation_days, range_pct, category)


@router.get("/history")
async def get_stock_history(
    code: str = Query(..., description="종목코드"),
    days: int = Query(90, description="조회 기간 (일)"),
    end_date: Optional[str] = Query(None, description="기준 날짜"),
    interval: str = Query("daily", description="봉 간격 (daily/weekly/monthly)")
):
    """종목 차트 데이터 반환"""
    if kr_data_manager is None:
        return {"line": [], "candle": [], "volume": [], "change": {},
                "ma20": [], "ma240": [], "end_date": end_date}
    return await kr_data_manager.get_stock_history(code, days, end_date, interval)


@router.get("/overview")
async def get_stock_overview(
    code: str = Query(..., description="종목코드")
):
    """종목 기업개요 반환"""
    if kr_data_manager is None:
        return {'ticker': code, 'industry': '', 'overview': ''}
    return await kr_data_manager.get_stock_overview(code)


@router.get("/earnings")
async def get_stock_earnings(
    code: str = Query(..., description="종목코드")
):
    """종목 실적 데이터 반환"""
    if kr_data_manager is None:
        return []
    return await kr_data_manager.get_stock_earnings(code)


@router.get("/financials")
async def get_stock_financials(
    code: str = Query(..., description="종목코드")
):
    """종목 재무제표 데이터 반환"""
    if kr_data_manager is None:
        return []
    return await kr_data_manager.get_stock_financials(code)


@router.get("/tickers")
async def get_all_tickers():
    """전체 종목 목록 반환 (클라이언트 사이드 검색용)"""
    if kr_data_manager is None:
        return []
    return await kr_data_manager.get_all_tickers()


@router.get("/search")
async def search_stock(
    q: str = Query(..., description="검색어"),
    limit: int = Query(50, description="최대 결과 수")
):
    """종목 검색"""
    if kr_data_manager is None:
        return []
    return await kr_data_manager.search_stocks(q, limit)


@router.get("/gap-analysis")
async def get_gap_analysis(
    start_date: str = Query(..., description="시작일 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="종료일 (YYYY-MM-DD)"),
    base_price: str = Query("prev_close", description="기준 가격"),
    compare_price: str = Query("open", description="비교 가격"),
    min_rate: float = Query(3.0, description="최소 상승률 (%)"),
    max_rate: float = Query(99999.0, description="최대 상승률 (%)"),
    extra_base: Optional[str] = Query(None),
    extra_compare: Optional[str] = Query(None),
    extra_direction: Optional[str] = Query(None),
    detail_base: Optional[str] = Query(None),
    detail_compare: Optional[str] = Query(None),
    detail_direction: Optional[str] = Query(None),
    ticker_filter: Optional[str] = Query(None, description="종목 필터"),
    direction: str = Query("up", description="방향 (up/down)")
):
    """갭 상승/하락 분석 데이터 조회"""
    if kr_data_manager is None:
        return []
    return await kr_data_manager.get_gap_analysis(
        start_date, end_date, base_price, compare_price, min_rate, max_rate,
        extra_base, extra_compare, extra_direction,
        detail_base, detail_compare, detail_direction,
        ticker_filter, direction
    )


@router.get("/new-listings")
async def get_new_listings(
    start_date: str = Query(..., description="시작일 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="종료일 (YYYY-MM-DD)"),
):
    """신규 상장 종목 조회"""
    if kr_data_manager is None:
        return []
    return await kr_data_manager.get_new_listings(start_date, end_date)
