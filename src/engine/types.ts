export type AustralianState =
  | 'NSW'
  | 'VIC'
  | 'QLD'
  | 'WA'
  | 'SA'
  | 'TAS'
  | 'ACT'
  | 'NT';

export type GstScheme = 'margin-scheme' | 'full-gst' | 'gst-free';

export type DevelopmentTypology =
  | 'greenfield-subdivision'
  | 'townhouse-infill'
  | 'mid-rise-apartments';

export type SCurveShape = 'standard' | 'front-loaded' | 'back-loaded';

export type DebtLimitType = 'LTC' | 'LVR';

export type GoalSeekTargetMetric = 'margin' | 'irr';

export interface ProgressiveBracket {
  min: number;
  max: number | null;
  baseTax: number;
  marginalRate: number; // decimal e.g. 0.055 for 5.5%
}

export interface StateStatutoryPreset {
  state: AustralianState;
  name: string;
  capital: string;
  revenueOffice: string;
  planningAuthority: string;
  dutyLabel: string;
  levyLabel: string;
  landTaxLabel: string;
  dutyBrackets: ProgressiveBracket[];
  foreignSurchargeRatePct: number;
  landTaxBrackets: ProgressiveBracket[];
  defaultLevyPerLotAud: number;
  defaultLevyPerUnitAud: number;
  defaultGaicPerHaAud: number;
  notes: string;
}

export interface StatutoryOverrides {
  customStampDutyRatePct: number | null;
  customForeignSurchargePct: number | null;
  customAnnualLandTaxRatePct: number | null;
  customInfrastructureLevyPerUnitAud: number | null;
  customInfrastructureLevyLumpSumAud: number | null;
  applyVicGaic: boolean;
  vicGaicPerHaAud: number | null;
}

export interface StampDutyBreakdown {
  state: AustralianState;
  dutiableValueAud: number;
  baseDutyAud: number;
  foreignSurchargeAud: number;
  totalDutyAud: number;
  effectiveRatePct: number;
  usedCustomRate: boolean;
  explanation: string;
}

export interface LandTaxBreakdown {
  state: AustralianState;
  taxableLandValueAud: number;
  annualLandTaxAud: number;
  monthlyLandTaxAud: number;
  effectiveRatePct: number;
  usedCustomRate: boolean;
}

export interface InfrastructureLevyBreakdown {
  state: AustralianState;
  levyLabel: string;
  baseLevyAud: number;
  gaicAud: number;
  totalLevyAud: number;
  perUnitEffectiveAud: number;
  explanation: string;
}

export interface EarthworksInputs {
  cutM3: number;
  fillM3: number;
  netSpoilM3: number;
  cutRatePerM3Aud: number;
  fillRatePerM3Aud: number;
  spoilDisposalRatePerM3Aud: number;
  retainingWallLengthM: number;
  retainingRatePerMAud: number;
  directBulkOverrideAud: number | null;
  directRetainingOverrideAud: number | null;
}

export interface EnvironmentInputs {
  acousticUpgradeRequired: boolean;
  acousticAllowancePerUnitAud: number;
  bushfireAttackLevel:
    | 'BAL-LOW'
    | 'BAL-12.5'
    | 'BAL-19'
    | 'BAL-29'
    | 'BAL-40'
    | 'BAL-FZ';
  balAllowanceAud: number;
  floodOverlay: boolean;
  floodMitigationAllowanceAud: number;
}

export interface DevelopmentStage {
  id: string;
  name: string;
  startMonth: number;
  constructionMonths: number;
  salesStartMonth: number;
  salesMonths: number;
  settlementLagMonths: number;
  lotsOrUnits: number;
  gfaSqm: number;
  nsaSqm: number;
  carBays: number;
  roadLengthM: number;
  constructionRatePerSqmAud: number;
  carBayCostAud: number;
  roadCostPerMAud: number;
  avgSalePriceAud: number;
  sCurveShape: SCurveShape;
}

export interface CapitalStackInputs {
  seniorDebtEnabled: boolean;
  seniorLimitType: DebtLimitType;
  seniorMaxPct: number;
  seniorInterestRatePct: number;
  seniorEstablishmentFeePct: number;
  seniorLineFeePct: number;
  interestCapitalised: boolean;
  mezzanineEnabled: boolean;
  mezzanineMaxPct: number;
  mezzanineInterestRatePct: number;
  mezzanineEstablishmentFeePct: number;
  jvEnabled: boolean;
  developerEquitySharePct: number;
  preferredIrrHurdlePct: number;
  promoteSplitDeveloperPct: number;
}

