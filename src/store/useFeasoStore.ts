import { create } from 'zustand';
import type {
  OsBridgeStatus,
  OsSyncOverrideFlags,
  SiteFeasibilityPatch,
  SiteProject,
} from '../bridge/types';
import {
  AUSTRALIAN_STATE_LIST,
  buildSensitivityMatrix,
  createDefaultStatutoryOverrides,
  createGreenfieldSubdivisionPreset,
  createMidRiseApartmentsPreset,
  createTownhouseInfillPreset,
  runCashflowModel,
  runMonteCarloSimulation,
  solveResidualLandValue,
  type AustralianState,
  type CapitalStackInputs,
  type CashflowResult,
  type DevelopmentStage,
  type DevelopmentTypology,
  type EarthworksInputs,
  type EnvironmentInputs,
  type FeasibilityInputs,
  type MonteCarloConfig,
  type MonteCarloResult,
  type RlvResult,
  type SensitivityMatrixResult,
  type StatutoryOverrides,
} from '../engine';
import type {
  MonteCarloWorkerRequest,
  MonteCarloWorkerResponse,
} from '../engine/monteCarlo.worker';

export type ActiveTab = 'assumptions' | 'cashflow' | 'risk' | 'audit';

export type AuditFocusKey =
  | 'rlv'
  | 'margin'
  | 'irr'
  | 'peakDebt'
  | 'netProfit'
  | 'p50Rlv'
  | 'gst'
  | 'statutory'
  | 'jv'
  | 'osBridge';

interface FeasoStoreState {
  inputs: FeasibilityInputs;
  cashflow: CashflowResult;
  rlv: RlvResult;
  sensitivityMatrix: SensitivityMatrixResult | null;
  monteCarloResult: MonteCarloResult | null;
  monteCarloRunning: boolean;
  monteCarloError: string | null;

  activeTab: ActiveTab;
  auditFocus: AuditFocusKey;
  osSyncOverrides: OsSyncOverrideFlags;
  bridgeStatus: OsBridgeStatus;

  // Actions
  setActiveTab: (tab: ActiveTab) => void;
  inspectKpiInAudit: (focus: AuditFocusKey) => void;
  loadPreset: (typology: DevelopmentTypology) => void;
  setStateJurisdiction: (state: AustralianState) => void;
  updateInputs: (partial: Partial<FeasibilityInputs>) => void;
  updateStatutoryOverrides: (partial: Partial<StatutoryOverrides>) => void;
  resetStatutoryOverrides: () => void;
  updateEarthworks: (partial: Partial<EarthworksInputs>) => void;
  updateEnvironment: (partial: Partial<EnvironmentInputs>) => void;
  updateCapitalStack: (partial: Partial<CapitalStackInputs>) => void;
  updateMonteCarloConfig: (partial: Partial<MonteCarloConfig>) => void;
  updateStage: (stageId: string, partial: Partial<DevelopmentStage>) => void;
  addStage: () => void;
  removeStage: (stageId: string) => void;
  applySolvedRlvToLand: () => void;

  setOsSyncOverride: (key: keyof OsSyncOverrideFlags, overridden: boolean) => void;
  applyInboundSiteProject: (project: SiteProject, sourceLabel: string) => string[];
  setBridgeStatus: (partial: Partial<OsBridgeStatus>) => void;
  recordOutboundPatch: (patch: SiteFeasibilityPatch) => void;

  computeSensitivityNow: () => void;
  runMonteCarloNow: () => Promise<MonteCarloResult>;
}

const VALID_STATES = new Set<string>(AUSTRALIAN_STATE_LIST);

function isAustralianState(val: unknown): val is AustralianState {
  return typeof val === 'string' && VALID_STATES.has(val);
}

function recalculateCore(inputs: FeasibilityInputs): {
  cashflow: CashflowResult;
  rlv: RlvResult;
} {
  const cashflow = runCashflowModel(inputs);
  const rlv = solveResidualLandValue(inputs);
  return { cashflow, rlv };
}

