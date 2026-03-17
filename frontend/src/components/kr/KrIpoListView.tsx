import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { krApi } from '../../services/api';
import type { NewListingResult } from '../../types/stock';
import Calendar from '../common/Calendar';

type SortKey = '날짜' | '종목코드' | '종목명' | '시가' | '종가' | '등락률' | '거래대금' | null;
type SortDir = 'asc' | 'desc';

interface KrIpoListViewProps {
  onStockClick: (code: string, name: string, date?: string) => void;
  availableDates: string[];
  minYear: number;
  maxYear: number;
  initialYear: number;
  initialMonth: number;
}

const PERIOD_PRESETS = [
  { label: '1주', days: 7 },
  { label: '2주', days: 14 },
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '1년', days: 365 },
];

function KrIpoListView({ onStockClick, availableDates, minYear, maxYear, initialYear, initialMonth }: KrIpoListViewProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [filterOpen, setFilterOpen] = useState(true);

  const [searchParams, setSearchParams] = useState<{ startDate: string; endDate: string } | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { data: results = [], isLoading } = useQuery<NewListingResult[]>({
    queryKey: ['kr', 'new-listings', searchParams],
    queryFn: () => krApi.getNewListings(searchParams!.startDate, searchParams!.endDate),
    enabled: !!searchParams,
  });

  const applyPreset = (days: number) => {
    if (availableDates.length === 0) return;
    const latestDate = availableDates[0];
    const earliestDate = availableDates[availableDates.length - 1];
    const end = new Date(latestDate);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().slice(0, 10);
    setStartDate(startStr < earliestDate ? earliestDate : startStr);
    setEndDate(latestDate);
  };

  const handleSearch = () => {
    if (!startDate || !endDate) return;
    setSearchParams({ startDate, endDate });
  };

  const toggleSort = (key: Exclude<SortKey, null>) => {
    if (sortKey === key) {
      const initialDir = 'desc';
      if (sortDir === initialDir) {
        setSortDir('asc');
      } else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const getSortIcon = (key: Exclude<SortKey, null>) => {
    if (sortKey !== key) return null;
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const formatVolume = (value: number) => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}조`;
    if (value >= 1e8) return `${(value / 1e8).toFixed(1)}억`;
    if (value >= 1e4) return `${(value / 1e4).toFixed(0)}만`;
    return value.toLocaleString();
  };

  const sortedResults = useMemo(() => {
    if (!results.length) return [];

    if (sortKey === null) return results;

    return [...results].sort((a, b) => {
      let cmp = 0;
      if (sortKey === '날짜') {
        cmp = a.날짜.localeCompare(b.날짜);
      } else if (sortKey === '종목코드') {
        cmp = a.티커.localeCompare(b.티커);
      } else if (sortKey === '종목명') {
        cmp = a.종목명.localeCompare(b.종목명);
      } else if (sortKey === '시가') {
        cmp = a.시가 - b.시가;
      } else if (sortKey === '종가') {
        cmp = a.종가 - b.종가;
      } else if (sortKey === '등락률') {
        cmp = a.등락률 - b.등락률;
      } else if (sortKey === '거래대금') {
        cmp = a.거래대금 - b.거래대금;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [results, sortKey, sortDir]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 필터 영역 */}
      <div className="bg-gray-800 rounded-lg mb-4">
        {searchParams && (
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs sm:text-sm text-gray-400 hover:bg-gray-700/30 rounded-t-lg"
          >
            <span>{filterOpen ? '검색 조건' : `${startDate} ~ ${endDate}`}</span>
            <svg className={`w-4 h-4 transition-transform ${filterOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
        {(!searchParams || filterOpen) && (
        <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs sm:text-sm bg-green-700 text-white px-2 py-1 rounded w-full sm:w-auto">기간</span>
          {PERIOD_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.days)}
              className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              {preset.label}
            </button>
          ))}

          <div className="w-full sm:hidden" />
          <span className="hidden sm:inline text-gray-600 mx-1">|</span>

          {/* 시작일 달력 */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStartCalendar(!showStartCalendar);
                setShowEndCalendar(false);
              }}
              className="flex items-center gap-1 bg-gray-700 border border-gray-600 rounded px-2 sm:px-3 py-1 hover:bg-gray-600 text-xs sm:text-sm"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{startDate || '시작일'}</span>
            </button>
            {showStartCalendar && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowStartCalendar(false)} />
                <div className="absolute top-full left-0 mt-2 z-40">
                  <Calendar
                    availableDates={availableDates}
                    selectedDate={startDate || null}
                    onSelectDate={(date) => {
                      setStartDate(date);
                      setShowStartCalendar(false);
                    }}
                    minYear={minYear}
                    maxYear={maxYear}
                    initialYear={startDate ? parseInt(startDate.slice(0, 4)) : initialYear}
                    initialMonth={startDate ? parseInt(startDate.slice(5, 7)) : initialMonth}
                  />
                </div>
              </>
            )}
          </div>

          <span className="text-gray-400">~</span>

          {/* 종료일 달력 */}
          <div className="relative">
            <button
              onClick={() => {
                setShowEndCalendar(!showEndCalendar);
                setShowStartCalendar(false);
              }}
              className="flex items-center gap-1 bg-gray-700 border border-gray-600 rounded px-2 sm:px-3 py-1 hover:bg-gray-600 text-xs sm:text-sm"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{endDate || '종료일'}</span>
            </button>
            {showEndCalendar && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowEndCalendar(false)} />
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 md:left-0 md:right-auto mt-2 z-40">
                  <Calendar
                    availableDates={availableDates}
                    selectedDate={endDate || null}
                    onSelectDate={(date) => {
                      setEndDate(date);
                      setShowEndCalendar(false);
                    }}
                    minYear={minYear}
                    maxYear={maxYear}
                    initialYear={endDate ? parseInt(endDate.slice(0, 4)) : initialYear}
                    initialMonth={endDate ? parseInt(endDate.slice(5, 7)) : initialMonth}
                  />
                </div>
              </>
            )}
          </div>

          {/* 검색 버튼 */}
          <div className="flex items-center gap-4 ml-auto">
            {results.length > 0 && (
              <span className="text-xs sm:text-sm text-gray-400">
                {results.length.toLocaleString()}개 결과
              </span>
            )}
            <button
              onClick={handleSearch}
              disabled={!startDate || !endDate}
              className="px-4 sm:px-6 py-1 text-xs sm:text-sm bg-green-700 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
            >
              검색
            </button>
          </div>
        </div>
        </div>
        )}
      </div>

      {/* 결과 테이블 */}
      <div className="flex-1 min-h-0 bg-gray-800 rounded-lg overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">로딩 중...</div>
          </div>
        ) : !searchParams ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs sm:text-sm text-gray-400">기간을 선택하고 검색 버튼을 클릭하세요.</div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">검색 결과가 없습니다</div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-x-2 gap-y-1 px-2 sm:px-4 py-1.5 sm:py-2 bg-gray-700/50 border-b border-gray-700">
              <span className="text-xs sm:text-sm text-gray-400 ml-auto">
                {sortedResults.length.toLocaleString()}개 표시
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-700 sticky top-0">
                  <tr>
                    <th
                      onClick={() => toggleSort('날짜')}
                      className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium cursor-pointer hover:bg-gray-600"
                    >
                      날짜{getSortIcon('날짜')}
                    </th>
                    <th
                      onClick={() => toggleSort('종목코드')}
                      className="min-w-[3rem] px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium cursor-pointer hover:bg-gray-600"
                    >
                      코드
                      {getSortIcon('종목코드')}
                    </th>
                    <th
                      onClick={() => toggleSort('종목명')}
                      className="w-[6.5rem] sm:w-auto px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium cursor-pointer hover:bg-gray-600"
                    >
                      종목명{getSortIcon('종목명')}
                    </th>
                    <th
                      onClick={() => toggleSort('시가')}
                      className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium cursor-pointer hover:bg-gray-600"
                    >
                      시가{getSortIcon('시가')}
                    </th>
                    <th
                      onClick={() => toggleSort('종가')}
                      className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium cursor-pointer hover:bg-gray-600"
                    >
                      종가{getSortIcon('종가')}
                    </th>
                    <th
                      onClick={() => toggleSort('등락률')}
                      className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium cursor-pointer hover:bg-gray-600"
                    >
                      등락률{getSortIcon('등락률')}
                    </th>
                    <th
                      onClick={() => toggleSort('거래대금')}
                      className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium cursor-pointer hover:bg-gray-600"
                    >
                      <span className="sm:hidden"><span className="block">거래</span><span className="block">대금</span></span>
                      <span className="hidden sm:inline">거래대금</span>
                      {getSortIcon('거래대금')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((item, idx) => (
                    <tr
                      key={`${item.날짜}-${item.티커}-${idx}`}
                      onClick={() => onStockClick(item.티커, item.종목명, item.날짜)}
                      className="border-t border-gray-700 hover:bg-gray-700/50 cursor-pointer"
                    >
                      <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap">
                        <div className="sm:hidden">
                          <div>{item.날짜.slice(0, 4)}</div>
                          <div>{item.날짜.slice(5)}</div>
                        </div>
                        <div className="hidden sm:block">{item.날짜}</div>
                      </td>
                      <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-mono text-yellow-400">
                        <div className="sm:hidden">
                          <div>{item.티커.slice(0, 3)}</div>
                          <div>{item.티커.slice(3)}</div>
                        </div>
                        <div className="hidden sm:block">{item.티커}</div>
                      </td>
                      <td className="min-w-[6.5rem] sm:min-w-0 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm line-clamp-2 sm:line-clamp-1">{item.종목명}</td>
                      <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-right whitespace-nowrap">{item.시가.toLocaleString()}원</td>
                      <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-right whitespace-nowrap">{item.종가.toLocaleString()}원</td>
                      <td className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-right ${
                        item.등락률 >= 0 ? 'text-red-400' : 'text-blue-400'
                      }`}>
                        {item.등락률 >= 0 ? '+' : ''}{item.등락률.toFixed(2)}%
                      </td>
                      <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-right text-gray-400 whitespace-nowrap">
                        {formatVolume(item.거래대금)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default KrIpoListView;