export interface MonteCarloConfig {
  iterations: number;
  constructionCostVolPct: number;
  salePriceVolPct: number;
  interestRateVolBps: number;
  salesDelayVolMonths: number;
  seed: number;
}

export interface FeasibilityInputs {
  projectId: string;
  projectName: string;
  address: string;
  lga: string;
  parcelId: string;
  state: AustralianState;
  typology: DevelopmentTypology;
  grossAreaSqm: number;
  netDevelopableAreaSqm: number;

  // Land Acquisition
  landPriceAud: number;
  landAcquisitionMonth: number;
  landDepositPct: number;
  landSettlementMonth: number;
  landTaxableValuePct: number;
  legalAcquisitionFeesAud: number;

  // Statutory & GST
  gstScheme: GstScheme;
  originalLandCostOverrideAud: number | null;
  foreignPurchaser: boolean;
  statutoryOverrides: StatutoryOverrides;

  // Site / Earthworks / Environment
  earthworks: EarthworksInputs;
  environment: EnvironmentInputs;

  // Soft, Selling & Holding
  professionalFeesPct: number;
  projectManagementPct: number;
  contingencyPct: number;
  daApprovalFeesAud: number;
  agentCommissionPct: number;
  marketingPct: number;
  sellingLegalPerUnitAud: number;
  ratesAndHoldingMonthlyAud: number;

  // Multi-Stage Schedule
  stages: DevelopmentStage[];
  horizonMonths: number;

  // Capital Stack & JV Waterfall
  capitalStack: CapitalStackInputs;

  // Goal-Seek RLV Settings
  targetMetric: GoalSeekTargetMetric;
  targetMarginPct: number;
  targetIrrPct: number;

  // Risk / Monte Carlo Config
  monteCarlo: MonteCarloConfig;
}

export interface GstCalculationResult {
  scheme: GstScheme;
  grossSalesInclGstAud: number;
  originalLandCostAud: number;
  gstMarginBaseAud: number;
  gstOnSalesAud: number;
  gstEligibleGrossCostsAud: number;
  inputTaxCreditsAud: number;
  netGstPayableAud: number;
  netRealisationExclGstAud: number;
  formulaDescription: string;
}

export interface MonthlyCashflowRow {
  month: number;
  label: string;
  landAud: number;
  stampDutyAud: number;
  earthworksAud: number;
  constructionAud: number;
  environmentAud: number;
  statutoryAud: number;
  softCostsAud: number;
  holdingAud: number;
  sellingAud: number;
  grossSalesAud: number;
  outputGstAud: number;
  itcCreditAud: number;
  netOperatingCfAud: number;
  seniorDrawAud: number;
  seniorRepayAud: number;
  seniorInterestAud: number;
  seniorLineFeeAud: number;
  seniorEstFeeAud: number;
  seniorBalanceAud: number;
  mezzDrawAud: number;
  mezzRepayAud: number;
  mezzInterestAud: number;
  mezzEstFeeAud: number;
  mezzBalanceAud: number;
  totalDebtBalanceAud: number;
  equityContributionAud: number;
  equityDistributionAud: number;
  netEquityCfAud: number;
  cumulativeUnleveredCfAud: number;
  cumulativeEquityCfAud: number;
}

export interface JvWaterfallResult {
  enabled: boolean;
  developerEquitySharePct: number;
  partnerEquitySharePct: number;
  preferredIrrHurdlePct: number;
  promoteSplitDeveloperPct: number;
  totalEquityContributedAud: number;
  totalEquityDistributedAud: number;
  developerContributionAud: number;
  partnerContributionAud: number;
  tier1DeveloperDistributionAud: number;
  tier1PartnerDistributionAud: number;
  tier2PromotePoolAud: number;
  tier2DeveloperPromoteAud: number;
  tier2PartnerResidualAud: number;
  developerTotalDistributionAud: number;
  partnerTotalDistributionAud: number;
  developerNetProfitAud: number;
  partnerNetProfitAud: number;
  developerIrrPct: number | null;
  partnerIrrPct: number | null;
  developerMoic: number;
  partnerMoic: number;
}

