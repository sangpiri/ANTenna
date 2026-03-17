import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { krApi, usApi, getMarketApi } from '../../services/api';
import type { Market, EarningsData, FinancialsData } from '../../types/stock';
import FavoriteButton from './FavoriteButton';
import MemoButton from './MemoButton';
import FinancialsPanel from './FinancialsPanel';

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockCode: string;
  stockName: string;
  market: Market;
  baseDate?: string;
}

type ChartType = 'candle' | 'line';
type IntervalType = 'daily' | 'weekly' | 'monthly';

interface TooltipData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  gap?: number;
  change?: number;
  volume?: number;
}

// 날짜 포맷 함수 (그대로 반환)
const formatDate = (dateStr: string): string => {
  return dateStr;
};

// 거래대금 포맷 함수
const formatVolume = (value: number, market: Market): string => {
  if (market === 'kr') {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}조`;
    if (value >= 1e8) return `${(value / 1e8).toFixed(1)}억`;
    if (value >= 1e4) return `${(value / 1e4).toFixed(1)}만`;
    return value.toLocaleString();
  } else {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toLocaleString()}`;
  }
};

function ChartModal({
  isOpen,
  onClose,
  stockCode,
  stockName,
  market,
  baseDate,
}: ChartModalProps) {
  console.log('ChartModal render', { isOpen, stockCode, stockName });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const closedByPopStateRef = useRef(false);

  const [chartType, setChartType] = useState<ChartType>('candle');
  const [interval, setInterval] = useState<IntervalType>('daily');
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [showOverview, setShowOverview] = useState(false);
  const [showEarnings, setShowEarnings] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);
  const [maVisible, setMaVisible] = useState({ ma5: true, ma20: true, ma240: true });
  const ma5Ref = useRef<any>(null);
  const ma20Ref = useRef<any>(null);
  const ma240Ref = useRef<any>(null);

  // 기업개요 데이터 (클릭 시에만 fetch)
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: [market, 'overview', stockCode],
    queryFn: () => getMarketApi(market).getOverview(stockCode),
    enabled: showOverview,
  });

  // 실적 데이터 (클릭 시에만 fetch)
  const { data: earningsData, isLoading: earningsLoading } = useQuery<EarningsData[]>({
    queryKey: [market, 'earnings', stockCode],
    queryFn: () => getMarketApi(market).getEarnings(stockCode),
    enabled: showEarnings,
  });

  // 재무제표 데이터 (클릭 시에만 fetch)
  const { data: financialsData, isLoading: financialsLoading } = useQuery<FinancialsData[]>({
    queryKey: [market, 'financials', stockCode],
    queryFn: () => getMarketApi(market).getFinancials(stockCode),
    enabled: showFinancials,
  });

  // 모달 닫힐 때 패널 리셋
  useEffect(() => {
    if (!isOpen) {
      setShowOverview(false);
      setShowEarnings(false);
      setShowFinancials(false);
    }
  }, [isOpen]);

  // 브라우저 뒤로 가기 버튼으로 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    closedByPopStateRef.current = false;
    window.history.pushState({ chartModal: true }, '');

    const handlePopState = () => {
      closedByPopStateRef.current = true;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // X, ESC, 백드롭 클릭으로 닫은 경우 pushState한 히스토리 엔트리 제거
      if (!closedByPopStateRef.current) {
        window.history.back();
      }
    };
  }, [isOpen]);

  // 차트 데이터 조회 (2022-01-01 이후 전체 데이터, 약 1500일)
  const { data: historyData, isLoading } = useQuery({
    queryKey: [market, 'history', stockCode, baseDate, interval],
    queryFn: () =>
      market === 'kr'
        ? krApi.getHistory(stockCode, 1500, baseDate, interval)
        : usApi.getHistory(stockCode, 1500, baseDate, interval),
    enabled: isOpen && !!stockCode,
  });

  // 차트 초기화 및 데이터 업데이트
  useEffect(() => {
    console.log('useEffect triggered', { isOpen, hasContainer: !!chartContainerRef.current, historyData, isLoading });
    if (!isOpen || !chartContainerRef.current || !historyData) {
      console.log('Early return', { isOpen, hasContainer: !!chartContainerRef.current, hasData: !!historyData });
      return;
    }

    let chart: any = null;
    let candleSeries: any = null;
    let lineSeries: any = null;
    let volumeSeries: any = null;
    let ma5Series: any = null;
    let ma20Series: any = null;
    let ma240Series: any = null;

    const initChart = async () => {
      try {
        console.log('initChart called', { historyData, container: chartContainerRef.current });

        // 기존 차트 제거
        if (chartInstanceRef.current) {
          chartInstanceRef.current.remove();
          chartInstanceRef.current = null;
        }

        const lc = await import('lightweight-charts');
        console.log('lightweight-charts loaded', lc);

        if (!chartContainerRef.current) {
          console.log('No container ref');
          return;
        }

        // 컨테이너 높이 기반으로 차트 높이 계산
        const containerHeight = chartContainerRef.current.clientHeight;
        const isMobile = window.innerWidth < 640;
        const chartHeight = containerHeight > 0
          ? containerHeight
          : (isMobile ? Math.min(350, window.innerHeight * 0.5) : 500);

        chart = lc.createChart(chartContainerRef.current, {
          layout: {
            background: { color: '#1f2937' },
            textColor: '#9ca3af',
            fontSize: isMobile ? 10 : 12,
          },
          grid: {
            vertLines: { color: '#374151' },
            horzLines: { color: '#374151' },
          },
          rightPriceScale: {
            borderColor: '#374151',
            scaleMargins: {
              top: 0.1,
              bottom: 0.2,
            },
          },
          timeScale: {
            borderColor: '#374151',
            timeVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
            tickMarkFormatter: (time: any) => {
              if (typeof time === 'string') {
                const date = new Date(time);
                const month = date.getMonth() + 1;
                const day = date.getDate();
                return `${month}/${day}`;
              } else if (time.year !== undefined) {
                return `${time.month}/${time.day}`;
              }
              return String(time);
            },
          },
          crosshair: {
            mode: lc.CrosshairMode.Magnet,
            vertLine: {
              labelVisible: false,  // 시간축 라벨 숨김 (커스텀 툴팁 사용)
            },
          },
          localization: {
            dateFormat: 'yyyy-MM-dd',
          },
          width: chartContainerRef.current.clientWidth,
          height: chartHeight,
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false,
          },
          handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
          },
        });

        chartInstanceRef.current = chart;
        console.log('Chart created', chart);

        // 가격 포맷 설정 (한국주식: 정수, 미국주식: 소수점 2자리)
        const priceFormat = market === 'kr'
          ? { type: 'custom' as const, formatter: (price: number) => Math.round(price).toLocaleString() }
          : { type: 'price' as const, precision: 2, minMove: 0.01 };

        // 거래대금 시리즈 (먼저 추가하여 캔들 뒤에 렌더링)
        volumeSeries = chart.addHistogramSeries({
          priceFormat: {
            type: 'custom' as const,
            formatter: (price: number) => formatVolume(price, market)
          },
          priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        // 캔들스틱 시리즈
        candleSeries = chart.addCandlestickSeries({
          upColor: '#ef5350',
          downColor: '#3b82f6',
          borderUpColor: '#ef5350',
          borderDownColor: '#3b82f6',
          wickUpColor: '#ef5350',
          wickDownColor: '#3b82f6',
          visible: chartType === 'candle',
          priceFormat,
        });

        // 라인 시리즈
        lineSeries = chart.addLineSeries({
          color: '#ffffff',
          lineWidth: 4,
          visible: chartType === 'line',
          priceFormat,
        });

        // MA5 시리즈
        ma5Series = chart.addLineSeries({
          color: '#ec4899',
          lineWidth: 1,
          priceFormat,
          lastValueVisible: false,
          priceLineVisible: false,
          visible: maVisible.ma5,
        });
        ma5Ref.current = ma5Series;

        // MA20 시리즈
        ma20Series = chart.addLineSeries({
          color: '#f59e0b',
          lineWidth: 1,
          priceFormat,
          lastValueVisible: false,
          priceLineVisible: false,
          visible: maVisible.ma20,
        });
        ma20Ref.current = ma20Series;

        // MA240 시리즈
        ma240Series = chart.addLineSeries({
          color: '#8b5cf6',
          lineWidth: 1,
          priceFormat,
          lastValueVisible: false,
          priceLineVisible: false,
          visible: maVisible.ma240,
        });
        ma240Ref.current = ma240Series;

        // 데이터 설정
        if (historyData.candle) candleSeries.setData(historyData.candle);
        if (historyData.line) lineSeries.setData(historyData.line);
        if (historyData.volume) {
          // 거래대금에 반투명 색상 적용 (상승: 빨강, 하락: 파랑)
          const volumeWithColors = historyData.volume.map((v: any, i: number) => {
            const candle = historyData.candle?.[i];
            const isUp = candle ? candle.close >= candle.open : true;
            return {
              ...v,
              color: isUp ? 'rgba(239, 83, 80, 0.4)' : 'rgba(59, 130, 246, 0.4)',
            };
          });
          volumeSeries.setData(volumeWithColors);
        }
        // MA5 계산 (캔들 종가 기반)
        if (historyData.candle && historyData.candle.length > 0) {
          const period = 5;
          const ma5Data: any[] = [];
          const decimalPlaces = market === 'kr' ? 0 : 2;
          for (let i = period - 1; i < historyData.candle.length; i++) {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
              sum += historyData.candle[j].close;
            }
            ma5Data.push({
              time: historyData.candle[i].time,
              value: parseFloat((sum / period).toFixed(decimalPlaces)),
            });
          }
          ma5Series.setData(ma5Data);
        }
        if (historyData.ma20) ma20Series.setData(historyData.ma20);
        if (historyData.ma240) ma240Series.setData(historyData.ma240);

        // baseDate가 있으면 해당 날짜가 오른쪽 끝에 오도록 스크롤
        if (baseDate && historyData.line && historyData.line.length > 0) {
          const baseDateParts = baseDate.split('-').map(Number);
          const baseTime = { year: baseDateParts[0], month: baseDateParts[1], day: baseDateParts[2] };

          // baseDate 위치 찾기
          const baseIndex = historyData.line.findIndex((item: any) => {
            if (typeof item.time === 'string') {
              return item.time === baseDate;
            }
            return item.time.year === baseTime.year &&
                   item.time.month === baseTime.month &&
                   item.time.day === baseTime.day;
          });

          if (baseIndex !== -1) {
            // 모든 interval에서 최근 90봉 표시
            const visibleBars = 90;
            const fromIndex = Math.max(0, baseIndex - visibleBars + 1);
            const fromTime = historyData.line[fromIndex].time;
            const toTime = historyData.line[baseIndex].time;

            chart.timeScale().setVisibleRange({ from: fromTime, to: toTime });
          } else {
            chart.timeScale().fitContent();
          }
        } else {
          // interval에 따라 초기 표시 범위 조정
          const sourceData = historyData.line || historyData.candle;
          if (sourceData && sourceData.length > 0) {
            const lastItem = sourceData[sourceData.length - 1] as any;
            const lastTimeStr = typeof lastItem.time === 'string'
              ? lastItem.time
              : `${lastItem.time.year}-${String(lastItem.time.month).padStart(2, '0')}-${String(lastItem.time.day).padStart(2, '0')}`;
            const lastDate = new Date(lastTimeStr + 'T00:00:00');
            const fromDate = new Date(lastDate);
            if (interval === 'monthly') {
              fromDate.setMonth(fromDate.getMonth() - 90);
            } else if (interval === 'weekly') {
              fromDate.setDate(fromDate.getDate() - 90 * 7);
            } else {
              fromDate.setDate(fromDate.getDate() - 90);
            }
            const fromStr = fromDate.toISOString().slice(0, 10);
            chart.timeScale().setVisibleRange({ from: fromStr, to: lastTimeStr });
          } else {
            chart.timeScale().fitContent();
          }
        }

        // 시간축 크로스헤어 라벨 포맷 설정
        chart.timeScale().applyOptions({
          tickMarkFormatter: (time: any) => {
            if (time.year !== undefined) {
              return `${time.month}/${time.day}`;
            }
            return '';
          },
        });

        // 갭률 맵 생성 (전일 종가 → 당일 시가)
        const gapMap: Record<string, number> = {};
        if (historyData.candle && historyData.candle.length > 1) {
          const toTimeStr = (t: any): string => {
            if (typeof t === 'string') return t;
            if (t.year !== undefined) {
              return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
            }
            return String(t);
          };
          for (let i = 1; i < historyData.candle.length; i++) {
            const prevClose = historyData.candle[i - 1].close;
            const currOpen = historyData.candle[i].open;
            const timeKey = toTimeStr(historyData.candle[i].time);
            gapMap[timeKey] = ((currOpen - prevClose) / prevClose) * 100;
          }
        }

        // 크로스헤어 이동 시 툴팁 업데이트
        chart.subscribeCrosshairMove((param: any) => {
          if (!param || !param.time) {
            setTooltip(null);
            return;
          }

          // param.time을 문자열로 변환
          let timeStr: string;
          let year: number, month: number, day: number;

          if (typeof param.time === 'string') {
            timeStr = param.time;
            const parts = param.time.split('-');
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
            day = parseInt(parts[2]);
          } else if (param.time.year !== undefined) {
            year = param.time.year;
            month = param.time.month;
            day = param.time.day;
            timeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          } else {
            setTooltip(null);
            return;
          }

          // historyData에서 직접 해당 날짜의 캔들 데이터 찾기
          const candleInfo = historyData.candle?.find((c: any) => {
            if (typeof c.time === 'string') {
              return c.time === timeStr;
            } else if (c.time.year !== undefined) {
              return c.time.year === year && c.time.month === month && c.time.day === day;
            }
            return false;
          });

          const volumeInfo = historyData.volume?.find((v: any) => {
            if (typeof v.time === 'string') {
              return v.time === timeStr;
            } else if (v.time.year !== undefined) {
              return v.time.year === year && v.time.month === month && v.time.day === day;
            }
            return false;
          });

          const changeData = historyData.change?.[timeStr];
          const gapData = gapMap[timeStr];

          if (candleInfo) {
            setTooltip({
              time: timeStr,
              open: candleInfo.open,
              high: candleInfo.high,
              low: candleInfo.low,
              close: candleInfo.close,
              gap: gapData,
              change: changeData,
              volume: volumeInfo?.value,
            });
          } else {
            // 캔들 데이터가 없으면 (거래정지일 등) 라인 데이터에서 찾기
            const lineInfo = historyData.line?.find((l: any) => {
              if (typeof l.time === 'string') {
                return l.time === timeStr;
              } else if (l.time.year !== undefined) {
                return l.time.year === year && l.time.month === month && l.time.day === day;
              }
              return false;
            });

            if (lineInfo) {
              setTooltip({
                time: timeStr,
                open: lineInfo.value,
                high: lineInfo.value,
                low: lineInfo.value,
                close: lineInfo.value,
                change: changeData,
                volume: volumeInfo?.value,
              });
            } else {
              setTooltip(null);
            }
          }
        });

        // 리사이즈 핸들러
        const handleResize = () => {
          if (chartContainerRef.current && chartInstanceRef.current) {
            const newContainerHeight = chartContainerRef.current.clientHeight;
            const newChartHeight = newContainerHeight > 0 ? newContainerHeight : 300;
            chartInstanceRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: newChartHeight,
            });
          }
        };
        window.addEventListener('resize', handleResize);

        // 핸들러를 ref에 저장하여 cleanup에서 사용
        (chartInstanceRef.current as any)._resizeHandler = handleResize;

      } catch (error) {
        console.error('Chart error:', error);
      }
    };

    initChart();

    return () => {
      // 리사이즈 핸들러 제거
      if (chartInstanceRef.current && (chartInstanceRef.current as any)._resizeHandler) {
        window.removeEventListener('resize', (chartInstanceRef.current as any)._resizeHandler);
      }
      // 차트 인스턴스 제거
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [isOpen, historyData, chartType]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* 모달 */}
      <div className="relative bg-gray-800 rounded-lg shadow-xl w-full sm:w-[900px] max-w-[95vw] max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-4 border-b border-gray-700">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => setShowOverview(!showOverview)}
              className="text-left group w-full overflow-hidden"
            >
              <h2 className="text-base sm:text-xl font-bold truncate group-hover:text-blue-300 transition-colors">
                {stockName}
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline ml-1 text-gray-400 group-hover:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </h2>
              <span className="text-sm sm:text-lg font-mono text-yellow-400">{stockCode}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
            {/* 봉 간격 */}
            <div className="hidden sm:flex bg-gray-700 rounded p-1">
              {(['daily', 'weekly', 'monthly'] as IntervalType[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setInterval(v)}
                  className={`px-3 py-1 rounded text-sm ${
                    interval === v ? 'bg-green-700' : 'hover:bg-gray-600'
                  }`}
                >
                  {v === 'daily' ? '일' : v === 'weekly' ? '주' : '월'}
                </button>
              ))}
            </div>

            {/* 차트 타입 */}
            <div className="hidden sm:flex bg-gray-700 rounded p-1">
              <button
                onClick={() => setChartType('candle')}
                className={`px-3 py-1 rounded text-sm ${
                  chartType === 'candle' ? 'bg-green-700' : 'hover:bg-gray-600'
                }`}
              >
                캔들
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-3 py-1 rounded text-sm ${
                  chartType === 'line' ? 'bg-green-700' : 'hover:bg-gray-600'
                }`}
              >
                라인
              </button>
            </div>

            {/* 즐겨찾기 버튼 */}
            <FavoriteButton code={stockCode} name={stockName} market={market} />

            {/* 메모 버튼 */}
            <MemoButton code={stockCode} market={market} />

            {/* 닫기 버튼 */}
            <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-gray-700 rounded">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 모바일 차트 타입 + 봉 간격 선택 */}
        <div className="flex sm:hidden items-center justify-center gap-2 px-3 py-2 bg-gray-750 border-b border-gray-700">
          <div className="flex bg-gray-700 rounded p-0.5">
            {(['daily', 'weekly', 'monthly'] as IntervalType[]).map((v) => (
              <button
                key={v}
                onClick={() => setInterval(v)}
                className={`px-3 py-1 rounded text-xs ${
                  interval === v ? 'bg-green-700' : 'hover:bg-gray-600'
                }`}
              >
                {v === 'daily' ? '일' : v === 'weekly' ? '주' : '월'}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-700 rounded p-0.5">
            <button
              onClick={() => setChartType('candle')}
              className={`px-3 py-1 rounded text-xs ${
                chartType === 'candle' ? 'bg-green-700' : 'hover:bg-gray-600'
              }`}
            >
              캔들
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1 rounded text-xs ${
                chartType === 'line' ? 'bg-green-700' : 'hover:bg-gray-600'
              }`}
            >
              라인
            </button>
          </div>
        </div>

        {/* 기업개요 패널 */}
        {showOverview && (
          <div className="px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-700 bg-gray-900/50">
            {overviewLoading ? (
              <div className="text-gray-400 text-sm">로딩 중...</div>
            ) : overviewData && (overviewData.industry || overviewData.overview) ? (
              <div className="space-y-2">
                {overviewData.industry && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-gray-400 flex-shrink-0">업종</span>
                    <span className="text-xs sm:text-sm text-blue-300 bg-blue-900/30 px-2 py-0.5 rounded">
                      {overviewData.industry}
                    </span>
                  </div>
                )}
                {overviewData.overview && (
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-h-32 overflow-y-auto">
                    {overviewData.overview}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">기업개요 정보가 없습니다.</div>
            )}
          </div>
        )}

        {/* 차트 */}
        <div className="p-2 sm:p-4 relative flex-1 min-h-0 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
              <div className="text-gray-400 text-sm">차트 로딩 중...</div>
            </div>
          )}

          {/* 툴팁 (캔들 hover 시 변동률 표시) */}
          {tooltip && (
            <div className="absolute top-2 sm:top-6 left-2 sm:left-6 bg-gray-900/90 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm z-20 pointer-events-none">
              <div className="text-gray-400 mb-1">{formatDate(tooltip.time)}</div>
              <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-0.5 sm:gap-y-1">
                <span className="text-gray-400">시가</span>
                <span className="text-right">{tooltip.open?.toLocaleString()}</span>
                <span className="text-gray-400">고가</span>
                <span className="text-right text-red-400">{tooltip.high?.toLocaleString()}</span>
                <span className="text-gray-400">저가</span>
                <span className="text-right text-blue-400">{tooltip.low?.toLocaleString()}</span>
                <span className="text-gray-400">종가</span>
                <span className="text-right">{tooltip.close?.toLocaleString()}</span>
                {tooltip.gap !== undefined && (
                  <>
                    <span className="text-gray-400">갭률</span>
                    <span className={`text-right font-medium ${tooltip.gap >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                      {tooltip.gap >= 0 ? '+' : ''}{tooltip.gap.toFixed(2)}%
                    </span>
                  </>
                )}
                {tooltip.change !== undefined && (
                  <>
                    <span className="text-gray-400">등락률</span>
                    <span className={`text-right font-medium ${tooltip.change >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                      {tooltip.change >= 0 ? '+' : ''}{tooltip.change.toFixed(2)}%
                    </span>
                  </>
                )}
                {tooltip.volume !== undefined && (
                  <>
                    <span className="text-gray-400">거래대금</span>
                    <span className="text-right text-white">{formatVolume(tooltip.volume, market)}</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div ref={chartContainerRef} className="w-full h-[50vh] sm:h-[500px] min-h-[280px]" />
        </div>

        {/* 범례 + 실적 버튼 */}
        <div className="flex items-center gap-4 sm:gap-6 px-3 sm:px-6 pb-2 sm:pb-4 text-xs sm:text-sm">
          <button
            onClick={() => {
              const next = !maVisible.ma5;
              setMaVisible(v => ({ ...v, ma5: next }));
              ma5Ref.current?.applyOptions({ visible: next });
            }}
            className={`flex items-center gap-1 sm:gap-2 ${maVisible.ma5 ? '' : 'opacity-30'}`}
          >
            <div className="w-2 sm:w-3 h-0.5 bg-pink-500" />
            <span className="text-gray-400">MA5</span>
          </button>
          <button
            onClick={() => {
              const next = !maVisible.ma20;
              setMaVisible(v => ({ ...v, ma20: next }));
              ma20Ref.current?.applyOptions({ visible: next });
            }}
            className={`flex items-center gap-1 sm:gap-2 ${maVisible.ma20 ? '' : 'opacity-30'}`}
          >
            <div className="w-2 sm:w-3 h-0.5 bg-yellow-500" />
            <span className="text-gray-400">MA20</span>
          </button>
          <button
            onClick={() => {
              const next = !maVisible.ma240;
              setMaVisible(v => ({ ...v, ma240: next }));
              ma240Ref.current?.applyOptions({ visible: next });
            }}
            className={`flex items-center gap-1 sm:gap-2 ${maVisible.ma240 ? '' : 'opacity-30'}`}
          >
            <div className="w-2 sm:w-3 h-0.5 bg-purple-500" />
            <span className="text-gray-400">MA240</span>
          </button>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => {
                setShowEarnings(!showEarnings);
                if (!showEarnings) setShowFinancials(false);
              }}
              className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded text-xs sm:text-sm ${
                showEarnings
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              실적
            </button>
            <button
              onClick={() => {
                setShowFinancials(!showFinancials);
                if (!showFinancials) setShowEarnings(false);
              }}
              className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded text-xs sm:text-sm ${
                showFinancials
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              재무제표
            </button>
          </div>
        </div>

        {/* 실적 테이블 (가로 배치) */}
        {showEarnings && (
          <div className="px-3 sm:px-6 pb-3 sm:pb-4 border-t border-gray-700 pt-3">
            {earningsLoading ? (
              <div className="text-gray-400 text-sm text-center py-4">실적 데이터 로딩 중...</div>
            ) : earningsData && earningsData.length > 0 ? (() => {
              const formatEarningsUsd = (amount: number | null) => {
                if (amount == null) return '-';
                const abs = Math.abs(amount);
                const sign = amount < 0 ? '-' : '';
                if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
                if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
                return `${sign}$${(abs / 1e3).toFixed(1)}K`;
              };
              const formatEarningsKrw = (amount: number | null | undefined) => {
                if (amount == null) return '-';
                const abs = Math.abs(amount);
                const sign = amount < 0 ? '-' : '';
                if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}조`;
                if (abs >= 1e8) return `${sign}${Math.round(abs / 1e8).toLocaleString()}억`;
                if (abs >= 1e4) return `${sign}${Math.round(abs / 1e4).toLocaleString()}만`;
                return `${sign}${Math.round(abs).toLocaleString()}`;
              };
              const formatAmt = market === 'us' ? formatEarningsUsd : formatEarningsKrw;
              const surpriseColor = (v: number | null) =>
                v != null ? (v > 0 ? 'text-red-400' : v < 0 ? 'text-blue-400' : 'text-gray-400') : 'text-gray-500';
              const formatSurprise = (v: number | null) =>
                v != null ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : '-';

              const rows: { label: string; getValue: (row: EarningsData) => string; getColor?: (row: EarningsData) => string }[] = market === 'us' ? [
                { label: '매출', getValue: r => formatAmt(r.매출) },
                { label: '매출예상', getValue: r => formatAmt(r.매출예상) },
                { label: '매출차이', getValue: r => formatSurprise(r.매출서프라이즈), getColor: r => surpriseColor(r.매출서프라이즈) },
                { label: 'EPS', getValue: r => r.EPS != null ? r.EPS.toFixed(2) : '-' },
                { label: 'EPS예상', getValue: r => r.EPS예상 != null ? r.EPS예상.toFixed(2) : '-' },
                { label: 'EPS차이', getValue: r => formatSurprise(r.EPS서프라이즈 ?? null), getColor: r => surpriseColor(r.EPS서프라이즈 ?? null) },
              ] : [
                { label: '매출', getValue: r => formatAmt(r.매출) },
                { label: '매출예상', getValue: r => formatAmt(r.매출예상) },
                { label: '매출차이', getValue: r => formatSurprise(r.매출서프라이즈), getColor: r => surpriseColor(r.매출서프라이즈) },
                { label: '영업이익', getValue: r => formatAmt(r.영업이익 ?? null) },
                { label: '영업이익예상', getValue: r => formatAmt(r.영업이익예상 ?? null) },
                { label: '영업이익차이', getValue: r => formatSurprise(r.영업이익서프라이즈 ?? null), getColor: r => surpriseColor(r.영업이익서프라이즈 ?? null) },
              ];

              return (
                <div className="overflow-auto max-h-[300px] rounded border border-gray-700">
                  <table className="text-xs sm:text-sm border-collapse">
                    <thead className="bg-gray-700 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 sm:px-3 py-1.5 text-left text-gray-300 font-medium sticky left-0 bg-gray-700 z-20 min-w-[88px] sm:min-w-[100px] whitespace-nowrap">
                          항목
                        </th>
                        {earningsData.map((row, i) => (
                          <th key={i} className="px-2 sm:px-3 py-1.5 text-right text-gray-300 font-medium whitespace-nowrap min-w-[70px] sm:min-w-[85px]">
                            {row.분기}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((field, fi) => (
                        <tr key={field.label} className={`${fi % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}${fi === 3 ? ' border-t border-gray-600' : ''}`}>
                          <td className={`px-2 sm:px-3 py-1 text-gray-300 font-medium sticky left-0 z-10 whitespace-nowrap ${fi % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`}>
                            {field.label}
                          </td>
                          {earningsData.map((row, ci) => (
                            <td key={ci} className={`px-2 sm:px-3 py-1 text-right whitespace-nowrap font-medium ${field.getColor ? field.getColor(row) : 'text-gray-200'}`}>
                              {field.getValue(row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })() : (
              <div className="text-gray-500 text-sm text-center py-4">실적 데이터가 없습니다.</div>
            )}
          </div>
        )}

        {/* 재무제표 패널 */}
        {showFinancials && (
          financialsLoading ? (
            <div className="px-3 sm:px-6 pb-3 sm:pb-4 border-t border-gray-700 pt-3">
              <div className="text-gray-400 text-sm text-center py-4">재무제표 데이터 로딩 중...</div>
            </div>
          ) : financialsData && financialsData.length > 0 ? (
            <FinancialsPanel data={financialsData} market={market} />
          ) : (
            <div className="px-3 sm:px-6 pb-3 sm:pb-4 border-t border-gray-700 pt-3">
              <div className="text-gray-500 text-sm text-center py-4">재무제표 데이터가 없습니다.</div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default ChartModal;
