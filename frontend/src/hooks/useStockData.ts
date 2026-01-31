import { useQuery, useQueryClient } from '@tanstack/react-query';
import { krApi, usApi } from '../services/api';
import type { Market, DatesInfo, KrDayData, UsDayData, StockHistory } from '../types/stock';

// 날짜 목록 조회 훅
export function useDates(market: Market) {
  return useQuery({
    queryKey: [market, 'dates'],
    queryFn: market === 'kr' ? krApi.getDates : usApi.getDates,
    staleTime: 1000 * 60 * 10, // 날짜 목록은 10분간 캐시
  });
}

// 일별 데이터 조회 훅 (한국)
export function useKrDayData(date: string | null | undefined) {
  return useQuery({
    queryKey: ['kr', 'data', date],
    queryFn: () => krApi.getData(date!),
    enabled: !!date,
    staleTime: 1000 * 60 * 5, // 5분
  });
}

// 일별 데이터 조회 훅 (미국)
export function useUsDayData(date: string | null | undefined) {
  return useQuery({
    queryKey: ['us', 'data', date],
    queryFn: () => usApi.getData(date!),
    enabled: !!date,
    staleTime: 1000 * 60 * 5,
  });
}

// 차트 히스토리 조회 훅
export function useStockHistory(
  market: Market,
  code: string,
  days: number = 90,
  endDate?: string
) {
  const api = market === 'kr' ? krApi : usApi;
  const queryFn = market === 'kr'
    ? () => krApi.getHistory(code, days, endDate)
    : () => usApi.getHistory(code, days, endDate);

  return useQuery({
    queryKey: [market, 'history', code, days, endDate],
    queryFn,
    enabled: !!code,
    staleTime: 1000 * 60 * 5,
  });
}

// 종목 검색 훅
export function useStockSearch(market: Market, query: string, limit: number = 20) {
  const api = market === 'kr' ? krApi : usApi;

  return useQuery({
    queryKey: [market, 'search', query],
    queryFn: () => api.search(query, limit),
    enabled: query.length >= 1,
    staleTime: 1000 * 60 * 1, // 검색 결과는 1분 캐시
  });
}

// 빈출 종목 조회 훅
export function useFrequentStocks(
  market: Market,
  date: string,
  weeks: number,
  category: string
) {
  const api = market === 'kr' ? krApi : usApi;

  return useQuery({
    queryKey: [market, 'frequent', date, weeks, category],
    queryFn: () => api.getFrequent(date, weeks, category),
    enabled: !!date,
    staleTime: 1000 * 60 * 5,
  });
}

// 눌림목 종목 조회 훅
export function usePullbackStocks(
  market: Market,
  date: string,
  daysAgo: number,
  category: string
) {
  const api = market === 'kr' ? krApi : usApi;

  return useQuery({
    queryKey: [market, 'pullback', date, daysAgo, category],
    queryFn: () => api.getPullback(date, daysAgo, category),
    enabled: !!date,
    staleTime: 1000 * 60 * 5,
  });
}

// 연속 상승 종목 조회 훅
export function useConsecutiveStocks(
  market: Market,
  date: string,
  days: number,
  category: string
) {
  const api = market === 'kr' ? krApi : usApi;

  return useQuery({
    queryKey: [market, 'consecutive', date, days, category],
    queryFn: () => api.getConsecutive(date, days, category),
    enabled: !!date,
    staleTime: 1000 * 60 * 5,
  });
}

// 날짜 데이터 프리페치 훅
export function usePrefetchDayData(market: Market) {
  const queryClient = useQueryClient();

  const prefetch = (date: string) => {
    const api = market === 'kr' ? krApi : usApi;
    queryClient.prefetchQuery({
      queryKey: [market, 'data', date],
      queryFn: () => market === 'kr' ? krApi.getData(date) : usApi.getData(date),
      staleTime: 1000 * 60 * 5,
    });
  };

  return { prefetch };
}
