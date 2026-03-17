import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { krApi, usApi } from '../../services/api';
import type { Market, FrequentStock, PullbackStock, ConsecutiveStock, WeekHigh52Stock } from '../../types/stock';

type AnalysisType = 'frequent' | 'pullback' | 'consecutive' | '52week';
type MaFilter = 'all' | 'above' | 'below';

const MA_FILTER_OPTIONS: { value: MaFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'above', label: '정배열 (MA240↑)' },
  { value: 'below', label: '역배열 (MA240↓)' },
];

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
  const [frequentWeeks, setFrequentWeeks] = useState(1);
  const [pullbackDays, setPullbackDays] = useState(1);
  const [consecutiveDays, setConsecutiveDays] = useState(2);
  const [weekHigh52ConsolidationDays, setWeekHigh52ConsolidationDays] = useState(0);
  const [weekHigh52RangePct, setWeekHigh52RangePct] = useState(20);

  // 각 탭별 정렬 상태
  const [frequentSortKey, setFrequentSortKey] = useState<string | null>(null);
  const [frequentSortDir, setFrequentSortDir] = useState<'asc' | 'desc'>('desc');
  const [pullbackSortKey, setPullbackSortKey] = useState<string | null>(null);
  const [pullbackSortDir, setPullbackSortDir] = useState<'asc' | 'desc'>('desc');
  const [consecutiveSortKey, setConsecutiveSortKey] = useState<string | null>(null);
  const [consecutiveSortDir, setConsecutiveSortDir] = useState<'asc' | 'desc'>('desc');
  const [weekHigh52SortKey, setWeekHigh52SortKey] = useState<string | null>(null);
  const [weekHigh52SortDir, setWeekHigh52SortDir] = useState<'asc' | 'desc'>('desc');

  // 각 탭별 MA240 필터 상태
  const [frequentMaFilter, setFrequentMaFilter] = useState<MaFilter>('all');
  const [pullbackMaFilter, setPullbackMaFilter] = useState<MaFilter>('all');
  const [consecutiveMaFilter, setConsecutiveMaFilter] = useState<MaFilter>('all');
  const [weekHigh52MaFilter, setWeekHigh52MaFilter] = useState<MaFilter>('all');
  const [visibleTooltip, setVisibleTooltip] = useState<AnalysisType | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleOptionLabel, setVisibleOptionLabel] = useState<string | null>(null);
  const optionLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      if (optionLabelTimer.current) clearTimeout(optionLabelTimer.current);
    };
  }, []);

  const showOptionLabel = useCallback((label: string) => {
    if (optionLabelTimer.current) clearTimeout(optionLabelTimer.current);
    setVisibleOptionLabel(label);
    optionLabelTimer.current = setTimeout(() => setVisibleOptionLabel(null), 2000);
  }, []);

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

  // 52주 신고가 종목
  const { data: weekHigh52Data = [], isLoading: weekHigh52Loading } = useQuery({
    queryKey: [market, '52week-high', selectedDate, weekHigh52ConsolidationDays, weekHigh52RangePct, category],
    queryFn: () => api.get52WeekHigh(selectedDate, weekHigh52ConsolidationDays, weekHigh52RangePct, category),
    enabled: activeTab === '52week' && !!selectedDate,
  });

  const tabs: { key: AnalysisType; label: string; tooltip?: string }[] = [
    { key: 'frequent', label: '빈출', tooltip: '상위 300위에 자주 등장하는 종목' },
    { key: 'pullback', label: '눌림목', tooltip: '기준일인 N일 전 상승 후, 당일 하락 중인 종목' },
    { key: 'consecutive', label: '연속 상승' },
    { key: '52week', label: '52주 신고가', tooltip: '당일 전일 대비 +5% 이상 상승하며 처음으로 52주 신고가를 돌파한 종목' },
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

  const handleWeekHigh52Sort = useCallback((key: string) => {
    if (weekHigh52SortKey === key) {
      if (weekHigh52SortDir === 'desc') {
        setWeekHigh52SortDir('asc');
      } else {
        setWeekHigh52SortKey(null);
        setWeekHigh52SortDir('desc');
      }
    } else {
      setWeekHigh52SortKey(key);
      setWeekHigh52SortDir('desc');
    }
  }, [weekHigh52SortKey, weekHigh52SortDir]);

  // 정렬 및 필터된 빈출 종목 데이터
  const sortedFrequentData = useMemo(() => {
    // MA240 필터 적용
    let filtered = frequentData;
    if (frequentMaFilter !== 'all') {
      filtered = filtered.filter(item => item.ma240_position === frequentMaFilter);
    }

    if (!frequentSortKey) return filtered;

    return [...filtered].sort((a, b) => {
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
  }, [frequentData, frequentSortKey, frequentSortDir, frequentMaFilter, codeKey]);

  // 정렬 및 필터된 눌림목 데이터
  const sortedPullbackData = useMemo(() => {
    // MA240 필터 적용
    let filtered = pullbackData;
    if (pullbackMaFilter !== 'all') {
      filtered = filtered.filter(item => item.ma240_position === pullbackMaFilter);
    }

    if (!pullbackSortKey) return filtered;

    return [...filtered].sort((a, b) => {
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
  }, [pullbackData, pullbackSortKey, pullbackSortDir, pullbackMaFilter, codeKey]);

  // 정렬 및 필터된 연속 상승 데이터
  const sortedConsecutiveData = useMemo(() => {
    // MA240 필터 적용
    let filtered = consecutiveData;
    if (consecutiveMaFilter !== 'all') {
      filtered = filtered.filter(item => item.ma240_position === consecutiveMaFilter);
    }

    if (!consecutiveSortKey) return filtered;

    return [...filtered].sort((a, b) => {
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
  }, [consecutiveData, consecutiveSortKey, consecutiveSortDir, consecutiveMaFilter, codeKey]);

  // 정렬 및 필터된 52주 신고가 데이터
  const sortedWeekHigh52Data = useMemo(() => {
    let filtered: WeekHigh52Stock[] = weekHigh52Data;
    if (weekHigh52MaFilter !== 'all') {
      filtered = filtered.filter(item => item.ma240_position === weekHigh52MaFilter);
    }

    if (!weekHigh52SortKey) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal: any, bVal: any;

      if (weekHigh52SortKey === codeKey) {
        aVal = a[codeKey as keyof WeekHigh52Stock];
        bVal = b[codeKey as keyof WeekHigh52Stock];
      } else if (weekHigh52SortKey === '종목명') {
        aVal = a.종목명;
        bVal = b.종목명;
      } else if (weekHigh52SortKey === '전일대비변동률') {
        aVal = a.전일대비변동률;
        bVal = b.전일대비변동률;
      } else if (weekHigh52SortKey === '종가') {
        aVal = a.종가;
        bVal = b.종가;
      } else if (weekHigh52SortKey === '거래대금') {
        aVal = a.거래대금;
        bVal = b.거래대금;
      } else {
        return 0;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return weekHigh52SortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      return weekHigh52SortDir === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [weekHigh52Data, weekHigh52SortKey, weekHigh52SortDir, weekHigh52MaFilter, codeKey]);

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

  const renderWeekHigh52Table = () => (
    <div className="overflow-auto flex-1">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-gray-700 sticky top-0">
          <tr>
            <th className="px-1 sm:px-3 py-1.5 sm:py-2 text-left">#</th>
            <SortableHeader
              label={market === 'kr' ? '코드' : '티커'}
              sortKey={codeKey}
              currentSortKey={weekHigh52SortKey}
              sortDir={weekHigh52SortDir}
              onSort={handleWeekHigh52Sort}
            />
            <SortableHeader
              label="종목명"
              sortKey="종목명"
              currentSortKey={weekHigh52SortKey}
              sortDir={weekHigh52SortDir}
              onSort={handleWeekHigh52Sort}
            />
            <SortableHeader
              label="등락률"
              sortKey="전일대비변동률"
              currentSortKey={weekHigh52SortKey}
              sortDir={weekHigh52SortDir}
              onSort={handleWeekHigh52Sort}
              align="right"
            />
            <SortableHeader
              label="종가"
              sortKey="종가"
              currentSortKey={weekHigh52SortKey}
              sortDir={weekHigh52SortDir}
              onSort={handleWeekHigh52Sort}
              align="right"
            />
            <SortableHeader
              label="거래대금"
              sortKey="거래대금"
              currentSortKey={weekHigh52SortKey}
              sortDir={weekHigh52SortDir}
              onSort={handleWeekHigh52Sort}
              align="right"
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {sortedWeekHigh52Data.map((stock, idx) => (
            <tr
              key={stock[codeKey as keyof WeekHigh52Stock] as string}
              onClick={() => onStockClick(
                stock[codeKey as keyof WeekHigh52Stock] as string,
                stock.종목명
              )}
              className="hover:bg-gray-700/50 cursor-pointer"
            >
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 text-gray-400">{idx + 1}</td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-base text-yellow-400 leading-tight">
                {market === 'kr' ? (
                  <>
                    <span className="sm:hidden block">{(stock[codeKey as keyof WeekHigh52Stock] as string)?.slice(0, 3)}<br/>{(stock[codeKey as keyof WeekHigh52Stock] as string)?.slice(3)}</span>
                    <span className="hidden sm:inline">{stock[codeKey as keyof WeekHigh52Stock] as string}</span>
                  </>
                ) : (
                  stock[codeKey as keyof WeekHigh52Stock] as string
                )}
              </td>
              <td className="px-1 sm:px-3 py-1.5 sm:py-2">{stock.종목명}</td>
              <td className={`px-1 sm:px-3 py-1.5 sm:py-2 text-right ${stock.전일대비변동률 >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {stock.전일대비변동률 >= 0 ? '+' : ''}{stock.전일대비변동률.toFixed(2)}%
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
    (activeTab === 'consecutive' && consecutiveLoading) ||
    (activeTab === '52week' && weekHigh52Loading);

  return (
    <div className="bg-gray-800 rounded-lg h-full flex flex-col overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab, index) => {
          const mobileAlign = index === 0 ? 'left-0' : index === tabs.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2';
          const desktopAlign = index === 0
            ? 'left-1/2 -translate-x-1/2 whitespace-nowrap sm:left-0 sm:translate-x-0 md:left-1/2 md:-translate-x-1/2'
            : index === tabs.length - 1
            ? 'left-1/2 -translate-x-1/2 whitespace-nowrap sm:left-auto sm:translate-x-0 sm:right-0 md:left-1/2 md:-translate-x-1/2 md:right-auto'
            : 'left-1/2 -translate-x-1/2 whitespace-nowrap';
          return (
          <div key={tab.key} className="relative flex-1 group">
            <button
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.tooltip) {
                  if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
                  setVisibleTooltip(tab.key);
                  tooltipTimer.current = setTimeout(() => setVisibleTooltip(null), 2000);
                }
              }}
              className={`w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
                index === 0 ? 'rounded-tl-lg' : index === tabs.length - 1 ? 'rounded-tr-lg' : ''
              } ${
                activeTab === tab.key
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {tab.label}
            </button>
            {tab.tooltip && (
              <div className={`absolute px-3 py-1.5 bg-gray-900 text-gray-300 text-xs rounded shadow-lg pointer-events-none z-50 ${
                visibleTooltip === tab.key
                  ? `sm:hidden block opacity-100 w-36 text-center bottom-full mb-2 ${mobileAlign}`
                  : `hidden sm:block ${desktopAlign} top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity`
              }`}>
                {tab.tooltip}
                <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                  visibleTooltip === tab.key ? 'top-full border-t-gray-900' : 'bottom-full border-b-gray-900'
                }`}></div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* 옵션 */}
      <div className="flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 sm:py-3 bg-gray-750 border-b border-gray-700 flex-wrap">
        {activeTab === 'frequent' && (
          <>
            <div className="relative flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">기간:</span>
              <div className={`sm:hidden absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-gray-300 text-xs rounded shadow-lg pointer-events-none z-50 whitespace-nowrap ${visibleOptionLabel === '기간' ? 'block' : 'hidden'}`}>기간</div>
              <select
                value={frequentWeeks}
                onChange={(e) => setFrequentWeeks(Number(e.target.value))}
                onFocus={() => showOptionLabel('기간')}
                className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
              >
                <option value={1}>1주</option>
                <option value={2}>2주</option>
                <option value={4}>4주</option>
                <option value={8}>8주</option>
                <option value={12}>12주</option>
              </select>
            </div>
            <select
              value={frequentMaFilter}
              onChange={(e) => setFrequentMaFilter(e.target.value as MaFilter)}
              className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
            >
              {MA_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </>
        )}

        {activeTab === 'pullback' && (
          <>
            <div className="relative flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">기준일:</span>
              <div className={`sm:hidden absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-gray-300 text-xs rounded shadow-lg pointer-events-none z-50 whitespace-nowrap ${visibleOptionLabel === '기준일' ? 'block' : 'hidden'}`}>기준일</div>
              <select
                value={pullbackDays}
                onChange={(e) => setPullbackDays(Number(e.target.value))}
                onFocus={() => showOptionLabel('기준일')}
                className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
              >
                <option value={1}>1일 전</option>
                <option value={2}>2일 전</option>
                <option value={3}>3일 전</option>
                <option value={4}>4일 전</option>
                <option value={5}>5일 전</option>
              </select>
            </div>
            <select
              value={pullbackMaFilter}
              onChange={(e) => setPullbackMaFilter(e.target.value as MaFilter)}
              className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
            >
              {MA_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </>
        )}

        {activeTab === 'consecutive' && (
          <>
            <div className="relative flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">연속일:</span>
              <div className={`sm:hidden absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-gray-300 text-xs rounded shadow-lg pointer-events-none z-50 whitespace-nowrap ${visibleOptionLabel === '연속일' ? 'block' : 'hidden'}`}>연속일</div>
              <select
                value={consecutiveDays}
                onChange={(e) => setConsecutiveDays(Number(e.target.value))}
                onFocus={() => showOptionLabel('연속일')}
                className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
              >
                <option value={2}>2일</option>
                <option value={3}>3일</option>
                <option value={4}>4일</option>
                <option value={5}>5일</option>
              </select>
            </div>
            <select
              value={consecutiveMaFilter}
              onChange={(e) => setConsecutiveMaFilter(e.target.value as MaFilter)}
              className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
            >
              {MA_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </>
        )}

        {activeTab === '52week' && (
          <>
            <select
              value={weekHigh52MaFilter}
              onChange={(e) => setWeekHigh52MaFilter(e.target.value as MaFilter)}
              className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
            >
              {MA_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="relative flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">횡보:</span>
              <div className={`sm:hidden absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-gray-300 text-xs rounded shadow-lg pointer-events-none z-50 whitespace-nowrap ${visibleOptionLabel === '횡보' ? 'block' : 'hidden'}`}>횡보</div>
              <select
                value={weekHigh52ConsolidationDays}
                onChange={(e) => setWeekHigh52ConsolidationDays(Number(e.target.value))}
                onFocus={() => showOptionLabel('횡보')}
                className="bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm"
              >
                <option value={0}>전체</option>
                <option value={10}>2주</option>
                <option value={21}>1개월</option>
                <option value={42}>2개월</option>
                <option value={63}>3개월</option>
              </select>
            </div>
            <div className="relative flex items-center gap-1 sm:gap-2">
              <span className={`text-xs sm:text-sm hidden sm:inline ${weekHigh52ConsolidationDays === 0 ? 'text-gray-600' : 'text-gray-400'}`}>진폭:</span>
              <div className={`sm:hidden absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-gray-300 text-xs rounded shadow-lg pointer-events-none z-50 whitespace-nowrap ${visibleOptionLabel === '진폭' ? 'block' : 'hidden'}`}>진폭</div>
              <select
                value={weekHigh52RangePct}
                onChange={(e) => setWeekHigh52RangePct(Number(e.target.value))}
                onFocus={() => showOptionLabel('진폭')}
                disabled={weekHigh52ConsolidationDays === 0}
                className={`bg-gray-700 border-none rounded px-2 py-1 text-xs sm:text-sm transition-opacity ${weekHigh52ConsolidationDays === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <option value={10}>10%</option>
                <option value={20}>20%</option>
                <option value={30}>30%</option>
              </select>
            </div>
          </>
        )}

        <span className="text-xs sm:text-sm text-gray-400 ml-auto">
          {activeTab === 'frequent' && `${sortedFrequentData.length}개`}
          {activeTab === 'pullback' && `${sortedPullbackData.length}개`}
          {activeTab === 'consecutive' && `${sortedConsecutiveData.length}개`}
          {activeTab === '52week' && `${sortedWeekHigh52Data.length}개`}
        </span>
      </div>

      {/* 테이블 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-b-lg">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-400 text-sm">로딩 중...</span>
          </div>
        ) : (
          <>
            {activeTab === 'frequent' && renderFrequentTable()}
            {activeTab === 'pullback' && renderPullbackTable()}
            {activeTab === 'consecutive' && renderConsecutiveTable()}
            {activeTab === '52week' && renderWeekHigh52Table()}
          </>
        )}
      </div>
    </div>
  );
}

export default AnalysisTabs;
