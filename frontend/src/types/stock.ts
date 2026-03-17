// 마켓 타입
export type Market = 'kr' | 'us';

// 시장 지표 요약
export interface MarketIndexSummary {
  ticker: string;
  name: string;
  close: number;
  change_rate: number;
  open: number;
  high: number;
  low: number;
  sparkline: number[];
  date?: string;
}

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
  ma240_position?: 'above' | 'below' | null;
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
  ma240_position?: 'above' | 'below' | null;
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
  ma240_position?: 'above' | 'below' | null;
}

// 52주 신고가 종목
export interface WeekHigh52Stock {
  순위: number;
  종목코드?: string;
  티커?: string;
  종목명: string;
  전일대비변동률: number;
  종가: number;
  거래대금: number;
  ma240_position?: 'above' | 'below' | null;
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
  is_52week_high: boolean;
}

// 신규 상장 결과
export interface NewListingResult {
  날짜: string;       // 상장일 (YYYY-MM-DD)
  티커: string;
  종목명: string;
  시가: number;       // 상장 당일 시가
  종가: number;
  등락률: number;     // (종가 - 시가) / 시가 * 100
  거래대금: number;
}

// 기업개요
export interface StockOverview {
  ticker: string;
  industry: string;
  overview: string;
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

// 실적 데이터 (미국: EPS+매출, 한국: 매출+영업이익)
export interface EarningsData {
  티커?: string;           // 미국 주식
  종목코드?: string;       // 한국 주식
  분기: string;
  // 미국 주식용
  EPS?: number | null;
  EPS예상?: number | null;
  EPS서프라이즈?: number | null;
  // 공통
  매출: number | null;
  매출예상: number | null;
  매출서프라이즈: number | null;
  // 한국 주식용
  영업이익?: number | null;
  영업이익예상?: number | null;
  영업이익서프라이즈?: number | null;
}

// 재무제표 데이터
export interface FinancialsData {
  fiscal_date: string;
  period_type: string;       // 'FY', 'Q1', 'Q2', 'Q3', 'Q4'
  revenue: number | null;
  gross_profit: number | null;
  operating_income: number | null;
  net_income: number | null;
  eps: number | null;
  total_assets: number | null;
  total_liabilities: number | null;
  total_equity: number | null;
  cash_from_operating: number | null;
  cash_from_investing: number | null;
  cash_from_financing: number | null;
  currency: string;
}

// API 응답
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── 백테스팅 ───────────────────────────────────────

export interface BacktestCondition {
  left: string;
  left_param?: number;
  left_val?: number;
  op: string;
  right: string;
  right_param?: number;
  right_val?: number;
  multiplier?: number;
}

export type BacktestConditionItem = BacktestCondition | { logic: 'AND' | 'OR' };

export interface BacktestExitParams {
  hold_days?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
}

export interface BacktestRequest {
  market: 'kr' | 'us';
  conditions: BacktestConditionItem[] | string;
  exit_params?: BacktestExitParams;
  initial_cash?: number;
  start_date: string;
  end_date: string;
  ticker?: string;
  run_walk_forward?: boolean;
  run_monte_carlo?: boolean;
}

export interface BacktestTrade {
  ticker: string;
  name?: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  shares: number;
  pnl: number;
  pnl_pct: number;
  reason: string;
}

export interface BacktestMetrics {
  total_return: number;
  cagr: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  volatility: number;
  calmar_ratio: number;
  total_trades: number;
  win_rate: number;
  profit_factor: number | null;
  information_ratio: number | null;
  expected_value: number;
  reliability: 'low' | 'medium' | 'high';
}

export interface WalkForwardWindow {
  train_period: string;
  test_period: string;
  in_sample_return: number;
  out_of_sample_return: number;
}

export interface WalkForwardResult {
  in_sample_avg: number | null;
  out_of_sample_avg: number | null;
  overfitting_gap: number | null;
  windows: WalkForwardWindow[];
}

export interface MonteCarloResult {
  median: number | null;
  percentile_5: number | null;
  percentile_95: number | null;
  loss_probability: number | null;
}

export interface BacktestResult {
  equity_curve: { date: string; value: number }[];
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  walk_forward: WalkForwardResult | null;
  monte_carlo: MonteCarloResult | null;
}

export interface BacktestProgressResponse {
  status: 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE';
  current?: number;
  total?: number;
  step?: string;
  result?: BacktestResult;
  error?: string;
}

export interface BacktestPreset {
  id: string;
  label: string;
  description: string;
  exit: BacktestExitParams;
  editable_params: Record<string, { label: string; default: number; min: number; max: number }>;
}

// ─── 스크리닝 기반 백테스팅 ──────────────────────────────────────────────────

export type ScreeningCondition =
  | 'frequent'
  | 'pullback'
  | 'consecutive'
  | '52week_high'
  | 'gap_up'
  | 'gap_down'
  | 'ipo';

export interface BacktestScreeningParams {
  condition: ScreeningCondition;
  date_mode: 'single' | 'range';
  date?: string;        // date_mode === 'single'
  start_date?: string;  // date_mode === 'range'
  end_date?: string;
  // 공통
  category?: string;
  ma_filter?: 'all' | 'above' | 'below';
  price_range?: 'all' | 'high' | 'mid' | 'low';  // US only
  top_n?: 5 | 8 | 10 | 15 | 30 | 50;
  tickers?: string[];
  // 빈출
  weeks?: number;
  // 눌림목
  days_ago?: number;
  // 연속상승
  consecutive_days?: number;
  // 52주 신고가
  consolidation_days?: number;
  range_pct?: number;
  // 갭 상승/하락
  base_price?: string;
  compare_price?: string;
  min_rate?: number;
  max_rate?: number;
  extra_base?: string;
  extra_compare?: string;
  extra_direction?: string;
  detail_base?: string;
  detail_compare?: string;
  detail_direction?: string;
  high_filter?: 'all' | 'high' | 'not_high';  // 갭 상승만
}

export interface BacktestEntryConfig {
  days_after: number;   // 0~5
  price: 'open' | 'close';
}

export interface BacktestScreeningRequest {
  market: 'kr' | 'us';
  screening: BacktestScreeningParams;
  entry: BacktestEntryConfig;
  exit: {
    hold_days: number;
    hold_unit?: 'days' | 'months' | 'years';
    stop_loss?: number | null;
    take_profit?: number | null;
  };
  initial_cash?: number;
  run_walk_forward?: boolean;
  run_monte_carlo?: boolean;
  wf_train_years?: number;
  wf_test_years?: number;
}
