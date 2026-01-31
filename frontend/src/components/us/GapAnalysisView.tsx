import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usApi } from '../../services/api';
import type { GapAnalysisResult } from '../../types/stock';
import Calendar from '../common/Calendar';

type BasePrice = 'prev_close' | 'open' | 'close';
type ComparePrice = 'open' | 'close' | 'next_open' | 'next_close';
type ExtraBase = '' | 'open' | 'close';
type ExtraCompare = '' | 'close' | 'next_open' | 'next_close';
type ExtraDirection = 'up' | 'down';
type DetailBase = '' | 'open' | 'close';
type DetailCompare = '' | 'next_open' | 'next_close';
type DetailDirection = 'up' | 'down';
type SortKey = '날짜' | '티커' | '종목명' | '종가' | '등락률' | '거래대금' | null;
type SortDir = 'asc' | 'desc';
type PriceRange = 'all' | 'high' | 'mid' | 'low';
type MaFilter = 'all' | 'above' | 'below';

const PRICE_RANGE_OPTIONS: { value: PriceRange; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'high', label: '$10 이상' },
  { value: 'mid', label: '$5~$10' },
  { value: 'low', label: '$5 미만' },
];

const MA_FILTER_OPTIONS: { value: MaFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'above', label: '정배열 (MA240↑)' },
  { value: 'below', label: '역배열 (MA240↓)' },
];

interface GapAnalysisViewProps {
  onStockClick: (code: string, name: string, date?: string) => void;
  availableDates: string[];
  minYear: number;
  maxYear: number;
  initialYear: number;
  initialMonth: number;
}

const PERIOD_PRESETS = [
  { label: '2주', days: 14 },
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '1년', days: 365 },
];

const BASE_PRICE_OPTIONS: { value: BasePrice; label: string }[] = [
  { value: 'prev_close', label: 'n-1일 종가' },
  { value: 'open', label: 'n일 시가' },
  { value: 'close', label: 'n일 종가' },
];

const COMPARE_PRICE_OPTIONS: { value: ComparePrice; label: string }[] = [
  { value: 'open', label: 'n일 시가' },
  { value: 'close', label: 'n일 종가' },
  { value: 'next_open', label: 'n+1일 시가' },
  { value: 'next_close', label: 'n+1일 종가' },
];

const MIN_RATE_OPTIONS = [3, 5, 10];
const MAX_RATE_OPTIONS = [3, 5, 10, 30, 50, 100, 99999];

const EXTRA_BASE_OPTIONS: { value: ExtraBase; label: string }[] = [
  { value: '', label: '선택 안함' },
  { value: 'open', label: 'n일 시가' },
  { value: 'close', label: 'n일 종가' },
];

const EXTRA_COMPARE_OPTIONS: { value: ExtraCompare; label: string }[] = [
  { value: '', label: '선택 안함' },
  { value: 'close', label: 'n일 종가' },
  { value: 'next_open', label: 'n+1일 시가' },
  { value: 'next_close', label: 'n+1일 종가' },
];

const EXTRA_DIRECTION_OPTIONS: { value: ExtraDirection; label: string }[] = [
  { value: 'up', label: '상승' },
  { value: 'down', label: '하락' },
];

const DETAIL_BASE_OPTIONS: { value: DetailBase; label: string }[] = [
  { value: '', label: '선택 안함' },
  { value: 'open', label: 'n일 시가' },
  { value: 'close', label: 'n일 종가' },
];

const DETAIL_COMPARE_OPTIONS: { value: DetailCompare; label: string }[] = [
  { value: '', label: '선택 안함' },
  { value: 'next_open', label: 'n+1일 시가' },
  { value: 'next_close', label: 'n+1일 종가' },
];

const DETAIL_DIRECTION_OPTIONS: { value: DetailDirection; label: string }[] = [
  { value: 'up', label: '상승' },
  { value: 'down', label: '하락' },
];

