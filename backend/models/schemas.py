"""
Pydantic 스키마 정의
"""
from pydantic import BaseModel
from typing import Optional
from datetime import date


# --- 공통 스키마 ---
class StockRecord(BaseModel):
    """주식 데이터 레코드"""
    날짜: str
    종목코드: Optional[str] = None  # 한국주식
    티커: Optional[str] = None  # 미국주식
    종목명: str
    시가: float
    고가: float
    저가: float
    종가: float
    거래량: Optional[float] = None
    거래대금: float
    전일대비변동률: float

    class Config:
        from_attributes = True


class ChartPoint(BaseModel):
    """차트 데이터 포인트"""
    time: str
    value: float


class CandlePoint(BaseModel):
    """캔들스틱 데이터 포인트"""
    time: str
    open: float
    high: float
    low: float
    close: float


class VolumePoint(BaseModel):
    """거래대금 데이터 포인트"""
    time: str
    value: float
    color: str


class StockHistoryResponse(BaseModel):
    """차트 히스토리 응답"""
    line: list[ChartPoint]
    candle: list[CandlePoint]
    volume: list[VolumePoint]
    change: dict[str, float]
    ma20: list[ChartPoint]
    ma240: list[ChartPoint]
    end_date: Optional[str] = None


# --- 한국주식 스키마 ---
class KrDayDataResponse(BaseModel):
    """한국주식 일별 데이터 응답"""
    trading_value: list[dict]
    change_rate: list[dict]


class FrequentStockItem(BaseModel):
    """빈출 종목 항목"""
    순위: int
    종목코드: Optional[str] = None
    티커: Optional[str] = None
    종목명: str
    등장횟수: int
    기간영업일수: int
    최근거래대금: int


class PullbackStockItem(BaseModel):
    """눌림목 종목 항목"""
    순위: int
    종목코드: Optional[str] = None
    티커: Optional[str] = None
    종목명: str
    기준일변동률: float
    당일변동률: float
    당일종가: float
    당일거래대금: int


class ConsecutiveStockItem(BaseModel):
    """연속 상승 종목 항목"""
    순위: int
    종목코드: Optional[str] = None
    티커: Optional[str] = None
    종목명: str
    연속일수: int
    누적변동률: float
    시작가: float
    당일종가: float
    당일변동률: float
    당일거래대금: int


# --- 미국주식 스키마 ---
class UsDayDataResponse(BaseModel):
    """미국주식 일별 데이터 응답 (가격대별)"""
    high_price_volume: list[dict]
    high_price_rate: list[dict]
    mid_price_volume: list[dict]
    mid_price_rate: list[dict]
    low_price_volume: list[dict]
    low_price_rate: list[dict]


# --- 사용자 데이터 스키마 ---
class Folder(BaseModel):
    """폴더"""
    id: str
    name: str
    order: int = 0


class FavoriteStock(BaseModel):
    """즐겨찾기 종목"""
    code: str  # 종목코드 또는 티커
    name: str
    market: str  # 'kr' 또는 'us'
    folder_id: str
    order: int = 0
    added_date: str


class StockMemo(BaseModel):
    """종목 메모"""
    code: str
    market: str
    content: str
    updated_date: str


class FolderCreateRequest(BaseModel):
    """폴더 생성 요청"""
    name: str


class FolderUpdateRequest(BaseModel):
    """폴더 수정 요청"""
    id: str
    name: Optional[str] = None
    order: Optional[int] = None


class FolderDeleteRequest(BaseModel):
    """폴더 삭제 요청"""
    id: str


class FavoriteAddRequest(BaseModel):
    """즐겨찾기 추가 요청"""
    code: str
    name: str
    market: str
    folder_id: str


class FavoriteRemoveRequest(BaseModel):
    """즐겨찾기 제거 요청"""
    code: str
    market: str


class FavoriteMoveRequest(BaseModel):
    """즐겨찾기 이동 요청"""
    code: str
    market: str
    target_folder_id: str


class MemoSaveRequest(BaseModel):
    """메모 저장 요청"""
    code: str
    market: str
    content: str


class UserDataResponse(BaseModel):
    """사용자 데이터 전체 응답"""
    folders: list[Folder]
    favorites: list[FavoriteStock]
    memos: list[StockMemo]
