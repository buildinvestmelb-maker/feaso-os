import {
  calculateAnnualLandTax,
  calculateInfrastructureLevy,
  calculateStampDuty,
} from './auStatutory';
import { calculateGstSummary, calculateMonthlyItc } from './gstEngine';
import type {
  CashflowResult,
  CostBreakdown,
  DevelopmentStage,
  FeasibilityInputs,
  JvWaterfallResult,
  MonthlyCashflowRow,
  SCurveShape,
} from './types';

/**
 * Computes normalized monthly S-curve weights summing strictly to 1.0.
 */
export function buildSCurveWeights(
  months: number,
  shape: SCurveShape = 'standard',
): number[] {
  const n = Math.max(1, Math.round(months));
  if (n === 1) return [1];

  const cdf = (t: number): number => {
    const x = Math.min(1, Math.max(0, t));
    if (shape === 'front-loaded') {
      return 1 - Math.pow(1 - x, 2.2);
    }
    if (shape === 'back-loaded') {
      return Math.pow(x, 2.2);
    }
    // Smooth cubic Hermite S-curve
    return 3 * x * x - 2 * x * x * x;
  };

  const weights: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.max(0, cdf((i + 1) / n) - cdf(i / n));
    weights.push(w);
    sum += w;
  }

  if (sum <= 0) {
    return Array.from({ length: n }, () => 1 / n);
  }
  return weights.map((w) => w / sum);
}

/**
 * Robust monthly IRR solver returning annualised effective IRR in percentage points.
 * Uses bracketed bisection with Newton-Raphson polish; returns null if cashflows
 * do not cross zero or diverge.
 */
