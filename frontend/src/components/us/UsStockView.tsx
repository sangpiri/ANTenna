import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usApi } from '../../services/api';
import type { StockRecord } from '../../types/stock';
import Calendar from '../common/Calendar';
import StockTable from '../common/StockTable';
import ChartModal from '../common/ChartModal';
import AnalysisTabs from '../common/AnalysisTabs';
import GapAnalysisView from './GapAnalysisView';

type PriceRange = 'high' | 'mid' | 'low';
type SortType = 'volume' | 'rate';
type ViewMode = 'table' | 'analysis';
type QueryMode = 'basic' | 'advanced';

interface UsStockViewProps {
  selectedFavoriteStock?: { code: string; name: string } | null;
  onClearFavoriteStock?: () => void;
  queryMode: QueryMode;
}

function UsStockView({ selectedFavoriteStock, onClearFavoriteStock, queryMode }: UsStockViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<PriceRange>('high');
  const [sortType, setSortType] = useState<SortType>('volume');
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // 차트 모달 상태
  const [chartModal, setChartModal] = useState<{
    isOpen: boolean;
    code: string;
    name: string;
    baseDate?: string;
  }>({ isOpen: false, code: '', name: '' });

  // 즐겨찾기에서 선택된 종목 처리
  useEffect(() => {
    if (selectedFavoriteStock) {
      setChartModal({
        isOpen: true,
        code: selectedFavoriteStock.code,
        name: selectedFavoriteStock.name,
        baseDate: undefined,
      });
      onClearFavoriteStock?.();
    }
  }, [selectedFavoriteStock, onClearFavoriteStock]);

  // 날짜 목록 가져오기
  const { data: datesInfo, isLoading: datesLoading } = useQuery({
    queryKey: ['us', 'dates'],
    queryFn: usApi.getDates,
  });

  // 선택된 날짜가 없으면 가장 최근 날짜 선택
  const currentDate = selectedDate || datesInfo?.dates[datesInfo.dates.length - 1];

  // 일별 데이터 가져오기
  const { data: dayData, isLoading: dataLoading } = useQuery({
    queryKey: ['us', 'data', currentDate],
    queryFn: () => usApi.getData(currentDate!),
    enabled: !!currentDate,
  });

  // 카테고리 키 생성
  const getCategoryKey = () => `${priceRange}_price_${sortType}`;
  const category = getCategoryKey();

  const stocks = dayData?.[category as keyof typeof dayData] as StockRecord[] | undefined;

  const priceRangeLabels: Record<PriceRange, string> = {
    high: '$10 이상',
    mid: '$5~$10',
    low: '$5 미만',
  };

  const handleStockClick = (stock: StockRecord) => {
    setChartModal({
      isOpen: true,
      code: stock.티커 || '',
      name: stock.종목명,
      baseDate: undefined,
    });
  };

  const handleAnalysisStockClick = (code: string, name: string, date?: string) => {
    setChartModal({ isOpen: true, code, name, baseDate: date });
  };

  if (datesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">데이터 로딩 중...</div>
      </div>
    );
  }

  // 가격대 라벨 (모바일용 축약)
  const priceRangeLabelsMobile: Record<PriceRange, string> = {
    high: '$10+',
    mid: '$5-10',
    low: '<$5',
  };

  return (
    <div className="p-2 sm:p-4 h-[calc(100vh-48px)] sm:h-[calc(100vh-56px)] flex flex-col">
      {/* 기본 조회 모드 */}
      {queryMode === 'basic' && (
        <>
          {/* 상단 컨트롤 */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap mb-2 sm:mb-4">
            {/* 날짜 선택 버튼 */}
            <div className="relative">
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="flex items-center gap-1 sm:gap-2 bg-gray-800 border border-gray-600 rounded px-2 sm:px-4 py-1.5 sm:py-2 hover:bg-gray-700 text-sm"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{currentDate || '날짜 선택'}</span>
              </button>

              {/* 캘린더 드롭다운 */}
              {showCalendar && datesInfo && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowCalendar(false)} />
                  <div className="absolute top-full left-0 mt-2 z-40">
                    <Calendar
                      availableDates={datesInfo.dates}
                      selectedDate={currentDate || null}
                      onSelectDate={(date) => {
                        setSelectedDate(date);
                        setShowCalendar(false);
                      }}
                      minYear={datesInfo.min_year}
                      maxYear={datesInfo.max_year}
                      initialYear={currentDate ? parseInt(currentDate.slice(0, 4)) : datesInfo.initial_year}
                      initialMonth={currentDate ? parseInt(currentDate.slice(5, 7)) : datesInfo.initial_month}
                    />
                  </div>
                </>
              )}
            </div>

            {/* 가격대 선택 */}
            <div className="flex bg-gray-700 rounded-lg p-0.5 sm:p-1">
              {(['high', 'mid', 'low'] as PriceRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setPriceRange(range)}
                  className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm whitespace-nowrap ${
                    priceRange === range
                      ? 'bg-green-700 text-white'
                      : 'text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span className="hidden sm:inline">{priceRangeLabels[range]}</span>
                  <span className="sm:hidden">{priceRangeLabelsMobile[range]}</span>
                </button>
              ))}
            </div>

            {/* 정렬 선택 */}
            <div className="flex bg-gray-700 rounded-lg p-0.5 sm:p-1">
              <div className="relative group">
                <button
                  onClick={() => setSortType('volume')}
                  className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm whitespace-nowrap ${
                    sortType === 'volume'
                      ? 'bg-green-700 text-white'
                      : 'text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span className="hidden sm:inline">거래대금순</span>
                  <span className="sm:hidden">거래대금</span>
                </button>
                <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-gray-300 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  상승률 3% 이상 종목 중 거래대금순
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
              <button
                onClick={() => setSortType('rate')}
                className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm whitespace-nowrap ${
                  sortType === 'rate'
                    ? 'bg-green-700 text-white'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span className="hidden sm:inline">상승률순</span>
                <span className="sm:hidden">상승률</span>
              </button>
            </div>

            {/* 뷰 모드 */}
            <div className="flex bg-gray-700 rounded-lg p-0.5 sm:p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'bg-green-700 text-white'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span className="hidden sm:inline">종목 목록</span>
                <span className="sm:hidden">목록</span>
              </button>
              <button
                onClick={() => setViewMode('analysis')}
                className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm whitespace-nowrap ${
                  viewMode === 'analysis'
                    ? 'bg-green-700 text-white'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                조건 검색
              </button>
            </div>

            {/* 데이터 개수 */}
            {stocks && viewMode === 'table' && (
              <span className="text-gray-400 text-xs sm:text-sm hidden sm:inline">
                총 {stocks.length}개 종목
              </span>
            )}
          </div>

          {/* 메인 콘텐츠 (기본 조회) */}
          {viewMode === 'table' ? (
            // 주식 테이블
            dataLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">데이터 로딩 중...</div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg overflow-hidden flex-1 min-h-0">
                <StockTable
                  data={stocks || []}
                  market="us"
                  onRowClick={handleStockClick}
                  pageSize={50}
                />
              </div>
            )
          ) : (
            // 조건 검색 탭
            currentDate && (
              <div className="flex-1 min-h-0">
                <AnalysisTabs
                  market="us"
                  category={category}
                  selectedDate={currentDate}
                  onStockClick={handleAnalysisStockClick}
                />
              </div>
            )
          )}
        </>
      )}

      {/* 고급 조회 모드 */}
      {queryMode === 'advanced' && datesInfo && (
        <div className="flex-1 min-h-0">
          <GapAnalysisView
            onStockClick={handleAnalysisStockClick}
            availableDates={datesInfo.dates}
            minYear={datesInfo.min_year}
            maxYear={datesInfo.max_year}
            initialYear={datesInfo.initial_year}
            initialMonth={datesInfo.initial_month}
          />
        </div>
      )}

      {/* 차트 모달 */}
      <ChartModal
        isOpen={chartModal.isOpen}
        onClose={() => setChartModal({ isOpen: false, code: '', name: '' })}
        stockCode={chartModal.code}
        stockName={chartModal.name}
        market="us"
        baseDate={chartModal.baseDate || currentDate}
      />
    </div>
  );
}

export default UsStockView;
