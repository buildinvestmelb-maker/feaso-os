import {
  Calculator,
  Download,
  FileSpreadsheet,
  Radio,
  Unplug,
} from 'lucide-react';
import {
  AUSTRALIAN_STATE_LIST,
  AU_STATUTORY_PRESETS,
  PRESET_TEMPLATES,
  type AustralianState,
  type DevelopmentTypology,
} from '../engine';
import { useFeasoStore } from '../store/useFeasoStore';
import {
  exportLenderSummaryPdf,
  exportMonthlyCashflowCsv,
} from '../utils/exports';

export function TopBar() {
  const inputs = useFeasoStore((s) => s.inputs);
  const cashflow = useFeasoStore((s) => s.cashflow);
  const rlv = useFeasoStore((s) => s.rlv);
  const mc = useFeasoStore((s) => s.monteCarloResult);
  const bridgeStatus = useFeasoStore((s) => s.bridgeStatus);
  const setStateJurisdiction = useFeasoStore((s) => s.setStateJurisdiction);
  const loadPreset = useFeasoStore((s) => s.loadPreset);
  const inspectKpiInAudit = useFeasoStore((s) => s.inspectKpiInAudit);

  const statePreset = AU_STATUTORY_PRESETS[inputs.state];

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(214,226,240,0.11)] bg-[#10141a] px-3 py-1.5 shrink-0">
      {/* Left: Brand + Active Project Name + Preset Picker */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#3daee9]/15 border border-[#3daee9]/35 text-[#3daee9]">
            <Calculator className="h-3.5 w-3.5" />
          </div>
          <span className="font-mono-tech text-[12px] font-bold tracking-tight text-[#e6edf3]">
            feaso-os
          </span>
        </div>

        <span className="h-3.5 w-px bg-[rgba(214,226,240,0.12)] hidden sm:block" />

        <h1
          data-testid="project-title"
          className="text-[12px] font-semibold text-[#e6edf3] truncate max-w-[180px] md:max-w-[260px]"
          title={inputs.projectName}
        >
          {inputs.projectName}
        </h1>

        <select
          aria-label="Development Preset Template"
          data-testid="preset-selector"
          value={inputs.typology}
          onChange={(e) => loadPreset(e.target.value as DevelopmentTypology)}
          className="plasma-select text-[11px] py-0.5 px-1.5 text-[#93a1b2] hover:text-[#e6edf3] hidden md:block"
        >
          {PRESET_TEMPLATES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.shortLabel}
            </option>
          ))}
        </select>
      </div>

      {/* Right: State Badge, Live OS Sync Indicator, Exports */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Active State Jurisdiction Selector Badge */}
        <div
          className="flex items-center gap-1 rounded-[5px] border border-[#34d399]/35 bg-[#10b981]/10 px-1.5 py-0.5"
          title={`${statePreset.name} — ${statePreset.revenueOffice}`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6ee7b7] hidden sm:inline">
            AU
          </span>
          <select
            aria-label="Australian State Jurisdiction"
            data-testid="state-selector"
            value={inputs.state}
            onChange={(e) =>
              setStateJurisdiction(e.target.value as AustralianState)
            }
            className="bg-transparent font-mono-tech text-[11px] font-bold text-[#6ee7b7] outline-none cursor-pointer"
          >
            {AUSTRALIAN_STATE_LIST.map((st) => (
              <option key={st} value={st} className="bg-[#151a22] text-[#e6edf3]">
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Live OS Bridge Sync Indicator */}
        <button
          type="button"
          data-testid="os-sync-indicator"
          key={`sync-${bridgeStatus.syncPulseCount}`}
          onClick={() => inspectKpiInAudit('osBridge')}
          title={
            bridgeStatus.connected
              ? `Synced via ${bridgeStatus.lastSyncSource || 'devaware-os'} (${bridgeStatus.lastSyncAt || ''})`
              : 'Standalone mode — listening for devaware-os postMessage events'
          }
          className={`flex items-center gap-1.5 rounded-[5px] border px-2 py-0.5 text-[11px] font-mono-tech transition-colors cursor-pointer ${
            bridgeStatus.syncPulseCount > 0 ? 'animate-sync-flash' : ''
          } ${
            bridgeStatus.connected
              ? 'border-[#3daee9]/40 bg-[#3daee9]/12 text-[#7dd3fc]'
              : 'border-[rgba(214,226,240,0.12)] bg-[#151a22] text-[#93a1b2] hover:text-[#e6edf3]'
          }`}
        >
          {bridgeStatus.connected ? (
            <Radio className="h-3 w-3 text-[#3daee9]" />
          ) : (
            <Unplug className="h-3 w-3 text-[#667587]" />
          )}
          <span className="hidden sm:inline">
            {bridgeStatus.connected
              ? `OS Sync (${bridgeStatus.lastSyncSource || 'Live'})`
              : bridgeStatus.mode === 'embedded'
                ? 'OS Ready'
                : 'Standalone'}
          </span>
          <span className="sm:hidden">
            {bridgeStatus.connected ? 'OS' : 'Local'}
          </span>
        </button>

        {/* Export Lender PDF */}
        <button
          type="button"
          data-testid="export-pdf-btn"
          onClick={() => void exportLenderSummaryPdf(inputs, cashflow, rlv, mc)}
          title="Export 1-Click Lender Summary PDF"
          className="flex items-center gap-1 rounded-[5px] border border-[rgba(214,226,240,0.14)] bg-[#151a22] px-2 py-0.5 text-[11px] font-medium text-[#e6edf3] hover:border-[#3daee9]/50 hover:bg-[#1c232e] transition-colors cursor-pointer"
        >
          <Download className="h-3 w-3 text-[#3daee9]" />
          <span>PDF</span>
        </button>

        {/* Export Monthly Cashflow CSV */}
        <button
          type="button"
          data-testid="export-csv-btn"
          onClick={() => exportMonthlyCashflowCsv(inputs, cashflow)}
          title="Export Full Monthly Cashflow CSV"
          className="flex items-center gap-1 rounded-[5px] border border-[rgba(214,226,240,0.14)] bg-[#151a22] px-2 py-0.5 text-[11px] font-medium text-[#e6edf3] hover:border-[#3daee9]/50 hover:bg-[#1c232e] transition-colors cursor-pointer"
        >
          <FileSpreadsheet className="h-3 w-3 text-[#34d399]" />
          <span>CSV</span>
        </button>
      </div>
    </header>
  );
}
