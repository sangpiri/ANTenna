import { useState } from 'react';
import type {
  Market,
  BacktestScreeningRequest,
  ScreeningCondition,
} from '../../types/stock';

interface Props {
  market: Market;
  onSubmit: (req: BacktestScreeningRequest) => void;
  loading: boolean;
  isPremium: boolean;
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const GAP_PRICE_OPTIONS = [
  { value: 'prev_close', label: '전일 종가' },
  { value: 'open',       label: '당일 시가' },
  { value: 'close',      label: '당일 종가' },
  { value: 'next_open',  label: '익일 시가' },
  { value: 'next_close', label: '익일 종가' },
];

const EXTRA_DIRECTION_OPTIONS = [
  { value: '', label: '없음' },
  { value: 'up',   label: '상승' },
  { value: 'down', label: '하락' },
];

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDefaultDates() {
  const end   = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return { start: formatDate(start), end: formatDate(end) };
}

// ─── 섹션 레이블 컴포넌트 ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">
      {children}
    </div>
  );
}

// ─── 토글 버튼 그룹 ──────────────────────────────────────────────────────────

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            value === o.value
              ? 'bg-sky-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function BacktestConditionPanel({ market, onSubmit, loading, isPremium }: Props) {
  const { start: defaultStart, end: defaultEnd } = getDefaultDates();

  // ── 1. 대상 종목 ────────────────────────────────────────────────────────────
  const [condition, setCondition] = useState<ScreeningCondition>('frequent');

  // 빈출 파라미터
  const [weeks, setWeeks] = useState<number>(4);

  // 눌림목 파라미터
  const [daysAgo, setDaysAgo] = useState<number>(1);

  // 연속상승 파라미터
  const [consecutiveDays, setConsecutiveDays] = useState<number>(2);

  // 52주 신고가 파라미터
  const [consolidationDays, setConsolidationDays] = useState<string>('0');
  const [rangePct, setRangePct] = useState<string>('0');

  // 갭 파라미터 (상승/하락 공통)
  const [basePrice, setBasePrice]         = useState('prev_close');
  const [comparePrice, setComparePrice]   = useState('open');
  const [minRate, setMinRate]             = useState<string>('3');
  const [maxRate, setMaxRate]             = useState<string>('');
  const [extraBase, setExtraBase]         = useState('');
  const [extraCompare, setExtraCompare]   = useState('');
  const [extraDirection, setExtraDirection] = useState('');
  const [detailBase, setDetailBase]       = useState('');
  const [detailCompare, setDetailCompare] = useState('');
  const [detailDirection, setDetailDirection] = useState('');
  const [highFilter, setHighFilter]       = useState<'all' | 'high' | 'not_high'>('all');

  // 공통 필터
  const [maFilter, setMaFilter]     = useState<'all' | 'above' | 'below'>('all');
  const [priceRange, setPriceRange] = useState<'all' | 'high' | 'mid' | 'low'>('all');

  // 날짜 모드
  const [dateMode, setDateMode]     = useState<'single' | 'range'>('single');
  const [singleDate, setSingleDate] = useState(defaultEnd);
  const [startDate, setStartDate]   = useState(defaultStart);
  const [endDate, setEndDate]       = useState(defaultEnd);

  // 종목 수
  const [topN, setTopN]               = useState<5 | 8 | 10 | 15 | 30 | 50>(10);
  const [tickerMode, setTickerMode]   = useState<'top' | 'manual'>('top');
  const [tickerInput, setTickerInput] = useState('');

  // ── 2. 진입 조건 ────────────────────────────────────────────────────────────
  const [daysAfter, setDaysAfter] = useState<string>('1');
  const [entryPrice, setEntryPrice] = useState<'open' | 'close'>('open');

  // ── 3. 청산 조건 ────────────────────────────────────────────────────────────
  const [holdUnit, setHoldUnit]         = useState<'days' | 'months' | 'years'>('days');
  const [holdDays, setHoldDays]         = useState<string>('5');
  const [useStopLoss, setUseStopLoss]   = useState(false);
  const [stopLoss, setStopLoss]         = useState<string>('5');
  const [useTakeProfit, setUseTakeProfit] = useState(false);
  const [takeProfit, setTakeProfit]     = useState<string>('10');

  // ── 기타 ────────────────────────────────────────────────────────────────────
  const [initialCash, setInitialCash]       = useState(10_000_000);
  const [runWalkForward, setRunWalkForward] = useState(false);
  const [wfTrainYears, setWfTrainYears]     = useState<string>('3');
  const [wfTestYears, setWfTestYears]       = useState<string>('1');
  const [runMonteCarlo, setRunMonteCarlo]   = useState(false);

  // ── 제출 ────────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    const tickers = tickerMode === 'manual'
      ? tickerInput.split(/[\s,]+/).map(t => t.trim().toUpperCase()).filter(Boolean)
      : undefined;

    const req: BacktestScreeningRequest = {
      market,
      screening: {
        condition,
        date_mode: dateMode,
        ...(dateMode === 'single' ? { date: singleDate } : { start_date: startDate, end_date: endDate }),
        ma_filter: maFilter,
        ...(market === 'us' ? { price_range: priceRange } : {}),
        top_n: tickerMode === 'top' ? topN : undefined,
        tickers,
        // 조건별 파라미터
        ...(condition === 'frequent'     ? { weeks }                              : {}),
        ...(condition === 'pullback'     ? { days_ago: daysAgo }                  : {}),
        ...(condition === 'consecutive'  ? { consecutive_days: consecutiveDays }  : {}),
        ...(condition === '52week_high'  ? { consolidation_days: Number(consolidationDays) || 0, range_pct: Number(rangePct) || 0 } : {}),
        ...(['gap_up', 'gap_down'].includes(condition) ? {
          base_price:      basePrice,
          compare_price:   comparePrice,
          min_rate:        Number(minRate) || 0,
          max_rate:        maxRate === '' ? 99999 : Number(maxRate) || 99999,
          extra_base:      extraBase    || undefined,
          extra_compare:   extraCompare || undefined,
          extra_direction: extraDirection || undefined,
          detail_base:     detailBase    || undefined,
          detail_compare:  detailCompare || undefined,
          detail_direction: detailDirection || undefined,
          ...(condition === 'gap_up' ? { high_filter: highFilter } : {}),
        } : {}),
      },
      entry: {
        days_after: Number(daysAfter) || 0,
        price:      entryPrice,
      },
      exit: {
        hold_days:   Number(holdDays) || 1,
        hold_unit:   holdUnit,
        stop_loss:   useStopLoss   ? -Math.abs(Number(stopLoss))  : null,
        take_profit: useTakeProfit ?  Math.abs(Number(takeProfit)) : null,
      },
      initial_cash:      initialCash,
      run_walk_forward:  runWalkForward,
      run_monte_carlo:   runMonteCarlo,
      wf_train_years:    Number(wfTrainYears) || 3,
      wf_test_years:     Number(wfTestYears)  || 1,
    };
    onSubmit(req);
  };

  // ── 헬퍼: 조건 버튼 ─────────────────────────────────────────────────────────
  const CondBtn = ({ value, label }: { value: ScreeningCondition; label: string }) => (
    <button
      onClick={() => setCondition(value)}
      className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
        condition === value
          ? 'bg-sky-500 text-white'
          : 'bg-sky-900/40 text-sky-300 hover:bg-sky-800/60 border border-sky-700/50'
      }`}
    >
      {label}
    </button>
  );

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">

      {/* ── 1. 대상 종목 ──────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>1. 대상 종목</SectionLabel>
        <div className="bg-gray-700/50 rounded-lg p-3 space-y-3">

          {/* 조건 선택 */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5">기본 조회</div>
            <div className="flex flex-wrap gap-1.5">
              <CondBtn value="frequent"    label="빈출" />
              <CondBtn value="pullback"    label="눌림목" />
              <CondBtn value="consecutive" label="연속 상승" />
              <CondBtn value="52week_high" label="52주 신고가" />
            </div>
            <div className="text-xs text-gray-500 mb-1.5 mt-2.5">고급 조회</div>
            <div className="flex flex-wrap gap-1.5">
              <CondBtn value="gap_up"   label="갭 상승" />
              <CondBtn value="gap_down" label="갭 하락 후 반등" />
              <CondBtn value="ipo"      label="신규 상장" />
            </div>
          </div>

          {/* 조건별 파라미터 */}
          {condition === 'frequent' && (
            <div className="space-y-1">
              <div className="text-xs text-gray-400">기간</div>
              <ToggleGroup
                options={[
                  { value: '1',  label: '1주' },
                  { value: '2',  label: '2주' },
                  { value: '4',  label: '4주' },
                  { value: '8',  label: '8주' },
                  { value: '12', label: '12주' },
                ]}
                value={String(weeks)}
                onChange={(v) => setWeeks(Number(v))}
              />
            </div>
          )}

          {condition === 'pullback' && (
            <div className="space-y-1">
              <div className="text-xs text-gray-400">기준일 (N일 전)</div>
              <ToggleGroup
                options={[1,2,3,4,5].map(n => ({ value: String(n), label: `${n}일 전` }))}
                value={String(daysAgo)}
                onChange={(v) => setDaysAgo(Number(v))}
              />
            </div>
          )}

          {condition === 'consecutive' && (
            <div className="space-y-1">
              <div className="text-xs text-gray-400">연속 상승일</div>
              <ToggleGroup
                options={[2,3,4,5].map(n => ({ value: String(n), label: `${n}일` }))}
                value={String(consecutiveDays)}
                onChange={(v) => setConsecutiveDays(Number(v))}
              />
            </div>
          )}

          {condition === '52week_high' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16 flex-shrink-0">횡보 기간</span>
                <input
                  type="number" min={0} value={consolidationDays}
                  onChange={e => setConsolidationDays(e.target.value)}
                  className="w-16 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
                />
                <span className="text-xs text-gray-500">일 (0=비활성)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16 flex-shrink-0">진폭 이내</span>
                <input
                  type="number" min={0} step={0.5} value={rangePct}
                  onChange={e => setRangePct(e.target.value)}
                  className="w-16 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
                />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>
          )}

          {(condition === 'gap_up' || condition === 'gap_down') && (
            <div className="space-y-2 text-xs">
              {/* 기준가격 / 비교가격 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-gray-400 mb-1">기준 가격</div>
                  <select value={basePrice} onChange={e => setBasePrice(e.target.value)}
                    className="w-full bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-600">
                    {GAP_PRICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">비교 가격</div>
                  <select value={comparePrice} onChange={e => setComparePrice(e.target.value)}
                    className="w-full bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-600">
                    {GAP_PRICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {/* 상승률 범위 */}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-12 flex-shrink-0">
                  {condition === 'gap_down' ? '하락률' : '상승률'}
                </span>
                <input type="number" step={0.5} value={minRate}
                  onChange={e => setMinRate(e.target.value)}
                  className="w-14 bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-600" />
                <span className="text-gray-500">~</span>
                <input type="number" step={0.5}
                  value={maxRate}
                  placeholder="∞"
                  onChange={e => setMaxRate(e.target.value)}
                  className="w-14 bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-600" />
                <span className="text-gray-500">%</span>
              </div>
              {/* 추가 조건 */}
              <div>
                <div className="text-gray-400 mb-1">추가 조건 (선택)</div>
                <div className="flex gap-2 items-center">
                  <select value={extraBase} onChange={e => setExtraBase(e.target.value)}
                    className="flex-1 bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-600">
                    <option value="">-</option>
                    {GAP_PRICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span className="text-gray-400 flex-shrink-0">→</span>
                  <select value={extraCompare} onChange={e => setExtraCompare(e.target.value)}
                    className="flex-1 bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-600">
                    <option value="">-</option>
                    {GAP_PRICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <select value={extraDirection} onChange={e => setExtraDirection(e.target.value)}
                    className="w-16 bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-600">
                    {EXTRA_DIRECTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {/* 세부 조건 */}
              <div>
                <div className="text-gray-400 mb-1">세부 조건 (선택)</div>
                <div className="flex gap-2 items-center">
                  <select value={detailBase} onChange={e => setDetailBase(e.target.value)}
                    className="flex-1 bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-600">
                    <option value="">-</option>
                    {GAP_PRICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span className="text-gray-400 flex-shrink-0">→</span>
                  <select value={detailCompare} onChange={e => setDetailCompare(e.target.value)}
                    className="flex-1 bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-600">
                    <option value="">-</option>
                    {GAP_PRICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <select value={detailDirection} onChange={e => setDetailDirection(e.target.value)}
                    className="w-16 bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-600">
                    {EXTRA_DIRECTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 공통 필터 */}
          <div className="space-y-2 pt-1 border-t border-gray-600/50">
            <div>
              <div className="text-xs text-gray-400 mb-1">MA240</div>
              <ToggleGroup
                options={[
                  { value: 'all',   label: '전체' },
                  { value: 'above', label: '정배열↑' },
                  { value: 'below', label: '역배열↓' },
                ]}
                value={maFilter}
                onChange={(v) => setMaFilter(v as 'all' | 'above' | 'below')}
              />
            </div>
            {market === 'us' && (
              <div>
                <div className="text-xs text-gray-400 mb-1">가격대</div>
                <ToggleGroup
                  options={[
                    { value: 'all',  label: '전체' },
                    { value: 'high', label: '$10+' },
                    { value: 'mid',  label: '$5-10' },
                    { value: 'low',  label: '<$5' },
                  ]}
                  value={priceRange}
                  onChange={(v) => setPriceRange(v as 'all' | 'high' | 'mid' | 'low')}
                />
              </div>
            )}
            {/* 52주 신고가 필터 (갭 상승만, MA240 뒤에 위치) */}
            {condition === 'gap_up' && (
              <div>
                <div className="text-xs text-gray-400 mb-1">52주 신고가</div>
                <ToggleGroup
                  options={[
                    { value: 'all',      label: '전체' },
                    { value: 'high',     label: '신고가' },
                    { value: 'not_high', label: '신고가 외' },
                  ]}
                  value={highFilter}
                  onChange={(v) => setHighFilter(v as 'all' | 'high' | 'not_high')}
                />
              </div>
            )}
          </div>

          {/* 날짜 */}
          <div className="space-y-2 pt-1 border-t border-gray-600/50">
            <div className="text-xs text-gray-400">조건 검색 날짜</div>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={dateMode === 'single'}
                  onChange={() => setDateMode('single')} className="accent-sky-400" />
                <span className="text-xs text-gray-300">특정 날짜</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={dateMode === 'range'}
                  onChange={() => setDateMode('range')} className="accent-sky-400" />
                <span className="text-xs text-gray-300">날짜 범위</span>
              </label>
            </div>
            {dateMode === 'single' ? (
              <input type="date" value={singleDate}
                onChange={e => setSingleDate(e.target.value)}
                className="w-full bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600" />
            ) : (
              <div className="flex items-center gap-2">
                <input type="date" value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600" />
                <span className="text-gray-500 text-xs">~</span>
                <input type="date" value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="flex-1 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600" />
              </div>
            )}
          </div>

          {/* 종목 수 */}
          <div className="space-y-2 pt-1 border-t border-gray-600/50">
            <div className="text-xs text-gray-400">종목 수</div>
            <div className="flex gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={tickerMode === 'top'}
                  onChange={() => setTickerMode('top')} className="accent-sky-400" />
                <span className="text-xs text-gray-300">
                  {condition === 'frequent' ? '빈출횟수 상위' : '거래대금 상위'}
                </span>
              </label>
              {tickerMode === 'top' && (
                <ToggleGroup
                  options={[
                    { value: '5',  label: '5' },
                    { value: '8',  label: '8' },
                    { value: '10', label: '10' },
                    { value: '15', label: '15' },
                    { value: '30', label: '30' },
                    { value: '50', label: '50' },
                  ]}
                  value={String(topN)}
                  onChange={(v) => setTopN(Number(v) as 5 | 8 | 10 | 15 | 30 | 50)}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                <input type="radio" checked={tickerMode === 'manual'}
                  onChange={() => setTickerMode('manual')} className="accent-sky-400" />
                <span className="relative group text-xs text-gray-300">
                  특정 종목 직접 입력
                  <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-52 rounded bg-gray-900 border border-gray-600 px-2.5 py-2 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-relaxed">
                    <span className="block">쉼표 또는 공백으로 구분</span>
                    {market === 'kr' ? (
                      <span className="block text-gray-500">
                        예) 005930, 000660<br />
                        {'    '}005930 000660
                      </span>
                    ) : (
                      <span className="block text-gray-500">
                        예) AAPL, MSFT, NVDA<br />
                        {'    '}AAPL MSFT NVDA
                      </span>
                    )}
                    <span className="block mt-1.5">입력된 종목 수 기준으로<br />자본이 균등 배분됩니다.</span>
                  </span>
                </span>
              </label>
              {tickerMode === 'manual' && (
                <input
                  type="text"
                  value={tickerInput}
                  onChange={e => setTickerInput(e.target.value)}
                  placeholder={market === 'kr' ? '005930, 000660' : 'AAPL, MSFT'}
                  className="flex-1 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 placeholder-gray-600"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. 진입 조건 ──────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>2. 진입 조건</SectionLabel>
        <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div>
            <div className="text-xs text-gray-400 mb-1.5">매수 시점 (등장일 후)</div>
            <ToggleGroup
              options={[
                { value: '1', label: '1일' },
                { value: '2', label: '2일' },
                { value: '3', label: '3일' },
                { value: '4', label: '4일' },
                { value: '5', label: '5일' },
              ]}
              value={daysAfter}
              onChange={(v) => setDaysAfter(v)}
            />
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1.5">매수 가격</div>
            <ToggleGroup
              options={[
                { value: 'open',  label: '시가' },
                { value: 'close', label: '종가' },
              ]}
              value={entryPrice}
              onChange={(v) => setEntryPrice(v as 'open' | 'close')}
            />
          </div>
        </div>
      </div>

      {/* ── 3. 청산 조건 ──────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>3. 청산 조건</SectionLabel>
        <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300 w-20 flex-shrink-0">보유 기간</span>
            <input
              type="number"
              min={1}
              max={holdUnit === 'days' ? 250 : holdUnit === 'months' ? 36 : 10}
              value={holdDays}
              onChange={e => setHoldDays(e.target.value)}
              className="w-16 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600"
            />
            <select
              value={holdUnit}
              onChange={e => {
                const unit = e.target.value as 'days' | 'months' | 'years';
                setHoldUnit(unit);
                setHoldDays(unit === 'days' ? '5' : unit === 'months' ? '3' : '1');
              }}
              className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600"
            >
              <option value="days">영업일</option>
              <option value="months">개월</option>
              <option value="years">년</option>
            </select>
            <span className="text-xs text-gray-400">(필수)</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer w-20 flex-shrink-0">
              <input type="checkbox" checked={useStopLoss}
                onChange={e => setUseStopLoss(e.target.checked)} className="accent-sky-400" />
              <span className="text-xs text-gray-300">손절</span>
            </label>
            <input
              type="number" min={0} step={0.5} value={stopLoss}
              onChange={e => setStopLoss(e.target.value)}
              disabled={!useStopLoss}
              className="w-16 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 disabled:opacity-40"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer w-20 flex-shrink-0">
              <input type="checkbox" checked={useTakeProfit}
                onChange={e => setUseTakeProfit(e.target.checked)} className="accent-sky-400" />
              <span className="text-xs text-gray-300">익절</span>
            </label>
            <input
              type="number" min={0} step={0.5} value={takeProfit}
              onChange={e => setTakeProfit(e.target.value)}
              disabled={!useTakeProfit}
              className="w-16 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600 disabled:opacity-40"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>
        </div>
      </div>

      {/* ── 4. 투자금액 ───────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>4. 투자금액</SectionLabel>
        <div className="bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={initialCash.toLocaleString('ko-KR')}
              onChange={e => {
                const raw = e.target.value.replace(/,/g, '');
                const num = Number(raw);
                if (!isNaN(num)) setInitialCash(num);
              }}
              className="flex-1 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-600"
            />
            <span className="text-xs text-gray-400">{market === 'kr' ? '원' : 'USD'}</span>
          </div>
        </div>
      </div>

      {/* ── 5. 신뢰도 분석 ────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>5. 신뢰도 분석 (선택)</SectionLabel>
        <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={runWalkForward}
              onChange={e => setRunWalkForward(e.target.checked)} className="accent-sky-400" />
            <div>
              <span className="flex items-center gap-1.5 text-xs text-gray-300">
                <svg className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Walk-Forward 검증
              </span>
              <div className="text-xs text-yellow-500/80 mt-0.5 leading-relaxed">
                전체 기간을 여러 구간으로 나눠 각각 백테스팅.<br />
                결과가 일관되면 특정 시기 운이 아닌 안정적인 조건,<br />
                구간별 편차가 크면 시장 환경에 민감한 조건.<br />
                <span className="text-gray-500">기간 모드 (훈련+검증) 이상 권장</span>
              </div>
            </div>
          </label>
          {runWalkForward && (
            <div className="flex items-center gap-3 pl-5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">훈련</span>
                <select
                  value={wfTrainYears}
                  onChange={e => setWfTrainYears(e.target.value)}
                  className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
                >
                  {[1,2,3,4,5,6,7].map(y => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">검증</span>
                <select
                  value={wfTestYears}
                  onChange={e => setWfTestYears(e.target.value)}
                  className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600"
                >
                  {[1,2,3].map(y => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-gray-500">
                최소 {(Number(wfTrainYears)||3) + (Number(wfTestYears)||1)}년 데이터 권장
              </span>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={runMonteCarlo}
              onChange={e => setRunMonteCarlo(e.target.checked)} className="accent-sky-400" />
            <div>
              <span className="flex items-center gap-1.5 text-xs text-gray-300">
                <svg className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.5} />
                  <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
                  <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
                  <circle cx="8.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
                  <circle cx="15.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
                  <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
                  <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
                </svg>
                Monte Carlo 시뮬레이션
              </span>
              <div className="text-xs text-yellow-500/80 mt-0.5 leading-relaxed">
                실제 발생한 거래들을 1,000번 무작위로 섞어 재시뮬레이션.<br />
                손실 거래가 초반에 몰리는 최악의 경우부터<br />
                수익 거래가 먼저 오는 최선의 경우까지 분포를 확인.<br />
                <span className="text-gray-500">결과 분포가 넓을수록 운의 영향이 큼</span>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* ── 실행 버튼 ─────────────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        disabled={loading || !isPremium}
        title={!isPremium ? 'premium 이상 사용자만 이용 가능합니다' : ''}
        className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
          !isPremium
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : loading
              ? 'bg-sky-600 text-sky-200 cursor-not-allowed'
              : 'bg-sky-500 hover:bg-sky-400 text-white'
        }`}
      >
        {!isPremium ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Premium 전용
          </span>
        ) : loading ? '실행 중...' : '백테스트 실행'}
      </button>
    </div>
  );
}
