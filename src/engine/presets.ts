import { createDefaultStatutoryOverrides } from './auStatutory';
import type {
  AustralianState,
  DevelopmentTypology,
  FeasibilityInputs,
} from './types';

export interface PresetMetadata {
  id: DevelopmentTypology;
  label: string;
  shortLabel: string;
  subtitle: string;
  build: (state?: AustralianState) => FeasibilityInputs;
}

export function createGreenfieldSubdivisionPreset(
  state: AustralianState = 'NSW',
): FeasibilityInputs {
  return {
    projectId: 'feaso-greenfield-au',
    projectName: 'Western Sydney Precinct 14 (Greenfield)',
    address: '142 Fifteenth Avenue, Austral NSW 2179',
    lga: 'Liverpool City Council',
    parcelId: 'Lot 14 DP 1248902',
    state,
    typology: 'greenfield-subdivision',
    grossAreaSqm: 48200,
    netDevelopableAreaSqm: 34650,

    landPriceAud: 21500000,
    landAcquisitionMonth: 0,
    landDepositPct: 10,
    landSettlementMonth: 3,
    landTaxableValuePct: 75,
    legalAcquisitionFeesAud: 65000,

    gstScheme: 'margin-scheme',
    originalLandCostOverrideAud: null,
    foreignPurchaser: false,
    statutoryOverrides: {
      ...createDefaultStatutoryOverrides(),
      applyVicGaic: state === 'VIC',
    },

    earthworks: {
      cutM3: 18400,
      fillM3: 14950,
      netSpoilM3: 3450,
      cutRatePerM3Aud: 24,
      fillRatePerM3Aud: 28,
      spoilDisposalRatePerM3Aud: 65,
      retainingWallLengthM: 410,
      retainingRatePerMAud: 900,
      directBulkOverrideAud: null,
      directRetainingOverrideAud: null,
    },
    environment: {
      acousticUpgradeRequired: false,
      acousticAllowancePerUnitAud: 6500,
      bushfireAttackLevel: 'BAL-12.5',
      balAllowanceAud: 145000,
      floodOverlay: false,
      floodMitigationAllowanceAud: 280000,
    },

    professionalFeesPct: 8.5,
    projectManagementPct: 2.5,
    contingencyPct: 7.5,
    daApprovalFeesAud: 185000,
    agentCommissionPct: 2.2,
    marketingPct: 1.5,
    sellingLegalPerUnitAud: 1650,
    ratesAndHoldingMonthlyAud: 14500,

    stages: [
      {
        id: 'stage-1',
        name: 'Stage 1 — Civil & Lots 1–42',
        startMonth: 4,
        constructionMonths: 11,
        salesStartMonth: 5,
        salesMonths: 7,
        settlementLagMonths: 11,
        lotsOrUnits: 42,
        gfaSqm: 15960, // Civil servicing footprint m²
        nsaSqm: 15960,
        carBays: 0,
        roadLengthM: 520,
        constructionRatePerSqmAud: 215,
        carBayCostAud: 0,
        roadCostPerMAud: 3800,
        avgSalePriceAud: 685000,
        sCurveShape: 'standard',
      },
      {
        id: 'stage-2',
        name: 'Stage 2 — Civil & Lots 43–82',
        startMonth: 11,
        constructionMonths: 11,
        salesStartMonth: 12,
        salesMonths: 8,
        settlementLagMonths: 11,
        lotsOrUnits: 40,
        gfaSqm: 15200,
        nsaSqm: 15200,
        carBays: 0,
        roadLengthM: 480,
        constructionRatePerSqmAud: 220,
        carBayCostAud: 0,
        roadCostPerMAud: 3900,
        avgSalePriceAud: 710000,
        sCurveShape: 'standard',
      },
    ],
    horizonMonths: 32,

    capitalStack: {
      seniorDebtEnabled: true,
      seniorLimitType: 'LTC',
      seniorMaxPct: 65,
      seniorInterestRatePct: 7.85,
      seniorEstablishmentFeePct: 1.0,
      seniorLineFeePct: 1.25,
      interestCapitalised: true,
      mezzanineEnabled: false,
      mezzanineMaxPct: 10,
      mezzanineInterestRatePct: 14.5,
      mezzanineEstablishmentFeePct: 2.0,
      jvEnabled: true,
      developerEquitySharePct: 30,
      preferredIrrHurdlePct: 15,
      promoteSplitDeveloperPct: 50,
    },

    targetMetric: 'margin',
    targetMarginPct: 20,
    targetIrrPct: 22,

    monteCarlo: {
      iterations: 10000,
      constructionCostVolPct: 10,
      salePriceVolPct: 8,
      interestRateVolBps: 150,
      salesDelayVolMonths: 3,
      seed: 20261123,
    },
  };
}