function distributeAcrossStages(
  stages: DevelopmentStage[],
  massing: NonNullable<SiteProject['massing']>,
): DevelopmentStage[] {
  if (stages.length === 0) return stages;

  const incomingLots =
    massing.totalLotsOrUnits ?? massing.lotYield ?? massing.dwellingYield;
  const incomingGfa = massing.gfaSqm ?? massing.grossFloorAreaSqm;
  const incomingNsa = massing.nsaSqm ?? massing.netSaleableAreaSqm;
  const incomingCarBays = massing.carBays;
  const incomingRoads = massing.roadLengthM;

  const existingTotalLots = stages.reduce((acc, s) => acc + Math.max(0, s.lotsOrUnits), 0);
  const weights = stages.map((s) =>
    existingTotalLots > 0
      ? Math.max(0, s.lotsOrUnits) / existingTotalLots
      : 1 / stages.length,
  );

  let remLots = incomingLots !== undefined ? Math.max(1, Math.round(incomingLots)) : null;
  let remBays = incomingCarBays !== undefined ? Math.max(0, Math.round(incomingCarBays)) : null;

  return stages.map((stage, idx) => {
    const isLast = idx === stages.length - 1;
    const w = weights[idx];

    let nextLots = stage.lotsOrUnits;
    if (remLots !== null) {
      nextLots = isLast ? Math.max(0, remLots) : Math.max(1, Math.round((incomingLots ?? 0) * w));
      remLots -= nextLots;
    }

    let nextCarBays = stage.carBays;
    if (remBays !== null) {
      nextCarBays = isLast ? Math.max(0, remBays) : Math.max(0, Math.round((incomingCarBays ?? 0) * w));
      remBays -= nextCarBays;
    }

    const nextGfa =
      incomingGfa !== undefined ? Math.max(0, Math.round(incomingGfa * w)) : stage.gfaSqm;
    const nextNsa =
      incomingNsa !== undefined ? Math.max(0, Math.round(incomingNsa * w)) : stage.nsaSqm;
    const nextRoad =
      incomingRoads !== undefined ? Math.max(0, Math.round(incomingRoads * w)) : stage.roadLengthM;

    return {
      ...stage,
      lotsOrUnits: nextLots,
      gfaSqm: nextGfa,
      nsaSqm: nextNsa,
      carBays: nextCarBays,
      roadLengthM: nextRoad,
    };
  });
}

// Persistent lazy Web Worker singleton for sub-500ms 10,000-run Monte Carlo
let mcWorker: Worker | null = null;
let mcRequestSeq = 0;
const mcPending = new Map<
  number,
  {
    resolve: (res: MonteCarloResult) => void;
    reject: (err: Error) => void;
  }
>();

function getMonteCarloWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }
  if (!mcWorker) {
    try {
      mcWorker = new Worker(
        new URL('../engine/monteCarlo.worker.ts', import.meta.url),
        { type: 'module' },
      );
      mcWorker.onmessage = (event: MessageEvent<MonteCarloWorkerResponse>) => {
        const { requestId, result, error } = event.data;
        const entry = mcPending.get(requestId);
        if (!entry) return;
        mcPending.delete(requestId);
        if (error || !result) {
          entry.reject(new Error(error || 'Empty Monte Carlo worker result'));
        } else {
          entry.resolve(result);
        }
      };
      mcWorker.onerror = (err) => {
        for (const [id, entry] of mcPending.entries()) {
          mcPending.delete(id);
          entry.reject(new Error(err.message || 'Monte Carlo worker crashed'));
        }
        mcWorker = null;
      };
    } catch {
      mcWorker = null;
    }
  }
  return mcWorker;
}

const initialInputs = createGreenfieldSubdivisionPreset('NSW');
const initialCore = recalculateCore(initialInputs);
const isEmbeddedInitial =
  typeof window !== 'undefined' && window.parent !== window;

