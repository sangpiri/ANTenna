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
  SearchResult,
  Folder,
  Favorite,
  FavoriteCheckResponse,
  GapAnalysisResult,
} from '../types/stock';

// API 기본 URL (개발 모드에서는 프록시 사용, 프로덕션에서는 같은 서버)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

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

  getHistory: async (code: string, days = 90, endDate?: string): Promise<StockHistory> => {
    const { data } = await api.get('/api/kr/history', {
      params: { code, days, end_date: endDate },
    });
    return data;
  },

  search: async (q: string, limit = 50): Promise<SearchResult[]> => {
    const { data } = await api.get('/api/kr/search', { params: { q, limit } });
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

  getHistory: async (ticker: string, days = 90, endDate?: string): Promise<StockHistory> => {
    const { data } = await api.get('/api/us/history', {
      params: { ticker, days, end_date: endDate },
    });
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
    tickerFilter?: string
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
      },
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

export default api;