export function createTownhouseInfillPreset(
  state: AustralianState = 'VIC',
): FeasibilityInputs {
  return {
    projectId: 'feaso-townhouse-au',
    projectName: 'Middle-Ring 24 Townhouse Infill',
    address: '88 Highbury Road, Burwood VIC 3125',
    lga: 'City of Whitehorse',
    parcelId: '1\\TP842910',
    state,
    typology: 'townhouse-infill',
    grossAreaSqm: 5400,
    netDevelopableAreaSqm: 4850,

    landPriceAud: 6800000,
    landAcquisitionMonth: 0,
    landDepositPct: 10,
    landSettlementMonth: 2,
    landTaxableValuePct: 80,
    legalAcquisitionFeesAud: 45000,

    gstScheme: 'margin-scheme',
    originalLandCostOverrideAud: null,
    foreignPurchaser: false,
    statutoryOverrides: {
      ...createDefaultStatutoryOverrides(),
      applyVicGaic: false,
    },

    earthworks: {
      cutM3: 3200,
      fillM3: 1100,
      netSpoilM3: 2100,
      cutRatePerM3Aud: 32,
      fillRatePerM3Aud: 34,
      spoilDisposalRatePerM3Aud: 85,
      retainingWallLengthM: 145,
      retainingRatePerMAud: 1150,
      directBulkOverrideAud: null,
      directRetainingOverrideAud: null,
    },
    environment: {
      acousticUpgradeRequired: true,
      acousticAllowancePerUnitAud: 11500,
      bushfireAttackLevel: 'BAL-LOW',
      balAllowanceAud: 0,
      floodOverlay: false,
      floodMitigationAllowanceAud: 120000,
    },

    professionalFeesPct: 9.0,
    projectManagementPct: 2.5,
    contingencyPct: 6.0,
    daApprovalFeesAud: 115000,
    agentCommissionPct: 2.4,
    marketingPct: 1.6,
    sellingLegalPerUnitAud: 1850,
    ratesAndHoldingMonthlyAud: 9500,

    stages: [
      {
        id: 'th-stage-1',
        name: 'Stage 1 — North Terrace (12 TH)',
        startMonth: 4,
        constructionMonths: 13,
        salesStartMonth: 3,
        salesMonths: 4,
        settlementLagMonths: 15,
        lotsOrUnits: 12,
        gfaSqm: 2280,
        nsaSqm: 2040,
        carBays: 24,
        roadLengthM: 95,
        constructionRatePerSqmAud: 3250,
        carBayCostAud: 12000,
        roadCostPerMAud: 2400,
        avgSalePriceAud: 1320000,
        sCurveShape: 'standard',
      },
      {
        id: 'th-stage-2',
        name: 'Stage 2 — South Courtyard (12 TH)',
        startMonth: 8,
        constructionMonths: 13,
        salesStartMonth: 7,
        salesMonths: 5,
        settlementLagMonths: 15,
        lotsOrUnits: 12,
        gfaSqm: 2340,
        nsaSqm: 2100,
        carBays: 24,
        roadLengthM: 85,
        constructionRatePerSqmAud: 3300,
        carBayCostAud: 12000,
        roadCostPerMAud: 2400,
        avgSalePriceAud: 1365000,
        sCurveShape: 'standard',
      },
    ],
    horizonMonths: 28,

    capitalStack: {
      seniorDebtEnabled: true,
      seniorLimitType: 'LTC',
      seniorMaxPct: 62,
      seniorInterestRatePct: 8.15,
      seniorEstablishmentFeePct: 1.0,
      seniorLineFeePct: 1.25,
      interestCapitalised: true,
      mezzanineEnabled: true,
      mezzanineMaxPct: 10,
      mezzanineInterestRatePct: 14.25,
      mezzanineEstablishmentFeePct: 2.0,
      jvEnabled: true,
      developerEquitySharePct: 25,
      preferredIrrHurdlePct: 15,
      promoteSplitDeveloperPct: 45,
    },

    targetMetric: 'margin',
    targetMarginPct: 18,
    targetIrrPct: 20,

    monteCarlo: {
      iterations: 10000,
      constructionCostVolPct: 9,
      salePriceVolPct: 7.5,
      interestRateVolBps: 150,
      salesDelayVolMonths: 3,
      seed: 20261124,
    },
  };
}

