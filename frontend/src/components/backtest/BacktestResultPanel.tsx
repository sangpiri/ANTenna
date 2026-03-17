import { useState, useEffect } from 'react';
import katex from 'katex';
import type { BacktestResult, BacktestProgressResponse } from '../../types/stock';

function KaTeX({ expr }: { expr: string }) {
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(expr, { throwOnError: false, displayMode: false }),
      }}
    />
  );
}

interface Props {
  status: BacktestProgressResponse['status'] | null;
  progress?: { current: number; total: number; step: string };
  result: BacktestResult | null;
  error: string | null;
  market: 'kr' | 'us';
  onTickerClick: (ticker: string, name: string, entryDate: string) => void;
}

function fmt(n: number | null | undefined, suffix = '%', decimals = 2): string {
  if (n === null || n === undefined) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(decimals)}${suffix}`;
}

function fmtKrw(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('ko-KR') + '원';
}

const RELIABILITY_LABEL = { low: '낮음', medium: '보통', high: '높음' } as const;
const RELIABILITY_COLOR = {
  low: 'text-blue-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
} as const;

function MetricRow({ label, value, color }: { label: React.ReactNode; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-700/50">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs font-medium whitespace-nowrap ${color ?? 'text-gray-200'}`}>{value}</span>
    </div>
  );
}

