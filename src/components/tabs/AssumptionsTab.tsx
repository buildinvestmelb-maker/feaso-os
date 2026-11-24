import { useState } from 'react';
import {
  Building2,
  Landmark,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Target,
  Trash2,
  Unlock,
  Volume2,
} from 'lucide-react';
import {
  AU_STATUTORY_PRESETS,
  PRESET_TEMPLATES,
  type DebtLimitType,
  type GstScheme,
  type SCurveShape,
} from '../../engine';
import { useFeasoStore } from '../../store/useFeasoStore';
import { formatAud, formatNum, formatPct } from '../../utils/formatters';
import { NumericField } from '../ui/NumericField';

type SectionFilter = 'all' | 'land' | 'stages' | 'statutory' | 'capital';

function OverridePill({
  label,
  overridden,
  onToggle,
  testId,
}: {
  label: string;
  overridden: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onToggle}
      title={
        overridden
          ? `${label}: User Override active — inbound OS_PROJECT_SYNC will not overwrite these fields`
          : `${label}: OS Auto-Sync active — updates automatically from devaware-os`
      }
      className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-mono-tech transition-colors cursor-pointer ${
        overridden
          ? 'border-[#f59e0b]/40 bg-[#f59e0b]/12 text-[#fcd34d]'
          : 'border-[#3daee9]/35 bg-[#3daee9]/10 text-[#7dd3fc]'
      }`}
    >
      {overridden ? (
        <Lock className="h-2.5 w-2.5" />
      ) : (
        <Unlock className="h-2.5 w-2.5" />
      )}
      <span>{overridden ? 'User Override' : 'OS Auto-Sync'}</span>
    </button>
  );
}

export function AssumptionsTab() {
  const [section, setSection] = useState<SectionFilter>('all');

  const inputs = useFeasoStore((s) => s.inputs);
  const cashflow = useFeasoStore((s) => s.cashflow);
  const rlv = useFeasoStore((s) => s.rlv);
  const osSyncOverrides = useFeasoStore((s) => s.osSyncOverrides);

  const loadPreset = useFeasoStore((s) => s.loadPreset);
  const updateInputs = useFeasoStore((s) => s.updateInputs);
  const updateStatutoryOverrides = useFeasoStore(
    (s) => s.updateStatutoryOverrides,
  );
  const resetStatutoryOverrides = useFeasoStore(
    (s) => s.resetStatutoryOverrides,
  );
  const updateEarthworks = useFeasoStore((s) => s.updateEarthworks);
  const updateEnvironment = useFeasoStore((s) => s.updateEnvironment);
  const updateCapitalStack = useFeasoStore((s) => s.updateCapitalStack);
  const updateStage = useFeasoStore((s) => s.updateStage);
  const addStage = useFeasoStore((s) => s.addStage);
  const removeStage = useFeasoStore((s) => s.removeStage);
  const applySolvedRlvToLand = useFeasoStore((s) => s.applySolvedRlvToLand);
  const setOsSyncOverride = useFeasoStore((s) => s.setOsSyncOverride);

  const statePreset = AU_STATUTORY_PRESETS[inputs.state];
  const cb = cashflow.costBreakdown;
  const jv = cashflow.jvWaterfall;

  const show = (key: Exclude<SectionFilter, 'all'>) =>
    section === 'all' || section === key;

  return (
    <div className="flex flex-col gap-2.5 p-3">
      {/* Top Strip: Quick Presets + Goal-Seek Bar + Sub-Section Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[7px] border border-[rgba(214,226,240,0.1)] bg-[#151a22] px-2.5 py-2">
        {/* Quick Preset Templates */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#667587] mr-0.5">
            Templates
          </span>
          {PRESET_TEMPLATES.map((tpl) => {
            const active = inputs.typology === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                data-testid={`preset-btn-${tpl.id}`}
                onClick={() => loadPreset(tpl.id)}
                title={tpl.subtitle}
                className={`rounded-[5px] border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border-[#3daee9]/55 bg-[#3daee9]/15 text-[#e6edf3]'
                    : 'border-[rgba(214,226,240,0.1)] bg-[#10141a] text-[#93a1b2] hover:text-[#e6edf3] hover:border-[rgba(214,226,240,0.22)]'
                }`}
              >
                {tpl.shortLabel}
              </button>
            );
          })}
        </div>

        {/* RLV Goal-Seek Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-[#34d399]" />
          <select
            aria-label="RLV Goal-Seek Metric"
            data-testid="goal-seek-metric"
            value={inputs.targetMetric}
            onChange={(e) =>
              updateInputs({
                targetMetric: e.target.value as 'margin' | 'irr',
              })
            }
            className="plasma-select text-[11px] py-0.5 px-1.5"
          >
            <option value="margin">Target Margin %</option>
            <option value="irr">Target Equity IRR %</option>
          </select>
          <input
            aria-label="Goal-Seek Target Percentage"
            data-testid="goal-seek-target"
            type="number"
            step={0.5}
            min={1}
            max={60}
            value={
              inputs.targetMetric === 'margin'
                ? inputs.targetMarginPct
                : inputs.targetIrrPct
            }
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!Number.isFinite(val)) return;
              if (inputs.targetMetric === 'margin') {
                updateInputs({ targetMarginPct: Math.max(0, val) });
              } else {
                updateInputs({ targetIrrPct: Math.max(0, val) });
              }
            }}
            className="plasma-input w-14 text-right py-0.5"
          />
          <button
            type="button"
            data-testid="apply-rlv-btn"
            onClick={applySolvedRlvToLand}
            disabled={!rlv.feasible}
            title="Set Land Purchase Price equal to solved Residual Land Value"
            className="inline-flex items-center gap-1 rounded-[5px] border border-[#34d399]/40 bg-[#10b981]/14 px-2 py-1 text-[11px] font-semibold text-[#6ee7b7] hover:bg-[#10b981]/22 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Apply RLV ({formatAud(rlv.rlvAud)})</span>
          </button>
        </div>

        {/* Compact Section Filter */}
        <div className="flex items-center gap-1 rounded-[5px] bg-[#0e1217] p-0.5 border border-[rgba(214,226,240,0.08)]">
          {(
            [
              ['all', 'All'],
              ['land', 'Land & Civil'],
              ['stages', 'Stages'],
              ['statutory', 'Statutory/GST'],
              ['capital', 'Capital/JV'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`rounded-[4px] px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                section === id
                  ? 'bg-[#1c232e] text-[#e6edf3]'
                  : 'text-[#93a1b2] hover:text-[#e6edf3]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: Land Acquisition + Civil/Earthworks + Environment */}
      {show('land') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* Land & Acquisition */}
          <div className="plasma-card p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-[rgba(214,226,240,0.08)] pb-1.5">
              <div className="flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5 text-[#3daee9]" />
                <h2 className="text-[12px] font-semibold text-[#e6edf3]">
                  Land &amp; Acquisition
                </h2>
              </div>
              <span className="font-mono-tech text-[11px] text-[#93a1b2]">
                Land + Duty: <strong className="text-[#e6edf3]">{formatAud(cb.landPriceAud + cb.stampDutyAud)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <NumericField
                label="Land Purchase Price"
                prefix="$"
                step={100000}
                min={0}
                value={inputs.landPriceAud}
                testId="input-land-price"
                onChange={(v) => updateInputs({ landPriceAud: v })}
              />
              <NumericField
                label="Gross Site Area"
                suffix="m²"
                step={500}
                min={100}
                value={inputs.grossAreaSqm}
                onChange={(v) => updateInputs({ grossAreaSqm: v })}
              />
              <NumericField
                label="Net Dev Area (NDA)"
                suffix="m²"
                step={500}
                min={100}
                value={inputs.netDevelopableAreaSqm}
                onChange={(v) => updateInputs({ netDevelopableAreaSqm: v })}
              />
              <NumericField
                label="Deposit %"
                suffix="%"
                step={1}
                min={0}
                max={100}
                value={inputs.landDepositPct}
                onChange={(v) => updateInputs({ landDepositPct: v })}
              />
              <NumericField
                label="Settlement Month"
                suffix="mo"
                step={1}
                min={0}
                max={36}
                value={inputs.landSettlementMonth}
                onChange={(v) => updateInputs({ landSettlementMonth: v })}
              />
              <NumericField
                label="Acq. Legal Fees"
                prefix="$"
                step={5000}
                min={0}
                value={inputs.legalAcquisitionFeesAud}
                onChange={(v) => updateInputs({ legalAcquisitionFeesAud: v })}
              />
            </div>

            {/* Soft Costs, Selling & Holding */}
            <div className="border-t border-[rgba(214,226,240,0.08)] pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#667587] mb-1.5">
                Soft Costs, Selling &amp; Holding
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <NumericField
                  label="Prof. Fees"
                  suffix="%"
                  step={0.5}
                  min={0}
                  max={25}
                  value={inputs.professionalFeesPct}
                  onChange={(v) => updateInputs({ professionalFeesPct: v })}
                />
                <NumericField
                  label="Contingency"
                  suffix="%"
                  step={0.5}
                  min={0}
                  max={25}
                  value={inputs.contingencyPct}
                  onChange={(v) => updateInputs({ contingencyPct: v })}
                />
                <NumericField
                  label="Agent Comm."
                  suffix="%"
                  step={0.1}
                  min={0}
                  max={10}
                  value={inputs.agentCommissionPct}
                  onChange={(v) => updateInputs({ agentCommissionPct: v })}
                />
                <NumericField
                  label="Marketing"
                  suffix="%"
                  step={0.1}
                  min={0}
                  max={10}
                  value={inputs.marketingPct}
                  onChange={(v) => updateInputs({ marketingPct: v })}
                />
                <NumericField
                  label="PM Fee"
                  suffix="%"
                  step={0.25}
                  min={0}
                  max={10}
                  value={inputs.projectManagementPct}
                  onChange={(v) => updateInputs({ projectManagementPct: v })}
                />
                <NumericField
                  label="DA / Approvals"
                  prefix="$"
                  step={10000}
                  min={0}
                  value={inputs.daApprovalFeesAud}
                  onChange={(v) => updateInputs({ daApprovalFeesAud: v })}
                />
                <NumericField
                  label="Selling Legal"
                  prefix="$"
                  suffix="/u"
                  step={100}
                  min={0}
                  value={inputs.sellingLegalPerUnitAud}
                  onChange={(v) => updateInputs({ sellingLegalPerUnitAud: v })}
                />
                <NumericField
                  label="Rates & Holding"
                  prefix="$"
                  suffix="/mo"
                  step={1000}
                  min={0}
                  value={inputs.ratesAndHoldingMonthlyAud}
                  onChange={(v) =>
                    updateInputs({ ratesAndHoldingMonthlyAud: v })
                  }
                />
              </div>
            </div>
          </div>

          {/* Civil / Bulk Earthworks & Environment (OS Bridge Auto-Sync) */}
          <div className="plasma-card p-3 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[rgba(214,226,240,0.08)] pb-1.5">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-[#3daee9]" />
                <h2 className="text-[12px] font-semibold text-[#e6edf3]">
                  Bulk Earthworks &amp; Environment
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <OverridePill
                  label="Earthworks"
                  overridden={osSyncOverrides.earthworks}
                  onToggle={() =>
                    setOsSyncOverride('earthworks', !osSyncOverrides.earthworks)
                  }
                  testId="override-earthworks-btn"
                />
                <span
                  data-testid="earthworks-total-cost"
                  data-raw-value={String(Math.round(cb.totalEarthworksGrossAud))}
                  className="font-mono-tech text-[11px] font-semibold text-[#7dd3fc]"
                >
                  {formatAud(cb.totalEarthworksGrossAud)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <NumericField
                label="Cut Volume"
                suffix="m³"
                step={500}
                min={0}
                value={inputs.earthworks.cutM3}
                testId="input-earthworks-cut"
                onChange={(v) =>
                  updateEarthworks({ cutM3: v, directBulkOverrideAud: null })
                }
              />
              <NumericField
                label="Fill Volume"
                suffix="m³"
                step={500}
                min={0}
                value={inputs.earthworks.fillM3}
                testId="input-earthworks-fill"
                onChange={(v) =>
                  updateEarthworks({ fillM3: v, directBulkOverrideAud: null })
                }
              />
              <NumericField
                label="Net Spoil / Import"
                suffix="m³"
                step={250}
                value={inputs.earthworks.netSpoilM3}
                testId="input-earthworks-spoil"
                onChange={(v) =>
                  updateEarthworks({
                    netSpoilM3: v,
                    directBulkOverrideAud: null,
                  })
                }
              />
              <NumericField
                label="Cut Rate"
                prefix="$"
                suffix="/m³"
                step={2}
                min={0}
                value={inputs.earthworks.cutRatePerM3Aud}
                onChange={(v) => updateEarthworks({ cutRatePerM3Aud: v })}
              />
              <NumericField
                label="Fill Compaction"
                prefix="$"
                suffix="/m³"
                step={2}
                min={0}
                value={inputs.earthworks.fillRatePerM3Aud}
                onChange={(v) => updateEarthworks({ fillRatePerM3Aud: v })}
              />
              <NumericField
                label="Spoil Disposal"
                prefix="$"
                suffix="/m³"
                step={5}
                min={0}
                value={inputs.earthworks.spoilDisposalRatePerM3Aud}
                onChange={(v) =>
                  updateEarthworks({ spoilDisposalRatePerM3Aud: v })
                }
              />
              <NumericField
                label="Retaining Length"
                suffix="m"
                step={10}
                min={0}
                value={inputs.earthworks.retainingWallLengthM}
                onChange={(v) =>
                  updateEarthworks({
                    retainingWallLengthM: v,
                    directRetainingOverrideAud: null,
                  })
                }
              />
              <NumericField
                label="Retaining Rate"
                prefix="$"
                suffix="/m"
                step={50}
                min={0}
                value={inputs.earthworks.retainingRatePerMAud}
                onChange={(v) => updateEarthworks({ retainingRatePerMAud: v })}
              />
              <div className="plasma-inset px-2 py-1 flex flex-col justify-center">
                <span className="text-[10px] text-[#667587]">Spoil + Retaining</span>
                <span className="font-mono-tech text-[11px] font-semibold text-[#e6edf3]">
                  {formatAud(cb.spoilDisposalAud + cb.retainingWallsAud)}
                </span>
              </div>
            </div>

            {/* Environment & Acoustic Glazing Allowance */}
            <div className="border-t border-[rgba(214,226,240,0.08)] pt-2 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#667587]">
                  Environment &amp; Attenuation Allowances
                </span>
                <OverridePill
                  label="Environment"
                  overridden={osSyncOverrides.environment}
                  onToggle={() =>
                    setOsSyncOverride(
                      'environment',
                      !osSyncOverrides.environment,
                    )
                  }
                  testId="override-environment-btn"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="plasma-inset p-2 flex flex-col gap-1.5">
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#e6edf3]">
                      <Volume2 className="h-3.5 w-3.5 text-[#3daee9]" />
                      Acoustic Glazing &amp; Attenuation
                    </span>
                    <input
                      type="checkbox"
                      data-testid="acoustic-upgrade-toggle"
                      checked={inputs.environment.acousticUpgradeRequired}
                      onChange={(e) =>
                        updateEnvironment({
                          acousticUpgradeRequired: e.target.checked,
                        })
                      }
                      className="h-3.5 w-3.5 accent-[#3daee9] cursor-pointer"
                    />
                  </label>
                  <div className="flex items-center justify-between gap-2">
                    <NumericField
                      label="Allowance / Lot or Unit"
                      prefix="$"
                      step={500}
                      min={0}
                      disabled={!inputs.environment.acousticUpgradeRequired}
                      value={inputs.environment.acousticAllowancePerUnitAud}
                      onChange={(v) =>
                        updateEnvironment({ acousticAllowancePerUnitAud: v })
                      }
                    />
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-[#667587]">Total</div>
                      <div
                        data-testid="acoustic-allowance-total"
                        className="font-mono-tech text-[11px] font-semibold text-[#e6edf3]"
                      >
                        {formatAud(cb.acousticAllowanceGrossAud)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="plasma-inset p-2 grid grid-cols-2 gap-1.5">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[11px] text-[#93a1b2]">BAL Rating</label>
                    <select
                      aria-label="Bushfire Attack Level"
                      value={inputs.environment.bushfireAttackLevel}
                      onChange={(e) =>
                        updateEnvironment({
                          bushfireAttackLevel: e.target
                            .value as typeof inputs.environment.bushfireAttackLevel,
                        })
                      }
                      className="plasma-select text-[11px] py-1"
                    >
                      {(
                        [
                          'BAL-LOW',
                          'BAL-12.5',
                          'BAL-19',
                          'BAL-29',
                          'BAL-40',
                          'BAL-FZ',
                        ] as const
                      ).map((bal) => (
                        <option key={bal} value={bal}>
                          {bal}
                        </option>
                      ))}
                    </select>
                  </div>
                  <NumericField
                    label="BAL Allowance"
                    prefix="$"
                    step={10000}
                    min={0}
                    value={inputs.environment.balAllowanceAud}
                    onChange={(v) => updateEnvironment({ balAllowanceAud: v })}
                  />
                  <label className="col-span-2 flex items-center justify-between text-[11px] text-[#93a1b2] pt-0.5 cursor-pointer">
                    <span>Flood Mitigation Overlay (+{formatAud(inputs.environment.floodMitigationAllowanceAud)})</span>
                    <input
                      type="checkbox"
                      checked={inputs.environment.floodOverlay}
                      onChange={(e) =>
                        updateEnvironment({ floodOverlay: e.target.checked })
                      }
                      className="h-3.5 w-3.5 accent-[#3daee9] cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Multi-Stage Construction & Revenue Mix */}
      {show('stages') && (
        <div className="plasma-card p-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(214,226,240,0.08)] pb-1.5">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#3daee9]" />
              <h2 className="text-[12px] font-semibold text-[#e6edf3]">
                Development Stages — Construction &amp; Revenue Schedule
              </h2>
              <span
                data-testid="massing-totals-summary"
                className="font-mono-tech text-[11px] text-[#93a1b2] ml-1"
              >
                ({formatNum(cashflow.totalLotsOrUnits)} units •{' '}
                {formatNum(cashflow.totalGfaSqm)} m² GFA •{' '}
                {formatNum(cashflow.totalCarBays)} bays •{' '}
                {formatNum(cashflow.totalRoadLengthM)}m roads)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <OverridePill
                label="Massing"
                overridden={osSyncOverrides.massing}
                onToggle={() =>
                  setOsSyncOverride('massing', !osSyncOverrides.massing)
                }
                testId="override-massing-btn"
              />
              <span
                data-testid="total-grv-readout"
                className="font-mono-tech text-[11px] font-semibold text-[#34d399]"
              >
                GRV {formatAud(cashflow.grossRealisationAud)}
              </span>
              <button
                type="button"
                data-testid="add-stage-btn"
                onClick={addStage}
                className="inline-flex items-center gap-1 rounded-[5px] border border-[#3daee9]/40 bg-[#3daee9]/12 px-2 py-0.5 text-[11px] font-medium text-[#7dd3fc] hover:bg-[#3daee9]/20 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Add Stage
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {inputs.stages.map((stage, idx) => {
              const stageGrv = stage.lotsOrUnits * stage.avgSalePriceAud;
              const stageHardCost =
                stage.gfaSqm * stage.constructionRatePerSqmAud +
                stage.carBays * stage.carBayCostAud +
                stage.roadLengthM * stage.roadCostPerMAud;

              return (
                <div
                  key={stage.id}
                  data-testid={`stage-card-${idx}`}
                  className="plasma-inset p-2.5 flex flex-col gap-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      aria-label={`Stage ${idx + 1} Name`}
                      type="text"
                      value={stage.name}
                      onChange={(e) =>
                        updateStage(stage.id, { name: e.target.value })
                      }
                      className="bg-transparent text-[12px] font-semibold text-[#e6edf3] border-b border-transparent hover:border-[rgba(214,226,240,0.2)] focus:border-[#3daee9] outline-none min-w-[180px]"
                    />

                    <div className="flex flex-wrap items-center gap-3 font-mono-tech text-[11px]">
                      <span className="text-[#93a1b2]">
                        Hard Cost:{' '}
                        <strong className="text-[#e6edf3]">
                          {formatAud(stageHardCost)}
                        </strong>
                      </span>
                      <span className="text-[#93a1b2]">
                        Stage GRV:{' '}
                        <strong className="text-[#34d399]">
                          {formatAud(stageGrv)}
                        </strong>
                      </span>
                      <select
                        aria-label={`Stage ${idx + 1} S-Curve`}
                        value={stage.sCurveShape}
                        onChange={(e) =>
                          updateStage(stage.id, {
                            sCurveShape: e.target.value as SCurveShape,
                          })
                        }
                        className="plasma-select text-[10px] py-0.5 px-1.5"
                      >
                        <option value="standard">S-Curve: Standard</option>
                        <option value="front-loaded">S-Curve: Front</option>
                        <option value="back-loaded">S-Curve: Back</option>
                      </select>
                      {inputs.stages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStage(stage.id)}
                          title="Remove Stage"
                          className="text-[#667587] hover:text-[#f87171] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    <NumericField
                      label="Lots / Units"
                      min={1}
                      value={stage.lotsOrUnits}
                      testId={`stage-${idx}-units`}
                      onChange={(v) => updateStage(stage.id, { lotsOrUnits: v })}
                    />
                    <NumericField
                      label="Avg Sale Price"
                      prefix="$"
                      step={10000}
                      min={0}
                      value={stage.avgSalePriceAud}
                      onChange={(v) =>
                        updateStage(stage.id, { avgSalePriceAud: v })
                      }
                    />
                    <NumericField
                      label="GFA / Civil Area"
                      suffix="m²"
                      step={100}
                      min={0}
                      value={stage.gfaSqm}
                      testId={`stage-${idx}-gfa`}
                      onChange={(v) => updateStage(stage.id, { gfaSqm: v })}
                    />
                    <NumericField
                      label="Build / Civil Rate"
                      prefix="$"
                      suffix="/m²"
                      step={25}
                      min={0}
                      value={stage.constructionRatePerSqmAud}
                      onChange={(v) =>
                        updateStage(stage.id, { constructionRatePerSqmAud: v })
                      }
                    />
                    <NumericField
                      label="NSA"
                      suffix="m²"
                      step={100}
                      min={0}
                      value={stage.nsaSqm}
                      onChange={(v) => updateStage(stage.id, { nsaSqm: v })}
                    />
                    <NumericField
                      label="Car Bays"
                      min={0}
                      value={stage.carBays}
                      onChange={(v) => updateStage(stage.id, { carBays: v })}
                    />
                    <NumericField
                      label="Car Bay Cost"
                      prefix="$"
                      step={1000}
                      min={0}
                      value={stage.carBayCostAud}
                      onChange={(v) =>
                        updateStage(stage.id, { carBayCostAud: v })
                      }
                    />
                    <NumericField
                      label="Roads Length"
                      suffix="m"
                      step={10}
                      min={0}
                      value={stage.roadLengthM}
                      onChange={(v) => updateStage(stage.id, { roadLengthM: v })}
                    />
                    <NumericField
                      label="Road Rate"
                      prefix="$"
                      suffix="/m"
                      step={100}
                      min={0}
                      value={stage.roadCostPerMAud}
                      onChange={(v) =>
                        updateStage(stage.id, { roadCostPerMAud: v })
                      }
                    />
                    <NumericField
                      label="Build Start"
                      suffix="mo"
                      min={0}
                      max={48}
                      value={stage.startMonth}
                      onChange={(v) => updateStage(stage.id, { startMonth: v })}
                    />
                    <NumericField
                      label="Build Duration"
                      suffix="mo"
                      min={1}
                      max={48}
                      value={stage.constructionMonths}
                      onChange={(v) =>
                        updateStage(stage.id, { constructionMonths: v })
                      }
                    />
                    <NumericField
                      label="Settle Lag / Span"
                      suffix="mo"
                      min={0}
                      max={48}
                      value={stage.settlementLagMonths}
                      hint={`${stage.salesMonths}m sell`}
                      onChange={(v) =>
                        updateStage(stage.id, { settlementLagMonths: v })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: Australian Statutory & GST */}
      {show('statutory') && (
        <div className="plasma-card p-3 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(214,226,240,0.08)] pb-1.5">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-[#34d399]" />
              <h2 className="text-[12px] font-semibold text-[#e6edf3]">
                Australian Statutory ({statePreset.name}) &amp; ATO GST Regime
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <OverridePill
                label="State"
                overridden={osSyncOverrides.state}
                onToggle={() =>
                  setOsSyncOverride('state', !osSyncOverrides.state)
                }
                testId="override-state-btn"
              />
              <button
                type="button"
                onClick={resetStatutoryOverrides}
                className="inline-flex items-center gap-1 rounded-[4px] border border-[rgba(214,226,240,0.12)] bg-[#10141a] px-2 py-0.5 text-[10px] text-[#93a1b2] hover:text-[#e6edf3] cursor-pointer"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Reset {inputs.state} Defaults
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {/* Statutory Editable Overrides */}
            <div className="flex flex-col gap-2">
              <div className="plasma-inset px-2.5 py-1.5 text-[11px] text-[#93a1b2] leading-relaxed">
                <div className="font-semibold text-[#7dd3fc] text-[11px]">
                  {statePreset.dutyLabel} • {statePreset.levyLabel}
                </div>
                <div className="text-[10px] text-[#93a1b2] mt-0.5">
                  {statePreset.notes}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <NumericField
                  label="Custom Duty % Override"
                  suffix="%"
                  step={0.1}
                  min={0}
                  max={20}
                  nullable
                  placeholder={`${cashflow.stampDuty.effectiveRatePct.toFixed(2)} auto`}
                  value={inputs.statutoryOverrides.customStampDutyRatePct}
                  onChange={() => {}}
                  onNullableChange={(v) =>
                    updateStatutoryOverrides({ customStampDutyRatePct: v })
                  }
                />
                <NumericField
                  label="Custom Levy / Unit"
                  prefix="$"
                  step={1000}
                  min={0}
                  nullable
                  placeholder={`${Math.round(cashflow.infrastructureLevy.perUnitEffectiveAud)} auto`}
                  value={
                    inputs.statutoryOverrides.customInfrastructureLevyPerUnitAud
                  }
                  onChange={() => {}}
                  onNullableChange={(v) =>
                    updateStatutoryOverrides({
                      customInfrastructureLevyPerUnitAud: v,
                    })
                  }
                />
                <NumericField
                  label="Custom Land Tax % p.a."
                  suffix="%"
                  step={0.1}
                  min={0}
                  max={10}
                  nullable
                  placeholder={`${cashflow.landTax.effectiveRatePct.toFixed(2)} auto`}
                  value={inputs.statutoryOverrides.customAnnualLandTaxRatePct}
                  onChange={() => {}}
                  onNullableChange={(v) =>
                    updateStatutoryOverrides({ customAnnualLandTaxRatePct: v })
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-0.5">
                <label className="inline-flex items-center gap-1.5 text-[11px] text-[#e6edf3] cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="foreign-purchaser-toggle"
                    checked={inputs.foreignPurchaser}
                    onChange={(e) =>
                      updateInputs({ foreignPurchaser: e.target.checked })
                    }
                    className="h-3.5 w-3.5 accent-[#3daee9] cursor-pointer"
                  />
                  <span>
                    Foreign Purchaser Surcharge (+
                    {statePreset.foreignSurchargeRatePct.toFixed(1)}%)
                  </span>
                </label>

                {inputs.state === 'VIC' && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[#e6edf3] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inputs.statutoryOverrides.applyVicGaic}
                      onChange={(e) =>
                        updateStatutoryOverrides({
                          applyVicGaic: e.target.checked,
                        })
                      }
                      className="h-3.5 w-3.5 accent-[#34d399] cursor-pointer"
                    />
                    <span>
                      VIC GAIC ($
                      {Math.round(
                        inputs.statutoryOverrides.vicGaicPerHaAud ??
                          statePreset.defaultGaicPerHaAud,
                      ).toLocaleString()}
                      /ha)
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* GST Engine & Live Statutory Summary */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-[#93a1b2]">
                  GST Regime (ATO)
                </span>
                <div className="flex items-center rounded-[5px] bg-[#0e1217] p-0.5 border border-[rgba(214,226,240,0.1)]">
                  {(
                    [
                      ['margin-scheme', 'Margin Scheme'],
                      ['full-gst', 'Full GST'],
                      ['gst-free', 'GST-Free'],
                    ] as [GstScheme, string][]
                  ).map(([scheme, label]) => (
                    <button
                      key={scheme}
                      type="button"
                      data-testid={`gst-scheme-${scheme}`}
                      onClick={() => updateInputs({ gstScheme: scheme })}
                      className={`rounded-[4px] px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                        inputs.gstScheme === scheme
                          ? 'bg-[#3daee9]/20 text-[#7dd3fc]'
                          : 'text-[#93a1b2] hover:text-[#e6edf3]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <div className="plasma-inset p-2">
                  <div className="text-[10px] text-[#667587]">Transfer Duty</div>
                  <div
                    data-testid="statutory-stamp-duty"
                    className="font-mono-tech text-[12px] font-semibold text-[#e6edf3]"
                  >
                    {formatAud(cashflow.stampDuty.totalDutyAud)}
                  </div>
                  <div className="font-mono-tech text-[10px] text-[#667587]">
                    {cashflow.stampDuty.effectiveRatePct.toFixed(2)}% eff.
                  </div>
                </div>
                <div className="plasma-inset p-2">
                  <div className="text-[10px] text-[#667587]">Infra. Levies</div>
                  <div
                    data-testid="statutory-infra-levy"
                    className="font-mono-tech text-[12px] font-semibold text-[#e6edf3]"
                  >
                    {formatAud(cashflow.infrastructureLevy.totalLevyAud)}
                  </div>
                  <div className="font-mono-tech text-[10px] text-[#667587]">
                    {formatAud(cashflow.infrastructureLevy.perUnitEffectiveAud)}/u
                  </div>
                </div>
                <div className="plasma-inset p-2">
                  <div className="text-[10px] text-[#667587]">Annual Land Tax</div>
                  <div className="font-mono-tech text-[12px] font-semibold text-[#e6edf3]">
                    {formatAud(cashflow.landTax.annualLandTaxAud)}/yr
                  </div>
                  <div className="font-mono-tech text-[10px] text-[#667587]">
                    Hold {formatAud(cb.landTaxHoldingAud)}
                  </div>
                </div>
                <div className="plasma-inset p-2">
                  <div className="text-[10px] text-[#667587]">Output GST</div>
                  <div className="font-mono-tech text-[12px] font-semibold text-[#fbbf24]">
                    {formatAud(cashflow.gst.gstOnSalesAud)}
                  </div>
                </div>
                <div className="plasma-inset p-2">
                  <div className="text-[10px] text-[#667587]">ITC Credits (1/11)</div>
                  <div className="font-mono-tech text-[12px] font-semibold text-[#34d399]">
                    {formatAud(cashflow.gst.inputTaxCreditsAud)}
                  </div>
                </div>
                <div className="plasma-inset p-2">
                  <div className="text-[10px] text-[#667587]">Net GST Payable</div>
                  <div className="font-mono-tech text-[12px] font-semibold text-[#7dd3fc]">
                    {formatAud(cashflow.gst.netGstPayableAud)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Capital Stack & 2-Tier JV Waterfall */}
      {show('capital') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {/* Senior & Mezzanine Debt */}
          <div className="plasma-card p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-[rgba(214,226,240,0.08)] pb-1.5">
              <h2 className="text-[12px] font-semibold text-[#e6edf3]">
                Capital Stack — Senior &amp; Mezzanine Debt
              </h2>
              <span className="font-mono-tech text-[11px] text-[#fbbf24]">
                Finance: {formatAud(cb.totalFinanceCostsAud)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#e6edf3] cursor-pointer">
                <input
                  type="checkbox"
                  checked={inputs.capitalStack.seniorDebtEnabled}
                  onChange={(e) =>
                    updateCapitalStack({ seniorDebtEnabled: e.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-[#3daee9]"
                />
                <span>Senior Construction Facility</span>
              </label>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Senior Debt Cap Basis"
                  value={inputs.capitalStack.seniorLimitType}
                  onChange={(e) =>
                    updateCapitalStack({
                      seniorLimitType: e.target.value as DebtLimitType,
                    })
                  }
                  className="plasma-select text-[11px] py-0.5 px-1.5"
                >
                  <option value="LTC">Cap: % LTC</option>
                  <option value="LVR">Cap: % LVR</option>
                </select>
                <label className="inline-flex items-center gap-1 text-[11px] text-[#93a1b2] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inputs.capitalStack.interestCapitalised}
                    onChange={(e) =>
                      updateCapitalStack({
                        interestCapitalised: e.target.checked,
                      })
                    }
                    className="h-3.5 w-3.5 accent-[#3daee9]"
                  />
                  <span>Capitalised Int.</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <NumericField
                label={`Max ${inputs.capitalStack.seniorLimitType}`}
                suffix="%"
                step={1}
                min={0}
                max={85}
                disabled={!inputs.capitalStack.seniorDebtEnabled}
                value={inputs.capitalStack.seniorMaxPct}
                onChange={(v) => updateCapitalStack({ seniorMaxPct: v })}
              />
              <NumericField
                label="Senior Rate"
                suffix="%"
                step={0.15}
                min={0}
                max={25}
                disabled={!inputs.capitalStack.seniorDebtEnabled}
                value={inputs.capitalStack.seniorInterestRatePct}
                onChange={(v) =>
                  updateCapitalStack({ seniorInterestRatePct: v })
                }
              />
              <NumericField
                label="Est. Fee"
                suffix="%"
                step={0.1}
                min={0}
                max={5}
                disabled={!inputs.capitalStack.seniorDebtEnabled}
                value={inputs.capitalStack.seniorEstablishmentFeePct}
                onChange={(v) =>
                  updateCapitalStack({ seniorEstablishmentFeePct: v })
                }
              />
              <NumericField
                label="Line Fee"
                suffix="%"
                step={0.1}
                min={0}
                max={5}
                disabled={!inputs.capitalStack.seniorDebtEnabled}
                value={inputs.capitalStack.seniorLineFeePct}
                onChange={(v) => updateCapitalStack({ seniorLineFeePct: v })}
              />
            </div>

            <div className="border-t border-[rgba(214,226,240,0.08)] pt-2 flex flex-col gap-2">
              <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#e6edf3] cursor-pointer">
                <input
                  type="checkbox"
                  checked={inputs.capitalStack.mezzanineEnabled}
                  onChange={(e) =>
                    updateCapitalStack({ mezzanineEnabled: e.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-[#3daee9]"
                />
                <span>Mezzanine Tranche (Subordinated Debt)</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <NumericField
                  label="Mezz Cap (% TDC)"
                  suffix="%"
                  step={1}
                  min={0}
                  max={30}
                  disabled={!inputs.capitalStack.mezzanineEnabled}
                  value={inputs.capitalStack.mezzanineMaxPct}
                  onChange={(v) => updateCapitalStack({ mezzanineMaxPct: v })}
                />
                <NumericField
                  label="Mezz Rate"
                  suffix="%"
                  step={0.25}
                  min={0}
                  max={30}
                  disabled={!inputs.capitalStack.mezzanineEnabled}
                  value={inputs.capitalStack.mezzanineInterestRatePct}
                  onChange={(v) =>
                    updateCapitalStack({ mezzanineInterestRatePct: v })
                  }
                />
                <NumericField
                  label="Mezz Est. Fee"
                  suffix="%"
                  step={0.25}
                  min={0}
                  max={5}
                  disabled={!inputs.capitalStack.mezzanineEnabled}
                  value={inputs.capitalStack.mezzanineEstablishmentFeePct}
                  onChange={(v) =>
                    updateCapitalStack({ mezzanineEstablishmentFeePct: v })
                  }
                />
              </div>
            </div>
          </div>

          {/* 2-Tier JV Profit-Split Waterfall */}
          <div className="plasma-card p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-[rgba(214,226,240,0.08)] pb-1.5">
              <label className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#e6edf3] cursor-pointer">
                <input
                  type="checkbox"
                  checked={inputs.capitalStack.jvEnabled}
                  onChange={(e) =>
                    updateCapitalStack({ jvEnabled: e.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-[#34d399]"
                />
                <span>2-Tier JV Equity Waterfall</span>
              </label>
              <span className="font-mono-tech text-[11px] text-[#93a1b2]">
                Peak Equity: <strong className="text-[#e6edf3]">{formatAud(cashflow.peakEquityAud)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <NumericField
                label="Sponsor Equity %"
                suffix="%"
                step={5}
                min={5}
                max={100}
                disabled={!inputs.capitalStack.jvEnabled}
                value={inputs.capitalStack.developerEquitySharePct}
                onChange={(v) =>
                  updateCapitalStack({ developerEquitySharePct: v })
                }
              />
              <NumericField
                label="Tier 1 Pref IRR"
                suffix="%"
                step={1}
                min={0}
                max={35}
                disabled={!inputs.capitalStack.jvEnabled}
                value={inputs.capitalStack.preferredIrrHurdlePct}
                onChange={(v) =>
                  updateCapitalStack({ preferredIrrHurdlePct: v })
                }
              />
              <NumericField
                label="Tier 2 Sponsor Split"
                suffix="%"
                step={5}
                min={0}
                max={100}
                disabled={!inputs.capitalStack.jvEnabled}
                value={inputs.capitalStack.promoteSplitDeveloperPct}
                onChange={(v) =>
                  updateCapitalStack({ promoteSplitDeveloperPct: v })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-0.5">
              <div className="plasma-inset p-2.5 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7dd3fc]">
                    Developer (Sponsor)
                  </span>
                  <span className="font-mono-tech text-[10px] text-[#93a1b2]">
                    {jv.developerEquitySharePct.toFixed(0)}% Eq
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#93a1b2]">Equity In</span>
                  <span className="font-mono-tech text-[#e6edf3]">
                    {formatAud(jv.developerContributionAud)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#93a1b2]">Tier 2 Promote</span>
                  <span className="font-mono-tech text-[#34d399]">
                    {formatAud(jv.tier2DeveloperPromoteAud)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-[rgba(214,226,240,0.08)] pt-1">
                  <span className="text-[#93a1b2]">Net Profit / IRR</span>
                  <span className="font-mono-tech font-semibold text-[#34d399]">
                    {formatAud(jv.developerNetProfitAud)} ({formatPct(jv.developerIrrPct, 1)})
                  </span>
                </div>
              </div>

              <div className="plasma-inset p-2.5 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#93a1b2]">
                    JV Capital Partner
                  </span>
                  <span className="font-mono-tech text-[10px] text-[#93a1b2]">
                    {jv.partnerEquitySharePct.toFixed(0)}% Eq
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#93a1b2]">Equity In</span>
                  <span className="font-mono-tech text-[#e6edf3]">
                    {formatAud(jv.partnerContributionAud)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#93a1b2]">Tier 1 Pref + Cap</span>
                  <span className="font-mono-tech text-[#e6edf3]">
                    {formatAud(jv.tier1PartnerDistributionAud)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-[rgba(214,226,240,0.08)] pt-1">
                  <span className="text-[#93a1b2]">Net Profit / IRR</span>
                  <span className="font-mono-tech font-semibold text-[#7dd3fc]">
                    {formatAud(jv.partnerNetProfitAud)} ({formatPct(jv.partnerIrrPct, 1)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
