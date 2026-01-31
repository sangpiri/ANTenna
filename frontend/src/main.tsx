import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 데이터가 "신선"하다고 간주되는 시간 (이 시간 동안은 refetch 안함)
      staleTime: 1000 * 60 * 5, // 5분
      // 캐시에 데이터를 유지하는 시간 (메모리)
      gcTime: 1000 * 60 * 30, // 30분 (구 cacheTime)
      // 재시도 횟수
      retry: 1,
      // 윈도우 포커스 시 refetch 비활성화
      refetchOnWindowFocus: false,
      // 마운트 시 refetch (stale인 경우만)
      refetchOnMount: true,
      // 네트워크 재연결 시 refetch
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
