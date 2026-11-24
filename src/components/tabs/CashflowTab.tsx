import { FileSpreadsheet } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFeasoStore } from '../../store/useFeasoStore';
import { exportMonthlyCashflowCsv } from '../../utils/exports';
import { formatAud, formatAudCompact, formatPct } from '../../utils/formatters';

export function CashflowTab() {
  const inputs = useFeasoStore((s) => s.inputs);
  const cashflow = useFeasoStore((s) => s.cashflow);

  const chartData = cashflow.monthly.map((row) => ({
    label: row.label,
    netOperatingM: Number((row.netOperatingCfAud / 1e6).toFixed(3)),
    cumulativeCfM: Number((row.cumulativeUnleveredCfAud / 1e6).toFixed(3)),
    totalDebtM: Number((row.totalDebtBalanceAud / 1e6).toFixed(3)),
    netOperatingAud: row.netOperatingCfAud,
    cumulativeAud: row.cumulativeUnleveredCfAud,
    totalDebtAud: row.totalDebtBalanceAud,
  }));

  const cb = cashflow.costBreakdown;

  return (
    <div className="flex flex-col gap-2.5 p-3">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="plasma-card px-2.5 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-[#667587]">
            Horizon
          </div>
          <div className="font-mono-tech text-[13px] font-bold text-[#e6edf3]">
            {cashflow.horizonMonths} Months
          </div>
        </div>
        <div className="plasma-card px-2.5 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-[#667587]">
            Peak Senior Debt
          </div>
          <div className="font-mono-tech text-[13px] font-bold text-[#7dd3fc]">
            {formatAudCompact(cashflow.peakSeniorDebtAud)}
          </div>
        </div>
        <div className="plasma-card px-2.5 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-[#667587]">
            Peak Mezzanine
          </div>
          <div className="font-mono-tech text-[13px] font-bold text-[#fbbf24]">
            {formatAudCompact(cashflow.peakMezzDebtAud)}
          </div>
        </div>
        <div className="plasma-card px-2.5 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-[#667587]">
            Total Finance Cost
          </div>
          <div className="font-mono-tech text-[13px] font-bold text-[#f87171]">
            {formatAudCompact(cb.totalFinanceCostsAud)}
          </div>
        </div>
        <div className="plasma-card px-2.5 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-[#667587]">
            Project / Equity IRR
          </div>
          <div className="font-mono-tech text-[13px] font-bold text-[#34d399]">
            {formatPct(cashflow.projectIrrPct, 1)} /{' '}
            {formatPct(cashflow.equityIrrPct, 1)}
          </div>
        </div>
        <div className="plasma-card px-2.5 py-1.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#667587]">
              Ledger Export
            </div>
            <div className="font-mono-tech text-[11px] text-[#93a1b2]">
              {cashflow.monthly.length} rows
            </div>
          </div>
          <button
            type="button"
            onClick={() => exportMonthlyCashflowCsv(inputs, cashflow)}
            className="inline-flex items-center gap-1 rounded-[5px] border border-[#34d399]/35 bg-[#10b981]/12 px-2 py-1 text-[11px] font-medium text-[#6ee7b7] hover:bg-[#10b981]/20 cursor-pointer"
          >
            <FileSpreadsheet className="h-3 w-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Interactive S-Curve & Peak Debt Chart */}
      <div className="plasma-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-[12px] font-semibold text-[#e6edf3]">
            Monthly Cashflow S-Curve &amp; Peak Debt Profile ($M AUD)
          </h2>
          <div className="flex items-center gap-3 text-[10px] font-mono-tech text-[#93a1b2]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-[#3daee9]" />
              Monthly Net CF
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-[#34d399]" />
              Cumulative S-Curve
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-xs bg-[#f59e0b]" />
              Total Debt Balance
            </span>
          </div>
        </div>

        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 6, right: 12, left: 0, bottom: 2 }}
            >
              <CartesianGrid
                stroke="rgba(214,226,240,0.07)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: '#93a1b2', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                stroke="rgba(214,226,240,0.15)"
              />
              <YAxis
                tick={{ fill: '#93a1b2', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                stroke="rgba(214,226,240,0.15)"
                tickFormatter={(v: number) => `$${v.toFixed(0)}M`}
                width={46}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#10141a',
                  border: '1px solid rgba(214,226,240,0.18)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono',
                }}
                labelStyle={{ color: '#e6edf3', fontWeight: 600 }}
                formatter={(value, name) => {
                  const numVal = typeof value === 'number' ? value : Number(value);
                  const audVal = formatAud(numVal * 1e6);
                  const lbl =
                    name === 'netOperatingM'
                      ? 'Monthly Net CF'
                      : name === 'cumulativeCfM'
                        ? 'Cumulative CF'
                        : 'Total Debt';
                  return [audVal, lbl];
                }}
              />
              <ReferenceLine y={0} stroke="rgba(214,226,240,0.28)" />
              <Bar
                dataKey="netOperatingM"
                fill="#3daee9"
                fillOpacity={0.55}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="totalDebtM"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.14}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="cumulativeCfM"
                stroke="#34d399"
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scrollable Institutional Monthly Ledger */}
      <div className="plasma-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[rgba(214,226,240,0.09)] bg-[#10141a] px-3 py-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#93a1b2]">
            Monthly Cashflow &amp; Debt Waterfall Ledger (AUD)
          </h3>
          <span className="font-mono-tech text-[10px] text-[#667587]">
            Reconciled Net Equity Sum = {formatAud(cashflow.netProfitAud)}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full border-collapse text-right font-mono-tech text-[11px]">
            <thead className="sticky top-0 z-10 bg-[#12171e] text-[#93a1b2] border-b border-[rgba(214,226,240,0.12)]">
              <tr>
                <th className="sticky left-0 z-20 bg-[#12171e] px-2 py-1.5 text-left font-semibold">
                  Mo
                </th>
                <th className="px-2 py-1.5">Land/Duty</th>
                <th className="px-2 py-1.5">Earthworks</th>
                <th className="px-2 py-1.5">Build/Env</th>
                <th className="px-2 py-1.5">Stat/Hold</th>
                <th className="px-2 py-1.5">Soft/Sell</th>
                <th className="px-2 py-1.5 text-[#34d399]">Gross Sales</th>
                <th className="px-2 py-1.5">Net GST/ITC</th>
                <th className="px-2 py-1.5 text-[#fbbf24]">Debt Bal</th>
                <th className="px-2 py-1.5">Finance</th>
                <th className="px-2 py-1.5 text-[#7dd3fc]">Net Equity CF</th>
                <th className="px-2 py-1.5">Cumul. Eq</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(214,226,240,0.06)]">
              {cashflow.monthly.map((row) => {
                const landDuty = row.landAud + row.stampDutyAud;
                const buildEnv = row.constructionAud + row.environmentAud;
                const statHold = row.statutoryAud + row.holdingAud;
                const softSell = row.softCostsAud + row.sellingAud;
                const netGstCash = row.itcCreditAud - row.outputGstAud;
                const finCharge =
                  row.seniorInterestAud +
                  row.seniorLineFeeAud +
                  row.seniorEstFeeAud +
                  row.mezzInterestAud +
                  row.mezzEstFeeAud;

                return (
                  <tr
                    key={row.month}
                    className="hover:bg-[#1c232e]/70 transition-colors"
                  >
                    <td className="sticky left-0 bg-[#151a22] px-2 py-1 text-left font-semibold text-[#e6edf3]">
                      {row.label}
                    </td>
                    <td className="px-2 py-1 text-[#cbd5e1]">
                      {landDuty > 0 ? formatAudCompact(-landDuty) : '—'}
                    </td>
                    <td className="px-2 py-1 text-[#cbd5e1]">
                      {row.earthworksAud > 0
                        ? formatAudCompact(-row.earthworksAud)
                        : '—'}
                    </td>
                    <td className="px-2 py-1 text-[#cbd5e1]">
                      {buildEnv > 0 ? formatAudCompact(-buildEnv) : '—'}
                    </td>
                    <td className="px-2 py-1 text-[#cbd5e1]">
                      {statHold > 0 ? formatAudCompact(-statHold) : '—'}
                    </td>
                    <td className="px-2 py-1 text-[#cbd5e1]">
                      {softSell > 0 ? formatAudCompact(-softSell) : '—'}
                    </td>
                    <td className="px-2 py-1 text-[#34d399]">
                      {row.grossSalesAud > 0
                        ? formatAudCompact(row.grossSalesAud)
                        : '—'}
                    </td>
                    <td
                      className={`px-2 py-1 ${
                        netGstCash > 0
                          ? 'text-[#34d399]'
                          : netGstCash < 0
                            ? 'text-[#fbbf24]'
                            : 'text-[#667587]'
                      }`}
                    >
                      {Math.abs(netGstCash) > 1
                        ? formatAudCompact(netGstCash)
                        : '—'}
                    </td>
                    <td className="px-2 py-1 text-[#fbbf24]">
                      {row.totalDebtBalanceAud > 1
                        ? formatAudCompact(row.totalDebtBalanceAud)
                        : '—'}
                    </td>
                    <td className="px-2 py-1 text-[#f87171]">
                      {finCharge > 1 ? formatAudCompact(-finCharge) : '—'}
                    </td>
                    <td
                      className={`px-2 py-1 font-semibold ${
                        row.netEquityCfAud > 1
                          ? 'text-[#34d399]'
                          : row.netEquityCfAud < -1
                            ? 'text-[#f87171]'
                            : 'text-[#667587]'
                      }`}
                    >
                      {Math.abs(row.netEquityCfAud) > 1
                        ? formatAudCompact(row.netEquityCfAud)
                        : '—'}
                    </td>
                    <td
                      className={`px-2 py-1 ${
                        row.cumulativeEquityCfAud >= 0
                          ? 'text-[#34d399]'
                          : 'text-[#93a1b2]'
                      }`}
                    >
                      {formatAudCompact(row.cumulativeEquityCfAud)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
