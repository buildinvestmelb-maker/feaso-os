import type { AustralianState, GstScheme } from '../engine/types';

export interface SiteLocation {
  address?: string;
  lga?: string;
  state: AustralianState;
  lat?: number;
  lng?: number;
  mgaZone?: number;
  mgaEpsg?: string;
}

export interface SiteGeometry {
  parcelId?: string;
  parcelIdScheme?: 'lot-dp' | 'spi' | 'lot-plan' | 'ct' | 'gnaf';
  grossAreaSqm?: number;
  netDevelopableAreaSqm?: number;
}

/**
 * Supports both canonical feaso-os keys (cutM3, fillM3, netSpoilM3)
 * and devaware-os / CutSheet AU SiteProject keys (cutVolumeM3, fillVolumeM3, netBalanceM3).
 */
export interface SiteEarthworks {
  cutM3?: number;
  fillM3?: number;
  netSpoilM3?: number;
  cutVolumeM3?: number;
  fillVolumeM3?: number;
  netBalanceM3?: number;
  importExportVolumeM3?: number;
  bulkEarthworksCostAud?: number;
  retainingWallLengthM?: number;
  retainingWallCostAud?: number;
  civilAllowanceAud?: number;
  finishedFloorLevelAHD?: number;
  updatedByApp?: string;
}

/**
 * Supports both canonical feaso-os keys (totalLotsOrUnits, gfaSqm, nsaSqm, carBays, roadLengthM)
 * and devaware-os SiteMassing keys (lotYield, dwellingYield, grossFloorAreaSqm, netSaleableAreaSqm).
 */
export interface SiteMassing {
  totalLotsOrUnits?: number;
  gfaSqm?: number;
  nsaSqm?: number;
  carBays?: number;
  roadLengthM?: number;
  lotYield?: number;
  dwellingYield?: number;
  grossFloorAreaSqm?: number;
  netSaleableAreaSqm?: number;
  siteCoveragePct?: number;
  maxHeightM?: number;
  fsr?: number;
  storeys?: number;
  zoningCode?: string;
}

export interface SiteEnvironment {
  acousticUpgradeRequired?: boolean;
  bushfireAttackLevel?:
    | 'BAL-LOW'
    | 'BAL-12.5'
    | 'BAL-19'
    | 'BAL-29'
    | 'BAL-40'
    | 'BAL-FZ';
  floodOverlay?: boolean;
  biodiversityOffsetHa?: number;
  solarExposureHrs?: number;
  windRegion?: 'A' | 'B' | 'C' | 'D';
  climateZone?: string;
}

export interface SiteFeasibilityPatch {
  rlvAud: number;
  devMarginPct: number;
  irrPct: number | null;
  peakDebtAud: number;
  p50RlvAud: number | null;
  // devaware-os SiteProject.feasibility compatibility fields
  residualLandValueAud: number;
  rlvPerSqmAud: number;
  grossRealisationAud: number;
  totalDevelopmentCostAud: number;
  statutoryContributionsAud: number;
  stampDutyRatePct: number;
  targetMarginPct: number;
  profitOnCostPct: number;
  gstScheme: 'margin-scheme' | 'full-gst';
}

export interface SiteProject {
  projectId?: string;
  name?: string;
  updatedAt?: string;
  location?: Partial<SiteLocation>;
  geometry?: SiteGeometry;
  earthworks?: SiteEarthworks;
  massing?: SiteMassing;
  environment?: SiteEnvironment;
  feasibility?: Partial<SiteFeasibilityPatch> & {
    gstScheme?: GstScheme;
  };
}

export type HostToChildMessage =
  | {
      type: 'OS_INIT';
      theme?: 'dark' | 'light';
      project?: SiteProject;
      active?: boolean;
      appId?: string;
      windowId?: string;
      payload?: Record<string, unknown>;
    }
  | {
      type: 'OS_PROJECT_SYNC';
      project: SiteProject;
      sourceAppId?: string;
      updatedAt?: string;
    }
  | {
      type: 'OS_RENDER_STATE';
      active: boolean;
      reason?: string;
    }
  | {
      type: 'OS_PAYLOAD';
      payload: Record<string, unknown>;
    };

export type ChildToHostMessage =
  | {
      type: 'APP_READY';
      appId: 'feaso-os';
      version?: string;
    }
  | {
      type: 'APP_FOCUS';
      appId: 'feaso-os';
    }
  | {
      type: 'PROJECT_PATCH';
      sourceAppId: 'feaso-os';
      patch: {
        feasibility: SiteFeasibilityPatch;
      };
    }
  | {
      type: 'NOTIFY';
      level: 'info' | 'success' | 'warning' | 'error';
      title: string;
      message?: string;
    };

export interface OsSyncOverrideFlags {
  earthworks: boolean;
  massing: boolean;
  environment: boolean;
  state: boolean;
}

export interface OsBridgeStatus {
  mode: 'standalone' | 'embedded';
  connected: boolean;
  renderActive: boolean;
  hostOrigin: string | null;
  windowId: string | null;
  lastSyncAt: string | null;
  lastSyncSource: string | null;
  syncPulseCount: number;
  lastInboundProject: SiteProject | null;
  lastOutboundPatch: SiteFeasibilityPatch | null;
}
