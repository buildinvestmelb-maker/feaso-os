import { Code2, FileCheck2, Radio, Scale, Sigma } from 'lucide-react';
import { AU_STATUTORY_PRESETS } from '../../engine';
import { useFeasoStore, type AuditFocusKey } from '../../store/useFeasoStore';
import { formatAud, formatNum, formatPct } from '../../utils/formatters';

const AUDIT_PILLS: { key: AuditFocusKey; label: string }[] = [
  { key: 'rlv', label: 'RLV Goal-Seek' },
  { key: 'gst', label: 'GST Margin Scheme' },
  { key: 'statutory', label: 'State Statutory' },
  { key: 'margin', label: 'Dev Margin & Profit' },
  { key: 'irr', label: 'Project & Equity IRR' },
  { key: 'peakDebt', label: 'Capital Stack & Debt' },
  { key: 'jv', label: 'JV Waterfall' },
  { key: 'osBridge', label: 'Live SiteProject Bridge' },
];

export function AuditTab() {
  const inputs = useFeasoStore((s) => s.inputs);
  const cashflow = useFeasoStore((s) => s.cashflow);
  const rlv = useFeasoStore((s) => s.rlv);
  const mc = useFeasoStore((s) => s.monteCarloResult);
  const auditFocus = useFeasoStore((s) => s.auditFocus);
  const bridgeStatus = useFeasoStore((s) => s.bridgeStatus);
  const osSyncOverrides = useFeasoStore((s) => s.osSyncOverrides);
  const inspectKpiInAudit = useFeasoStore((s) => s.inspectKpiInAudit);

  const statePreset = AU_STATUTORY_PRESETS[inputs.state];
  const cb = cashflow.costBreakdown;
  const gst = cashflow.gst;
  const jv = cashflow.jvWaterfall;

  const isHighlighted = (keys: AuditFocusKey[]) => keys.includes(auditFocus);

  const cardRing = (keys: AuditFocusKey[]) =>
    isHighlighted(keys)
      ? 'border-[#3daee9]/65 bg-[#16202b]'
      : 'border-[rgba(214,226,240,0.11)] bg-[#151a22]';

  const sumEquityCf = cashflow.monthly.reduce(
    (acc, r) => acc + r.netEquityCfAud,
    0,
  );

  return (
    <div className="flex flex-col gap-2.5 p-3">
      {/* Audit Selector Pills */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-[7px] border border-[rgba(214,226,240,0.1)] bg-[#151a22] px-2.5 py-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#667587] mr-1">
          <Sigma className="h-3.5 w-3.5 text-[#3daee9]" />
          Glass-Box Formula Audit
        </span>
        {AUDIT_PILLS.map((pill) => {
          const active =
            auditFocus === pill.key ||
            (pill.key === 'margin' && auditFocus === 'netProfit') ||
            (pill.key === 'rlv' && auditFocus === 'p50Rlv');
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => inspectKpiInAudit(pill.key)}
              className={`rounded-[4px] border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                active
                  ? 'border-[#3daee9]/55 bg-[#3daee9]/18 text-[#7dd3fc]'
                  : 'border-[rgba(214,226,240,0.09)] bg-[#10141a] text-[#93a1b2] hover:text-[#e6edf3]'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* 1. Residual Land Value & Feasibility Core Equations */}
        <section
          className={`rounded-[8px] border p-3 flex flex-col gap-2 ${cardRing([
            'rlv',
            'margin',
            'netProfit',
            'p50Rlv',
          ])}`}
        >
          <div className="flex items-center justify-between border-b border-[rgba(214,226,240,0.09)] pb-1.5">
            <div className="flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-[#34d399]" />
              <h2 className="text-[12px] font-semibold text-[#e6edf3]">
                Residual Land Value (RLV) &amp; Profit Equations
              </h2>
            </div>
            <span className="font-mono-tech text-[10px] text-[#34d399]">
              {rlv.converged ? `Converged (${rlv.iterations} iters)` : 'Open'}
            </span>
          </div>

          <div className="plasma-inset p-2.5 font-mono-tech text-[11px] flex flex-col gap-1.5">
            <div className="text-[#7dd3fc]">
              Net Profit = Net Realisation (Excl. GST) − Total Development Cost
            </div>
            <div className="text-[#e6edf3]">
              {formatAud(cashflow.netProfitAud)} ={' '}
              {formatAud(cashflow.netRealisationAud)} −{' '}
              {formatAud(cashflow.totalDevelopmentCostAud)}
            </div>
            <div className="border-t border-[rgba(214,226,240,0.08)] pt-1.5 text-[#7dd3fc]">
              Dev Margin on Cost (MDC) = Net Profit ÷ TDC × 100
            </div>
            <div className="text-[#e6edf3]">
              {formatPct(cashflow.devMarginPct, 2)} = (
              {formatAud(cashflow.netProfitAud)} ÷{' '}
              {formatAud(cashflow.totalDevelopmentCostAud)}) × 100
            </div>
            <div className="border-t border-[rgba(214,226,240,0.08)] pt-1.5 text-[#7dd3fc]">
              Goal-Seek Solver: Solve Land Price L s.t.{' '}
              {rlv.targetMetric === 'margin' ? 'MDC(L)' : 'EquityIRR(L)'} ={' '}
              {rlv.targetValuePct.toFixed(1)}%
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] pt-0.5">
              <span className="text-[#93a1b2]">Solved RLV (AUD):</span>
              <span className="text-right font-semibold text-[#34d399]">
                {formatAud(rlv.rlvAud)}
              </span>
              <span className="text-[#93a1b2]">RLV / m² Gross / NDA:</span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(rlv.rlvPerSqmGrossAud)} /{' '}
                {formatAud(rlv.rlvPerSqmNdaAud)}
              </span>
              <span className="text-[#93a1b2]">Stamp Duty @ RLV:</span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(rlv.stampDutyAtRlvAud)}
              </span>
              <span className="text-[#93a1b2]">Re-fed Verification MDC:</span>
              <span className="text-right text-[#34d399]">
                {formatPct(rlv.achievedMarginPct, 3)}
              </span>
              <span className="text-[#93a1b2]">Equity Ledger Checksum:</span>
              <span className="text-right text-[#e6edf3]">
                Σ Eq CF = {formatAud(sumEquityCf)}
              </span>
              {mc && (
                <>
                  <span className="text-[#93a1b2]">Monte Carlo P10 / P50 / P90:</span>
                  <span className="text-right text-[#7dd3fc]">
                    {formatAud(mc.rlv.p10)} / {formatAud(mc.rlv.p50)} /{' '}
                    {formatAud(mc.rlv.p90)}
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* 2. ATO GST Margin Scheme / Full GST Working */}
        <section
          className={`rounded-[8px] border p-3 flex flex-col gap-2 ${cardRing([
            'gst',
          ])}`}
        >
          <div className="flex items-center justify-between border-b border-[rgba(214,226,240,0.09)] pb-1.5">
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-[#fbbf24]" />
              <h2 className="text-[12px] font-semibold text-[#e6edf3]">
                ATO GST Working ({gst.scheme.toUpperCase()})
              </h2>
            </div>
            <span className="font-mono-tech text-[10px] text-[#7dd3fc]">
              Net GST: {formatAud(gst.netGstPayableAud)}
            </span>
          </div>

          <div className="plasma-inset p-2.5 font-mono-tech text-[11px] flex flex-col gap-1.5">
            <div className="text-[#fbbf24] text-[10px]">
              {gst.formulaDescription}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
              <span className="text-[#93a1b2]">Gross Realisation (Incl. GST):</span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(gst.grossSalesInclGstAud)}
              </span>
              <span className="text-[#93a1b2]">Original Land Cost Base:</span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(gst.originalLandCostAud)}
              </span>
              <span className="text-[#93a1b2]">Taxable Margin Base:</span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(gst.gstMarginBaseAud)}
              </span>
              <span className="text-[#93a1b2]">Output GST on Sales (÷ 11):</span>
              <span className="text-right font-semibold text-[#fbbf24]">
                {formatAud(gst.gstOnSalesAud)}
              </span>
              <span className="text-[#93a1b2]">
                GST-Eligible Outflows (Build/Civil/Fees):
              </span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(gst.gstEligibleGrossCostsAud)}
              </span>
              <span className="text-[#93a1b2]">
                Input Tax Credits — ITCs (÷ 11):
              </span>
              <span className="text-right font-semibold text-[#34d399]">
                ({formatAud(gst.inputTaxCreditsAud)})
              </span>
              <span className="text-[#93a1b2] border-t border-[rgba(214,226,240,0.08)] pt-1">
                Net GST Remittable to ATO:
              </span>
              <span className="text-right font-bold text-[#7dd3fc] border-t border-[rgba(214,226,240,0.08)] pt-1">
                {formatAud(gst.netGstPayableAud)}
              </span>
              <span className="text-[#93a1b2]">Net Realisation (Excl. GST):</span>
              <span className="text-right font-semibold text-[#e6edf3]">
                {formatAud(gst.netRealisationExclGstAud)}
              </span>
            </div>
          </div>
        </section>

        {/* 3. Australian State Statutory Schedule & Capital Stack Audit */}
        <section
          className={`rounded-[8px] border p-3 flex flex-col gap-2 ${cardRing([
            'statutory',
            'irr',
            'peakDebt',
            'jv',
          ])}`}
        >
          <div className="flex items-center justify-between border-b border-[rgba(214,226,240,0.09)] pb-1.5">
            <h2 className="text-[12px] font-semibold text-[#e6edf3]">
              Statutory Schedule ({inputs.state}) &amp; Capital Stack Proof
            </h2>
            <span className="font-mono-tech text-[10px] text-[#93a1b2]">
              {statePreset.revenueOffice}
            </span>
          </div>

          <div className="plasma-inset p-2.5 font-mono-tech text-[11px] flex flex-col gap-1.5">
            <div className="text-[#7dd3fc] text-[10px]">
              {cashflow.stampDuty.explanation}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-[#93a1b2]">Base Transfer Duty:</span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(cashflow.stampDuty.baseDutyAud)}
              </span>
              <span className="text-[#93a1b2]">Foreign Purchaser Surcharge:</span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(cashflow.stampDuty.foreignSurchargeAud)}
              </span>
              <span className="text-[#93a1b2]">Annual Land Tax / Hold Total:</span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(cashflow.landTax.annualLandTaxAud)}/yr (
                {formatAud(cb.landTaxHoldingAud)})
              </span>
              <span className="text-[#93a1b2]">Infrastructure Levies:</span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(cashflow.infrastructureLevy.totalLevyAud)}
              </span>
            </div>
            <div className="text-[10px] text-[#667587]">
              Levy basis: {cashflow.infrastructureLevy.explanation}
            </div>

            <div className="border-t border-[rgba(214,226,240,0.08)] pt-1.5 mt-0.5 grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-[#93a1b2]">Senior Cap / Peak Senior:</span>
              <span className="text-right text-[#e6edf3]">
                {formatAud(cashflow.seniorFacilityLimitAud)} /{' '}
                {formatAud(cashflow.peakSeniorDebtAud)}
              </span>
              <span className="text-[#93a1b2]">Senior Int + Line + Est Fees:</span>
              <span className="text-right text-[#fbbf24]">
                {formatAud(
                  cb.seniorInterestAud +
                    cb.seniorLineFeesAud +
                    cb.seniorEstFeesAud,
                )}
              </span>
              <span className="text-[#93a1b2]">Project IRR / Equity IRR:</span>
              <span className="text-right text-[#34d399]">
                {formatPct(cashflow.projectIrrPct, 2)} /{' '}
                {formatPct(cashflow.equityIrrPct, 2)}
              </span>
              {jv.enabled && (
                <>
                  <span className="text-[#93a1b2]">
                    JV Sponsor ({jv.developerEquitySharePct}%) vs Partner:
                  </span>
                  <span className="text-right text-[#7dd3fc]">
                    {formatPct(jv.developerIrrPct, 1)} ({jv.developerMoic.toFixed(2)}x) vs{' '}
                    {formatPct(jv.partnerIrrPct, 1)} ({jv.partnerMoic.toFixed(2)}x)
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* 4. Live SiteProject & OS Bridge JSON Audit */}
        <section
          className={`rounded-[8px] border p-3 flex flex-col gap-2 ${cardRing([
            'osBridge',
          ])}`}
        >
          <div className="flex items-center justify-between border-b border-[rgba(214,226,240,0.09)] pb-1.5">
            <div className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-[#3daee9]" />
              <h2 className="text-[12px] font-semibold text-[#e6edf3]">
                Live SiteProject &amp; devaware-os Bridge Inspector
              </h2>
            </div>
            <span className="font-mono-tech text-[10px] text-[#7dd3fc]">
              {bridgeStatus.mode.toUpperCase()} •{' '}
              {bridgeStatus.connected ? 'CONNECTED' : 'LISTENING'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono-tech text-[10px]">
            <div className="plasma-inset p-2">
              <div className="text-[#667587] mb-1">Active Sync Overrides</div>
              <div>Earthworks: {osSyncOverrides.earthworks ? 'LOCKED' : 'AUTO-SYNC'}</div>
              <div>Massing: {osSyncOverrides.massing ? 'LOCKED' : 'AUTO-SYNC'}</div>
              <div>Environment: {osSyncOverrides.environment ? 'LOCKED' : 'AUTO-SYNC'}</div>
              <div>State: {osSyncOverrides.state ? 'LOCKED' : 'AUTO-SYNC'}</div>
            </div>
            <div className="plasma-inset p-2">
              <div className="text-[#667587] mb-1">Live Synced Totals</div>
              <div>Cut / Fill: {formatNum(inputs.earthworks.cutM3)} / {formatNum(inputs.earthworks.fillM3)} m³</div>
              <div>Spoil: {formatNum(inputs.earthworks.netSpoilM3)} m³</div>
              <div>Yield / GFA: {formatNum(cashflow.totalLotsOrUnits)} u / {formatNum(cashflow.totalGfaSqm)} m²</div>
              <div>Acoustic: {inputs.environment.acousticUpgradeRequired ? 'ON' : 'OFF'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="plasma-inset p-2 flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-[#93a1b2]">
                <Code2 className="h-3 w-3 text-[#3daee9]" />
                Last Inbound SiteProject
              </div>
              <pre
                data-testid="audit-inbound-json"
                className="font-mono-tech text-[10px] text-[#cbd5e1] overflow-auto max-h-[140px] m-0 whitespace-pre-wrap break-all"
              >
                {bridgeStatus.lastInboundProject
                  ? JSON.stringify(bridgeStatus.lastInboundProject, null, 2)
                  : '// Standalone mode — awaiting OS_INIT or OS_PROJECT_SYNC'}
              </pre>
            </div>
            <div className="plasma-inset p-2 flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-[#93a1b2]">
                <Code2 className="h-3 w-3 text-[#34d399]" />
                Last Outbound PROJECT_PATCH
              </div>
              <pre
                data-testid="audit-outbound-json"
                className="font-mono-tech text-[10px] text-[#6ee7b7] overflow-auto max-h-[140px] m-0 whitespace-pre-wrap break-all"
              >
                {bridgeStatus.lastOutboundPatch
                  ? JSON.stringify(
                      { feasibility: bridgeStatus.lastOutboundPatch },
                      null,
                      2,
                    )
                  : '// Debouncing initial patch...'}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