export function calculateAnnualisedIrr(monthlyCashflows: number[]): number | null {
  let hasPos = false;
  let hasNeg = false;
  let firstNonZero = -1;

  for (let i = 0; i < monthlyCashflows.length; i++) {
    const cf = monthlyCashflows[i];
    if (Math.abs(cf) > 1e-4 && firstNonZero === -1) {
      firstNonZero = i;
    }
    if (cf > 1e-4) hasPos = true;
    if (cf < -1e-4) hasNeg = true;
  }

  if (!hasPos || !hasNeg || firstNonZero === -1) {
    return null;
  }

  const trimmed = monthlyCashflows.slice(firstNonZero);

  const npv = (rate: number): number => {
    let total = 0;
    const base = 1 + rate;
    if (base <= 0) return Number.NaN;
    let discount = 1;
    for (let t = 0; t < trimmed.length; t++) {
      if (t > 0) discount *= base;
      total += trimmed[t] / discount;
    }
    return total;
  };

  // Search grid across reasonable monthly rates (-50%/mo to +80%/mo)
  const grid: number[] = [
    -0.5, -0.3, -0.2, -0.1, -0.05, -0.02, -0.01, 0, 0.005, 0.01, 0.015, 0.02,
    0.03, 0.05, 0.08, 0.12, 0.2, 0.35, 0.6, 1.0,
  ];

  let lo: number | null = null;
  let hi: number | null = null;
  let npvLo = 0;

  for (let i = 0; i < grid.length - 1; i++) {
    const a = grid[i];
    const b = grid[i + 1];
    const fa = npv(a);
    const fb = npv(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
    if (Math.abs(fa) < 1e-6) {
      return (Math.pow(1 + a, 12) - 1) * 100;
    }
    if (fa * fb <= 0) {
      lo = a;
      hi = b;
      npvLo = fa;
      break;
    }
  }

  if (lo === null || hi === null) {
    return null;
  }

  let low: number = lo;
  let high: number = hi;

  for (let iter = 0; iter < 80; iter++) {
    const mid: number = 0.5 * (low + high);
    const fMid = npv(mid);
    if (!Number.isFinite(fMid)) break;
    if (Math.abs(fMid) < 1e-5 || Math.abs(high - low) < 1e-10) {
      low = mid;
      high = mid;
      break;
    }
    if (npvLo * fMid <= 0) {
      high = mid;
    } else {
      low = mid;
      npvLo = fMid;
    }
  }

  const monthlyRate = 0.5 * (low + high);
  const annualPct = (Math.pow(1 + monthlyRate, 12) - 1) * 100;
  return Number.isFinite(annualPct) ? annualPct : null;
}

/**
 * Computes 2-tier JV profit-split waterfall:
 * Tier 1: Pari-passu return of equity + monthly compounded Preferred IRR Hurdle.
 * Tier 2: Residual profit split by Developer Promote %.
 */
export function computeJvWaterfall(
  equityContributions: number[],
  equityDistributions: number[],
  inputs: FeasibilityInputs['capitalStack'],
): JvWaterfallResult {
  const devShare = Math.min(1, Math.max(0, inputs.developerEquitySharePct / 100));
  const partnerShare = 1 - devShare;
  const promoteDevShare = Math.min(
    1,
    Math.max(0, inputs.promoteSplitDeveloperPct / 100),
  );
  const promotePartnerShare = 1 - promoteDevShare;

  const monthlyHurdleRate =
    Math.pow(1 + Math.max(0, inputs.preferredIrrHurdlePct) / 100, 1 / 12) - 1;

  let devPrefBal = 0;
  let partnerPrefBal = 0;
  let totalContributed = 0;
  let totalDistributed = 0;
  let devContribTotal = 0;
  let partnerContribTotal = 0;
  let tier1DevTotal = 0;
  let tier1PartnerTotal = 0;
  let tier2PoolTotal = 0;
  let tier2DevTotal = 0;
  let tier2PartnerTotal = 0;

  const devCashflows: number[] = [];
  const partnerCashflows: number[] = [];

  for (let m = 0; m < equityContributions.length; m++) {
    const contrib = Math.max(0, equityContributions[m] ?? 0);
    const dist = Math.max(0, equityDistributions[m] ?? 0);

    // Accrue preferred return on opening unreturned capital/pref balances
    if (m > 0) {
      devPrefBal *= 1 + monthlyHurdleRate;
      partnerPrefBal *= 1 + monthlyHurdleRate;
    }

    const devC = contrib * devShare;
    const partnerC = contrib * partnerShare;
    devPrefBal += devC;
    partnerPrefBal += partnerC;
    totalContributed += contrib;
    devContribTotal += devC;
    partnerContribTotal += partnerC;

    let devD = 0;
    let partnerD = 0;

    if (dist > 0) {
      totalDistributed += dist;
      if (!inputs.jvEnabled) {
        devD = dist;
        partnerD = 0;
        tier1DevTotal += dist;
      } else {
        const tier1Need = devPrefBal + partnerPrefBal;
        const tier1Paid = Math.min(dist, tier1Need);

        if (tier1Paid > 0 && tier1Need > 0) {
          const devRatio = devPrefBal / tier1Need;
          const t1Dev = tier1Paid * devRatio;
          const t1Partner = tier1Paid - t1Dev;
          devPrefBal = Math.max(0, devPrefBal - t1Dev);
          partnerPrefBal = Math.max(0, partnerPrefBal - t1Partner);
          devD += t1Dev;
          partnerD += t1Partner;
          tier1DevTotal += t1Dev;
          tier1PartnerTotal += t1Partner;
        }

        const tier2Pool = Math.max(0, dist - tier1Paid);
        if (tier2Pool > 0) {
          const t2Dev = tier2Pool * promoteDevShare;
          const t2Partner = tier2Pool * promotePartnerShare;
          devD += t2Dev;
          partnerD += t2Partner;
          tier2PoolTotal += tier2Pool;
          tier2DevTotal += t2Dev;
          tier2PartnerTotal += t2Partner;
        }
      }
    }

    devCashflows.push(devD - (inputs.jvEnabled ? devC : contrib));
    partnerCashflows.push(partnerD - (inputs.jvEnabled ? partnerC : 0));
  }

  const actualDevContrib = inputs.jvEnabled ? devContribTotal : totalContributed;
  const actualPartnerContrib = inputs.jvEnabled ? partnerContribTotal : 0;
  const devTotalDist = tier1DevTotal + tier2DevTotal;
  const partnerTotalDist = inputs.jvEnabled
    ? tier1PartnerTotal + tier2PartnerTotal
    : 0;

  return {
    enabled: inputs.jvEnabled,
    developerEquitySharePct: inputs.jvEnabled ? inputs.developerEquitySharePct : 100,
    partnerEquitySharePct: inputs.jvEnabled ? 100 - inputs.developerEquitySharePct : 0,
    preferredIrrHurdlePct: inputs.preferredIrrHurdlePct,
    promoteSplitDeveloperPct: inputs.promoteSplitDeveloperPct,
    totalEquityContributedAud: totalContributed,
    totalEquityDistributedAud: totalDistributed,
    developerContributionAud: actualDevContrib,
    partnerContributionAud: actualPartnerContrib,
    tier1DeveloperDistributionAud: tier1DevTotal,
    tier1PartnerDistributionAud: tier1PartnerTotal,
    tier2PromotePoolAud: tier2PoolTotal,
    tier2DeveloperPromoteAud: tier2DevTotal,
    tier2PartnerResidualAud: tier2PartnerTotal,
    developerTotalDistributionAud: devTotalDist,
    partnerTotalDistributionAud: partnerTotalDist,
    developerNetProfitAud: devTotalDist - actualDevContrib,
    partnerNetProfitAud: partnerTotalDist - actualPartnerContrib,
    developerIrrPct: calculateAnnualisedIrr(devCashflows),
    partnerIrrPct: inputs.jvEnabled
      ? calculateAnnualisedIrr(partnerCashflows)
      : null,
    developerMoic: actualDevContrib > 0 ? devTotalDist / actualDevContrib : 0,
    partnerMoic:
      actualPartnerContrib > 0 ? partnerTotalDist / actualPartnerContrib : 0,
  };
}

function getStageHardConstruction(stage: DevelopmentStage): {
  buildingAndCivil: number;
  carBays: number;
  roads: number;
  total: number;
} {
  const buildingAndCivil = Math.max(0, stage.gfaSqm) * Math.max(0, stage.constructionRatePerSqmAud);
  const carBays = Math.max(0, stage.carBays) * Math.max(0, stage.carBayCostAud);
  const roads = Math.max(0, stage.roadLengthM) * Math.max(0, stage.roadCostPerMAud);
  return {
    buildingAndCivil,
    carBays,
    roads,
    total: buildingAndCivil + carBays + roads,
  };
}

function computeRequiredHorizon(inputs: FeasibilityInputs): number {
  let maxMonth = Math.max(
    inputs.landAcquisitionMonth,
    inputs.landSettlementMonth,
    5,
  );
  for (const s of inputs.stages) {
    const buildEnd = s.startMonth + Math.max(1, s.constructionMonths) - 1;
    const settleEnd =
      s.salesStartMonth +
      s.settlementLagMonths +
      Math.max(1, s.salesMonths) -
      1;
    maxMonth = Math.max(maxMonth, buildEnd, settleEnd);
  }
  return Math.min(60, Math.max(6, inputs.horizonMonths, maxMonth + 1));
}

/**
 * Pure deterministic Multi-Stage Monthly Australian Property Development Cashflow,
 * GST, Statutory, Capital Stack & JV Waterfall Engine.
 */
export function runCashflowModel(inputs: FeasibilityInputs): CashflowResult {
  const horizon = computeRequiredHorizon(inputs);
  const clampMonth = (m: number): number =>
    Math.min(horizon - 1, Math.max(0, Math.round(m)));

  // 1. Aggregate stage totals
  let totalLotsOrUnits = 0;
  let totalGfaSqm = 0;
  let totalNsaSqm = 0;
  let totalCarBays = 0;
  let totalRoadLengthM = 0;
  let grossRealisationAud = 0;
  let buildingAndCivilConstructionGrossAud = 0;
  let carBaysGrossAud = 0;
  let roadsGrossAud = 0;
  let earliestBuildMonth = horizon - 1;
  let latestBuildMonth = 0;

  for (const stage of inputs.stages) {
    totalLotsOrUnits += Math.max(0, stage.lotsOrUnits);
    totalGfaSqm += Math.max(0, stage.gfaSqm);
    totalNsaSqm += Math.max(0, stage.nsaSqm);
    totalCarBays += Math.max(0, stage.carBays);
    totalRoadLengthM += Math.max(0, stage.roadLengthM);
    grossRealisationAud +=
      Math.max(0, stage.lotsOrUnits) * Math.max(0, stage.avgSalePriceAud);

    const hc = getStageHardConstruction(stage);
    buildingAndCivilConstructionGrossAud += hc.buildingAndCivil;
    carBaysGrossAud += hc.carBays;
    roadsGrossAud += hc.roads;

    earliestBuildMonth = Math.min(earliestBuildMonth, clampMonth(stage.startMonth));
    latestBuildMonth = Math.max(
      latestBuildMonth,
      clampMonth(stage.startMonth + Math.max(1, stage.constructionMonths) - 1),
    );
  }

  if (inputs.stages.length === 0) {
    earliestBuildMonth = clampMonth(inputs.landSettlementMonth);
    latestBuildMonth = clampMonth(inputs.landSettlementMonth + 12);
  }

  // 2. Statutory calculations (Stamp Duty, Land Tax, Infrastructure Levies)
  const landPriceAud = Math.max(0, inputs.landPriceAud);
  const stampDuty = calculateStampDuty(
    landPriceAud,
    inputs.state,
    inputs.foreignPurchaser,
    inputs.statutoryOverrides,
  );
  const taxableLandValue =
    landPriceAud * (Math.max(0, inputs.landTaxableValuePct) / 100);
  const landTax = calculateAnnualLandTax(
    taxableLandValue,
    inputs.state,
    inputs.statutoryOverrides,
  );
  const infrastructureLevy = calculateInfrastructureLevy(
    inputs.state,
    totalLotsOrUnits,
    inputs.grossAreaSqm,
    inputs.typology,
    inputs.statutoryOverrides,
  );

  // 3. Earthworks & Environment gross costs (GST-inclusive)
  const ew = inputs.earthworks;
  const bulkEarthworksAud =
    ew.directBulkOverrideAud !== null && Number.isFinite(ew.directBulkOverrideAud)
      ? Math.max(0, ew.directBulkOverrideAud)
      : Math.max(0, ew.cutM3) * Math.max(0, ew.cutRatePerM3Aud) +
        Math.max(0, ew.fillM3) * Math.max(0, ew.fillRatePerM3Aud);

  const spoilDisposalAud =
    ew.directBulkOverrideAud !== null && Number.isFinite(ew.directBulkOverrideAud)
      ? 0
      : Math.abs(ew.netSpoilM3) * Math.max(0, ew.spoilDisposalRatePerM3Aud);

  const retainingWallsAud =
    ew.directRetainingOverrideAud !== null &&
    Number.isFinite(ew.directRetainingOverrideAud)
      ? Math.max(0, ew.directRetainingOverrideAud)
      : Math.max(0, ew.retainingWallLengthM) *
        Math.max(0, ew.retainingRatePerMAud);

  const totalEarthworksGrossAud =
    bulkEarthworksAud + spoilDisposalAud + retainingWallsAud;

  const acousticAllowanceGrossAud = inputs.environment.acousticUpgradeRequired
    ? totalLotsOrUnits * Math.max(0, inputs.environment.acousticAllowancePerUnitAud)
    : 0;
  const balAndFloodGrossAud =
    Math.max(0, inputs.environment.balAllowanceAud) +
    (inputs.environment.floodOverlay
      ? Math.max(0, inputs.environment.floodMitigationAllowanceAud)
      : 0);

  const totalHardConstructionGrossAud =
    buildingAndCivilConstructionGrossAud + carBaysGrossAud + roadsGrossAud;
  const totalSiteAndBuildGrossAud =
    totalHardConstructionGrossAud +
    totalEarthworksGrossAud +
    acousticAllowanceGrossAud +
    balAndFloodGrossAud;

  // 4. Soft & Selling gross costs (GST-inclusive)
  const professionalFeesGrossAud =
    totalSiteAndBuildGrossAud * (Math.max(0, inputs.professionalFeesPct) / 100);
  const projectManagementGrossAud =
    totalSiteAndBuildGrossAud * (Math.max(0, inputs.projectManagementPct) / 100);
  const contingencyGrossAud =
    totalSiteAndBuildGrossAud * (Math.max(0, inputs.contingencyPct) / 100);

  const agentCommissionGrossAud =
    grossRealisationAud * (Math.max(0, inputs.agentCommissionPct) / 100);
  const marketingGrossAud =
    grossRealisationAud * (Math.max(0, inputs.marketingPct) / 100);
  const sellingLegalGrossAud =
    totalLotsOrUnits * Math.max(0, inputs.sellingLegalPerUnitAud);

  const legalAcquisitionAud = Math.max(0, inputs.legalAcquisitionFeesAud);
  const daApprovalFeesAud = Math.max(0, inputs.daApprovalFeesAud);

  // 5. Build monthly operating arrays (length = horizon)
  const mLand = new Float64Array(horizon);
  const mStampDuty = new Float64Array(horizon);
  const mEarthworks = new Float64Array(horizon);
  const mConstruction = new Float64Array(horizon);
  const mEnvironment = new Float64Array(horizon);
  const mStatutory = new Float64Array(horizon);
  const mSoftCosts = new Float64Array(horizon);
  const mHolding = new Float64Array(horizon);
  const mSelling = new Float64Array(horizon);
  const mGrossSales = new Float64Array(horizon);
  const mUnitsSettled = new Float64Array(horizon);
  const mGstEligibleGross = new Float64Array(horizon);

  // Land deposit & settlement
  const acqM = clampMonth(inputs.landAcquisitionMonth);
  const settleM = clampMonth(Math.max(inputs.landAcquisitionMonth, inputs.landSettlementMonth));
  const depositFrac = Math.min(1, Math.max(0, inputs.landDepositPct / 100));
  const depositAud = landPriceAud * depositFrac;
  const landBalanceAud = landPriceAud - depositAud;

  mLand[acqM] += depositAud;
  mLand[settleM] += landBalanceAud + legalAcquisitionAud;
  mStampDuty[settleM] += stampDuty.totalDutyAud;

  // DA / Approval fees at acquisition + 1 month (or settleM)
  mStatutory[clampMonth(Math.min(settleM, acqM + 1))] += daApprovalFeesAud;

  // Earthworks spread across first 4 months from earliestBuildMonth
  const ewDuration = Math.min(4, Math.max(1, latestBuildMonth - earliestBuildMonth + 1));
  const ewWeights = buildSCurveWeights(ewDuration, 'front-loaded');
  for (let i = 0; i < ewDuration; i++) {
    const idx = clampMonth(earliestBuildMonth + i);
    const amt = totalEarthworksGrossAud * ewWeights[i];
    mEarthworks[idx] += amt;
    mGstEligibleGross[idx] += amt;
  }

  // Stage-by-stage construction, environment, levies, and sales settlements
  for (const stage of inputs.stages) {
    const hc = getStageHardConstruction(stage);
    const buildLen = Math.max(1, Math.round(stage.constructionMonths));
    const weights = buildSCurveWeights(buildLen, stage.sCurveShape);
    const stageUnitShare =
      totalLotsOrUnits > 0 ? Math.max(0, stage.lotsOrUnits) / totalLotsOrUnits : 0;
    const stageEnvGross =
      (acousticAllowanceGrossAud + balAndFloodGrossAud) * stageUnitShare;

    for (let i = 0; i < buildLen; i++) {
      const idx = clampMonth(stage.startMonth + i);
      const cAmt = hc.total * weights[i];
      const envAmt = stageEnvGross * weights[i];
      mConstruction[idx] += cAmt;
      mEnvironment[idx] += envAmt;
      mGstEligibleGross[idx] += cAmt + envAmt;
    }

    // Statutory infrastructure levies due at practical completion / titling of each stage
    const pcMonth = clampMonth(stage.startMonth + buildLen - 1);
    mStatutory[pcMonth] += infrastructureLevy.totalLevyAud * stageUnitShare;

    // Settlements & selling costs
    const salesLen = Math.max(1, Math.round(stage.salesMonths));
    const firstSettleM = stage.salesStartMonth + stage.settlementLagMonths;
    const stageGrossSales =
      Math.max(0, stage.lotsOrUnits) * Math.max(0, stage.avgSalePriceAud);
    const stageCommission =
      stageGrossSales * (Math.max(0, inputs.agentCommissionPct) / 100);
    const stageSellingLegal =
      Math.max(0, stage.lotsOrUnits) * Math.max(0, inputs.sellingLegalPerUnitAud);
    const stageMarketing =
      stageGrossSales * (Math.max(0, inputs.marketingPct) / 100);

    // 50% marketing during pre-sales launch, 50% during settlement absorption
    const launchStart = clampMonth(stage.salesStartMonth);
    const launchLen = Math.max(1, Math.min(salesLen, 4));
    for (let i = 0; i < launchLen; i++) {
      const idx = clampMonth(launchStart + i);
      const mkt = (stageMarketing * 0.5) / launchLen;
      mSelling[idx] += mkt;
      mGstEligibleGross[idx] += mkt;
    }

    for (let i = 0; i < salesLen; i++) {
      const idx = clampMonth(firstSettleM + i);
      const salesAmt = stageGrossSales / salesLen;
      const unitsAmt = Math.max(0, stage.lotsOrUnits) / salesLen;
      const commAmt = stageCommission / salesLen;
      const legAmt = stageSellingLegal / salesLen;
      const mktAmt = (stageMarketing * 0.5) / salesLen;
      mGrossSales[idx] += salesAmt;
      mUnitsSettled[idx] += unitsAmt;
      mSelling[idx] += commAmt + legAmt + mktAmt;
      mGstEligibleGross[idx] += commAmt + legAmt + mktAmt;
    }
  }

  // Professional fees: 40% pre-construction (acqM .. earliestBuildMonth), 60% during build
  const preBuildStart = acqM;
  const preBuildEnd = Math.max(acqM, earliestBuildMonth);
  const preBuildLen = preBuildEnd - preBuildStart + 1;
  for (let m = preBuildStart; m <= preBuildEnd; m++) {
    const amt = (professionalFeesGrossAud * 0.4) / preBuildLen;
    mSoftCosts[m] += amt;
    mGstEligibleGross[m] += amt;
  }

  const activeBuildSpan = Math.max(1, latestBuildMonth - earliestBuildMonth + 1);
  // Build activity weights for remaining 60% prof fees + contingency + PM
  let buildSum = 0;
  for (let m = 0; m < horizon; m++) {
    buildSum += mConstruction[m] + mEarthworks[m] + mEnvironment[m];
  }
  const buildDependentSoft =
    professionalFeesGrossAud * 0.6 +
    projectManagementGrossAud +
    contingencyGrossAud;

  for (let m = 0; m < horizon; m++) {
    let w = 0;
    if (buildSum > 0) {
      w = (mConstruction[m] + mEarthworks[m] + mEnvironment[m]) / buildSum;
    } else if (m >= earliestBuildMonth && m <= latestBuildMonth) {
      w = 1 / activeBuildSpan;
    }
    if (w > 0) {
      const amt = buildDependentSoft * w;
      mSoftCosts[m] += amt;
      mGstEligibleGross[m] += amt;
    }
  }

  // Holding costs (Land Tax + Council Rates/Insurance) from land settlement until all units settle
  let lastSettlementMonth = latestBuildMonth;
  for (let m = horizon - 1; m >= 0; m--) {
    if (mGrossSales[m] > 0) {
      lastSettlementMonth = m;
      break;
    }
  }

  let landTaxHoldingAud = 0;
  let ratesHoldingAud = 0;
  let cumUnitsSettled = 0;

  for (let m = settleM; m <= lastSettlementMonth; m++) {
    const unsoldRatio =
      totalLotsOrUnits > 0
        ? Math.max(0, 1 - cumUnitsSettled / totalLotsOrUnits)
        : 1;
    const lt = landTax.monthlyLandTaxAud * unsoldRatio;
    const rates = Math.max(0, inputs.ratesAndHoldingMonthlyAud) * unsoldRatio;
    mHolding[m] += lt + rates;
    landTaxHoldingAud += lt;
    ratesHoldingAud += rates;
    cumUnitsSettled += mUnitsSettled[m];
  }

  // 6. GST Calculation (exact ATO Margin Scheme / Full GST / GST-Free)
  let gstEligibleGrossCostsAud = 0;
  for (let m = 0; m < horizon; m++) {
    gstEligibleGrossCostsAud += mGstEligibleGross[m];
  }

  const originalLandCostAud =
    inputs.originalLandCostOverrideAud !== null &&
    Number.isFinite(inputs.originalLandCostOverrideAud)
      ? Math.max(0, inputs.originalLandCostOverrideAud)
      : landPriceAud;

  const gst = calculateGstSummary({
    scheme: inputs.gstScheme,
    grossSalesInclGstAud: grossRealisationAud,
    originalLandCostAud,
    gstEligibleGrossCostsAud,
  });

  // Allocate monthly Output GST & ITC credits
  const mOutputGst = new Float64Array(horizon);
  const mItcCredit = new Float64Array(horizon);
  const mNetOperatingCf = new Float64Array(horizon);

  let unleveredNetCostsAud = 0;
  let peakCumulativeDeficit = 0;
  let runningUnlevered = 0;

  for (let m = 0; m < horizon; m++) {
    const itc = calculateMonthlyItc(inputs.gstScheme, mGstEligibleGross[m]);
    const outGst =
      grossRealisationAud > 0
        ? gst.gstOnSalesAud * (mGrossSales[m] / grossRealisationAud)
        : 0;

    mItcCredit[m] = itc;
    mOutputGst[m] = outGst;

    const grossOutflow =
      mLand[m] +
      mStampDuty[m] +
      mEarthworks[m] +
      mConstruction[m] +
      mEnvironment[m] +
      mStatutory[m] +
      mSoftCosts[m] +
      mHolding[m] +
      mSelling[m];

    const netOutflow = grossOutflow - itc;
    const netInflow = mGrossSales[m] - outGst;
    unleveredNetCostsAud += netOutflow;

    const opCf = netInflow - netOutflow;
    mNetOperatingCf[m] = opCf;
    runningUnlevered += opCf;
    if (-runningUnlevered > peakCumulativeDeficit) {
      peakCumulativeDeficit = -runningUnlevered;
    }
  }

  // 7. Capital Stack & Debt Engine (3-pass fixed-point convergence for LTC cap including capitalised interest)
  const cs = inputs.capitalStack;
  const seniorMonthlyRate = Math.max(0, cs.seniorInterestRatePct) / 100 / 12;
  const seniorLineMonthlyRate = Math.max(0, cs.seniorLineFeePct) / 100 / 12;
  const seniorEstRate = Math.max(0, cs.seniorEstablishmentFeePct) / 100;
  const mezzMonthlyRate = Math.max(0, cs.mezzanineInterestRatePct) / 100 / 12;
  const mezzEstRate = Math.max(0, cs.mezzanineEstablishmentFeePct) / 100;

  let estimatedTdc = unleveredNetCostsAud;
  let seniorFacilityLimitAud = 0;
  let mezzFacilityLimitAud = 0;

  let finalRows: MonthlyCashflowRow[] = [];
  let peakDebtAud = 0;
  let peakSeniorDebtAud = 0;
  let peakMezzDebtAud = 0;
  let peakEquityAud = 0;
  let seniorInterestTotal = 0;
  let seniorLineFeesTotal = 0;
  let seniorEstFeesTotal = 0;
  let mezzInterestTotal = 0;
  let mezzEstFeesTotal = 0;

  for (let pass = 0; pass < 4; pass++) {
    seniorFacilityLimitAud = cs.seniorDebtEnabled
      ? cs.seniorLimitType === 'LTC'
        ? estimatedTdc * (Math.max(0, cs.seniorMaxPct) / 100)
        : gst.netRealisationExclGstAud * (Math.max(0, cs.seniorMaxPct) / 100)
      : 0;

    mezzFacilityLimitAud = cs.mezzanineEnabled
      ? estimatedTdc * (Math.max(0, cs.mezzanineMaxPct) / 100)
      : 0;

    // Required upfront equity commitment (Australian "equity first" construction funding rule)
    const estimatedPeakNeed = Math.max(
      peakCumulativeDeficit,
      unleveredNetCostsAud * 0.35,
    );
    const initialEquityCommitment = Math.max(
      0,
      estimatedTdc - seniorFacilityLimitAud - mezzFacilityLimitAud,
      estimatedPeakNeed - seniorFacilityLimitAud - mezzFacilityLimitAud,
    );
    let remainingEquityCommitment = initialEquityCommitment;

    let seniorBal = 0;
    let mezzBal = 0;
    let seniorActivated = false;
    let mezzActivated = false;
    let cumUnlevered = 0;
    let cumEquity = 0;

    peakDebtAud = 0;
    peakSeniorDebtAud = 0;
    peakMezzDebtAud = 0;
    peakEquityAud = 0;
    seniorInterestTotal = 0;
    seniorLineFeesTotal = 0;
    seniorEstFeesTotal = 0;
    mezzInterestTotal = 0;
    mezzEstFeesTotal = 0;

    const rows: MonthlyCashflowRow[] = [];

    for (let m = 0; m < horizon; m++) {
      const opCf = mNetOperatingCf[m];
      cumUnlevered += opCf;

      let seniorInterest = seniorBal * seniorMonthlyRate;
      let seniorLineFee =
        seniorActivated && seniorFacilityLimitAud > 0
          ? Math.max(0, seniorFacilityLimitAud - seniorBal) * seniorLineMonthlyRate
          : 0;
      let mezzInterest = mezzBal * mezzMonthlyRate;
      let seniorEstFee = 0;
      let mezzEstFee = 0;

      let seniorDraw = 0;
      let seniorRepay = 0;
      let mezzDraw = 0;
      let mezzRepay = 0;
      let equityContrib = 0;
      let equityDist = 0;

      // Apply interest & line fee before operating flows
      if (cs.interestCapitalised) {
        // Capitalise senior interest + line fee up to facility headroom; excess funded by equity
        const seniorCapRoom = Math.max(0, seniorFacilityLimitAud - seniorBal);
        const seniorFinCharge = seniorInterest + seniorLineFee;
        const seniorCapAmt = Math.min(seniorFinCharge, seniorCapRoom);
        seniorBal += seniorCapAmt;
        equityContrib += seniorFinCharge - seniorCapAmt;

        const mezzCapRoom = Math.max(0, mezzFacilityLimitAud - mezzBal);
        const mezzCapAmt = Math.min(mezzInterest, mezzCapRoom);
        mezzBal += mezzCapAmt;
        equityContrib += mezzInterest - mezzCapAmt;
      } else {
        // Serviced monthly from cash/equity
        equityContrib += seniorInterest + seniorLineFee + mezzInterest;
      }

      if (opCf < 0) {
        let shortfall = -opCf;

        // 1. Equity first commitment
        if (remainingEquityCommitment > 0 && shortfall > 0) {
          const eqUsed = Math.min(shortfall, remainingEquityCommitment);
          equityContrib += eqUsed;
          remainingEquityCommitment -= eqUsed;
          shortfall -= eqUsed;
        }

        // 2. Mezzanine draw
        if (shortfall > 0 && cs.mezzanineEnabled && mezzFacilityLimitAud > 0) {
          if (!mezzActivated) {
            mezzActivated = true;
            mezzEstFee = mezzFacilityLimitAud * mezzEstRate;
            if (cs.interestCapitalised) {
              const room = Math.max(0, mezzFacilityLimitAud - mezzBal);
              const cap = Math.min(mezzEstFee, room);
              mezzBal += cap;
              equityContrib += mezzEstFee - cap;
            } else {
              equityContrib += mezzEstFee;
            }
          }
          const mezzRoom = Math.max(0, mezzFacilityLimitAud - mezzBal);
          const mDraw = Math.min(shortfall, mezzRoom);
          mezzDraw += mDraw;
          mezzBal += mDraw;
          shortfall -= mDraw;
        }

        // 3. Senior debt draw
        if (shortfall > 0 && cs.seniorDebtEnabled && seniorFacilityLimitAud > 0) {
          if (!seniorActivated) {
            seniorActivated = true;
            seniorEstFee = seniorFacilityLimitAud * seniorEstRate;
            if (cs.interestCapitalised) {
              const room = Math.max(0, seniorFacilityLimitAud - seniorBal);
              const cap = Math.min(seniorEstFee, room);
              seniorBal += cap;
              equityContrib += seniorEstFee - cap;
            } else {
              equityContrib += seniorEstFee;
            }
          }
          const seniorRoom = Math.max(0, seniorFacilityLimitAud - seniorBal);
          const sDraw = Math.min(shortfall, seniorRoom);
          seniorDraw += sDraw;
          seniorBal += sDraw;
          shortfall -= sDraw;
        }

        // 4. Equity overflow if debt caps reached
        if (shortfall > 0) {
          equityContrib += shortfall;
          shortfall = 0;
        }
      } else if (opCf > 0) {
        let surplus = opCf;

        // Waterfall repayment: Senior first -> Mezzanine -> Equity distribution
        if (seniorBal > 0 && surplus > 0) {
          const sRepay = Math.min(surplus, seniorBal);
          seniorRepay += sRepay;
          seniorBal -= sRepay;
          surplus -= sRepay;
        }

        if (mezzBal > 0 && surplus > 0) {
          const mRepay = Math.min(surplus, mezzBal);
          mezzRepay += mRepay;
          mezzBal -= mRepay;
          surplus -= mRepay;
        }

        if (surplus > 0) {
          equityDist += surplus;
        }
      }

      // Close out any residual debt at final month from equity so accounting reconciles strictly
      if (m === horizon - 1) {
        if (seniorBal > 1e-6) {
          seniorRepay += seniorBal;
          equityContrib += seniorBal;
          seniorBal = 0;
        }
        if (mezzBal > 1e-6) {
          mezzRepay += mezzBal;
          equityContrib += mezzBal;
          mezzBal = 0;
        }
      }

      // Net equity contrib vs dist inside the same month cleanly
      if (equityContrib > 0 && equityDist > 0) {
        if (equityDist >= equityContrib) {
          equityDist -= equityContrib;
          equityContrib = 0;
        } else {
          equityContrib -= equityDist;
          equityDist = 0;
        }
      }

      const netEquityCf = equityDist - equityContrib;
      cumEquity += netEquityCf;

      const totalDebt = seniorBal + mezzBal;
      if (totalDebt > peakDebtAud) peakDebtAud = totalDebt;
      if (seniorBal > peakSeniorDebtAud) peakSeniorDebtAud = seniorBal;
      if (mezzBal > peakMezzDebtAud) peakMezzDebtAud = mezzBal;
      if (-cumEquity > peakEquityAud) peakEquityAud = -cumEquity;

      seniorInterestTotal += seniorInterest;
      seniorLineFeesTotal += seniorLineFee;
      seniorEstFeesTotal += seniorEstFee;
      mezzInterestTotal += mezzInterest;
      mezzEstFeesTotal += mezzEstFee;

      rows.push({
        month: m,
        label: `M${m}`,
        landAud: mLand[m],
        stampDutyAud: mStampDuty[m],
        earthworksAud: mEarthworks[m],
        constructionAud: mConstruction[m],
        environmentAud: mEnvironment[m],
        statutoryAud: mStatutory[m],
        softCostsAud: mSoftCosts[m],
        holdingAud: mHolding[m],
        sellingAud: mSelling[m],
        grossSalesAud: mGrossSales[m],
        outputGstAud: mOutputGst[m],
        itcCreditAud: mItcCredit[m],
        netOperatingCfAud: opCf,
        seniorDrawAud: seniorDraw,
        seniorRepayAud: seniorRepay,
        seniorInterestAud: seniorInterest,
        seniorLineFeeAud: seniorLineFee,
        seniorEstFeeAud: seniorEstFee,
        seniorBalanceAud: seniorBal,
        mezzDrawAud: mezzDraw,
        mezzRepayAud: mezzRepay,
        mezzInterestAud: mezzInterest,
        mezzEstFeeAud: mezzEstFee,
        mezzBalanceAud: mezzBal,
        totalDebtBalanceAud: totalDebt,
        equityContributionAud: equityContrib,
        equityDistributionAud: equityDist,
        netEquityCfAud: netEquityCf,
        cumulativeUnleveredCfAud: cumUnlevered,
        cumulativeEquityCfAud: cumEquity,
      });
    }

    const totalFin =
      seniorInterestTotal +
      seniorLineFeesTotal +
      seniorEstFeesTotal +
      mezzInterestTotal +
      mezzEstFeesTotal;
    const nextTdc = unleveredNetCostsAud + totalFin;
    finalRows = rows;

    if (Math.abs(nextTdc - estimatedTdc) < 1) {
      estimatedTdc = nextTdc;
      break;
    }
    estimatedTdc = nextTdc;
  }

  const totalFinanceCostsAud =
    seniorInterestTotal +
    seniorLineFeesTotal +
    seniorEstFeesTotal +
    mezzInterestTotal +
    mezzEstFeesTotal;

  const totalDevelopmentCostAud = unleveredNetCostsAud + totalFinanceCostsAud;
  const netRealisationAud = gst.netRealisationExclGstAud;
  const netProfitAud = netRealisationAud - totalDevelopmentCostAud;
  const devMarginPct =
    totalDevelopmentCostAud > 0
      ? (netProfitAud / totalDevelopmentCostAud) * 100
      : 0;
  const profitOnGrvPct =
    netRealisationAud > 0 ? (netProfitAud / netRealisationAud) * 100 : 0;

  const projectIrrPct = calculateAnnualisedIrr(
    finalRows.map((r) => r.netOperatingCfAud),
  );
  const equityIrrPct = calculateAnnualisedIrr(
    finalRows.map((r) => r.netEquityCfAud),
  );

  const jvWaterfall = computeJvWaterfall(
    finalRows.map((r) => r.equityContributionAud),
    finalRows.map((r) => r.equityDistributionAud),
    cs,
  );

  const costBreakdown: CostBreakdown = {
    landPriceAud,
    stampDutyAud: stampDuty.totalDutyAud,
    legalAcquisitionAud,
    bulkEarthworksAud,
    spoilDisposalAud,
    retainingWallsAud,
    totalEarthworksGrossAud,
    buildingAndCivilConstructionGrossAud,
    carBaysGrossAud,
    roadsGrossAud,
    acousticAllowanceGrossAud,
    balAndFloodGrossAud,
    professionalFeesGrossAud,
    projectManagementGrossAud,
    contingencyGrossAud,
    daApprovalFeesAud,
    infrastructureLeviesAud: infrastructureLevy.totalLevyAud,
    landTaxHoldingAud,
    ratesHoldingAud,
    agentCommissionGrossAud,
    marketingGrossAud,
    sellingLegalGrossAud,
    gstEligibleGrossCostsAud,
    inputTaxCreditsAud: gst.inputTaxCreditsAud,
    seniorInterestAud: seniorInterestTotal,
    seniorLineFeesAud: seniorLineFeesTotal,
    seniorEstFeesAud: seniorEstFeesTotal,
    mezzInterestAud: mezzInterestTotal,
    mezzEstFeesAud: mezzEstFeesTotal,
    totalFinanceCostsAud,
    totalDevelopmentCostAud,
  };

  return {
    horizonMonths: horizon,
    totalLotsOrUnits,
    totalGfaSqm,
    totalNsaSqm,
    totalCarBays,
    totalRoadLengthM,
    grossRealisationAud,
    netRealisationAud,
    totalDevelopmentCostAud,
    netProfitAud,
    devMarginPct,
    profitOnGrvPct,
    projectIrrPct,
    equityIrrPct,
    peakDebtAud,
    peakSeniorDebtAud,
    peakMezzDebtAud,
    peakEquityAud,
    seniorFacilityLimitAud,
    mezzFacilityLimitAud,
    peakLtcPct:
      totalDevelopmentCostAud > 0
        ? (peakDebtAud / totalDevelopmentCostAud) * 100
        : 0,
    peakLvrPct:
      netRealisationAud > 0 ? (peakDebtAud / netRealisationAud) * 100 : 0,
    gst,
    stampDuty,
    landTax,
    infrastructureLevy,
    costBreakdown,
    jvWaterfall,
    monthly: finalRows,
  };
}
