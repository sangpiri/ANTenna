import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { krApi, usApi } from '../../services/api';
import type { Market, FrequentStock, PullbackStock, ConsecutiveStock } from '../../types/stock';

type AnalysisType = 'frequent' | 'pullback' | 'consecutive';

interface AnalysisTabsProps {
  market: Market;
  category: string;
  selectedDate: string;
  onStockClick: (code: string, name: string) => void;
}

// 정렬 가능한 헤더 컴포넌트
function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  align?: 'left' | 'right';
}) {
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-1 sm:px-3 py-1.5 sm:py-2 cursor-pointer hover:bg-gray-600 transition-colors whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {currentSortKey === sortKey && (
          <span className="text-blue-400">
            {sortDir === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </span>
    </th>
  );
}

function AnalysisTabs({ market, category, selectedDate, onStockClick }: AnalysisTabsProps) {
  const [activeTab, setActiveTab] = useState<AnalysisType>('frequent');
  const [frequentWeeks, setFrequentWeeks] = useState(4);
  const [pullbackDays, setPullbackDays] = useState(1);
  const [consecutiveDays, setConsecutiveDays] = useState(2);

  // 각 탭별 정렬 상태
  const [frequentSortKey, setFrequentSortKey] = useState<string | null>(null);
  const [frequentSortDir, setFrequentSortDir] = useState<'asc' | 'desc'>('desc');
  const [pullbackSortKey, setPullbackSortKey] = useState<string | null>(null);
  const [pullbackSortDir, setPullbackSortDir] = useState<'asc' | 'desc'>('desc');
  const [consecutiveSortKey, setConsecutiveSortKey] = useState<string | null>(null);
  const [consecutiveSortDir, setConsecutiveSortDir] = useState<'asc' | 'desc'>('desc');

  const api = market === 'kr' ? krApi : usApi;
  const codeKey = market === 'kr' ? '종목코드' : '티커';

  // 빈출 종목
  const { data: frequentData = [], isLoading: frequentLoading } = useQuery({
    queryKey: [market, 'frequent', selectedDate, frequentWeeks, category],
    queryFn: () => api.getFrequent(selectedDate, frequentWeeks, category),
    enabled: activeTab === 'frequent' && !!selectedDate,
  });

  // 눌림목 종목
  const { data: pullbackData = [], isLoading: pullbackLoading } = useQuery({
    queryKey: [market, 'pullback', selectedDate, pullbackDays, category],
    queryFn: () => api.getPullback(selectedDate, pullbackDays, category),
    enabled: activeTab === 'pullback' && !!selectedDate,
  });

  // 연속 상승 종목
  const { data: consecutiveData = [], isLoading: consecutiveLoading } = useQuery({
    queryKey: [market, 'consecutive', selectedDate, consecutiveDays, category],
    queryFn: () => api.getConsecutive(selectedDate, consecutiveDays, category),
    enabled: activeTab === 'consecutive' && !!selectedDate,
  });

  const tabs: { key: AnalysisType; label: string; tooltip?: string }[] = [
    { key: 'frequent', label: '빈출', tooltip: '상위 300위에 자주 등장하는 종목' },
    { key: 'pullback', label: '눌림목', tooltip: '기준일인 N일 전 상승 후, 당일 하락 중인 종목' },
    { key: 'consecutive', label: '연속 상승' },
  ];

  // 정렬 핸들러 (3단계: 내림차순 → 오름차순 → 해제)
  const handleFrequentSort = useCallback((key: string) => {
    if (frequentSortKey === key) {
      // 같은 컬럼 클릭: 3단계 순환
      if (frequentSortDir === 'desc') {
        setFrequentSortDir('asc');
      } else {
        // 오름차순 → 정렬 해제
        setFrequentSortKey(null);
        setFrequentSortDir('desc');
      }
    } else {
      // 다른 컬럼 클릭: 내림차순으로 시작
      setFrequentSortKey(key);
      setFrequentSortDir('desc');
    }
  }, [frequentSortKey, frequentSortDir]);

  const handlePullbackSort = useCallback((key: string) => {
    if (pullbackSortKey === key) {
      // 같은 컬럼 클릭: 3단계 순환
      if (pullbackSortDir === 'desc') {
        setPullbackSortDir('asc');
      } else {
        // 오름차순 → 정렬 해제
        setPullbackSortKey(null);
        setPullbackSortDir('desc');
      }
    } else {
      // 다른 컬럼 클릭: 내림차순으로 시작
      setPullbackSortKey(key);
      setPullbackSortDir('desc');
    }
  }, [pullbackSortKey, pullbackSortDir]);

  const handleConsecutiveSort = useCallback((key: string) => {
    if (consecutiveSortKey === key) {
      // 같은 컬럼 클릭: 3단계 순환
      if (consecutiveSortDir === 'desc') {
        setConsecutiveSortDir('asc');
      } else {
        // 오름차순 → 정렬 해제
        setConsecutiveSortKey(null);
        setConsecutiveSortDir('desc');
      }
    } else {
      // 다른 컬럼 클릭: 내림차순으로 시작
      setConsecutiveSortKey(key);
      setConsecutiveSortDir('desc');
    }
  }, [consecutiveSortKey, consecutiveSortDir]);

  // 정렬된 빈출 종목 데이터
  const sortedFrequentData = useMemo(() => {
    if (!frequentSortKey) return frequentData;

    return [...frequentData].sort((a, b) => {
      let aVal: any, bVal: any;

      if (frequentSortKey === codeKey) {
        aVal = a[codeKey as keyof FrequentStock];
        bVal = b[codeKey as keyof FrequentStock];
      } else if (frequentSortKey === '종목명') {
        aVal = a.종목명;
        bVal = b.종목명;
      } else if (frequentSortKey === '등장횟수') {
        aVal = a.등장횟수;
        bVal = b.등장횟수;
      } else if (frequentSortKey === '최근거래대금') {
        aVal = a.최근거래대금;
        bVal = b.최근거래대금;
      } else {
        return 0;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return frequentSortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      return frequentSortDir === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [frequentData, frequentSortKey, frequentSortDir, codeKey]);

  // 정렬된 눌림목 데이터
  const sortedPullbackData = useMemo(() => {
    if (!pullbackSortKey) return pullbackData;

    return [...pullbackData].sort((a, b) => {
      let aVal: any, bVal: any;

      if (pullbackSortKey === codeKey) {
        aVal = a[codeKey as keyof PullbackStock];
        bVal = b[codeKey as keyof PullbackStock];
      } else if (pullbackSortKey === '종목명') {
        aVal = a.종목명;
        bVal = b.종목명;
      } else if (pullbackSortKey === '전일대비변동률') {
        aVal = a.전일대비변동률;
        bVal = b.전일대비변동률;
      } else if (pullbackSortKey === '종가') {
        aVal = a.종가;
        bVal = b.종가;
      } else if (pullbackSortKey === '거래대금') {
        aVal = a.거래대금;
        bVal = b.거래대금;
      } else {
        return 0;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return pullbackSortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      return pullbackSortDir === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [pullbackData, pullbackSortKey, pullbackSortDir, codeKey]);

  // 정렬된 연속 상승 데이터
  const sortedConsecutiveData = useMemo(() => {
    if (!consecutiveSortKey) return consecutiveData;

    return [...consecutiveData].sort((a, b) => {
      let aVal: any, bVal: any;

      if (consecutiveSortKey === codeKey) {
        aVal = a[codeKey as keyof ConsecutiveStock];
        bVal = b[codeKey as keyof ConsecutiveStock];
      } else if (consecutiveSortKey === '종목명') {
        aVal = a.종목명;
        bVal = b.종목명;
      } else if (consecutiveSortKey === '연속일수') {
        aVal = a.연속일수;
        bVal = b.연속일수;
      } else if (consecutiveSortKey === '전일대비변동률') {
        aVal = a.전일대비변동률;
        bVal = b.전일대비변동률;
      } else if (consecutiveSortKey === '종가') {
        aVal = a.종가;
        bVal = b.종가;
      } else if (consecutiveSortKey === '거래대금') {
        aVal = a.거래대금;
        bVal = b.거래대금;
      } else {
        return 0;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return consecutiveSortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      return consecutiveSortDir === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [consecutiveData, consecutiveSortKey, consecutiveSortDir, codeKey]);

  const renderFrequentTable = () => (
    <div className="overflow-auto flex-1">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-gray-700 sticky top-0">
          <tr>
            <th className="px-1 sm:px-3 py-1.5 sm:py-2 text-left">#</th>
            <SortableHeader
              label={market === 'kr' ? '코드' : '티커'}
              sortKey={codeKey}
              currentSortKey={frequentSortKey}
              sortDir={frequentSortDir}
              onSort={handleFrequentSort}
            />
            <SortableHeader
              label="종목명"
              sortKey="종목명"
              currentSortKey={frequentSortKey}
              sortDir={frequentSortDir}
              onSort={handleFrequentSort}
            />
            <SortableHeader
              label="등장횟수"
              sortKey="등장횟수"
              currentSortKey={frequentSortKey}
              sortDir={frequentSortDir}
              onSort={handleFrequentSort}
              align="right"
            />
            <SortableHeader
              label="거래대금"
              sortKey="최근거래대금"
              currentSortKey={frequentSortKey}
              sortDir={frequentSortDir}
              onSort={handleFrequentSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {sortedFrequentData.map((stock, idx) => (
            <tr
              key={stock[codeKey as keyof FrequentStock] as string}
              onClick={() => onStockClick(
                stock[codeKey as keyof FrequentStock] as string,
                stock.종목명
              )}
              className="hover:bg-gray-700/50 cursor-pointer"
            >
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-gray-400">{idx + 1}</td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-base text-yellow-400 leading-tight">
                {market === 'kr' ? (
                  <>
                    <span className="sm:hidden block">{(stock[codeKey as keyof FrequentStock] as string)?.slice(0, 3)}<br/>{(stock[codeKey as keyof FrequentStock] as string)?.slice(3)}</span>
                    <span className="hidden sm:inline">{stock[codeKey as keyof FrequentStock] as string}</span>
                  </>
                ) : (
                  stock[codeKey as keyof FrequentStock] as string
                )}
              </td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2">{stock.종목명}</td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-right text-yellow-400">
                {stock.등장횟수}/{stock.기간영업일수}
              </td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-right text-gray-300">
                {market === 'kr'
                  ? stock.최근거래대금 >= 1e12
                    ? `${Math.floor(stock.최근거래대금 / 1e12)}조${Math.floor((stock.최근거래대금 % 1e12) / 1e8)}억`
                    : `${(stock.최근거래대금 / 1e8).toFixed(0)}억`
                  : stock.최근거래대금 >= 1e9
                    ? `$${(stock.최근거래대금 / 1e9).toFixed(1)}B`
                    : stock.최근거래대금 >= 1e6
                      ? `$${(stock.최근거래대금 / 1e6).toFixed(1)}M`
                      : stock.최근거래대금 >= 1e3
                        ? `$${(stock.최근거래대금 / 1e3).toFixed(1)}K`
                        : `$${stock.최근거래대금}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderPullbackTable = () => (
    <div className="overflow-auto flex-1">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-gray-700 sticky top-0">
          <tr>
            <th className="px-1 sm:px-3 py-1.5 sm:py-2 text-left">#</th>
            <SortableHeader
              label={market === 'kr' ? '코드' : '티커'}
              sortKey={codeKey}
              currentSortKey={pullbackSortKey}
              sortDir={pullbackSortDir}
              onSort={handlePullbackSort}
            />
            <SortableHeader
              label="종목명"
              sortKey="종목명"
              currentSortKey={pullbackSortKey}
              sortDir={pullbackSortDir}
              onSort={handlePullbackSort}
            />
            <SortableHeader
              label="등락률"
              sortKey="전일대비변동률"
              currentSortKey={pullbackSortKey}
              sortDir={pullbackSortDir}
              onSort={handlePullbackSort}
              align="right"
            />
            <SortableHeader
              label="종가"
              sortKey="종가"
              currentSortKey={pullbackSortKey}
              sortDir={pullbackSortDir}
              onSort={handlePullbackSort}
              align="right"
            />
            <SortableHeader
              label="거래대금"
              sortKey="거래대금"
              currentSortKey={pullbackSortKey}
              sortDir={pullbackSortDir}
              onSort={handlePullbackSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {sortedPullbackData.map((stock, idx) => (
            <tr
              key={stock[codeKey as keyof PullbackStock] as string}
              onClick={() => onStockClick(
                stock[codeKey as keyof PullbackStock] as string,
                stock.종목명
              )}
              className="hover:bg-gray-700/50 cursor-pointer"
            >
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-gray-400">{idx + 1}</td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-base text-yellow-400 leading-tight">
                {market === 'kr' ? (
                  <>
                    <span className="sm:hidden block">{(stock[codeKey as keyof PullbackStock] as string)?.slice(0, 3)}<br/>{(stock[codeKey as keyof PullbackStock] as string)?.slice(3)}</span>
                    <span className="hidden sm:inline">{stock[codeKey as keyof PullbackStock] as string}</span>
                  </>
                ) : (
                  stock[codeKey as keyof PullbackStock] as string
                )}
              </td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2">{stock.종목명}</td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-right text-blue-500">
                {stock.전일대비변동률.toFixed(2)}%
              </td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-right">
                {market === 'kr' ? stock.종가.toLocaleString() : `$${stock.종가}`}
              </td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-right text-gray-300">
                {market === 'kr'
                  ? stock.거래대금 >= 1e12
                    ? `${Math.floor(stock.거래대금 / 1e12)}조${Math.floor((stock.거래대금 % 1e12) / 1e8)}억`
                    : `${(stock.거래대금 / 1e8).toFixed(0)}억`
                  : stock.거래대금 >= 1e9
                    ? `$${(stock.거래대금 / 1e9).toFixed(1)}B`
                    : stock.거래대금 >= 1e6
                      ? `$${(stock.거래대금 / 1e6).toFixed(1)}M`
                      : stock.거래대금 >= 1e3
                        ? `$${(stock.거래대금 / 1e3).toFixed(1)}K`
                        : `$${stock.거래대금}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderConsecutiveTable = () => (
    <div className="overflow-auto flex-1">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-gray-700 sticky top-0">
          <tr>
            <th className="px-1 sm:px-3 py-1.5 sm:py-2 text-left">#</th>
            <SortableHeader
              label={market === 'kr' ? '코드' : '티커'}
              sortKey={codeKey}
              currentSortKey={consecutiveSortKey}
              sortDir={consecutiveSortDir}
              onSort={handleConsecutiveSort}
            />
            <SortableHeader
              label="종목명"
              sortKey="종목명"
              currentSortKey={consecutiveSortKey}
              sortDir={consecutiveSortDir}
              onSort={handleConsecutiveSort}
            />
            <SortableHeader
              label="등락률"
              sortKey="전일대비변동률"
              currentSortKey={consecutiveSortKey}
              sortDir={consecutiveSortDir}
              onSort={handleConsecutiveSort}
              align="right"
            />
            <SortableHeader
              label="종가"
              sortKey="종가"
              currentSortKey={consecutiveSortKey}
              sortDir={consecutiveSortDir}
              onSort={handleConsecutiveSort}
              align="right"
            />
            <SortableHeader
              label="거래대금"
              sortKey="거래대금"
              currentSortKey={consecutiveSortKey}
              sortDir={consecutiveSortDir}
              onSort={handleConsecutiveSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {sortedConsecutiveData.map((stock, idx) => (
            <tr
              key={stock[codeKey as keyof ConsecutiveStock] as string}
              onClick={() => onStockClick(
                stock[codeKey as keyof ConsecutiveStock] as string,
                stock.종목명
              )}
              className="hover:bg-gray-700/50 cursor-pointer"
            >
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-gray-400">{idx + 1}</td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-base text-yellow-400 leading-tight">
                {market === 'kr' ? (
                  <>
                    <span className="sm:hidden block">{(stock[codeKey as keyof ConsecutiveStock] as string)?.slice(0, 3)}<br/>{(stock[codeKey as keyof ConsecutiveStock] as string)?.slice(3)}</span>
                    <span className="hidden sm:inline">{stock[codeKey as keyof ConsecutiveStock] as string}</span>
                  </>
                ) : (
                  stock[codeKey as keyof ConsecutiveStock] as string
                )}
              </td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2">{stock.종목명}</td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-right text-red-500">
                +{stock.전일대비변동률.toFixed(2)}%
              </td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-right">
                {market === 'kr' ? stock.종가.toLocaleString() : `$${stock.종가}`}
              </td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-right text-gray-300">
                {market === 'kr'
                  ? stock.거래대금 >= 1e12
                    ? `${Math.floor(stock.거래대금 / 1e12)}조${Math.floor((stock.거래대금 % 1e12) / 1e8)}억`
                    : `${(stock.거래대금 / 1e8).toFixed(0)}억`
                  : stock.거래대금 >= 1e9
                    ? `$${(stock.거래대금 / 1e9).toFixed(1)}B`
                    : stock.거래대금 >= 1e6
                      ? `$${(stock.거래대금 / 1e6).toFixed(1)}M`
                      : stock.거래대금 >= 1e3
                        ? `$${(stock.거래대금 / 1e3).toFixed(1)}K`
                        : `$${stock.거래대금}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const isLoading =
    (activeTab === 'frequent' && frequentLoading) ||
    (activeTab === 'pullback' && pullbackLoading) ||
    (activeTab === 'consecutive' && consecutiveLoading);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden h-full flex flex-col">
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <div key={tab.key} className="relative flex-1 group">
            <button
              onClick={() => setActiveTab(tab.key)}
              className={`w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {tab.label}
            </button>
            {tab.tooltip && (
              <div className="hidden sm:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-gray-900 text-gray-300 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {tab.tooltip}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 옵션 */}
      <div className="flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 sm:py-3 bg-gray-750 border-b border-gray-700">
        {activeTab === 'frequent' && (
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">기간:</span>
            <select
              value={frequentWeeks}
              onChange={(e) => setFrequentWeeks(Number(e.target.value))}
              className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
            >
              <option value={1}>1주</option>
              <option value={2}>2주</option>
              <option value={4}>4주</option>
              <option value={8}>8주</option>
              <option value={12}>12주</option>
            </select>
          </div>
        )}

        {activeTab === 'pullback' && (
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">기준일:</span>
            <select
              value={pullbackDays}
              onChange={(e) => setPullbackDays(Number(e.target.value))}
              className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
            >
              <option value={1}>1일 전</option>
              <option value={2}>2일 전</option>
              <option value={3}>3일 전</option>
              <option value={4}>4일 전</option>
              <option value={5}>5일 전</option>
            </select>
          </div>
        )}

        {activeTab === 'consecutive' && (
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">연속일:</span>
            <select
              value={consecutiveDays}
              onChange={(e) => setConsecutiveDays(Number(e.target.value))}
              className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
            >
              <option value={2}>2일</option>
              <option value={3}>3일</option>
              <option value={4}>4일</option>
            </select>
          </div>
        )}

        <span className="text-xs sm:text-sm text-gray-400 ml-auto">
          {activeTab === 'frequent' && `${frequentData.length}개`}
          {activeTab === 'pullback' && `${pullbackData.length}개`}
          {activeTab === 'consecutive' && `${consecutiveData.length}개`}
        </span>
      </div>

      {/* 테이블 */}
      <div className="flex-1 min-h-0 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-400 text-sm">로딩 중...</span>
          </div>
        ) : (
          <>
            {activeTab === 'frequent' && renderFrequentTable()}
            {activeTab === 'pullback' && renderPullbackTable()}
            {activeTab === 'consecutive' && renderConsecutiveTable()}
          </>
        )}
      </div>
    </div>
  );
}

export default AnalysisTabs;
