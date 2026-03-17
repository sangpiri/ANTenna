import { useState, useMemo } from 'react';
import type { FinancialsData } from '../../types/stock';

type TabType = 'income' | 'balance' | 'cashflow';
type PeriodType = 'FY' | 'Q';

interface FinancialsPanelProps {
  data: FinancialsData[];
  market: 'kr' | 'us';
}

const TAB_CONFIG: Record<TabType, { label: string; fields: { key: keyof FinancialsData; label: string }[] }> = {
  income: {
    label: '손익계산서',
    fields: [
      { key: 'revenue', label: '매출' },
      { key: 'gross_profit', label: '매출총이익' },
      { key: 'operating_income', label: '영업이익' },
      { key: 'net_income', label: '순이익' },
      { key: 'eps', label: 'EPS' },
    ],
  },
  balance: {
    label: '재무상태표',
    fields: [
      { key: 'total_assets', label: '자산총계' },
      { key: 'total_liabilities', label: '부채총계' },
      { key: 'total_equity', label: '자본총계' },
    ],
  },
  cashflow: {
    label: '현금흐름표',
    fields: [
      { key: 'cash_from_operating', label: '영업CF' },
      { key: 'cash_from_investing', label: '투자CF' },
      { key: 'cash_from_financing', label: '재무CF' },
    ],
  },
};