export function createMidRiseApartmentsPreset(
  state: AustralianState = 'QLD',
): FeasibilityInputs {
  return {
    projectId: 'feaso-midrise-au',
    projectName: 'Inner-Ring 68 Apartment Mid-Rise',
    address: '412 Montague Road, West End QLD 4101',
    lga: 'Brisbane City Council',
    parcelId: 'Lot 2 RP 904182',
    state,
    typology: 'mid-rise-apartments',
    grossAreaSqm: 3250,
    netDevelopableAreaSqm: 3100,

    landPriceAud: 11200000,
    landAcquisitionMonth: 0,
    landDepositPct: 10,
    landSettlementMonth: 3,
    landTaxableValuePct: 85,
    legalAcquisitionFeesAud: 75000,

    gstScheme: 'margin-scheme',
    originalLandCostOverrideAud: null,
    foreignPurchaser: false,
    statutoryOverrides: {
      ...createDefaultStatutoryOverrides(),
      applyVicGaic: false,
    },

    earthworks: {
      cutM3: 11800,
      fillM3: 650,
      netSpoilM3: 11150,
      cutRatePerM3Aud: 42,
      fillRatePerM3Aud: 36,
      spoilDisposalRatePerM3Aud: 110,
      retainingWallLengthM: 230,
      retainingRatePerMAud: 3400, // Basement secant piling / shoring
      directBulkOverrideAud: null,
      directRetainingOverrideAud: null,
    },
    environment: {
      acousticUpgradeRequired: true,
      acousticAllowancePerUnitAud: 14500,
      bushfireAttackLevel: 'BAL-LOW',
      balAllowanceAud: 0,
      floodOverlay: true,
      floodMitigationAllowanceAud: 340000,
    },

    professionalFeesPct: 10.0,
    projectManagementPct: 2.5,
    contingencyPct: 6.5,
    daApprovalFeesAud: 220000,
    agentCommissionPct: 2.75,
    marketingPct: 2.0,
    sellingLegalPerUnitAud: 1950,
    ratesAndHoldingMonthlyAud: 16000,

    stages: [
      {
        id: 'apt-tower',
        name: 'Tower A — 6-Storey Mixed (68 Apts)',
        startMonth: 6,
        constructionMonths: 20,
        salesStartMonth: 4,
        salesMonths: 6,
        settlementLagMonths: 23,
        lotsOrUnits: 68,
        gfaSqm: 7480,
        nsaSqm: 6120,
        carBays: 96,
        roadLengthM: 45,
        constructionRatePerSqmAud: 4450,
        carBayCostAud: 58000,
        roadCostPerMAud: 3200,
        avgSalePriceAud: 1185000,
        sCurveShape: 'standard',
      },
    ],
    horizonMonths: 36,

    capitalStack: {
      seniorDebtEnabled: true,
      seniorLimitType: 'LVR',
      seniorMaxPct: 60,
      seniorInterestRatePct: 8.35,
      seniorEstablishmentFeePct: 1.25,
      seniorLineFeePct: 1.35,
      interestCapitalised: true,
      mezzanineEnabled: true,
      mezzanineMaxPct: 12,
      mezzanineInterestRatePct: 14.75,
      mezzanineEstablishmentFeePct: 2.0,
      jvEnabled: true,
      developerEquitySharePct: 20,
      preferredIrrHurdlePct: 16,
      promoteSplitDeveloperPct: 45,
    },

    targetMetric: 'margin',
    targetMarginPct: 18,
    targetIrrPct: 20,

    monteCarlo: {
      iterations: 10000,
      constructionCostVolPct: 10,
      salePriceVolPct: 8,
      interestRateVolBps: 150,
      salesDelayVolMonths: 4,
      seed: 20261125,
    },
  };
}

export const PRESET_TEMPLATES: PresetMetadata[] = [
  {
    id: 'greenfield-subdivision',
    label: 'Greenfield Subdivision (82 Lots)',
    shortLabel: 'Greenfield',
    subtitle: '2-Stage land release, civil roadworks, cut/fill earthworks, Margin Scheme',
    build: createGreenfieldSubdivisionPreset,
  },
  {
    id: 'townhouse-infill',
    label: 'Townhouse Infill (24 Dwellings)',
    shortLabel: 'Townhouses',
    subtitle: '2-Stage medium density, Senior + Mezzanine stack, acoustic glazing',
    build: createTownhouseInfillPreset,
  },
  {
    id: 'mid-rise-apartments',
    label: 'Mid-Rise Apartments (68 Units)',
    shortLabel: 'Mid-Rise',
    subtitle: '6-Storey build with basement car bays, LVR facility & JV waterfall',
    build: createMidRiseApartmentsPreset,
  },
];
