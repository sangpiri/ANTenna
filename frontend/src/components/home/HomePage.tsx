import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { indicesApi } from '../../services/api';
import IndexCard from './IndexCard';
import MacroCard from './MacroCard';
import IndexChartModal from './IndexChartModal';
import type { MarketIndexSummary } from '../../types/stock';

interface HomePageProps {
  onStart: () => void;
}

interface Section {
  label: string;
  market: string[];
  macro: string[];
}

const SECTIONS: Section[] = [
  {
    label: '공통 지표',
    market: ['GC=F', 'SI=F', 'HG=F', 'CL=F', 'BTC-USD'],
    macro: [],
  },
  {
    label: '미국 지표',
    market: ['^GSPC', '^IXIC', 'DX-Y.NYB'],
    macro: ['DFEDTARU', 'DGS3', 'DGS10', 'CPIAUCSL', 'UNRATE', 'GDPC1'],
  },
  {
    label: '한국 지표',
    market: ['^KS11', '^KQ11', 'USDKRW=X'],
    macro: ['KR-BASE-RATE', 'KR-3Y', 'KR-10Y', 'KR-CPI', 'KR-UNRATE', 'KR-GDP'],
  },
];

// 스켈레톤 카드 (시장 지표용, 스파크라인 포함)
function SkeletonCard() {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 animate-pulse">
      <div className="flex justify-between mb-2">
        <div className="h-4 bg-gray-700 rounded w-2/3" />
        <div className="h-4 bg-gray-700 rounded w-12" />
      </div>
      <div className="h-10 bg-gray-700 rounded my-2" />
      <div className="flex justify-between">
        <div className="h-4 bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-700 rounded w-14" />
      </div>
    </div>
  );
}

// 스켈레톤 카드 (거시경제 지표용)
function MacroSkeletonCard() {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-3 bg-gray-700 rounded w-2/3" />
        <div className="h-3 bg-gray-700 rounded w-12" />
      </div>
      <div className="flex justify-between">
        <div className="h-5 bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-700 rounded w-14" />
      </div>
    </div>
  );
}

export default function HomePage({ onStart }: HomePageProps) {
  const [showLogo, setShowLogo] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<{
    ticker: string;
    name: string;
  } | null>(null);

  const { data: indices, isLoading } = useQuery({
    queryKey: ['indices', 'list'],
    queryFn: indicesApi.getList,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const indexMap: Record<string, MarketIndexSummary> = {};
  if (indices) {
    for (const idx of indices) {
      indexMap[idx.ticker] = idx;
    }
  }

  return (
    <div className="flex flex-col">
      {/* Hero 섹션 */}
      <div className="flex flex-col items-center justify-center pt-10 pb-8 px-4 text-center">
        <img
          src="/logo.png"
          alt="ANTenna"
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl mb-4 shadow-lg cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowLogo(true)}
        />
        <h1 className="text-3xl sm:text-4xl font-bold text-blue-400 mb-1">ANTenna</h1>
        <p className="text-gray-400 text-sm sm:text-base mb-6">Stock Calendar &amp; Search &amp; Backtesting</p>
        <button
          onClick={onStart}
          className="bg-green-700 hover:bg-green-600 text-white font-semibold px-8 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm sm:text-base"
        >
          시작하기
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="mt-6 bg-gray-800/60 border border-gray-700 rounded-lg px-5 py-3.5 max-w-sm">
          <p className="text-xs font-semibold text-gray-300 mb-2">📡 데이터 업데이트 시간 (KST)</p>
          <div className="text-xs text-gray-400 leading-relaxed space-y-0.5">
            <p>시장 지표: 매일 07:10, 16:40</p>
            <p>미국 주식: 화~토 01:10, 02:10, 05:40, 06:40</p>
            <p>한국 주식: 월~금 10:40, 12:40, 14:40, 16:10</p>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">위 시간에 최신 데이터로 업데이트됩니다.</p>
        </div>
      </div>

      {/* 지표 섹션들 */}
      <div className="max-w-5xl mx-auto w-full px-4 pb-6 space-y-5">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200 mb-2">
              <span className="w-1 h-4 bg-green-600 rounded-full flex-shrink-0" />
              {section.label}
            </h2>

            {/* 시장 지표 (IndexCard with sparkline) */}
            <div
              className={`grid gap-2.5 ${
                section.market.length === 5
                  ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                  : 'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              {section.market.map((ticker) => {
                const summary = indexMap[ticker];
                if (isLoading || !summary) {
                  return <SkeletonCard key={ticker} />;
                }
                return (
                  <IndexCard
                    key={ticker}
                    summary={summary}
                    onClick={() =>
                      setSelectedIndex({ ticker: summary.ticker, name: summary.name })
                    }
                  />
                );
              })}
            </div>

            {/* 거시경제 지표 (MacroCard) */}
            {section.macro.length > 0 && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {section.macro.map((ticker) => {
                  const summary = indexMap[ticker];
                  if (isLoading || !summary) {
                    return <MacroSkeletonCard key={ticker} />;
                  }
                  return (
                    <MacroCard
                      key={ticker}
                      summary={summary}
                      onClick={() =>
                        setSelectedIndex({ ticker: summary.ticker, name: summary.name })
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 차트 모달 - 항상 마운트, isOpen으로 표시 제어 (StrictMode 호환) */}
      <IndexChartModal
        isOpen={!!selectedIndex}
        onClose={() => setSelectedIndex(null)}
        ticker={selectedIndex?.ticker ?? ''}
        name={selectedIndex?.name ?? ''}
      />

      {/* 로고 모달 */}
      {showLogo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
          onClick={() => setShowLogo(false)}
        >
          <div className="relative">
            <img
              src="/logo.png"
              alt="ANTenna"
              className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowLogo(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