function GapAnalysisView({ onStockClick, availableDates, minYear, maxYear, initialYear, initialMonth }: GapAnalysisViewProps) {
  // 필터 상태
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [basePrice, setBasePrice] = useState<BasePrice>('prev_close');
  const [comparePrice, setComparePrice] = useState<ComparePrice>('open');
  const [minRate, setMinRate] = useState<number>(3);
  const [maxRate, setMaxRate] = useState<number>(99999);
  const [extraBase, setExtraBase] = useState<ExtraBase>('');
  const [extraCompare, setExtraCompare] = useState<ExtraCompare>('');
  const [extraDirection, setExtraDirection] = useState<ExtraDirection>('up');
  const [detailBase, setDetailBase] = useState<DetailBase>('');
  const [detailCompare, setDetailCompare] = useState<DetailCompare>('');
  const [detailDirection, setDetailDirection] = useState<DetailDirection>('up');
  const [tickerFilter, setTickerFilter] = useState<string>('');
  const [tickerQuery, setTickerQuery] = useState<string>('');
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [tickerSelectedIndex, setTickerSelectedIndex] = useState(0);
  const tickerInputRef = useRef<HTMLInputElement>(null);
  const tickerContainerRef = useRef<HTMLDivElement>(null);

  // 달력 표시 상태
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  // 종목 자동완성 검색
  const { data: tickerResults = [] } = useQuery({
    queryKey: ['us', 'search', tickerQuery],
    queryFn: () => usApi.search(tickerQuery, 10),
    enabled: tickerQuery.length >= 1,
    staleTime: 1000 * 60,
  });

  // 종목 자동완성 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tickerContainerRef.current && !tickerContainerRef.current.contains(e.target as Node)) {
        setShowTickerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 검색 트리거
  const [searchParams, setSearchParams] = useState<{
    startDate: string;
    endDate: string;
    basePrice: BasePrice;
    comparePrice: ComparePrice;
    minRate: number;
    maxRate: number;
    extraBase: ExtraBase;
    extraCompare: ExtraCompare;
    extraDirection: 'up' | 'down';
    detailBase: DetailBase;
    detailCompare: DetailCompare;
    detailDirection: 'up' | 'down';
    tickerFilter: string;
  } | null>(null);

  // 정렬 상태
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [maFilter, setMaFilter] = useState<MaFilter>('all');

  // API 호출
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['us', 'gap-analysis', searchParams],
    queryFn: () =>
      usApi.getGapAnalysis(
        searchParams!.startDate,
        searchParams!.endDate,
        searchParams!.basePrice,
        searchParams!.comparePrice,
        searchParams!.minRate,
        searchParams!.maxRate,
        searchParams!.extraBase || undefined,
        searchParams!.extraCompare || undefined,
        searchParams!.extraDirection || undefined,
        searchParams!.detailBase || undefined,
        searchParams!.detailCompare || undefined,
        searchParams!.detailDirection || undefined,
        searchParams!.tickerFilter || undefined
      ),
    enabled: !!searchParams,
  });

  // 기간 프리셋 적용
  const applyPreset = (days: number) => {
    if (availableDates.length === 0) return;

    const latestDate = availableDates[availableDates.length - 1];
    const end = new Date(latestDate);
    const start = new Date(end);
    start.setDate(start.getDate() - days);

    // 시작일이 데이터 범위 내에 있는지 확인
    const earliestDate = availableDates[0];
    const startStr = start.toISOString().slice(0, 10);

    setStartDate(startStr < earliestDate ? earliestDate : startStr);
    setEndDate(latestDate);
  };

  // 검색 실행
  const handleSearch = () => {
    if (!startDate || !endDate) return;
    setSearchParams({
      startDate,
      endDate,
      basePrice,
      comparePrice,
      minRate,
      maxRate,
      extraBase,
      extraCompare,
      extraDirection,
      detailBase,
      detailCompare,
      detailDirection,
      tickerFilter,
    });
  };

  // 가격대 및 MA240 필터링 + 정렬된 결과
  const sortedResults = useMemo(() => {
    if (!results.length) return [];

    // 가격대 필터링
    let filtered = results;
    if (priceRange !== 'all') {
      filtered = filtered.filter(item => {
        if (priceRange === 'high') return item.종가 >= 10;
        if (priceRange === 'mid') return item.종가 >= 5 && item.종가 < 10;
        if (priceRange === 'low') return item.종가 < 5;
        return true;
      });
    }

    // MA240 필터링
    if (maFilter !== 'all') {
      filtered = filtered.filter(item => item.ma240_position === maFilter);
    }

    // 정렬 키가 없으면 필터링된 결과만 반환
    if (sortKey === null) return filtered;

    return [...filtered].sort((a, b) => {
      let cmp = 0;

      if (sortKey === '날짜') {
        cmp = a.날짜.localeCompare(b.날짜);
        // 같은 날짜면 거래대금 내림차순
        if (cmp === 0) {
          cmp = b.거래대금 - a.거래대금;
        }
      } else if (sortKey === '티커') {
        cmp = a.티커.localeCompare(b.티커);
      } else if (sortKey === '종목명') {
        cmp = a.종목명.localeCompare(b.종목명);
      } else if (sortKey === '종가') {
        cmp = a.종가 - b.종가;
      } else if (sortKey === '등락률') {
        cmp = a.등락률 - b.등락률;
      } else if (sortKey === '거래대금') {
        cmp = a.거래대금 - b.거래대금;
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [results, sortKey, sortDir, priceRange, maFilter]);

  // 정렬 토글 (3단계: 초기방향 → 반대방향 → 기본값)
  const toggleSort = (key: Exclude<SortKey, null>) => {
    if (sortKey === key) {
      // 같은 컬럼 클릭: 3단계 순환
      const initialDir = key === '날짜' ? 'asc' : 'desc';
      if (sortDir === initialDir) {
        // 초기방향 → 반대방향
        setSortDir(initialDir === 'asc' ? 'desc' : 'asc');
      } else {
        // 반대방향 → 정렬 해제
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      // 다른 컬럼 클릭: 해당 컬럼으로 정렬 시작
      setSortKey(key);
      setSortDir(key === '날짜' ? 'asc' : 'desc');
    }
  };

  // 정렬 아이콘
  const getSortIcon = (key: Exclude<SortKey, null>) => {
    if (sortKey !== key) return null;
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  // 거래대금 포맷
  const formatVolume = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return value.toString();
  };

  // 종목 자동완성 키보드 네비게이션
  const handleTickerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowTickerDropdown(false);
      return;
    }

    if (!showTickerDropdown || tickerResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setTickerSelectedIndex((prev) => Math.min(prev + 1, tickerResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setTickerSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (tickerResults[tickerSelectedIndex]) {
          handleTickerSelect(tickerResults[tickerSelectedIndex].code);
        }
        break;
    }
  };

  // 종목 선택
  const handleTickerSelect = (code: string) => {
    setTickerFilter(code);
    setTickerQuery(code);
    setShowTickerDropdown(false);
    setTickerSelectedIndex(0);
  };

  // 종목 입력 변경
  const handleTickerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTickerQuery(value);
    setTickerFilter(value);
    setShowTickerDropdown(true);
    setTickerSelectedIndex(0);
  };

  // 종목 필터 초기화
  const handleTickerClear = () => {
    setTickerFilter('');
    setTickerQuery('');
    setShowTickerDropdown(false);
    tickerInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      {/* 필터 영역 */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        {/* 첫째 줄: 기간 프리셋 + 달력 선택 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm bg-green-700 text-white px-2 py-1 rounded">기간</span>
          {PERIOD_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset.days)}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              {preset.label}
            </button>
          ))}

          <span className="text-gray-600 mx-1">|</span>

          {/* 시작일 달력 */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStartCalendar(!showStartCalendar);
                setShowEndCalendar(false);
              }}
              className="flex items-center gap-1 bg-gray-700 border border-gray-600 rounded px-3 py-1 hover:bg-gray-600 text-sm"
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
              className="flex items-center gap-1 bg-gray-700 border border-gray-600 rounded px-3 py-1 hover:bg-gray-600 text-sm"
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
                <div className="absolute top-full left-0 mt-2 z-40">
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
        </div>

        {/* 둘째 줄: 기준 가격 + 비교 가격 + 상승률 범위 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm bg-green-700 text-white px-2 py-1 rounded">기준</span>
          <select
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value as BasePrice)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {BASE_PRICE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <span className="text-gray-400">→</span>

          <select
            value={comparePrice}
            onChange={(e) => setComparePrice(e.target.value as ComparePrice)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {COMPARE_PRICE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <span className="text-gray-600 mx-1">|</span>

          <span className="text-sm text-gray-400">상승률:</span>
          <select
            value={minRate}
            onChange={(e) => setMinRate(Number(e.target.value))}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {MIN_RATE_OPTIONS.map(rate => (
              <option key={rate} value={rate}>{rate}%</option>
            ))}
          </select>
          <span className="text-gray-400">~</span>
          <select
            value={maxRate}
            onChange={(e) => setMaxRate(Number(e.target.value))}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {MAX_RATE_OPTIONS.map(rate => (
              <option key={rate} value={rate}>
                {rate === 99999 ? '무제한' : `${rate}%`}
              </option>
            ))}
          </select>
        </div>

        {/* 셋째 줄: 추가 기준 + 종목 필터 + 세부 기준 + 검색 버튼 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm bg-green-700 text-white px-2 py-1 rounded">추가 기준</span>
          <select
            value={extraBase}
            onChange={(e) => {
              const value = e.target.value as ExtraBase;
              setExtraBase(value);
              if (!value) {
                setExtraCompare('');
              }
            }}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {EXTRA_BASE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {extraBase && (
            <>
              <span className="text-gray-400">→</span>
              <select
                value={extraCompare}
                onChange={(e) => setExtraCompare(e.target.value as ExtraCompare)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
              >
                {EXTRA_COMPARE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          )}

          {extraBase && extraCompare && (
            <>
              <span className="text-gray-600 mx-1">|</span>
              <select
                value={extraDirection}
                onChange={(e) => setExtraDirection(e.target.value as ExtraDirection)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
              >
                {EXTRA_DIRECTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          )}

          <span className="text-gray-600 mx-1">|</span>

          <span className="text-sm bg-blue-400 text-white px-2 py-1 rounded">종목</span>
          <div ref={tickerContainerRef} className="relative">
            <input
              ref={tickerInputRef}
              type="text"
              value={tickerQuery}
              onChange={handleTickerInputChange}
              onFocus={() => tickerQuery && setShowTickerDropdown(true)}
              onKeyDown={handleTickerKeyDown}
              placeholder="티커/종목명"
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm w-40 placeholder-gray-500 pr-7"
            />
            {tickerQuery && (
              <button
                onClick={handleTickerClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {/* 자동완성 드롭다운 */}
            {showTickerDropdown && tickerQuery && (
              <div className="absolute top-full left-0 w-64 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg overflow-hidden z-50">
                {tickerResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">검색 결과가 없습니다</div>
                ) : (
                  <ul className="max-h-48 overflow-y-auto">
                    {tickerResults.map((result, index) => (
                      <li
                        key={result.code}
                        onClick={() => handleTickerSelect(result.code)}
                        onMouseEnter={() => setTickerSelectedIndex(index)}
                        className={`px-4 py-2 cursor-pointer flex items-center justify-between ${
                          index === tickerSelectedIndex ? 'bg-gray-700' : 'hover:bg-gray-700/50'
                        }`}
                      >
                        <span className="text-sm truncate">{result.name}</span>
                        <span className="text-sm text-yellow-400 font-mono ml-2">{result.code}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <span className="text-gray-600 mx-1">|</span>

          <span className="text-sm bg-green-700 text-white px-2 py-1 rounded">세부 기준</span>
          <select
            value={detailBase}
            onChange={(e) => {
              const value = e.target.value as DetailBase;
              setDetailBase(value);
              if (!value) {
                setDetailCompare('');
              }
            }}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
          >
            {DETAIL_BASE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {detailBase && (
            <>
              <span className="text-gray-400">→</span>
              <select
                value={detailCompare}
                onChange={(e) => setDetailCompare(e.target.value as DetailCompare)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
              >
                {DETAIL_COMPARE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          )}

          {detailBase && detailCompare && (
            <>
              <span className="text-gray-600 mx-1">|</span>
              <select
                value={detailDirection}
                onChange={(e) => setDetailDirection(e.target.value as DetailDirection)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
              >
                {DETAIL_DIRECTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          )}

          {/* 검색 버튼 - 오른쪽 정렬 */}
          <div className="flex items-center gap-4 ml-auto">
            {results.length > 0 && (
              <span className="text-sm text-gray-400">
                {results.length.toLocaleString()}개 결과
              </span>
            )}
            <button
              onClick={handleSearch}
              disabled={!startDate || !endDate}
              className="px-6 py-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
            >
              검색
            </button>
          </div>
        </div>
      </div>

      {/* 결과 테이블 */}
      <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden min-h-0 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">로딩 중...</div>
          </div>
        ) : !searchParams ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">기간과 기준을 선택하고 검색 버튼을 클릭하세요.</div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">검색 결과가 없습니다</div>
          </div>
        ) : (
          <>
            {/* 가격대 및 MA240 필터 바 */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-700/50 border-b border-gray-700 flex-wrap">
              <span className="text-sm text-gray-400">가격대:</span>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value as PriceRange)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
              >
                {PRICE_RANGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <span className="text-gray-600">|</span>

              <span className="text-sm text-gray-400">배열:</span>
              <select
                value={maFilter}
                onChange={(e) => setMaFilter(e.target.value as MaFilter)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
              >
                {MA_FILTER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <span className="text-sm text-gray-400 ml-auto">
                {sortedResults.length.toLocaleString()}개 표시
                {(priceRange !== 'all' || maFilter !== 'all') && ` (전체 ${results.length.toLocaleString()}개)`}
              </span>
            </div>
            <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-700 sticky top-0">
                <tr>
                  <th
                    onClick={() => toggleSort('날짜')}
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-gray-600"
                  >
                    날짜{getSortIcon('날짜')}
                  </th>
                  <th
                    onClick={() => toggleSort('티커')}
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-gray-600"
                  >
                    티커{getSortIcon('티커')}
                  </th>
                  <th
                    onClick={() => toggleSort('종목명')}
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-gray-600"
                  >
                    종목명{getSortIcon('종목명')}
                  </th>
                  <th
                    onClick={() => toggleSort('종가')}
                    className="px-4 py-3 text-right text-sm font-medium cursor-pointer hover:bg-gray-600"
                  >
                    종가{getSortIcon('종가')}
                  </th>
                  <th
                    onClick={() => toggleSort('등락률')}
                    className="px-4 py-3 text-right text-sm font-medium cursor-pointer hover:bg-gray-600"
                  >
                    등락률{getSortIcon('등락률')}
                  </th>
                  <th
                    onClick={() => toggleSort('거래대금')}
                    className="px-4 py-3 text-right text-sm font-medium cursor-pointer hover:bg-gray-600"
                  >
                    거래대금{getSortIcon('거래대금')}
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
                    <td className="px-4 py-2 text-sm">{item.날짜}</td>
                    <td className="px-4 py-2 text-sm font-mono text-yellow-400">{item.티커}</td>
                    <td className="px-4 py-2 text-sm truncate max-w-[200px]">{item.종목명}</td>
                    <td className="px-4 py-2 text-sm text-right">${item.종가.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-sm text-right ${
                      item.등락률 >= 0 ? 'text-red-400' : 'text-blue-400'
                    }`}>
                      {item.등락률 >= 0 ? '+' : ''}{item.등락률.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-400">
                      ${formatVolume(item.거래대금)}
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

export default GapAnalysisView;
