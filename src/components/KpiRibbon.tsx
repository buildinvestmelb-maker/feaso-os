import { useFeasoStore, type AuditFocusKey } from '../store/useFeasoStore';
import { formatAud, formatAudCompact, formatPct } from '../utils/formatters';

interface KpiItem {
  id: string;
  focus: AuditFocusKey;
  label: string;
  value: string;
  sub: string;
  tone: 'emerald' | 'cyan' | 'amber' | 'rose' | 'neutral';
  rawValue?: string;
}

const TONE_CLASS: Record<KpiItem['tone'], string> = {
  emerald: 'text-[#34d399]',
  cyan: 'text-[#7dd3fc]',
  amber: 'text-[#fbbf24]',
  rose: 'text-[#f87171]',
  neutral: 'text-[#e6edf3]',
};

export function KpiRibbon() {
  const inputs = useFeasoStore((s) => s.inputs);
  const cashflow = useFeasoStore((s) => s.cashflow);
  const rlv = useFeasoStore((s) => s.rlv);
  const mc = useFeasoStore((s) => s.monteCarloResult);
  const mcRunning = useFeasoStore((s) => s.monteCarloRunning);
  const inspectKpiInAudit = useFeasoStore((s) => s.inspectKpiInAudit);

  const marginTone: KpiItem['tone'] =
    cashflow.devMarginPct >= inputs.targetMarginPct
      ? 'emerald'
      : cashflow.devMarginPct >= 0
        ? 'amber'
        : 'rose';

  const irrTone: KpiItem['tone'] =
    cashflow.equityIrrPct === null
      ? 'neutral'
      : cashflow.equityIrrPct >= inputs.targetIrrPct
        ? 'emerald'
        : cashflow.equityIrrPct >= 10
          ? 'amber'
          : 'rose';

  const profitTone: KpiItem['tone'] =
    cashflow.netProfitAud > 0 ? 'emerald' : 'rose';

  const items: KpiItem[] = [
    {
      id: 'kpi-rlv',
      focus: 'rlv',
      label: 'Residual Land Value',
      value: rlv.feasible ? formatAudCompact(rlv.rlvAud) : 'Infeasible',
      sub: `${formatAud(rlv.rlvPerSqmGrossAud)}/m² • ${formatAud(rlv.rlvPerLotOrUnitAud)}/lot`,
      tone: rlv.feasible ? 'emerald' : 'rose',
      rawValue: String(rlv.rlvAud),
    },
    {
      id: 'kpi-margin',
      focus: 'margin',
      label: 'Dev Margin (MDC)',
      value: formatPct(cashflow.devMarginPct, 1),
      sub: `Target ${inputs.targetMarginPct.toFixed(1)}% • ${formatPct(cashflow.profitOnGrvPct, 1)} GRV`,
      tone: marginTone,
      rawValue: cashflow.devMarginPct.toFixed(2),
    },
    {
      id: 'kpi-irr',
      focus: 'irr',
      label: 'Equity IRR (p.a.)',
      value: formatPct(cashflow.equityIrrPct, 1),
      sub: `Project IRR ${formatPct(cashflow.projectIrrPct, 1)}`,
      tone: irrTone,
      rawValue:
        cashflow.equityIrrPct !== null ? cashflow.equityIrrPct.toFixed(2) : '',
    },
    {
      id: 'kpi-peak-debt',
      focus: 'peakDebt',
      label: 'Peak Debt',
      value: formatAudCompact(cashflow.peakDebtAud),
      sub: `${cashflow.peakLtcPct.toFixed(1)}% LTC • Eq ${formatAudCompact(cashflow.peakEquityAud)}`,
      tone: 'cyan',
      rawValue: String(Math.round(cashflow.peakDebtAud)),
    },
    {
      id: 'kpi-net-profit',
      focus: 'netProfit',
      label: 'Net Profit',
      value: formatAudCompact(cashflow.netProfitAud),
      sub: `TDC ${formatAudCompact(cashflow.totalDevelopmentCostAud)}`,
      tone: profitTone,
      rawValue: String(Math.round(cashflow.netProfitAud)),
    },
    {
      id: 'kpi-p50-rlv',
      focus: 'p50Rlv',
      label: 'P50 Monte Carlo RLV',
      value: mcRunning
        ? 'Simulating…'
        : mc
          ? formatAudCompact(mc.rlv.p50)
          : formatAudCompact(rlv.rlvAud),
      sub: mc
        ? `P10 ${formatAudCompact(mc.rlv.p10)} – P90 ${formatAudCompact(mc.rlv.p90)}`
        : '10,000-run queued',
      tone: 'cyan',
      rawValue: mc ? String(Math.round(mc.rlv.p50)) : '',
    },
  ];

  return (
    <section
      aria-label="Key Feasibility Metrics"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 border-b border-[rgba(214,226,240,0.1)] bg-[#12171e] px-3 py-1.5 shrink-0"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid={item.id}
          data-raw-value={item.rawValue}
          onClick={() => inspectKpiInAudit(item.focus)}
          title={`Click to inspect ${item.label} formula in Glass-Box Audit`}
          className="group flex flex-col items-start justify-between rounded-[6px] border border-[rgba(214,226,240,0.09)] bg-[#161c24] px-2.5 py-1.5 text-left transition-colors hover:border-[#3daee9]/45 hover:bg-[#1a222d] cursor-pointer min-w-0"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#93a1b2] group-hover:text-[#e6edf3] truncate w-full">
            {item.label}
          </span>
          <span
            className={`font-mono-tech text-[15px] font-bold leading-tight tracking-tight truncate w-full mt-0.5 ${TONE_CLASS[item.tone]}`}
          >
            {item.value}
          </span>
          <span className="font-mono-tech text-[10px] text-[#667587] truncate w-full mt-0.5">
            {item.sub}
          </span>
        </button>
      ))}
    </section>
  );
}
