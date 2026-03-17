import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { indicesApi } from '../../services/api';

interface IndexChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  name: string;
}

type ChartType = 'candle' | 'line';
type IntervalType = 'daily' | 'weekly' | 'monthly';

// 계절조정 데이터 티커
const SA_TICKERS: Record<string, string> = {
  'KR-UNRATE': '계절조정',
  'UNRATE':    'Seasonally Adjusted',
};

// 단위 라벨
const UNIT_LABELS: Record<string, string> = {
  'GC=F':     'USD / troy oz',
  'SI=F':     'USD / troy oz',
  'HG=F':     'USD / lb',
  'CL=F':     'USD / bbl',
  'BTC-USD':  'USD',
  'USDKRW=X': 'KRW / USD',
  'DX-Y.NYB': 'Index',
};

// 라인 차트가 기본인 티커
const LINE_TICKERS = new Set([
  'DX-Y.NYB', 'USDKRW=X',
  // 거시경제 지표 (월별/분기별 데이터 → 라인 전용)
  'DFEDTARU', 'DGS3', 'DGS10', 'CPIAUCSL', 'UNRATE', 'GDPC1',
  'KR-BASE-RATE', 'KR-3Y', 'KR-10Y', 'KR-CPI', 'KR-UNRATE', 'KR-GDP',
]);

// 거래량을 표시하지 않는 티커 (선물/FX/인덱스/거시경제)
const NO_VOLUME_TICKERS = new Set([
  'GC=F', 'SI=F', 'HG=F', 'CL=F', 'DX-Y.NYB', 'USDKRW=X',
  'DFEDTARU', 'DGS3', 'DGS10', 'CPIAUCSL', 'UNRATE', 'GDPC1',
  'KR-BASE-RATE', 'KR-3Y', 'KR-10Y', 'KR-CPI', 'KR-UNRATE', 'KR-GDP',
]);

// MA20/MA240을 표시하지 않는 티커 (기준금리·GDP·실업률·CPI는 이동평균 불필요)
const NO_MA_TICKERS = new Set([
  'DFEDTARU', 'GDPC1', 'UNRATE', 'CPIAUCSL',
  'KR-BASE-RATE', 'KR-GDP', 'KR-UNRATE', 'KR-CPI',
]);

// 일별 반복 데이터를 변곡점만으로 필터링 (기준금리: 값 변경일에만 snap)
const DEDUPE_LINE_TICKERS = new Set(['DFEDTARU', 'KR-BASE-RATE']);

function getDefaultChartType(ticker: string): ChartType {
  return LINE_TICKERS.has(ticker) ? 'line' : 'candle';
}

// 티커별 가격 포맷 (lightweight-charts 용)
function getPriceFormat(ticker: string) {
  if (['^KS11', '^KQ11', 'BTC-USD'].includes(ticker)) {
    return {
      type: 'custom' as const,
      formatter: (price: number) => Math.round(price).toLocaleString(),
    };
  }
  if (ticker === 'GDPC1') return {
    type: 'custom' as const,
    formatter: (price: number) => `${Math.round(price).toLocaleString('en-US')}B`,
  };
  if (ticker === 'KR-GDP') return {
    type: 'custom' as const,
    formatter: (price: number) => `${(price / 1000).toFixed(0)}조`,
  };
  if (ticker === 'HG=F') return { type: 'price' as const, precision: 4, minMove: 0.0001 };
  if (ticker === 'SI=F') return { type: 'price' as const, precision: 3, minMove: 0.001 };
  return { type: 'price' as const, precision: 2, minMove: 0.01 };
}

// 툴팁용 가격 포맷
function formatIndexPrice(ticker: string, price: number): string {
  if (['^KS11', '^KQ11', 'BTC-USD'].includes(ticker)) {
    return Math.round(price).toLocaleString();
  }
  if (ticker === 'GDPC1') return `${Math.round(price).toLocaleString('en-US')}B`;
  if (ticker === 'KR-GDP') return `${(price / 1000).toFixed(1)}조`;
  if (ticker === 'HG=F') return price.toFixed(4);
  if (ticker === 'SI=F') return price.toFixed(3);
  return price.toFixed(2);
}

// 거래량 포맷
function formatIndexVolume(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}

interface TooltipData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change?: number;
  volume?: number;
}

