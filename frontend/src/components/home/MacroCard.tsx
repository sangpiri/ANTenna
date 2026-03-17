import type { MarketIndexSummary } from '../../types/stock';

interface MacroCardProps {
  summary: MarketIndexSummary;
  onClick: () => void;
}

// 퍼센트로 표시하는 티커 (금리, 실업률)
const PERCENT_TICKERS = new Set([
  'DFEDTARU', 'DGS3', 'DGS10', 'UNRATE',
  'KR-BASE-RATE', 'KR-3Y', 'KR-10Y', 'KR-UNRATE',
]);

// 분기 날짜로 표시하는 티커
const QUARTERLY_TICKERS = new Set(['GDPC1', 'KR-GDP']);

// 기준일을 표시하지 않는 티커 (국고채 일별 수집)
const NO_DATE_TICKERS = new Set(['DGS3', 'DGS10', 'KR-3Y', 'KR-10Y']);

function formatValue(ticker: string, value: number): string {
  if (PERCENT_TICKERS.has(ticker)) return `${value.toFixed(2)}%`;
  if (ticker === 'GDPC1') return `$${(value / 1000).toFixed(1)}T`;
  if (ticker === 'KR-GDP') return `${(value / 1000).toFixed(1)}조`;
  // CPI (CPIAUCSL, KR-CPI)
  return value.toFixed(1);
}

function formatDate(ticker: string, dateStr: string): string | null {
  if (NO_DATE_TICKERS.has(ticker)) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (QUARTERLY_TICKERS.has(ticker)) {
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${d.getFullYear()} Q${q}`;
  }
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export default function MacroCard({ summary, onClick }: MacroCardProps) {
  const isUp = summary.change_rate >= 0;
  const changeColor = isUp ? 'text-red-400' : 'text-blue-400';
  const changeSign = isUp ? '+' : '';

  const formattedValue = formatValue(summary.ticker, summary.close);
  const formattedDate = summary.date ? formatDate(summary.ticker, summary.date) : null;

  return (
    <button
      onClick={onClick}
      className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-lg p-3 text-left transition-all duration-150 hover:shadow-lg hover:shadow-black/30 w-full"
    >
      {/* 상단: 이름 + 기준일 */}
      <div className="flex items-start justify-between gap-1 mb-3">
        <span className="text-xs text-gray-400 leading-tight line-clamp-2 flex-1">
          {summary.name}
        </span>
        {formattedDate && (
          <span className="text-[10px] text-gray-500 flex-shrink-0 mt-0.5 whitespace-nowrap">
            {formattedDate}
          </span>
        )}
      </div>

      {/* 하단: 값 + 변동률 */}
      <div className="flex items-end justify-between">
        <span className="text-base font-bold text-white font-mono">
          {formattedValue}
        </span>
        <span className={`text-xs font-medium ${changeColor}`}>
          {changeSign}{summary.change_rate.toFixed(2)}%
        </span>
      </div>
    </button>
  );
}