function TooltipLabel({ label, content }: { label: string; content: React.ReactNode }) {
  const [pos, setPos] = useState<{ x: number; right: number; y: number } | null>(null);
  const TOOLTIP_WIDTH = 240; // w-60
  return (
    <span
      className="inline-flex items-center gap-1 cursor-help"
      onMouseEnter={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({ x: rect.left, right: rect.right, y: rect.bottom });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {label}
      <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      {pos && (() => {
        const overflows = pos.x + TOOLTIP_WIDTH > window.innerWidth - 8;
        return (
          <div
            className="fixed z-50 w-60 bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-xl pointer-events-none"
            style={{
              top: pos.y + 6,
              ...(overflows
                ? { right: window.innerWidth - pos.right }
                : { left: pos.x }),
            }}
          >
            {content}
          </div>
        );
      })()}
    </span>
  );
}

const PAGE_SIZE = 100;
const MAX_TRADES = 1000;

export default function BacktestResultPanel({ status, progress, result, error, market, onTickerClick }: Props) {
  const [tradePage, setTradePage] = useState(1);

  // 결과 바뀌면 1페이지로 리셋
  useEffect(() => { setTradePage(1); }, [result]);

  // 초기 화면
  if (!status || status === 'PENDING') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-16">
        <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <div className="text-gray-500 text-sm">조건을 설정하고<br />백테스트를 실행하세요</div>
      </div>
    );
  }

  // 실행 중
  if (status === 'STARTED' || status === 'PROGRESS') {
    const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 py-16">
        <div className="text-gray-300 text-sm font-medium">백테스트 실행 중...</div>
        <div className="w-full max-w-xs">
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">{progress?.step ?? '처리 중'}</span>
            <span className="text-xs text-gray-400">{pct}%</span>
          </div>
        </div>
      </div>
    );
  }

  // 실패
  if (status === 'FAILURE' || error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
        <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="text-red-400 text-sm text-center">{error ?? '백테스팅 실행 중 오류가 발생했습니다.'}</div>
      </div>
    );
  }

  // 성공
  if (!result) return null;

  const m = result.metrics;
  const trades = result.trades ?? [];
  const wf = result.walk_forward;
  const mc = result.monte_carlo;

  // 마지막 청산일까지만 자산 곡선 표시
  const lastExitDate = trades.length > 0
    ? trades.reduce((max, t) => t.exit_date > max ? t.exit_date : max, trades[0].exit_date)
    : null;
  const equityCurve = lastExitDate
    ? result.equity_curve.filter(d => d.date <= lastExitDate)
    : result.equity_curve;

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      {/* 핵심 지표 */}
      <div className="bg-gray-700/50 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">핵심 성과</div>
        <div className="grid grid-cols-2 gap-x-4">
          <MetricRow
            label="총 수익률"
            value={fmt(m.total_return)}
            color={m.total_return >= 0 ? 'text-red-400' : 'text-blue-400'}
          />
          <MetricRow label="총 거래 수" value={`${m.total_trades}건`} />
          <MetricRow
            label={
              <TooltipLabel
                label="CAGR"
                content={
                  <div className="text-xs leading-relaxed">
                    <p className="text-gray-100 font-medium mb-1">연평균 복리 수익률</p>
                    <p className="text-gray-400 mb-2">매년 일정한 비율로 성장했다고 가정할 때의 연간 수익률입니다.</p>
                    <div className="text-yellow-400/80 mb-1.5"><KaTeX expr="\left(\dfrac{\text{최종자산}}{\text{초기자산}}\right)^{\!\frac{1}{n}} - 1" /></div>
                    <p className="text-gray-500">총 수익률이 같아도 기간이 길수록 CAGR은 낮아집니다. 총 수익률보다 기간을 감안한 이 값으로 전략을 비교하세요.</p>
                  </div>
                }
              />
            }
            value={fmt(m.cagr)}
            color={m.cagr >= 0 ? 'text-red-400' : 'text-blue-400'}
          />
          <MetricRow
            label="승률"
            value={fmt(m.win_rate)}
            color={m.win_rate >= 50 ? 'text-red-400' : 'text-blue-400'}
          />
          <MetricRow
            label={
              <TooltipLabel
                label="Sharpe"
                content={
                  <div className="text-xs leading-relaxed">
                    <p className="text-gray-100 font-medium mb-1">샤프 비율 — 위험 대비 수익</p>
                    <p className="text-gray-400 mb-2">변동성 1단위당 얼마나 수익을 냈는지 나타냅니다.</p>
                    <div className="text-yellow-400/80 mb-1.5"><KaTeX expr="\dfrac{\text{수익률}}{\sigma}" /></div>
                    <div className="text-gray-500 space-y-0.5">
                      <div>1 미만 — 보통</div>
                      <div>1 이상 — 양호</div>
                      <div>2 이상 — 우수</div>
                    </div>
                  </div>
                }
              />
            }
            value={m.sharpe_ratio?.toFixed(2) ?? '—'}
          />
          <MetricRow
            label={
              <TooltipLabel
                label="Sortino"
                content={
                  <div className="text-xs leading-relaxed">
                    <p className="text-gray-100 font-medium mb-1">소르티노 비율 — 하락 위험 대비 수익</p>
                    <p className="text-gray-400 mb-2">Sharpe와 비슷하지만 하락 변동성만 위험으로 계산합니다. 상승 변동성은 위험으로 보지 않습니다.</p>
                    <div className="text-yellow-400/80 mb-1.5"><KaTeX expr="\dfrac{\text{수익률}}{\sigma_{\text{하방}}}" /></div>
                    <p className="text-gray-500">Sharpe보다 실용적인 지표입니다. Sharpe보다 높으면 상승 변동성이 크다는 의미입니다.</p>
                  </div>
                }
              />
            }
            value={m.sortino_ratio?.toFixed(2) ?? '—'}
          />
          <MetricRow
            label={
              <TooltipLabel
                label="MDD"
                content={
                  <div className="text-xs leading-relaxed">
                    <p className="text-gray-100 font-medium mb-1">최대 낙폭 (Max Drawdown)</p>
                    <p className="text-gray-400 mb-2">고점 대비 최대 손실 폭. 전략 실행 중 겪을 수 있는 최악의 손실 구간입니다.</p>
                    <div className="text-yellow-400/80 mb-1.5"><KaTeX expr="\dfrac{\text{최저점} - \text{최고점}}{\text{최고점}} \times 100" /></div>
                    <p className="text-gray-500">−20%면 고점에서 20% 떨어진 구간이 있었다는 뜻입니다. 이 손실을 감당할 수 있는지 확인하세요.</p>
                  </div>
                }
              />
            }
            value={fmt(m.max_drawdown)}
            color="text-blue-400"
          />
          <MetricRow
            label={
              <TooltipLabel
                label="Volatility"
                content={
                  <div className="text-xs leading-relaxed">
                    <p className="text-gray-100 font-medium mb-1">연간 변동성</p>
                    <p className="text-gray-400 mb-2">수익률의 흔들림 정도를 연 단위로 환산한 값입니다.</p>
                    <div className="text-yellow-400/80 mb-1.5"><KaTeX expr="\sigma_{\text{일별}} \times \sqrt{252}" /></div>
                    <p className="text-gray-500">높을수록 급등락이 심합니다. 같은 수익률이라면 변동성이 낮은 전략이 더 안정적입니다.</p>
                  </div>
                }
              />
            }
            value={fmt(m.volatility)}
          />
          <MetricRow
            label={
              <TooltipLabel
                label="Calmar"
                content={
                  <div className="text-xs leading-relaxed">
                    <p className="text-gray-100 font-medium mb-1">칼마 비율 — 낙폭 대비 연수익</p>
                    <p className="text-gray-400 mb-2">MDD 대비 CAGR의 비율로, 위험 대비 수익 효율을 나타냅니다.</p>
                    <div className="text-yellow-400/80 mb-1.5"><KaTeX expr="\dfrac{\text{CAGR}}{|\text{MDD}|}" /></div>
                    <div className="text-gray-500 space-y-0.5">
                      <div>0.5 이상 — 양호</div>
                      <div>1 이상 — 우수</div>
                    </div>
                  </div>
                }
              />
            }
            value={m.calmar_ratio?.toFixed(2) ?? '—'}
          />
          <MetricRow
            label={
              <TooltipLabel
                label="Profit Factor"
                content={
                  <div className="text-xs leading-relaxed">
                    <p className="text-gray-100 font-medium mb-1">수익/손실 비율</p>
                    <p className="text-gray-400 mb-2">총 수익금을 총 손실금으로 나눈 값입니다.</p>
                    <div className="text-yellow-400/80 mb-1.5"><KaTeX expr="\dfrac{\text{총 수익금}}{\text{총 손실금}}" /></div>
                    <div className="text-gray-500 space-y-0.5">
                      <div>1 미만 — 손실 우위</div>
                      <div>1.5 이상 — 양호</div>
                      <div>2 이상 — 우수</div>
                    </div>
                    <p className="text-gray-500 mt-1.5">승률이 낮아도 이 값이 높으면 큰 수익 거래가 손실을 충분히 커버하는 전략입니다.</p>
                  </div>
                }
              />
            }
            value={m.profit_factor != null ? m.profit_factor.toFixed(2) : '—'}
          />
        </div>
      </div>

      {/* 신뢰도 분석 */}
      <div className="bg-gray-700/50 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">신뢰도 분석</div>
        <div className="grid grid-cols-2 gap-x-4">
          <MetricRow
            label="샘플 신뢰도"
            value={m.reliability ? `${RELIABILITY_LABEL[m.reliability]} (${m.total_trades}건)` : '—'}
            color={m.reliability ? RELIABILITY_COLOR[m.reliability] : undefined}
          />
          <MetricRow
            label={
              <TooltipLabel
                label="건당 기대값(EV)"
                content={
                  <div className="text-xs leading-relaxed">
                    <p className="text-gray-100 font-medium mb-1">거래 1건당 기대 수익</p>
                    <p className="text-gray-400 mb-2">거래를 반복했을 때 한 번의 거래에서 평균적으로 기대할 수 있는 손익입니다.</p>
                    <div className="text-yellow-400/80 mb-2"><KaTeX expr="(\text{승률} \times \text{평균수익}) - (\text{패율} \times \text{평균손실})" /></div>
                    <p className="text-gray-500">양수면 거래를 반복할수록 수익이 쌓이는 구조입니다. 승률이 낮아도 수익 거래의 평균 수익이 크면 EV는 양수가 될 수 있습니다.</p>
                  </div>
                }
              />
            }
            value={m.expected_value != null ? fmtKrw(m.expected_value) : '—'}
            color={m.expected_value != null && m.expected_value > 0 ? 'text-red-400' : 'text-blue-400'}
          />
        </div>

        {/* Walk-Forward */}
        {wf && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Walk-Forward 검증</div>
            <div className="grid grid-cols-2 gap-x-4">
              <MetricRow
                label={
                  <TooltipLabel
                    label="In-sample 평균"
                    content={
                      <div className="text-xs leading-relaxed">
                        <p className="text-gray-100 font-medium mb-1">훈련 구간 평균 수익률</p>
                        <p className="text-gray-400 mb-2">전체 기간을 여러 구간으로 쪼개, 각 훈련 구간의 수익률을 평균낸 값입니다.</p>
                        <p className="text-gray-500">총 수익률(누적)과 다른 이유: 총 수익률은 전체 기간의 복리 누적이고, 이 값은 각 구간별 수익률의 단순 평균입니다. CAGR(연평균)과 비슷한 수준이 정상입니다.</p>
                      </div>
                    }
                  />
                }
                value={fmt(wf.in_sample_avg)}
                color={wf.in_sample_avg != null && wf.in_sample_avg >= 0 ? 'text-red-400' : 'text-blue-400'}
              />
              <MetricRow
                label={
                  <TooltipLabel
                    label="Out-of-sample 평균"
                    content={
                      <div className="text-xs leading-relaxed">
                        <p className="text-gray-100 font-medium mb-1">검증 구간 평균 수익률</p>
                        <p className="text-gray-400 mb-2">각 훈련 이후 새로운 데이터(미래 구간)에서의 수익률을 평균낸 값입니다. 전략이 본 적 없는 데이터에서의 성과로, 실전과 가장 유사합니다.</p>
                        <p className="text-gray-500">총 수익률보다 낮게 나오는 것은 정상입니다. 중요한 건 이 값이 In-sample과 크게 차이나지 않는지 여부입니다.</p>
                      </div>
                    }
                  />
                }
                value={fmt(wf.out_of_sample_avg)}
                color={wf.out_of_sample_avg != null && wf.out_of_sample_avg >= 0 ? 'text-red-400' : 'text-blue-400'}
              />
              <MetricRow
                label={
                  <TooltipLabel
                    label="과적합 갭"
                    content={
                      <div className="text-xs leading-relaxed">
                        <p className="text-gray-100 font-medium mb-1">In-sample − Out-of-sample</p>
                        <p className="text-gray-400 mb-2">값이 작을수록 실전에서도 안정적입니다.</p>
                        <div className="space-y-0.5">
                          <div><span className="text-red-400">●</span> <span className="text-gray-300">0 이하 / ~5%</span> <span className="text-gray-500">— 양호</span></div>
                          <div><span className="text-yellow-400">●</span> <span className="text-gray-300">5 ~ 20%</span> <span className="text-gray-500">— 과적합 주의</span></div>
                          <div><span className="text-blue-400">●</span> <span className="text-gray-300">20% 초과</span> <span className="text-gray-500">— 과적합 위험</span></div>
                        </div>
                      </div>
                    }
                  />
                }
                value={fmt(wf.overfitting_gap)}
                color={
                  wf.overfitting_gap != null
                    ? wf.overfitting_gap > 20 ? 'text-blue-400' : wf.overfitting_gap > 5 ? 'text-yellow-400' : 'text-red-400'
                    : undefined
                }
              />
            </div>
            {wf.overfitting_gap != null && wf.overfitting_gap > 20 && (
              <div className="text-xs text-red-400 mt-1">
                과적합 주의 — In-sample 대비 Out-of-sample 성과 차이가 큽니다
              </div>
            )}
          </div>
        )}

        {/* Monte Carlo */}
        {mc && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Monte Carlo (1,000회)</div>
            <div className="grid grid-cols-2 gap-x-4">
              <MetricRow
                label={
                  <TooltipLabel
                    label="중앙값"
                    content={
                      <div className="text-xs leading-relaxed">
                        <p className="text-gray-100 font-medium mb-1">1,000회 시뮬레이션의 중간 결과</p>
                        <p className="text-gray-400 mb-2">1,000번 시뮬레이션한 최종 자산을 크기 순으로 줄 세웠을 때 정중앙(500번째)에 해당하는 값입니다.</p>
                        <p className="text-gray-500">평균보다 극단값의 영향을 덜 받아, 기대할 수 있는 현실적인 결과에 가깝습니다.</p>
                      </div>
                    }
                  />
                }
                value={fmtKrw(mc.median)}
              />
              <MetricRow
                label={
                  <TooltipLabel
                    label="손실 확률"
                    content={
                      <div className="text-xs leading-relaxed">
                        <p className="text-gray-100 font-medium mb-1">원금 손실이 발생할 확률</p>
                        <p className="text-gray-400 mb-2">1,000번 시뮬레이션 중 최종 자산이 초기 투자금보다 낮게 끝난 경우의 비율입니다.</p>
                        <p className="text-gray-500">전략의 총 수익률이 플러스여도 거래 순서가 불리하게 배치되면 손실로 끝날 수 있습니다. 이 값이 낮을수록 안정적인 전략입니다.</p>
                      </div>
                    }
                  />
                }
                value={mc.loss_probability != null ? `${mc.loss_probability}%` : '—'}
              />
              <MetricRow
                label={
                  <TooltipLabel
                    label="최선 케이스 (95%)"
                    content={
                      <div className="text-xs leading-relaxed">
                        <p className="text-gray-100 font-medium mb-1">상위 95% 시나리오 최종 자산</p>
                        <p className="text-gray-400 mb-2">1,000번 시뮬레이션 중 하위 5%를 제외한 나머지 95% 시나리오에서의 최종 자산입니다.</p>
                        <p className="text-gray-500">수익 거래가 초반에 몰리는 등 운이 따랐을 때 기대할 수 있는 수준입니다.</p>
                      </div>
                    }
                  />
                }
                value={fmtKrw(mc.percentile_95)}
              />
              <MetricRow
                label={
                  <TooltipLabel
                    label="최악 케이스 (5%)"
                    content={
                      <div className="text-xs leading-relaxed">
                        <p className="text-gray-100 font-medium mb-1">하위 5% 시나리오 최종 자산</p>
                        <p className="text-gray-400 mb-2">1,000번 시뮬레이션 중 가장 나쁜 5% 시나리오에서의 최종 자산입니다.</p>
                        <p className="text-gray-500">손실 거래가 초반에 몰리는 최악의 순서로 진행됐을 때 감내해야 할 수준입니다. 이 값이 원금보다 크게 낮으면 리스크 관리가 필요합니다.</p>
                      </div>
                    }
                  />
                }
                value={fmtKrw(mc.percentile_5)}
              />
            </div>
          </div>
        )}
      </div>

      {/* 자산 곡선 (간이) */}
      {equityCurve.length > 0 && (
        <div className="bg-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
            자산 곡선
            <span className="ml-2 text-gray-500 font-normal normal-case">
              {equityCurve[0]?.date} ~ {equityCurve[equityCurve.length - 1]?.date}
            </span>
          </div>
          <EquityCurveChart data={equityCurve} />
        </div>
      )}

      {/* 매매 이력 */}
      {trades.length > 0 && (() => {
        const visibleTrades = trades.slice(0, MAX_TRADES);
        const totalPages = Math.ceil(visibleTrades.length / PAGE_SIZE);
        const pageTrades = visibleTrades.slice((tradePage - 1) * PAGE_SIZE, tradePage * PAGE_SIZE);
        return (
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
              매매 이력 ({trades.length}건{trades.length > MAX_TRADES ? ` · 상위 ${MAX_TRADES}건 표시` : ''})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-700">
                    <th className="text-left py-1 pr-2">종목</th>
                    <th className="text-left py-1 pr-2">진입일</th>
                    <th className="text-left py-1 pr-2">청산일</th>
                    <th className="text-right py-1 pr-2">진입가</th>
                    <th className="text-right py-1 pr-2">청산가</th>
                    <th className="text-right py-1">수익률</th>
                  </tr>
                </thead>
                <tbody>
                  {pageTrades.map((t, i) => (
                    <tr key={i} className="border-b border-gray-700/30 hover:bg-gray-700/30">
                      <td className="py-1 pr-2">
                        <button
                          onClick={() => onTickerClick(t.ticker, t.name ?? t.ticker, t.entry_date)}
                          className={`hover:underline text-left ${market === 'kr' ? 'text-gray-200 hover:text-white' : 'text-yellow-400 hover:text-yellow-300'}`}
                        >
                          {market === 'kr' ? (t.name || t.ticker) : t.ticker}
                        </button>
                      </td>
                      <td className="py-1 pr-2 text-gray-400">{t.entry_date}</td>
                      <td className="py-1 pr-2 text-gray-400">{t.exit_date}</td>
                      <td className="py-1 pr-2 text-right text-gray-300">{t.entry_price.toLocaleString()}</td>
                      <td className="py-1 pr-2 text-right text-gray-300">{t.exit_price.toLocaleString()}</td>
                      <td className={`py-1 text-right font-medium ${t.pnl_pct >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-2">
                <button
                  onClick={() => setTradePage(p => Math.max(1, p - 1))}
                  disabled={tradePage === 1}
                  className="px-2 py-0.5 text-xs rounded bg-gray-600 text-gray-300 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setTradePage(p)}
                    className={`px-2 py-0.5 text-xs rounded ${
                      p === tradePage
                        ? 'bg-sky-600 text-white'
                        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setTradePage(p => Math.min(totalPages, p + 1))}
                  disabled={tradePage === totalPages}
                  className="px-2 py-0.5 text-xs rounded bg-gray-600 text-gray-300 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  &gt;
                </button>
                <span className="text-xs text-gray-500 ml-1">
                  {(tradePage - 1) * PAGE_SIZE + 1}–{Math.min(tradePage * PAGE_SIZE, visibleTrades.length)} / {visibleTrades.length}건
                </span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// 간이 SVG 자산 곡선
function EquityCurveChart({ data }: { data: { date: string; value: number }[] }) {
  if (data.length < 2) return null;

  const W = 400, H = 80, PAD = 4;
  const values = data.map(d => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = PAD + ((maxV - d.value) / range) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(' ');

  const lastValue = values[values.length - 1];
  const firstValue = values[0];
  const isUp = lastValue >= firstValue;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#f87171' : '#60a5fa'}
        strokeWidth="1.5"
      />
    </svg>
  );
}