export default function IndexChartModal({
  isOpen,
  onClose,
  ticker,
  name,
}: IndexChartModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const closedByPopStateRef = useRef(false);

  const [chartType, setChartType] = useState<ChartType>(() => getDefaultChartType(ticker));
  const [interval, setInterval] = useState<IntervalType>('daily');
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [maVisible, setMaVisible] = useState({ ma20: true, ma240: true });
  const ma20Ref = useRef<any>(null);
  const ma240Ref = useRef<any>(null);

  // ticker 변경 시 기본 차트 타입 리셋
  useEffect(() => {
    setChartType(getDefaultChartType(ticker));
  }, [ticker]);

  // 브라우저 뒤로 가기로 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    closedByPopStateRef.current = false;
    window.history.pushState({ indexChartModal: true }, '');

    const handlePopState = () => {
      closedByPopStateRef.current = true;
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (!closedByPopStateRef.current) {
        window.history.back();
      }
    };
  }, [isOpen]);

  // 차트 데이터 조회
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['indices', 'history', ticker, interval],
    queryFn: () => indicesApi.getHistory(ticker, interval),
    enabled: isOpen && !!ticker,
    staleTime: 5 * 60 * 1000,
  });

  // 차트 초기화 및 데이터 업데이트
  useEffect(() => {
    if (!isOpen || !chartContainerRef.current || !historyData) return;

    const initChart = async () => {
      try {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.remove();
          chartInstanceRef.current = null;
        }

        // DOM 레이아웃 완료 후 실행 (캐시 데이터로 즉시 열릴 때 clientWidth=0 방지)
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        if (!chartContainerRef.current) return;

        const lc = await import('lightweight-charts');
        if (!chartContainerRef.current) return;

        const isMobile = window.innerWidth < 640;
        const hasVolume = !NO_VOLUME_TICKERS.has(ticker) && !!(historyData?.volume && historyData.volume.length > 0);
        const chart = lc.createChart(chartContainerRef.current, {
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
            scaleMargins: { top: 0.1, bottom: hasVolume ? 0.2 : NO_MA_TICKERS.has(ticker) ? 0.1 : 0 },
          },
          timeScale: {
            borderColor: '#374151',
            timeVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
            tickMarkFormatter: (time: any) => {
              if (typeof time === 'string') {
                const d = new Date(time);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              } else if (time.year !== undefined) {
                return `${time.month}/${time.day}`;
              }
              return String(time);
            },
          },
          crosshair: {
            mode: lc.CrosshairMode.Magnet,
            vertLine: { labelVisible: false },
          },
          localization: { dateFormat: 'yyyy-MM-dd' },
          width: chartContainerRef.current.clientWidth,
          height: isMobile ? Math.min(350, window.innerHeight * 0.5) : 500,
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

        const priceFormat = getPriceFormat(ticker);
        const showVolume = hasVolume;
        const lineOnly = LINE_TICKERS.has(ticker);

        // 거래량 시리즈 (있을 때만, NO_VOLUME_TICKERS 제외)
        let volumeSeries: any = null;
        if (showVolume) {
          volumeSeries = chart.addHistogramSeries({
            priceFormat: { type: 'custom' as const, formatter: formatIndexVolume },
            priceScaleId: 'volume',
          });
          chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
          });
        }

        // 캔들스틱 시리즈 (라인 전용 티커는 생성하지 않음)
        let candleSeries: any = null;
        if (!lineOnly) {
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
        }

        // 라인 시리즈 (거시경제 지표는 계단식 라인)
        const lineSeries = chart.addLineSeries({
          color: '#ffffff',
          lineWidth: 2,
          lineType: NO_MA_TICKERS.has(ticker) ? lc.LineType.WithSteps : lc.LineType.Simple,
          visible: lineOnly || chartType === 'line',
          priceFormat,
        });

        const showMA = !NO_MA_TICKERS.has(ticker);

        // MA20 시리즈
        const ma20Series = showMA ? chart.addLineSeries({
          color: '#f59e0b',
          lineWidth: 1,
          priceFormat,
          lastValueVisible: false,
          priceLineVisible: false,
          visible: maVisible.ma20,
        }) : null;
        ma20Ref.current = ma20Series;

        // MA240 시리즈
        const ma240Series = showMA ? chart.addLineSeries({
          color: '#8b5cf6',
          lineWidth: 1,
          priceFormat,
          lastValueVisible: false,
          priceLineVisible: false,
          visible: maVisible.ma240,
        }) : null;
        ma240Ref.current = ma240Series;

        // 데이터 설정 (shallow clone: lightweight-charts가 setData 시 time 필드를 숫자로 mutate하여
        //   React Query 캐시 원본이 오염되는 것을 방지)
        if (candleSeries && historyData.candle) candleSeries.setData(historyData.candle.map((c: any) => ({ ...c })));

        // 라인 데이터: 기준금리도 전체 데이터 사용 (시간축 비례 정확)
        const lineData: any[] = historyData.line || [];

        if (lineData.length > 0) lineSeries.setData(lineData.map((d: any) => ({ ...d })));

        // 기준금리: 변곡점에 마커(●) 표시
        if (DEDUPE_LINE_TICKERS.has(ticker) && lineData.length > 0) {
          const markers: any[] = [];
          for (let i = 1; i < lineData.length; i++) {
            if (lineData[i].value !== lineData[i - 1].value) {
              markers.push({
                time: lineData[i].time,
                position: 'inBar',
                color: lineData[i].value > lineData[i - 1].value ? '#ef5350' : '#3b82f6',
                shape: 'circle',
                size: 1,
              });
            }
          }
          lineSeries.setMarkers(markers);
        }

        if (showVolume && volumeSeries && historyData.volume) {
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

        if (ma20Series && historyData.ma20) ma20Series.setData(historyData.ma20.map((m: any) => ({ ...m })));
        if (ma240Series && historyData.ma240) ma240Series.setData(historyData.ma240.map((m: any) => ({ ...m })));

        // 기본 표시 기간 설정 (setVisibleLogicalRange 사용)
        // 시장지표/국채금리(일별): 일봉 6개월 / 주봉 3년 / 월봉 6년
        // 거시경제(기준금리/CPI/실업률/GDP): 일봉 12개월 / 주봉 5년 / 월봉 10년
        if (lineData.length > 0) {
          const lastItem = lineData[lineData.length - 1] as any;
          const lastTime = typeof lastItem.time === 'string' ? lastItem.time : `${lastItem.time.year}-${String(lastItem.time.month).padStart(2, '0')}-${String(lastItem.time.day).padStart(2, '0')}`;
          const lastDate = new Date(lastTime + 'T00:00:00');
          const fromDate = new Date(lastDate);
          const isMacro = NO_MA_TICKERS.has(ticker);
          if (interval === 'monthly') {
            fromDate.setFullYear(fromDate.getFullYear() - (isMacro ? 10 : 6));
          } else if (interval === 'weekly') {
            fromDate.setFullYear(fromDate.getFullYear() - (isMacro ? 5 : 3));
          } else {
            fromDate.setMonth(fromDate.getMonth() - (isMacro ? 12 : 6));
          }
          const fromStr = fromDate.toISOString().slice(0, 10);
          chart.timeScale().setVisibleRange({ from: fromStr, to: lastTime });
        } else {
          chart.timeScale().fitContent();
        }

        // 크로스헤어 툴팁
        chart.subscribeCrosshairMove((param: any) => {
          if (!param || !param.time) {
            setTooltip(null);
            return;
          }

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

          const candleInfo = historyData.candle?.find((c: any) => {
            if (typeof c.time === 'string') return c.time === timeStr;
            return c.time.year === year && c.time.month === month && c.time.day === day;
          });

          const volumeInfo = historyData.volume?.find((v: any) => {
            if (typeof v.time === 'string') return v.time === timeStr;
            return v.time.year === year && v.time.month === month && v.time.day === day;
          });

          const changeData = historyData.change?.[timeStr];

          if (candleInfo) {
            setTooltip({
              time: timeStr,
              open: candleInfo.open,
              high: candleInfo.high,
              low: candleInfo.low,
              close: candleInfo.close,
              change: changeData,
              volume: volumeInfo?.value,
            });
          } else {
            setTooltip(null);
          }
        });

        // 리사이즈 핸들러
        const handleResize = () => {
          if (chartContainerRef.current && chartInstanceRef.current) {
            chartInstanceRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        };
        window.addEventListener('resize', handleResize);
        (chartInstanceRef.current as any)._resizeHandler = handleResize;
      } catch (error) {
        console.error('Index chart error:', error);
      }
    };

    initChart();

    return () => {
      if (chartInstanceRef.current?._resizeHandler) {
        window.removeEventListener('resize', chartInstanceRef.current._resizeHandler);
      }
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [isOpen, historyData, chartType, ticker]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const showVolume = !NO_VOLUME_TICKERS.has(ticker) && !!(historyData?.volume && historyData.volume.length > 0);
  const isLineOnly = LINE_TICKERS.has(ticker);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* 모달 */}
      <div className="relative bg-gray-800 rounded-lg shadow-xl w-full sm:w-[900px] max-w-[95vw] max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-4 border-b border-gray-700">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base sm:text-xl font-bold truncate">{name}</h2>
            {SA_TICKERS[ticker] && (
              <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
                {SA_TICKERS[ticker]}
              </span>
            )}
            {UNIT_LABELS[ticker] && (
              <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-gray-700/60 text-gray-400 border border-gray-600/50">
                {UNIT_LABELS[ticker]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
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

            {/* 캔들/라인 토글 (라인 전용 티커는 숨김) */}
            {!isLineOnly && (
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
            )}

            {/* 닫기 버튼 */}
            <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-gray-700 rounded">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 모바일 봉 간격 + 차트 타입 */}
        <div className="flex sm:hidden items-center justify-center gap-2 px-3 py-2 border-b border-gray-700">
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
          {!isLineOnly && (
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
          )}
        </div>

        {/* 차트 */}
        <div className="p-2 sm:p-4 relative flex-1 min-h-0 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
              <div className="text-gray-400 text-sm">차트 로딩 중...</div>
            </div>
          )}

          {/* 툴팁 */}
          {tooltip && (
            <div className="absolute top-2 sm:top-6 left-2 sm:left-6 bg-gray-900/90 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm z-20 pointer-events-none">
              <div className="text-gray-400 mb-1">{tooltip.time}</div>
              <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-0.5 sm:gap-y-1">
                {NO_MA_TICKERS.has(ticker) ? (
                  /* 거시경제 지표: 수치 + 변동률만 표시 */
                  <>
                    <span className="text-gray-400">수치</span>
                    <span className="text-right">{formatIndexPrice(ticker, tooltip.close)}</span>
                    {tooltip.change !== undefined && tooltip.change !== 0 && (
                      <>
                        <span className="text-gray-400">변동률</span>
                        <span
                          className={`text-right font-medium ${
                            tooltip.change >= 0 ? 'text-red-400' : 'text-blue-400'
                          }`}
                        >
                          {tooltip.change >= 0 ? '+' : ''}
                          {tooltip.change.toFixed(2)}%
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  /* 일반 지표: 시가/고가/저가/종가/등락률/거래량 */
                  <>
                    <span className="text-gray-400">시가</span>
                    <span className="text-right">{formatIndexPrice(ticker, tooltip.open)}</span>
                    <span className="text-gray-400">고가</span>
                    <span className="text-right text-red-400">{formatIndexPrice(ticker, tooltip.high)}</span>
                    <span className="text-gray-400">저가</span>
                    <span className="text-right text-blue-400">{formatIndexPrice(ticker, tooltip.low)}</span>
                    <span className="text-gray-400">종가</span>
                    <span className="text-right">{formatIndexPrice(ticker, tooltip.close)}</span>
                    {tooltip.change !== undefined && (
                      <>
                        <span className="text-gray-400">등락률</span>
                        <span
                          className={`text-right font-medium ${
                            tooltip.change >= 0 ? 'text-red-400' : 'text-blue-400'
                          }`}
                        >
                          {tooltip.change >= 0 ? '+' : ''}
                          {tooltip.change.toFixed(2)}%
                        </span>
                      </>
                    )}
                    {tooltip.volume !== undefined && showVolume && (
                      <>
                        <span className="text-gray-400">거래량</span>
                        <span className="text-right text-white">
                          {formatIndexVolume(tooltip.volume)}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div ref={chartContainerRef} className="w-full h-[50vh] sm:h-[500px] min-h-[280px]" />
        </div>

        {/* 범례 */}
        {!NO_MA_TICKERS.has(ticker) && (
          <div className="flex items-center gap-4 sm:gap-6 px-3 sm:px-6 pb-2 sm:pb-4 text-xs sm:text-sm">
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
          </div>
        )}
      </div>
    </div>
  );
}
