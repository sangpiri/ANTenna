// 마켓 타입
export type Market = 'kr' | 'us';

// 카테고리 타입
export type KrCategory = 'trading_value' | 'change_rate';
export type UsCategory =
  | 'high_price_volume' | 'high_price_rate'
  | 'mid_price_volume' | 'mid_price_rate'
  | 'low_price_volume' | 'low_price_rate';

// 주식 레코드
export interface StockRecord {
  날짜: string;
  종목코드?: string;  // 한국주식
  티커?: string;      // 미국주식
  종목명: string;
  시가: number;
  고가: number;
  저가: number;
  종가: number;
  거래량?: number;
  거래대금: number;
  '전일대비변동률(%)'?: number;
}

// 차트 데이터
export interface ChartPoint {
  time: string;
  value: number;
}

export interface CandlePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumePoint {
  time: string;
  value: number;
  color: string;
}

export interface StockHistory {
  line: ChartPoint[];
  candle: CandlePoint[];
  volume: VolumePoint[];
  change: Record<string, number>;
  ma20: ChartPoint[];
  ma240: ChartPoint[];
  end_date: string | null;
}

// 한국주식 일별 데이터
export interface KrDayData {
  trading_value: StockRecord[];
  change_rate: StockRecord[];
}

// 미국주식 일별 데이터 (가격대별)
export interface UsDayData {
  high_price_volume: StockRecord[];
  high_price_rate: StockRecord[];
  mid_price_volume: StockRecord[];
  mid_price_rate: StockRecord[];
  low_price_volume: StockRecord[];
  low_price_rate: StockRecord[];
}

// 날짜 정보
export interface DatesInfo {
  dates: string[];
  initial_year: number;
  initial_month: number;
  min_year: number;
  max_year: number;
}

// 빈출 종목
export interface FrequentStock {
  순위: number;
  종목코드?: string;
  티커?: string;
  종목명: string;
  등장횟수: number;
  기간영업일수: number;
  최근거래대금: number;
}

// 눌림목 종목
export interface PullbackStock {
  순위: number;
  종목코드?: string;
  티커?: string;
  종목명: string;
  전일대비변동률: number;
  종가: number;
  거래대금: number;
  기준일: string;
}

// 연속 상승 종목
export interface ConsecutiveStock {
  순위: number;
  종목코드?: string;
  티커?: string;
  종목명: string;
  전일대비변동률: number;
  종가: number;
  거래대금: number;
  연속일수: number;
}

// 검색 결과
export interface SearchResult {
  code: string;
  name: string;
}

// 갭 분석 결과
export interface GapAnalysisResult {
  날짜: string;
  티커: string;
  종목명: string;
  종가: number;
  등락률: number;
  거래대금: number;
  ma240: number | null;
  ma240_position: 'above' | 'below' | null;
}

// 폴더
export interface Folder {
  id: string;
  name: string;
  count?: number;
}

// 즐겨찾기
export interface Favorite {
  code: string;
  name: string;
  market: Market;
  folder_id?: string;
  added_date?: string;
}

// 메모
export interface Memo {
  code: string;
  market: Market;
  content: string;
  updated_date?: string;
}

// 즐겨찾기 체크 응답
export interface FavoriteCheckResponse {
  is_favorite: boolean;
  folder_id: string | null;
  folder_name: string | null;
}

// API 응답
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
