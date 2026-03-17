import { useState, useEffect, useRef } from 'react';
import type {
  Market,
  BacktestScreeningRequest,
  BacktestResult,
  BacktestProgressResponse,
} from '../../types/stock';
import { backtestApi } from '../../services/api';
import BacktestConditionPanel from './BacktestConditionPanel';
import BacktestResultPanel from './BacktestResultPanel';
import ChartModal from '../common/ChartModal';

interface User {
  role: 'user' | 'premium' | 'admin';
}

interface Props {
  market: Market;
  user: User | null;
}

const POLL_INTERVAL_MS = 2000;

export default function BacktestView({ market, user }: Props) {
  const isPremium = user?.role === 'premium' || user?.role === 'admin';

  const [status,   setStatus]   = useState<BacktestProgressResponse['status'] | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; step: string } | undefined>();
  const [result,   setResult]   = useState<BacktestResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [mobileTab, setMobileTab] = useState<'condition' | 'result'>('condition');
  const [chartModal, setChartModal] = useState<{ ticker: string; name: string; entryDate: string } | null>(null);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskIdRef = useRef<string | null>(null);

  // market 변경 시 결과 초기화
  useEffect(() => {
    setStatus(null);
    setResult(null);
    setError(null);
    setProgress(undefined);
  }, [market]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (taskId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await backtestApi.getResult(taskId);
        setStatus(res.status);

        if (res.status === 'PROGRESS') {
          setProgress({ current: res.current ?? 0, total: res.total ?? 100, step: res.step ?? '' });
        } else if (res.status === 'SUCCESS') {
          stopPolling();
          setResult(res.result ?? null);
          setLoading(false);
        } else if (res.status === 'FAILURE') {
          stopPolling();
          setError(res.error ?? '백테스팅 실행 중 오류가 발생했습니다.');
          setLoading(false);
        }
      } catch {
        stopPolling();
        setError('결과 조회 중 오류가 발생했습니다.');
        setLoading(false);
      }
    }, POLL_INTERVAL_MS);
  };

  const handleSubmit = async (req: BacktestScreeningRequest) => {
    setLoading(true);
    setStatus('STARTED');
    setResult(null);
    setError(null);
    setProgress(undefined);
    stopPolling();
    setMobileTab('result');

    try {
      const { task_id } = await backtestApi.requestScreeningBacktest(req);
      taskIdRef.current = task_id;
      startPolling(task_id);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        '요청 중 오류가 발생했습니다.';
      setError(msg);
      setStatus('FAILURE');
      setLoading(false);
    }
  };

  // 언마운트 시 폴링 중지
  useEffect(() => () => stopPolling(), []);

  return (
    <>
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] overflow-hidden">
      {/* 모바일 탭 바 */}
      <div className="flex md:hidden flex-shrink-0 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => setMobileTab('condition')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            mobileTab === 'condition'
              ? 'text-white border-b-2 border-sky-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          조건 설정
        </button>
        <button
          onClick={() => setMobileTab('result')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            mobileTab === 'result'
              ? 'text-white border-b-2 border-sky-500'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          결과
        </button>
      </div>

      {/* 좌측: 조건 패널 */}
      <div className={`${mobileTab === 'condition' ? 'flex-1' : 'hidden'} md:flex md:flex-[2] flex-col min-w-0 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto`}>
        <div className="hidden md:block text-sm font-semibold text-gray-200 mb-4">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            조건 설정
          </span>
        </div>
        <BacktestConditionPanel
          market={market}
          onSubmit={handleSubmit}
          loading={loading}
          isPremium={isPremium}
        />
      </div>

      {/* 우측: 결과 패널 */}
      <div className={`${mobileTab === 'result' ? 'flex-1' : 'hidden'} md:flex md:flex-[3] flex-col min-w-0 p-4 overflow-y-auto`}>
        <div className="hidden md:block text-sm font-semibold text-gray-200 mb-4">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            결과
          </span>
        </div>
        <BacktestResultPanel
          status={status}
          progress={progress}
          result={result}
          error={error}
          market={market}
          onTickerClick={(ticker, name, entryDate) => setChartModal({ ticker, name, entryDate })}
        />
      </div>
    </div>

    <ChartModal
      isOpen={!!chartModal}
      onClose={() => setChartModal(null)}
      stockCode={chartModal?.ticker ?? ''}
      stockName={chartModal?.name ?? chartModal?.ticker ?? ''}
      market={market}
      baseDate={chartModal?.entryDate}
    />
    </>
  );
}