export const useFeasoStore = create<FeasoStoreState>((set, get) => ({
  inputs: initialInputs,
  cashflow: initialCore.cashflow,
  rlv: initialCore.rlv,
  sensitivityMatrix: null,
  monteCarloResult: null,
  monteCarloRunning: false,
  monteCarloError: null,

  activeTab: 'assumptions',
  auditFocus: 'rlv',
  osSyncOverrides: {
    earthworks: false,
    massing: false,
    environment: false,
    state: false,
  },
  bridgeStatus: {
    mode: isEmbeddedInitial ? 'embedded' : 'standalone',
    connected: false,
    renderActive: true,
    hostOrigin: null,
    windowId: null,
    lastSyncAt: null,
    lastSyncSource: null,
    syncPulseCount: 0,
    lastInboundProject: null,
    lastOutboundPatch: null,
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    if (tab === 'risk' && !get().sensitivityMatrix) {
      get().computeSensitivityNow();
    }
    if (tab === 'risk' && !get().monteCarloResult && !get().monteCarloRunning) {
      void get().runMonteCarloNow();
    }
  },

  inspectKpiInAudit: (focus) => {
    set({ activeTab: 'audit', auditFocus: focus });
  },

  loadPreset: (typology) => {
    const currentState = get().inputs.state;
    const nextInputs =
      typology === 'greenfield-subdivision'
        ? createGreenfieldSubdivisionPreset(currentState)
        : typology === 'townhouse-infill'
          ? createTownhouseInfillPreset(currentState)
          : createMidRiseApartmentsPreset(currentState);
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
      monteCarloResult: null,
    });
    if (get().activeTab === 'risk') {
      get().computeSensitivityNow();
      void get().runMonteCarloNow();
    }
  },

  setStateJurisdiction: (state) => {
    const prev = get().inputs;
    const nextInputs: FeasibilityInputs = {
      ...prev,
      state,
      statutoryOverrides: {
        ...prev.statutoryOverrides,
        applyVicGaic:
          state === 'VIC' && prev.typology === 'greenfield-subdivision',
      },
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  updateInputs: (partial) => {
    const nextInputs: FeasibilityInputs = {
      ...get().inputs,
      ...partial,
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  updateStatutoryOverrides: (partial) => {
    const prev = get().inputs;
    const nextInputs: FeasibilityInputs = {
      ...prev,
      statutoryOverrides: {
        ...prev.statutoryOverrides,
        ...partial,
      },
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  resetStatutoryOverrides: () => {
    const prev = get().inputs;
    const nextInputs: FeasibilityInputs = {
      ...prev,
      statutoryOverrides: {
        ...createDefaultStatutoryOverrides(),
        applyVicGaic:
          prev.state === 'VIC' && prev.typology === 'greenfield-subdivision',
      },
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  updateEarthworks: (partial) => {
    const prev = get().inputs;
    const nextInputs: FeasibilityInputs = {
      ...prev,
      earthworks: {
        ...prev.earthworks,
        ...partial,
      },
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  updateEnvironment: (partial) => {
    const prev = get().inputs;
    const nextInputs: FeasibilityInputs = {
      ...prev,
      environment: {
        ...prev.environment,
        ...partial,
      },
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  updateCapitalStack: (partial) => {
    const prev = get().inputs;
    const nextInputs: FeasibilityInputs = {
      ...prev,
      capitalStack: {
        ...prev.capitalStack,
        ...partial,
      },
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  updateMonteCarloConfig: (partial) => {
    const prev = get().inputs;
    set({
      inputs: {
        ...prev,
        monteCarlo: {
          ...prev.monteCarlo,
          ...partial,
        },
      },
    });
  },

  updateStage: (stageId, partial) => {
    const prev = get().inputs;
    const nextInputs: FeasibilityInputs = {
      ...prev,
      stages: prev.stages.map((s) =>
        s.id === stageId ? { ...s, ...partial } : s,
      ),
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  addStage: () => {
    const prev = get().inputs;
    const last = prev.stages[prev.stages.length - 1];
    const nextIdx = prev.stages.length + 1;
    const newStage: DevelopmentStage = last
      ? {
          ...last,
          id: `stage-${Date.now().toString(36)}`,
          name: `Stage ${nextIdx}`,
          startMonth: Math.min(48, last.startMonth + 6),
          salesStartMonth: Math.min(48, last.salesStartMonth + 6),
        }
      : {
          id: `stage-${Date.now().toString(36)}`,
          name: `Stage ${nextIdx}`,
          startMonth: 4,
          constructionMonths: 12,
          salesStartMonth: 5,
          salesMonths: 6,
          settlementLagMonths: 12,
          lotsOrUnits: 20,
          gfaSqm: 4000,
          nsaSqm: 3600,
          carBays: 20,
          roadLengthM: 120,
          constructionRatePerSqmAud: 2800,
          carBayCostAud: 15000,
          roadCostPerMAud: 3200,
          avgSalePriceAud: 850000,
          sCurveShape: 'standard',
        };
    const nextInputs: FeasibilityInputs = {
      ...prev,
      stages: [...prev.stages, newStage],
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  removeStage: (stageId) => {
    const prev = get().inputs;
    if (prev.stages.length <= 1) return;
    const nextInputs: FeasibilityInputs = {
      ...prev,
      stages: prev.stages.filter((s) => s.id !== stageId),
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  applySolvedRlvToLand: () => {
    const { inputs, rlv } = get();
    if (!rlv.feasible) return;
    const nextInputs: FeasibilityInputs = {
      ...inputs,
      landPriceAud: rlv.rlvAud,
    };
    const core = recalculateCore(nextInputs);
    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
    });
  },

  setOsSyncOverride: (key, overridden) => {
    const nextOverrides: OsSyncOverrideFlags = {
      ...get().osSyncOverrides,
      [key]: overridden,
    };
    set({ osSyncOverrides: nextOverrides });

    // If user re-enables Auto-Sync and we already have an inbound SiteProject, immediately re-apply
    const lastProject = get().bridgeStatus.lastInboundProject;
    if (!overridden && lastProject) {
      get().applyInboundSiteProject(lastProject, 'OS Auto-Sync Re-applied');
    }
  },

  applyInboundSiteProject: (project, sourceLabel) => {
    const { inputs, osSyncOverrides, bridgeStatus } = get();
    const appliedFields: string[] = [];

    let nextInputs: FeasibilityInputs = {
      ...inputs,
      projectId: project.projectId ?? inputs.projectId,
      projectName: project.name ?? inputs.projectName,
      address: project.location?.address ?? inputs.address,
      lga: project.location?.lga ?? inputs.lga,
      parcelId: project.geometry?.parcelId ?? inputs.parcelId,
      grossAreaSqm:
        typeof project.geometry?.grossAreaSqm === 'number' &&
        project.geometry.grossAreaSqm > 0
          ? project.geometry.grossAreaSqm
          : inputs.grossAreaSqm,
      netDevelopableAreaSqm:
        typeof project.geometry?.netDevelopableAreaSqm === 'number' &&
        project.geometry.netDevelopableAreaSqm > 0
          ? project.geometry.netDevelopableAreaSqm
          : inputs.netDevelopableAreaSqm,
    };

    // 1. State jurisdiction sync
    if (!osSyncOverrides.state && isAustralianState(project.location?.state)) {
      const nextState = project.location.state;
      nextInputs = {
        ...nextInputs,
        state: nextState,
        statutoryOverrides: {
          ...nextInputs.statutoryOverrides,
          applyVicGaic:
            nextState === 'VIC' &&
            nextInputs.typology === 'greenfield-subdivision',
        },
      };
      appliedFields.push(`State: ${nextState}`);
    }

    // 2. Earthworks sync (cutM3, fillM3, netSpoilM3 + devaware-os aliases)
    if (!osSyncOverrides.earthworks && project.earthworks) {
      const ew = project.earthworks;
      const cutM3 = ew.cutM3 ?? ew.cutVolumeM3;
      const fillM3 = ew.fillM3 ?? ew.fillVolumeM3;
      const netSpoilM3 =
        ew.netSpoilM3 ??
        ew.netBalanceM3 ??
        ew.importExportVolumeM3 ??
        (cutM3 !== undefined && fillM3 !== undefined ? cutM3 - fillM3 : undefined);

      const hasVolumes =
        cutM3 !== undefined || fillM3 !== undefined || netSpoilM3 !== undefined;

      nextInputs = {
        ...nextInputs,
        earthworks: {
          ...nextInputs.earthworks,
          cutM3: cutM3 !== undefined ? Math.max(0, cutM3) : nextInputs.earthworks.cutM3,
          fillM3: fillM3 !== undefined ? Math.max(0, fillM3) : nextInputs.earthworks.fillM3,
          netSpoilM3:
            netSpoilM3 !== undefined ? netSpoilM3 : nextInputs.earthworks.netSpoilM3,
          retainingWallLengthM:
            typeof ew.retainingWallLengthM === 'number'
              ? Math.max(0, ew.retainingWallLengthM)
              : nextInputs.earthworks.retainingWallLengthM,
          // When volumes arrive, let unit $/m³ rates dynamically price Bulk Earthworks & Spoil Disposal
          directBulkOverrideAud: hasVolumes
            ? null
            : typeof ew.bulkEarthworksCostAud === 'number'
              ? Math.max(0, ew.bulkEarthworksCostAud)
              : nextInputs.earthworks.directBulkOverrideAud,
          directRetainingOverrideAud:
            typeof ew.retainingWallLengthM === 'number'
              ? null
              : typeof ew.retainingWallCostAud === 'number'
                ? Math.max(0, ew.retainingWallCostAud)
                : nextInputs.earthworks.directRetainingOverrideAud,
        },
      };
      appliedFields.push('Earthworks');
    }

    // 3. Massing sync (totalLotsOrUnits, gfaSqm, nsaSqm, carBays, roadLengthM + aliases)
    if (!osSyncOverrides.massing && project.massing) {
      const hasMassing =
        project.massing.totalLotsOrUnits !== undefined ||
        project.massing.lotYield !== undefined ||
        project.massing.dwellingYield !== undefined ||
        project.massing.gfaSqm !== undefined ||
        project.massing.grossFloorAreaSqm !== undefined ||
        project.massing.nsaSqm !== undefined ||
        project.massing.netSaleableAreaSqm !== undefined ||
        project.massing.carBays !== undefined ||
        project.massing.roadLengthM !== undefined;

      if (hasMassing) {
        nextInputs = {
          ...nextInputs,
          stages: distributeAcrossStages(nextInputs.stages, project.massing),
        };
        appliedFields.push('Massing');
      }
    }

    // 4. Environment sync (acousticUpgradeRequired, BAL, floodOverlay)
    if (!osSyncOverrides.environment && project.environment) {
      const env = project.environment;
      const balCostMap: Record<string, number> = {
        'BAL-LOW': 0,
        'BAL-12.5': 125000,
        'BAL-19': 240000,
        'BAL-29': 420000,
        'BAL-40': 680000,
        'BAL-FZ': 1150000,
      };
      const nextBal = env.bushfireAttackLevel ?? nextInputs.environment.bushfireAttackLevel;

      nextInputs = {
        ...nextInputs,
        environment: {
          ...nextInputs.environment,
          acousticUpgradeRequired:
            typeof env.acousticUpgradeRequired === 'boolean'
              ? env.acousticUpgradeRequired
              : nextInputs.environment.acousticUpgradeRequired,
          bushfireAttackLevel: nextBal,
          balAllowanceAud:
            env.bushfireAttackLevel !== undefined
              ? (balCostMap[env.bushfireAttackLevel] ?? nextInputs.environment.balAllowanceAud)
              : nextInputs.environment.balAllowanceAud,
          floodOverlay:
            typeof env.floodOverlay === 'boolean'
              ? env.floodOverlay
              : nextInputs.environment.floodOverlay,
        },
      };
      appliedFields.push('Environment');
    }

    const core = recalculateCore(nextInputs);

    set({
      inputs: nextInputs,
      cashflow: core.cashflow,
      rlv: core.rlv,
      sensitivityMatrix: null,
      bridgeStatus: {
        ...bridgeStatus,
        connected: true,
        lastSyncAt: new Date().toISOString(),
        lastSyncSource: sourceLabel,
        syncPulseCount: bridgeStatus.syncPulseCount + 1,
        lastInboundProject: project,
      },
    });

    return appliedFields;
  },

  setBridgeStatus: (partial) => {
    set({
      bridgeStatus: {
        ...get().bridgeStatus,
        ...partial,
      },
    });
  },

  recordOutboundPatch: (patch) => {
    set({
      bridgeStatus: {
        ...get().bridgeStatus,
        lastOutboundPatch: patch,
      },
    });
  },

  computeSensitivityNow: () => {
    const matrix = buildSensitivityMatrix(get().inputs);
    set({ sensitivityMatrix: matrix });
  },

  runMonteCarloNow: async () => {
    const currentInputs = get().inputs;
    set({ monteCarloRunning: true, monteCarloError: null });

    const worker = getMonteCarloWorker();
    if (worker) {
      const requestId = ++mcRequestSeq;
      try {
        const result = await new Promise<MonteCarloResult>((resolve, reject) => {
          mcPending.set(requestId, { resolve, reject });
          const req: MonteCarloWorkerRequest = {
            requestId,
            inputs: currentInputs,
          };
          worker.postMessage(req);
        });
        set({
          monteCarloResult: result,
          monteCarloRunning: false,
          monteCarloError: null,
        });
        return result;
      } catch {
        // Fallback to direct pure TS execution if Web Worker blocked
      }
    }

    const fallbackResult = runMonteCarloSimulation(currentInputs);
    set({
      monteCarloResult: fallbackResult,
      monteCarloRunning: false,
      monteCarloError: null,
    });
    return fallbackResult;
  },
}));
