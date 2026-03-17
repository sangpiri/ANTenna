import type { MarketIndexSummary } from '../../types/stock';

interface IndexCardProps {
  summary: MarketIndexSummary;
  onClick: () => void;
}

// 티커별 가격 포맷
function formatPrice(ticker: string, price: number): string {
  if (['^KS11', '^KQ11', 'BTC-USD'].includes(ticker)) {
    return Math.round(price).toLocaleString();
  }
  if (ticker === 'HG=F') return price.toFixed(4);
  if (ticker === 'SI=F') return price.toFixed(3);
  return price.toFixed(2);
}

// SVG 스파크라인 (경량)
function Sparkline({ data, isUp }: { data: number[]; isUp: boolean }) {
  if (!data || data.length < 2) return <div className="h-10" />;

  const width = 200;
  const height = 48;
  const padding = 3;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = padding + (1 - (v - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  // 상승 = 빨간색, 하락 = 파란색
  const color = isUp ? '#ef5350' : '#3b82f6';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-10"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function IndexCard({ summary, onClick }: IndexCardProps) {
  const isUp = summary.change_rate >= 0;
  // 상승 = 빨간색, 하락 = 파란색 (한국 주식 컨벤션)
  const changeColor = isUp ? 'text-red-400' : 'text-blue-400';
  const changeSign = isUp ? '+' : '';

  return (
    <button
      onClick={onClick}
      className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-lg p-3 text-left transition-all duration-150 hover:shadow-lg hover:shadow-black/30 w-full"
    >
      {/* 상단: 이름 */}
      <div className="mb-1">
        <span className="text-sm font-medium text-white leading-tight line-clamp-1">
          {summary.name}
        </span>
      </div>

      {/* 중단: 스파크라인 */}
      <Sparkline data={summary.sparkline} isUp={isUp} />

      {/* 하단: 현재가 + 변동률 */}
      <div className="flex items-end justify-between mt-1">
        <span className="text-sm font-bold text-white font-mono">
          {formatPrice(summary.ticker, summary.close)}
        </span>
        <span className={`text-xs font-medium ${changeColor}`}>
          {changeSign}{summary.change_rate.toFixed(2)}%
        </span>
      </div>
    </button>
  );
}