const formatUsd = (amount: number | null) => {
  if (amount == null) return '-';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const formatKrw = (amount: number | null) => {
  if (amount == null) return '-';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}조`;
  if (abs >= 1e8) return `${sign}${Math.round(abs / 1e8).toLocaleString()}억`;
  if (abs >= 1e4) return `${sign}${Math.round(abs / 1e4).toLocaleString()}만`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
};

export default function FinancialsPanel({ data, market }: FinancialsPanelProps) {
  const [tab, setTab] = useState<TabType>('income');
  const [period, setPeriod] = useState<PeriodType>('FY');

  const formatAmount = market === 'kr' ? formatKrw : formatUsd;

  // 기간별 필터링 + 정렬 (최신 → 과거)
  const filtered = useMemo(() => {
    if (period === 'FY') {
      return data.filter(d => d.period_type === 'FY');
    }
    // 분기: Q1~Q4
    return data.filter(d => d.period_type.startsWith('Q'));
  }, [data, period]);

  // 기간 레이블 생성
  const getPeriodLabel = (d: FinancialsData) => {
    const year = d.fiscal_date.substring(0, 4);
    if (d.period_type === 'FY') return `${year}`;
    return `${year} ${d.period_type}`;
  };

  // YoY 변동률 계산
  const getYoY = (fieldKey: keyof FinancialsData, index: number): number | null => {
    const current = filtered[index][fieldKey] as number | null;
    if (current == null) return null;

    if (period === 'FY') {
      // 연간: 바로 다음 항목이 전년도
      const prev = filtered[index + 1]?.[fieldKey] as number | null | undefined;
      if (prev == null || prev === 0) return null;
      return ((current - prev) / Math.abs(prev)) * 100;
    } else {
      // 분기: 같은 분기의 전년도 찾기
      const currentType = filtered[index].period_type;
      const currentYear = parseInt(filtered[index].fiscal_date.substring(0, 4));
      const prevEntry = filtered.find(d =>
        d.period_type === currentType &&
        parseInt(d.fiscal_date.substring(0, 4)) === currentYear - 1
      );
      if (!prevEntry) return null;
      const prev = prevEntry[fieldKey] as number | null;
      if (prev == null || prev === 0) return null;
      return ((current - prev) / Math.abs(prev)) * 100;
    }
  };

  // 재무상태표 불일치 감지 (자산 ≠ 부채 + 자본)
  const balanceMismatch = useMemo(() => {
    if (tab !== 'balance') return new Set<number>();
    const mismatched = new Set<number>();
    filtered.forEach((d, i) => {
      const a = d.total_assets;
      const l = d.total_liabilities;
      const e = d.total_equity;
      if (a != null && l != null && e != null) {
        const diff = Math.abs(a - l - e);
        if (diff > Math.abs(a) * 0.2) {
          mismatched.add(i);
        }
      }
    });
    return mismatched;
  }, [filtered, tab]);

  const { fields } = TAB_CONFIG[tab];

  return (
    <div className="px-3 sm:px-6 pb-3 sm:pb-4 border-t border-gray-700 pt-3">
      {/* 탭 + 기간 토글 */}
      <div className="flex flex-wrap items-center justify-between mb-2 gap-1 sm:gap-2">
        <div className="flex gap-1 shrink-0">
          {(Object.entries(TAB_CONFIG) as [TabType, typeof TAB_CONFIG.income][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded text-xs sm:text-sm whitespace-nowrap ${
                tab === key
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {period === 'Q' && (
            <span className="text-[10px] text-gray-500 mr-1 leading-tight text-right">전년<br className="sm:hidden" /><span className="hidden sm:inline"> </span>동기 대비</span>
          )}
          <button
            onClick={() => setPeriod('FY')}
            className={`px-2 py-0.5 rounded text-xs sm:text-sm whitespace-nowrap ${
              period === 'FY'
                ? 'bg-green-700 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            연간
          </button>
          <button
            onClick={() => setPeriod('Q')}
            className={`px-2 py-0.5 rounded text-xs sm:text-sm whitespace-nowrap ${
              period === 'Q'
                ? 'bg-green-700 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            분기
          </button>
        </div>
      </div>
      <div className="text-right mb-1">
        <span className="text-[10px] sm:text-xs text-gray-500">
          {market === 'us' ? '📋 SEC EDGAR 공식 데이터' : '📋 DART(금감원) 공식 데이터'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-4">재무제표 데이터가 없습니다.</div>
      ) : (
        <div className="overflow-auto max-h-[300px] rounded border border-gray-700">
          <table className="text-xs sm:text-sm border-collapse">
            <thead className="bg-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-2 sm:px-3 py-1.5 text-left text-gray-300 font-medium sticky left-0 bg-gray-700 z-20 min-w-[80px] sm:min-w-[100px]">
                  항목
                </th>
                {filtered.map((d, i) => (
                  <th key={i} className="px-2 sm:px-3 py-1.5 text-right text-gray-300 font-medium whitespace-nowrap min-w-[70px] sm:min-w-[85px]">
                    {getPeriodLabel(d)}{balanceMismatch.has(i) && <span className="text-yellow-400" title="자산 ≠ 부채+자본"> !</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, fi) => (
                <>
                  {/* 값 행 */}
                  <tr key={field.key} className={`${fi % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}${(tab === 'income' && fi === 4) ? ' border-t border-gray-600' : ''}`}>
                    <td className={`px-2 sm:px-3 py-1 text-gray-300 font-medium sticky left-0 z-10 ${fi % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`}>
                      {field.label}
                    </td>
                    {filtered.map((d, ci) => {
                      const val = d[field.key] as number | null;
                      const formatted = field.key === 'eps'
                        ? (val != null ? (market === 'us' ? `$${val.toFixed(2)}` : `${val.toLocaleString()}원`) : '-')
                        : formatAmount(val);
                      return (
                        <td key={ci} className="px-2 sm:px-3 py-1 text-right text-gray-200 whitespace-nowrap">
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>
                  {/* 변동률 행 */}
                  <tr key={`${field.key}-yoy`} className={fi % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}>
                    <td className={`px-2 sm:px-3 sticky left-0 z-10 ${fi % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`} />
                    {filtered.map((_, ci) => {
                      const yoy = getYoY(field.key, ci);
                      if (yoy == null) return <td key={ci} className="px-2 sm:px-3 pb-1 text-right text-gray-600 text-[10px] sm:text-xs">-</td>;
                      const color = yoy > 0 ? 'text-red-400' : yoy < 0 ? 'text-blue-400' : 'text-gray-400';
                      return (
                        <td key={ci} className={`px-2 sm:px-3 pb-1 text-right text-[10px] sm:text-xs font-medium ${color}`}>
                          {yoy > 0 ? '+' : ''}{yoy.toFixed(1)}%
                        </td>
                      );
                    })}
                  </tr>
                </>
              ))}
              {/* 부채비율 행 (재무상태표 탭에서만) */}
              {tab === 'balance' && (
                <>
                  <tr className={`${fields.length % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'} border-t border-gray-600`}>
                    <td className={`px-2 sm:px-3 py-1 text-white font-medium sticky left-0 z-10 ${fields.length % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`}>
                      부채비율
                    </td>
                    {filtered.map((d, ci) => {
                      const liabilities = d.total_liabilities;
                      const equity = d.total_equity;
                      if (liabilities == null || equity == null || equity === 0) {
                        return <td key={ci} className="px-2 sm:px-3 py-1 text-right text-gray-600 whitespace-nowrap">-</td>;
                      }
                      const ratio = (liabilities / equity) * 100;
                      if (ratio < 0) {
                        return (
                          <td key={ci} className="px-2 sm:px-3 py-1 text-right font-medium whitespace-nowrap text-blue-400">
                            자본잠식
                          </td>
                        );
                      }
                      const ratioColor = ratio <= 100 ? 'text-red-400' : ratio <= 200 ? 'text-green-400' : 'text-blue-400';
                      return (
                        <td key={ci} className={`px-2 sm:px-3 py-1 text-right font-medium whitespace-nowrap ${ratioColor}`}>
                          {ratio.toFixed(0)}%
                        </td>
                      );
                    })}
                  </tr>
                  <tr className={fields.length % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}>
                    <td className={`px-2 sm:px-3 sticky left-0 z-10 ${fields.length % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`} />
                    {filtered.map((_, ci) => <td key={ci} className="px-2 sm:px-3 pb-1" />)}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'balance' && balanceMismatch.size > 0 && (
        <div className="mt-1.5 text-[10px] sm:text-xs text-yellow-400/80 leading-snug">
          <span className="font-medium">! 일부 기간에서 자산 ≠ 부채+자본 불일치가 감지되었습니다.</span>
          <br />
          <span className="text-gray-500">SPAC 합병/역합병, 비지배지분 포함 여부, XBRL 태그 차이, 보고 단위 불일치, 수정 보고서 혼재 등으로 발생할 수 있습니다.</span>
        </div>
      )}
      {tab === 'cashflow' && (
        <div className="mt-1.5 text-[10px] sm:text-xs text-gray-500 leading-snug">
          <span className="font-medium text-gray-400">영업CF</span> +가 정상 (본업에서 현금 창출). 지속적 (-)는 수익성 악화 신호.
          <br />
          <span className="font-medium text-gray-400">투자CF</span> (-)가 일반적 (설비·인수 등 투자 지출). (+)는 자산 매각 등 회수 의미.
          <br />
          <span className="font-medium text-gray-400">재무CF</span> (-)는 배당·상환 (주주환원·부채축소), (+)는 증자·차입 (외부 자금 조달).
        </div>
      )}
    </div>
  );
}
