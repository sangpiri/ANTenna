import axios from 'axios';
import type {
  Market,
  KrDayData,
  UsDayData,
  DatesInfo,
  StockHistory,
  FrequentStock,
  PullbackStock,
  ConsecutiveStock,
  WeekHigh52Stock,
  SearchResult,
  StockOverview,
  Folder,
  Favorite,
  FavoriteCheckResponse,
  GapAnalysisResult,
  NewListingResult,
  EarningsData,
  FinancialsData,
  BacktestRequest,
  BacktestProgressResponse,
  BacktestPreset,
  BacktestScreeningRequest,
  MarketIndexSummary,
} from '../types/stock';

// API 기본 URL (개발 모드에서는 프록시 사용, 프로덕션에서는 같은 서버)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
});

// JWT 토큰 자동 첨부
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 응답 처리
// /api/user/* 는 로그인 필요 기능이므로 리로드 없이 조용히 reject
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const url: string = error.config?.url || '';
      if (!url.includes('/api/user/')) {
        localStorage.removeItem('token');
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

// --- 한국주식 API ---
export const krApi = {
  getDates: async (): Promise<DatesInfo> => {
    const { data } = await api.get('/api/kr/dates');
    return data;
  },

  getData: async (date: string): Promise<KrDayData> => {
    const { data } = await api.get('/api/kr/data', { params: { date } });
    return data;
  },

  getHistory: async (code: string, days = 90, endDate?: string, interval = 'daily'): Promise<StockHistory> => {
    const { data } = await api.get('/api/kr/history', {
      params: { code, days, end_date: endDate, interval },
    });
    return data;
  },

  getTickers: async (): Promise<SearchResult[]> => {
    const { data } = await api.get('/api/kr/tickers');
    return data;
  },

  search: async (q: string, limit = 50): Promise<SearchResult[]> => {
    const { data } = await api.get('/api/kr/search', { params: { q, limit } });
    return data;
  },

  getOverview: async (code: string): Promise<StockOverview> => {
    const { data } = await api.get('/api/kr/overview', { params: { code } });
    return data;
  },

  getEarnings: async (code: string): Promise<EarningsData[]> => {
    const { data } = await api.get('/api/kr/earnings', { params: { code } });
    return data;
  },

  getFinancials: async (code: string): Promise<FinancialsData[]> => {
    const { data } = await api.get('/api/kr/financials', { params: { code } });
    return data;
  },

  getFrequent: async (date: string, weeks = 4, category = 'trading_value'): Promise<FrequentStock[]> => {
    const { data } = await api.get('/api/kr/frequent', {
      params: { date, weeks, category },
    });
    return data;
  },

  getPullback: async (date: string, daysAgo = 1, category = 'trading_value'): Promise<PullbackStock[]> => {
    const { data } = await api.get('/api/kr/pullback', {
      params: { date, days_ago: daysAgo, category },
    });
    return data;
  },

  getConsecutive: async (date: string, days = 2, category = 'trading_value'): Promise<ConsecutiveStock[]> => {
    const { data } = await api.get('/api/kr/consecutive', {
      params: { date, days, category },
    });
    return data;
  },

  get52WeekHigh: async (date: string, consolidationDays = 0, rangePct = 0, category = 'trading_value'): Promise<WeekHigh52Stock[]> => {
    const { data } = await api.get('/api/kr/52week-high', {
      params: { date, consolidation_days: consolidationDays, range_pct: rangePct, category },
    });
    return data;
  },

  getGapAnalysis: async (
    startDate: string,
    endDate: string,
    basePrice: string,
    comparePrice: string,
    minRate: number,
    maxRate: number,
    extraBase?: string,
    extraCompare?: string,
    extraDirection?: string,
    detailBase?: string,
    detailCompare?: string,
    detailDirection?: string,
    tickerFilter?: string,
    direction: 'up' | 'down' = 'up'
  ): Promise<GapAnalysisResult[]> => {
    const { data } = await api.get('/api/kr/gap-analysis', {
      params: {
        start_date: startDate,
        end_date: endDate,
        base_price: basePrice,
        compare_price: comparePrice,
        min_rate: minRate,
        max_rate: maxRate,
        extra_base: extraBase || undefined,
        extra_compare: extraCompare || undefined,
        extra_direction: extraDirection || undefined,
        detail_base: detailBase || undefined,
        detail_compare: detailCompare || undefined,
        detail_direction: detailDirection || undefined,
        ticker_filter: tickerFilter || undefined,
        direction,
      },
    });
    return data;
  },

  getNewListings: async (startDate: string, endDate: string): Promise<NewListingResult[]> => {
    const { data } = await api.get('/api/kr/new-listings', {
      params: { start_date: startDate, end_date: endDate },
    });
    return data;
  },
};

// --- 미국주식 API ---
export const usApi = {
  getDates: async (): Promise<DatesInfo> => {
    const { data } = await api.get('/api/us/dates');
    return data;
  },

  getData: async (date: string): Promise<UsDayData> => {
    const { data } = await api.get('/api/us/data', { params: { date } });
    return data;
  },

  getHistory: async (ticker: string, days = 90, endDate?: string, interval = 'daily'): Promise<StockHistory> => {
    const { data } = await api.get('/api/us/history', {
      params: { ticker, days, end_date: endDate, interval },
    });
    return data;
  },

  getTickers: async (): Promise<SearchResult[]> => {
    const { data } = await api.get('/api/us/tickers');
    return data;
  },

  search: async (q: string, limit = 50): Promise<SearchResult[]> => {
    const { data } = await api.get('/api/us/search', { params: { q, limit } });
    return data;
  },

  getFrequent: async (date: string, weeks = 4, category = 'high_price_volume'): Promise<FrequentStock[]> => {
    const { data } = await api.get('/api/us/frequent', {
      params: { date, weeks, category },
    });
    return data;
  },

  getPullback: async (date: string, daysAgo = 1, category = 'high_price_volume'): Promise<PullbackStock[]> => {
    const { data } = await api.get('/api/us/pullback', {
      params: { date, days_ago: daysAgo, category },
    });
    return data;
  },

  getConsecutive: async (date: string, days = 2, category = 'high_price_volume'): Promise<ConsecutiveStock[]> => {
    const { data } = await api.get('/api/us/consecutive', {
      params: { date, days, category },
    });
    return data;
  },

  get52WeekHigh: async (date: string, consolidationDays = 0, rangePct = 0, category = 'high_price_volume'): Promise<WeekHigh52Stock[]> => {
    const { data } = await api.get('/api/us/52week-high', {
      params: { date, consolidation_days: consolidationDays, range_pct: rangePct, category },
    });
    return data;
  },

  getOverview: async (ticker: string): Promise<StockOverview> => {
    const { data } = await api.get('/api/us/overview', { params: { ticker } });
    return data;
  },

  getEarnings: async (ticker: string): Promise<EarningsData[]> => {
    const { data } = await api.get('/api/us/earnings', { params: { ticker } });
    return data;
  },

  getFinancials: async (ticker: string): Promise<FinancialsData[]> => {
    const { data } = await api.get('/api/us/financials', { params: { ticker } });
    return data;
  },

  getGapAnalysis: async (
    startDate: string,
    endDate: string,
    basePrice: string,
    comparePrice: string,
    minRate: number,
    maxRate: number,
    extraBase?: string,
    extraCompare?: string,
    extraDirection?: string,
    detailBase?: string,
    detailCompare?: string,
    detailDirection?: string,
    tickerFilter?: string,
    direction: 'up' | 'down' = 'up'
  ): Promise<GapAnalysisResult[]> => {
    const { data } = await api.get('/api/us/gap-analysis', {
      params: {
        start_date: startDate,
        end_date: endDate,
        base_price: basePrice,
        compare_price: comparePrice,
        min_rate: minRate,
        max_rate: maxRate,
        extra_base: extraBase || undefined,
        extra_compare: extraCompare || undefined,
        extra_direction: extraDirection || undefined,
        detail_base: detailBase || undefined,
        detail_compare: detailCompare || undefined,
        detail_direction: detailDirection || undefined,
        ticker_filter: tickerFilter || undefined,
        direction,
      },
    });
    return data;
  },

  getNewListings: async (startDate: string, endDate: string): Promise<NewListingResult[]> => {
    const { data } = await api.get('/api/us/new-listings', {
      params: { start_date: startDate, end_date: endDate },
    });
    return data;
  },
};

// --- 사용자 API ---
export const userApi = {
  // 폴더
  getFolders: async (): Promise<Folder[]> => {
    const { data } = await api.get('/api/user/folders');
    return data;
  },

  createFolder: async (name: string): Promise<{ success: boolean; folder?: Folder }> => {
    const { data } = await api.post('/api/user/folder/create', { name });
    return data;
  },

  deleteFolder: async (folderId: string): Promise<{ success: boolean }> => {
    const { data } = await api.post('/api/user/folder/delete', { folder_id: folderId });
    return data;
  },

  renameFolder: async (folderId: string, newName: string): Promise<{ success: boolean }> => {
    const { data } = await api.post('/api/user/folder/rename', {
      folder_id: folderId,
      new_name: newName,
    });
    return data;
  },

  reorderFolders: async (folderIds: string[]): Promise<{ success: boolean }> => {
    const { data } = await api.post('/api/user/folder/reorder', { folder_ids: folderIds });
    return data;
  },

  // 즐겨찾기
  getFavorites: async (folderId = 'default'): Promise<Favorite[]> => {
    const { data } = await api.get('/api/user/favorites', { params: { folder_id: folderId } });
    return data;
  },

  getAllFavorites: async (): Promise<Favorite[]> => {
    const { data } = await api.get('/api/user/favorites/all');
    return data;
  },

  getFavoritePrices: async (items: { code: string; market: string }[]): Promise<Record<string, { close: number | null; change_rate: number | null; trading_value: number | null }>> => {
    const { data } = await api.post('/api/user/favorites/prices', { items });
    return data;
  },

  addFavorite: async (
    folderId: string,
    code: string,
    name: string,
    market: Market
  ): Promise<{ success: boolean }> => {
    const { data } = await api.post('/api/user/favorite/add', {
      folder_id: folderId,
      code,
      name,
      market,
    });
    return data;
  },

  removeFavorite: async (
    folderId: string,
    code: string,
    market: Market
  ): Promise<{ success: boolean }> => {
    const { data } = await api.post('/api/user/favorite/remove', {
      folder_id: folderId,
      code,
      market,
    });
    return data;
  },

  moveFavorite: async (
    code: string,
    fromFolder: string,
    toFolder: string,
    market: Market
  ): Promise<{ success: boolean }> => {
    const { data } = await api.post('/api/user/favorite/move', {
      code,
      from_folder: fromFolder,
      to_folder: toFolder,
      market,
    });
    return data;
  },

  checkFavorite: async (code: string, market: Market): Promise<FavoriteCheckResponse> => {
    const { data } = await api.get('/api/user/favorite/check', { params: { code, market } });
    return data;
  },

  reorderFavorites: async (folderId: string, favoriteKeys: string[]): Promise<{ success: boolean }> => {
    const { data } = await api.post('/api/user/favorite/reorder', {
      folder_id: folderId,
      favorite_keys: favoriteKeys,
    });
    return data;
  },

  // 메모
  getMemo: async (code: string, market: Market): Promise<{ memo: string }> => {
    const { data } = await api.get('/api/user/memo', { params: { code, market } });
    return data;
  },

  saveMemo: async (code: string, memo: string, market: Market): Promise<{ success: boolean }> => {
    const { data } = await api.post('/api/user/memo/save', { code, memo, market });
    return data;
  },

  deleteMemo: async (code: string, market: Market): Promise<{ success: boolean }> => {
    const { data } = await api.post('/api/user/memo/delete', { code, market });
    return data;
  },
};

// 마켓에 따른 API 선택
export const getMarketApi = (market: Market) => {
  return market === 'kr' ? krApi : usApi;
};

// --- 백테스팅 API ---
export const backtestApi = {
  getPresets: async (): Promise<BacktestPreset[]> => {
    const { data } = await api.get('/api/backtest/presets');
    return data;
  },

  requestBacktest: async (body: BacktestRequest): Promise<{ task_id: string }> => {
    const { data } = await api.post('/api/backtest', body);
    return data;
  },

  requestScreeningBacktest: async (body: BacktestScreeningRequest): Promise<{ task_id: string }> => {
    const { data } = await api.post('/api/backtest/screening', body);
    return data;
  },

  getResult: async (taskId: string): Promise<BacktestProgressResponse> => {
    const { data } = await api.get(`/api/backtest/${taskId}`);
    return data;
  },
};

// --- 시장 지표 API ---
export const indicesApi = {
  getList: async (): Promise<MarketIndexSummary[]> => {
    const { data } = await api.get('/api/indices/list');
    return data;
  },

  getHistory: async (ticker: string, interval = 'daily'): Promise<StockHistory> => {
    const { data } = await api.get(`/api/indices/history/${encodeURIComponent(ticker)}`, {
      params: { interval },
    });
    return data;
  },
};

export default api;
