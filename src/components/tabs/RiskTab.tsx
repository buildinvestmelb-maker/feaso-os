import { useEffect, useState } from 'react';
import { Activity, Play, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFeasoStore } from '../../store/useFeasoStore';
import { formatAud, formatAudCompact, formatPct } from '../../utils/formatters';
import { NumericField } from '../ui/NumericField';

type MatrixMetric = 'rlv' | 'margin' | 'irr';

export function RiskTab() {
  const [matrixMetric, setMatrixMetric] = useState<MatrixMetric>('rlv');

  const inputs = useFeasoStore((s) => s.inputs);
  const rlv = useFeasoStore((s) => s.rlv);
  const sensitivityMatrix = useFeasoStore((s) => s.sensitivityMatrix);
  const mc = useFeasoStore((s) => s.monteCarloResult);
  const mcRunning = useFeasoStore((s) => s.monteCarloRunning);

  const updateMonteCarloConfig = useFeasoStore(
    (s) => s.updateMonteCarloConfig,
  );
  const computeSensitivityNow = useFeasoStore((s) => s.computeSensitivityNow);
  const runMonteCarloNow = useFeasoStore((s) => s.runMonteCarloNow);

  useEffect(() => {
    if (!sensitivityMatrix) {
      computeSensitivityNow();
    }
    if (!mc && !mcRunning) {
      void runMonteCarloNow();
    }
  }, [sensitivityMatrix, mc, mcRunning, computeSensitivityNow, runMonteCarloNow]);

  const maxTornadoAbs = mc
    ? Math.max(
        1,
        ...mc.tornado.map((d) =>
          Math.max(Math.abs(d.downsideDeltaAud), Math.abs(d.upsideDeltaAud)),
        ),
      )
    : 1;

  // Find closest histogram bucket labels for P10, P50, P90 markers
  const findNearestBinLabel = (targetVal: number): string | undefined => {
    if (!mc || mc.rlvHistogram.length === 0) return undefined;
    let best = mc.rlvHistogram[0];
    let bestDist = Math.abs(best.binMidAud - targetVal);
    for (const b of mc.rlvHistogram) {
      const d = Math.abs(b.binMidAud - targetVal);
      if (d < bestDist) {
        best = b;
        bestDist = d;
      }
    }
    return best.label;
  };

  const p10Label = mc ? findNearestBinLabel(mc.rlv.p10) : undefined;
  const p50Label = mc ? findNearestBinLabel(mc.rlv.p50) : undefined;
  const p90Label = mc ? findNearestBinLabel(mc.rlv.p90) : undefined;

  return (
    <div className="flex flex-col gap-2.5 p-3">
      {/* Monte Carlo Controls Bar */}
      <div className="plasma-card p-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(214,226,240,0.08)] pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#3daee9]" />
            <div>
              <h2 className="text-[12px] font-semibold text-[#e6edf3]">
                10,000-Run Monte Carlo Risk Simulator (Triangular Distributions • Web Worker)
              </h2>
              <p className="text-[10px] text-[#93a1b2]">
                Stochastic simulation across Construction Cost, End Sale Price, Interest Rate &amp; Absorption Delay
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mc && (
              <span
                data-testid="mc-runtime-badge"
                className="inline-flex items-center gap-1 rounded-[5px] border border-[#34d399]/35 bg-[#10b981]/10 px-2 py-0.5 font-mono-tech text-[11px] text-[#6ee7b7]"
              >
                <ShieldCheck className="h-3 w-3" />
                {mc.iterations.toLocaleString()} runs • {mc.elapsedMs}ms
              </span>
            )}
            <button
              type="button"
              data-testid="run-monte-carlo-btn"
              disabled={mcRunning}
              onClick={() => void runMonteCarloNow()}
              className="inline-flex items-center gap-1.5 rounded-[5px] border border-[#3daee9]/60 bg-[#3daee9]/20 px-3 py-1 text-[11px] font-semibold text-[#e6edf3] hover:bg-[#3daee9]/30 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>
                {mcRunning
                  ? 'Running 10,000 Runs…'
                  : 'Run 10,000-Run Simulation'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <NumericField
            label="Iterations"
            step={1000}
            min={1000}
            max={25000}
            value={inputs.monteCarlo.iterations}
            onChange={(v) => updateMonteCarloConfig({ iterations: v })}
          />
          <NumericField
            label="Cost Volatility (±%)"
            suffix="%"
            step={1}
            min={1}
            max={35}
            value={inputs.monteCarlo.constructionCostVolPct}
            onChange={(v) =>
              updateMonteCarloConfig({ constructionCostVolPct: v })
            }
          />
          <NumericField
            label="Sale Price Vol. (±%)"
            suffix="%"
            step={1}
            min={1}
            max={35}
            value={inputs.monteCarlo.salePriceVolPct}
            onChange={(v) => updateMonteCarloConfig({ salePriceVolPct: v })}
          />
          <NumericField
            label="Interest Vol. (±bps)"
            suffix="bps"
            step={25}
            min={25}
            max={500}
            value={inputs.monteCarlo.interestRateVolBps}
            onChange={(v) => updateMonteCarloConfig({ interestRateVolBps: v })}
          />
          <NumericField
            label="Sales Delay (±mo)"
            suffix="mo"
            step={1}
            min={1}
            max={12}
            value={inputs.monteCarlo.salesDelayVolMonths}
            onChange={(v) => updateMonteCarloConfig({ salesDelayVolMonths: v })}
          />
        </div>

        {/* P10 / P50 / P90 Percentiles Strip */}
        {mc && (
          <div
            data-testid="mc-percentiles"
            className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-1"
          >
            <div className="plasma-inset p-2">
              <div className="text-[10px] uppercase tracking-wider text-[#667587]">
                Residual Land Value (RLV)
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 font-mono-tech text-[11px]">
                <div>
                  <div className="text-[9px] text-[#f87171]">P10</div>
                  <div data-testid="mc-rlv-p10" className="font-semibold text-[#e6edf3]">
                    {formatAudCompact(mc.rlv.p10)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-[#7dd3fc]">P50</div>
                  <div data-testid="mc-rlv-p50" className="font-bold text-[#7dd3fc]">
                    {formatAudCompact(mc.rlv.p50)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-[#34d399]">P90</div>
                  <div data-testid="mc-rlv-p90" className="font-semibold text-[#34d399]">
                    {formatAudCompact(mc.rlv.p90)}
                  </div>
                </div>
              </div>
            </div>

            <div className="plasma-inset p-2">
              <div className="text-[10px] uppercase tracking-wider text-[#667587]">
                Dev Margin on Cost (%)
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 font-mono-tech text-[11px]">
                <div>
                  <div className="text-[9px] text-[#f87171]">P10</div>
                  <div className="font-semibold text-[#e6edf3]">
                    {formatPct(mc.devMarginPct.p10, 1)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-[#7dd3fc]">P50</div>
                  <div className="font-bold text-[#7dd3fc]">
                    {formatPct(mc.devMarginPct.p50, 1)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-[#34d399]">P90</div>
                  <div className="font-semibold text-[#34d399]">
                    {formatPct(mc.devMarginPct.p90, 1)}
                  </div>
                </div>
              </div>
            </div>

            <div className="plasma-inset p-2">
              <div className="text-[10px] uppercase tracking-wider text-[#667587]">
                Equity IRR (% p.a.)
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 font-mono-tech text-[11px]">
                <div>
                  <div className="text-[9px] text-[#f87171]">P10</div>
                  <div className="font-semibold text-[#e6edf3]">
                    {formatPct(mc.equityIrrPct.p10, 1)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-[#7dd3fc]">P50</div>
                  <div className="font-bold text-[#7dd3fc]">
                    {formatPct(mc.equityIrrPct.p50, 1)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-[#34d399]">P90</div>
                  <div className="font-semibold text-[#34d399]">
                    {formatPct(mc.equityIrrPct.p90, 1)}
                  </div>
                </div>
              </div>
            </div>

            <div className="plasma-inset p-2 flex flex-col justify-between">
              <div className="text-[10px] uppercase tracking-wider text-[#667587]">
                Feasibility Confidence
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-[11px] text-[#93a1b2]">
                  Prob ≥ {inputs.targetMarginPct}% MDC
                </span>
                <span
                  className={`font-mono-tech text-[14px] font-bold ${
                    mc.probMeetsTargetMarginPct >= 50
                      ? 'text-[#34d399]'
                      : 'text-[#fbbf24]'
                  }`}
                >
                  {mc.probMeetsTargetMarginPct.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-baseline justify-between text-[10px] text-[#667587]">
                <span>Prob Profit &gt; $0</span>
                <span className="font-mono-tech text-[#e6edf3]">
                  {mc.probPositiveProfitPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row: Histogram + Tornado Sensitivity */}
      {mc && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* Monte Carlo RLV Histogram */}
          <div className="plasma-card p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12px] font-semibold text-[#e6edf3]">
                RLV Distribution Histogram ({mc.iterations.toLocaleString()} Runs)
              </h3>
              <span className="font-mono-tech text-[10px] text-[#93a1b2]">
                σ = {formatAudCompact(mc.rlv.stdDev)}
              </span>
            </div>

            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mc.rlvHistogram}
                  margin={{ top: 20, right: 10, left: 0, bottom: 2 }}
                >
                  <CartesianGrid
                    stroke="rgba(214,226,240,0.07)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#93a1b2', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                    interval={3}
                    stroke="rgba(214,226,240,0.14)"
                  />
                  <YAxis
                    tick={{ fill: '#93a1b2', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    stroke="rgba(214,226,240,0.14)"
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#10141a',
                      border: '1px solid rgba(214,226,240,0.18)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono',
                    }}
                    formatter={(value, _name, item) => {
                      const pct = typeof value === 'number' ? value : Number(value);
                      const count = (item?.payload as { count?: number })?.count ?? 0;
                      return [`${pct.toFixed(2)}% (${count} runs)`, 'Frequency'];
                    }}
                  />
                  <Bar
                    dataKey="frequencyPct"
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={false}
                  >
                    {mc.rlvHistogram.map((bucket, idx) => {
                      const inTailLow = bucket.binMidAud < mc.rlv.p10;
                      const inTailHigh = bucket.binMidAud > mc.rlv.p90;
                      const fill = inTailLow
                        ? '#f87171'
                        : inTailHigh
                          ? '#34d399'
                          : '#3daee9';
                      return (
                        <Cell
                          key={`bin-${idx}`}
                          fill={fill}
                          fillOpacity={0.78}
                        />
                      );
                    })}
                  </Bar>
                  {p10Label && (
                    <ReferenceLine
                      x={p10Label}
                      stroke="#f87171"
                      strokeDasharray="3 3"
                      label={{ value: 'P10', fill: '#f87171', fontSize: 10, position: 'top' }}
                    />
                  )}
                  {p50Label && (
                    <ReferenceLine
                      x={p50Label}
                      stroke="#e6edf3"
                      strokeWidth={1.5}
                      label={{ value: 'P50', fill: '#e6edf3', fontSize: 10, position: 'top' }}
                    />
                  )}
                  {p90Label && (
                    <ReferenceLine
                      x={p90Label}
                      stroke="#34d399"
                      strokeDasharray="3 3"
                      label={{ value: 'P90', fill: '#34d399', fontSize: 10, position: 'top' }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tornado Sensitivity Chart (Top Deal-Breakers) */}
          <div className="plasma-card p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12px] font-semibold text-[#e6edf3]">
                Tornado Sensitivity — Top RLV Deal-Breakers
              </h3>
              <span className="font-mono-tech text-[10px] text-[#93a1b2]">
                Base RLV: {formatAudCompact(rlv.rlvAud)}
              </span>
            </div>

            <div
              data-testid="tornado-chart"
              className="flex flex-col gap-2.5 my-auto"
            >
              {mc.tornado.map((driver, idx) => {
                const leftPct = Math.min(
                  100,
                  (Math.abs(Math.min(0, driver.downsideDeltaAud)) / maxTornadoAbs) *
                    100,
                );
                const rightPct = Math.min(
                  100,
                  (Math.max(0, driver.upsideDeltaAud) / maxTornadoAbs) * 100,
                );

                return (
                  <div key={driver.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-[#e6edf3]">
                        <span className="font-mono-tech text-[#667587] mr-1.5">
                          #{idx + 1}
                        </span>
                        {driver.label}{' '}
                        <span className="font-mono-tech text-[10px] text-[#93a1b2]">
                          ({driver.unitLabel})
                        </span>
                      </span>
                      <span className="font-mono-tech text-[10px] text-[#93a1b2]">
                        Spread:{' '}
                        <strong className="text-[#e6edf3]">
                          {formatAudCompact(driver.spreadAud)}
                        </strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 items-center gap-0 h-5 rounded-[4px] bg-[#0e1217] border border-[rgba(214,226,240,0.08)] overflow-hidden relative">
                      {/* Downside (left half, grows right-to-left) */}
                      <div className="flex justify-end items-center h-full pr-1 border-r border-[rgba(214,226,240,0.22)] relative">
                        <div
                          style={{ width: `${leftPct}%` }}
                          className="h-3.5 rounded-l-[2px] bg-[#f87171]/75"
                        />
                        <span className="absolute left-1.5 font-mono-tech text-[10px] text-[#fca5a5]">
                          {formatAudCompact(driver.downsideDeltaAud)}
                        </span>
                      </div>

                      {/* Upside (right half, grows left-to-right) */}
                      <div className="flex justify-start items-center h-full pl-1 relative">
                        <div
                          style={{ width: `${rightPct}%` }}
                          className="h-3.5 rounded-r-[2px] bg-[#34d399]/75"
                        />
                        <span className="absolute right-1.5 font-mono-tech text-[10px] text-[#6ee7b7]">
                          +{formatAudCompact(driver.upsideDeltaAud)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2D Cost vs Revenue Sensitivity Matrix */}
      <div className="plasma-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#3daee9]" />
            <h3 className="text-[12px] font-semibold text-[#e6edf3]">
              2D Sensitivity Matrix — Construction Cost Δ% vs. End Sale Price Δ%
            </h3>
          </div>

          <div className="flex items-center rounded-[5px] bg-[#0e1217] p-0.5 border border-[rgba(214,226,240,0.1)]">
            {(
              [
                ['rlv', 'RLV ($)'],
                ['margin', 'Dev Margin %'],
                ['irr', 'Equity IRR %'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMatrixMetric(m)}
                className={`rounded-[4px] px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                  matrixMetric === m
                    ? 'bg-[#3daee9]/20 text-[#7dd3fc]'
                    : 'text-[#93a1b2] hover:text-[#e6edf3]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {sensitivityMatrix && (
          <div className="overflow-x-auto">
            <table
              data-testid="sensitivity-matrix"
              className="w-full border-collapse font-mono-tech text-[11px]"
            >
              <thead>
                <tr>
                  <th className="border border-[rgba(214,226,240,0.1)] bg-[#10141a] px-2 py-1.5 text-left text-[#93a1b2]">
                    Cost Δ \ Revenue Δ
                  </th>
                  {sensitivityMatrix.revenueDeltasPct.map((rev) => (
                    <th
                      key={rev}
                      className={`border border-[rgba(214,226,240,0.1)] px-2 py-1.5 text-center ${
                        rev === 0
                          ? 'bg-[#1c232e] text-[#7dd3fc]'
                          : 'bg-[#10141a] text-[#93a1b2]'
                      }`}
                    >
                      {rev > 0 ? `+${rev}%` : `${rev}%`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sensitivityMatrix.cells.map((row, rIdx) => {
                  const costDelta = sensitivityMatrix.costDeltasPct[rIdx];
                  return (
                    <tr key={costDelta}>
                      <th
                        className={`border border-[rgba(214,226,240,0.1)] px-2 py-1.5 text-left ${
                          costDelta === 0
                            ? 'bg-[#1c232e] text-[#7dd3fc]'
                            : 'bg-[#10141a] text-[#93a1b2]'
                        }`}
                      >
                        {costDelta > 0 ? `+${costDelta}%` : `${costDelta}%`} Cost
                      </th>
                      {row.map((cell) => {
                        const isBase =
                          cell.costDeltaPct === 0 && cell.revenueDeltaPct === 0;
                        const feasible =
                          cell.devMarginPct >= inputs.targetMarginPct;
                        const positive = cell.devMarginPct >= 0;

                        const bgClass = isBase
                          ? 'bg-[#3daee9]/18 text-[#e6edf3] font-bold ring-1 ring-inset ring-[#3daee9]/60'
                          : feasible
                            ? 'bg-[#10b981]/12 text-[#6ee7b7]'
                            : positive
                              ? 'bg-[#f59e0b]/10 text-[#fcd34d]'
                              : 'bg-[#f87171]/12 text-[#fca5a5]';

                        const display =
                          matrixMetric === 'rlv'
                            ? formatAudCompact(cell.rlvAud)
                            : matrixMetric === 'margin'
                              ? formatPct(cell.devMarginPct, 1)
                              : formatPct(cell.equityIrrPct, 1);

                        return (
                          <td
                            key={`${cell.costDeltaPct}-${cell.revenueDeltaPct}`}
                            title={`Cost ${cell.costDeltaPct}% / Rev ${cell.revenueDeltaPct}% → RLV ${formatAud(cell.rlvAud)}, Margin ${cell.devMarginPct.toFixed(1)}%, Profit ${formatAud(cell.netProfitAud)}`}
                            className={`border border-[rgba(214,226,240,0.08)] px-2 py-1.5 text-center ${bgClass}`}
                          >
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