export interface CostBreakdown {
  landPriceAud: number;
  stampDutyAud: number;
  legalAcquisitionAud: number;
  bulkEarthworksAud: number;
  spoilDisposalAud: number;
  retainingWallsAud: number;
  totalEarthworksGrossAud: number;
  buildingAndCivilConstructionGrossAud: number;
  carBaysGrossAud: number;
  roadsGrossAud: number;
  acousticAllowanceGrossAud: number;
  balAndFloodGrossAud: number;
  professionalFeesGrossAud: number;
  projectManagementGrossAud: number;
  contingencyGrossAud: number;
  daApprovalFeesAud: number;
  infrastructureLeviesAud: number;
  landTaxHoldingAud: number;
  ratesHoldingAud: number;
  agentCommissionGrossAud: number;
  marketingGrossAud: number;
  sellingLegalGrossAud: number;
  gstEligibleGrossCostsAud: number;
  inputTaxCreditsAud: number;
  seniorInterestAud: number;
  seniorLineFeesAud: number;
  seniorEstFeesAud: number;
  mezzInterestAud: number;
  mezzEstFeesAud: number;
  totalFinanceCostsAud: number;
  totalDevelopmentCostAud: number;
}

export interface CashflowResult {
  horizonMonths: number;
  totalLotsOrUnits: number;
  totalGfaSqm: number;
  totalNsaSqm: number;
  totalCarBays: number;
  totalRoadLengthM: number;
  grossRealisationAud: number;
  netRealisationAud: number;
  totalDevelopmentCostAud: number;
  netProfitAud: number;
  devMarginPct: number;
  profitOnGrvPct: number;
  projectIrrPct: number | null;
  equityIrrPct: number | null;
  peakDebtAud: number;
  peakSeniorDebtAud: number;
  peakMezzDebtAud: number;
  peakEquityAud: number;
  seniorFacilityLimitAud: number;
  mezzFacilityLimitAud: number;
  peakLtcPct: number;
  peakLvrPct: number;
  gst: GstCalculationResult;
  stampDuty: StampDutyBreakdown;
  landTax: LandTaxBreakdown;
  infrastructureLevy: InfrastructureLevyBreakdown;
  costBreakdown: CostBreakdown;
  jvWaterfall: JvWaterfallResult;
  monthly: MonthlyCashflowRow[];
}

export interface RlvResult {
  targetMetric: GoalSeekTargetMetric;
  targetValuePct: number;
  rlvAud: number;
  rlvPerSqmGrossAud: number;
  rlvPerSqmNdaAud: number;
  rlvPerLotOrUnitAud: number;
  achievedMarginPct: number;
  achievedIrrPct: number | null;
  stampDutyAtRlvAud: number;
  deltaVsCurrentLandAud: number;
  iterations: number;
  converged: boolean;
  feasible: boolean;
}

export interface SensitivityCell {
  costDeltaPct: number;
  revenueDeltaPct: number;
  rlvAud: number;
  devMarginPct: number;
  equityIrrPct: number | null;
  netProfitAud: number;
}

export interface SensitivityMatrixResult {
  costDeltasPct: number[];
  revenueDeltasPct: number[];
  cells: SensitivityCell[][];
}

export interface TornadoDriver {
  id: string;
  label: string;
  unitLabel: string;
  lowInputLabel: string;
  highInputLabel: string;
  baseRlvAud: number;
  lowRlvAud: number;
  highRlvAud: number;
  downsideDeltaAud: number;
  upsideDeltaAud: number;
  spreadAud: number;
  correlation?: number;
}

export interface HistogramBucket {
  binStartAud: number;
  binEndAud: number;
  binMidAud: number;
  label: string;
  count: number;
  frequencyPct: number;
}

export interface PercentileStats {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface MonteCarloResult {
  iterations: number;
  elapsedMs: number;
  rlv: PercentileStats;
  devMarginPct: PercentileStats;
  equityIrrPct: PercentileStats;
  probMeetsTargetMarginPct: number;
  probPositiveProfitPct: number;
  rlvHistogram: HistogramBucket[];
  tornado: TornadoDriver[];
}
