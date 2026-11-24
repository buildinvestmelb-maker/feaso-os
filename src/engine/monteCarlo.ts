import { runCashflowModel } from './cashflowEngine';
import { solveResidualLandValue } from './rlvSolver';
import { buildTornadoSensitivity } from './sensitivity';
import type {
  FeasibilityInputs,
  HistogramBucket,
  MonteCarloResult,
  PercentileStats,
} from './types';

/**
 * Deterministic fast 32-bit PRNG (Mulberry32) for reproducible Monte Carlo runs.
 */
function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Inverse CDF sampling of a Triangular distribution on [min, mode, max].
 */
export function sampleTriangular(
  u: number,
  min: number,
  mode: number,
  max: number,
): number {
  if (max <= min) return mode;
  const clampedU = Math.min(1 - 1e-12, Math.max(1e-12, u));
  const fc = (mode - min) / (max - min);
  if (clampedU < fc) {
    return min + Math.sqrt(clampedU * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - clampedU) * (max - min) * (max - mode));
}

function computePercentileStats(values: Float64Array): PercentileStats {
  const n = values.length;
  if (n === 0) {
    return { p10: 0, p50: 0, p90: 0, mean: 0, stdDev: 0, min: 0, max: 0 };
  }
  const sorted = Float64Array.from(values).sort();
  let sum = 0;
  for (let i = 0; i < n; i++) sum += sorted[i];
  const mean = sum / n;

  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = sorted[i] - mean;
    varSum += d * d;
  }
  const stdDev = Math.sqrt(varSum / n);

  const pick = (q: number): number => {
    const idx = Math.min(n - 1, Math.max(0, Math.floor(q * (n - 1))));
    return sorted[idx];
  };

  return {
    p10: pick(0.1),
    p50: pick(0.5),
    p90: pick(0.9),
    mean,
    stdDev,
    min: sorted[0],
    max: sorted[n - 1],
  };
}

function buildHistogram(values: Float64Array, binCount = 24): HistogramBucket[] {
  const n = values.length;
  if (n === 0) return [];

  let min = values[0];
  let max = values[0];
  for (let i = 1; i < n; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }

  if (max - min < 1) {
    const mid = min;
    return [
      {
        binStartAud: mid,
        binEndAud: mid,
        binMidAud: mid,
        label: `$${(mid / 1e6).toFixed(2)}M`,
        count: n,
        frequencyPct: 100,
      },
    ];
  }

  const width = (max - min) / binCount;
  const counts = new Int32Array(binCount);
  for (let i = 0; i < n; i++) {
    const idx = Math.min(binCount - 1, Math.floor((values[i] - min) / width));
    counts[idx]++;
  }

  const buckets: HistogramBucket[] = [];
  for (let b = 0; b < binCount; b++) {
    const binStartAud = min + b * width;
    const binEndAud = binStartAud + width;
    const binMidAud = 0.5 * (binStartAud + binEndAud);
    buckets.push({
      binStartAud,
      binEndAud,
      binMidAud,
      label: `$${(binMidAud / 1e6).toFixed(1)}M`,
      count: counts[b],
      frequencyPct: (counts[b] / n) * 100,
    });
  }
  return buckets;
}

/**
 * Fast allocation-free monthly IRR solver (Newton-Raphson seeded at base rate)
 * operating directly on a pre-allocated Float64Array slice [0..len-1].
 */
function fastAnnualisedIrr(
  cf: Float64Array,
  len: number,
  seedMonthlyRate: number,
): number {
  let first = -1;
  let hasPos = false;
  let hasNeg = false;
  for (let t = 0; t < len; t++) {
    const v = cf[t];
    if (first === -1 && Math.abs(v) > 1e-3) first = t;
    if (v > 1e-3) hasPos = true;
    if (v < -1e-3) hasNeg = true;
  }
  if (!hasPos || !hasNeg || first === -1) return -50;

  let r = Math.min(0.25, Math.max(-0.15, seedMonthlyRate));
  for (let iter = 0; iter < 12; iter++) {
    const base = 1 + r;
    if (base <= 0.1) {
      r = -0.1;
      break;
    }
    let npv = 0;
    let dNpv = 0;
    let disc = 1;
    for (let t = first; t < len; t++) {
      const k = t - first;
      if (k > 0) disc *= base;
      const val = cf[t];
      if (val !== 0) {
        const pv = val / disc;
        npv += pv;
        if (k > 0) {
          dNpv -= (k * pv) / base;
        }
      }
    }
    if (Math.abs(npv) < 10) break;
    if (Math.abs(dNpv) < 1e-6) break;
    const step = npv / dNpv;
    r -= Math.min(0.15, Math.max(-0.15, step));
    if (r < -0.45) r = -0.45;
    if (r > 0.65) r = 0.65;
  }

  return (Math.pow(1 + r, 12) - 1) * 100;
}

/**
 * High-performance 10,000-run Monte Carlo risk simulator (<500ms budget).
 * Samples independent Triangular distributions for:
 *  1. Construction & Civil Cost (±%)
 *  2. End Sale Price (±%)
 *  3. Debt Interest Rate (±bps)
 *  4. Sales Absorption Delay (±months)
 *
 * Uses zero-allocation Float64Array monthly debt & capitalised interest loops
 * calibrated directly against the exact deterministic cashflow & RLV engine.
 */
export function runMonteCarloSimulation(
  inputs: FeasibilityInputs,
): MonteCarloResult {
  const t0 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  const iterations = Math.min(
    25000,
    Math.max(100, Math.round(inputs.monteCarlo.iterations)),
  );
  const costVol = Math.max(0, inputs.monteCarlo.constructionCostVolPct) / 100;
  const priceVol = Math.max(0, inputs.monteCarlo.salePriceVolPct) / 100;
  const rateVolPct = Math.max(0, inputs.monteCarlo.interestRateVolBps) / 100;
  const delayVol = Math.max(0, inputs.monteCarlo.salesDelayVolMonths);

  // 1. Run exact deterministic base model & RLV calibration
  const baseCf = runCashflowModel(inputs);
  const baseRlv = solveResidualLandValue(inputs, {
    maxIterations: 32,
    tolerancePct: 0.01,
  });

  // Calibrate exact marginal TDC slope per $1 of land price (captures progressive stamp duty,
  // land tax, and debt carry cleanly around RLV)
  const probeDelta = 250_000;
  const probeLand = Math.max(0, baseRlv.rlvAud + probeDelta);
  const baseAtRlv = runCashflowModel({
    ...inputs,
    landPriceAud: baseRlv.rlvAud,
    originalLandCostOverrideAud:
      inputs.originalLandCostOverrideAud !== null
        ? inputs.originalLandCostOverrideAud
        : baseRlv.rlvAud,
  });
  const probeAtRlv = runCashflowModel({
    ...inputs,
    landPriceAud: probeLand,
    originalLandCostOverrideAud:
      inputs.originalLandCostOverrideAud !== null
        ? inputs.originalLandCostOverrideAud
        : probeLand,
  });
  const dTdcPerLand =
    probeDelta > 0
      ? Math.max(
          1.0,
          (probeAtRlv.totalDevelopmentCostAud -
            baseAtRlv.totalDevelopmentCostAud) /
            probeDelta,
        )
      : 1.06;

  const gstLandSlope =
    inputs.gstScheme === 'margin-scheme' &&
    inputs.originalLandCostOverrideAud === null
      ? 1 / 11
      : 0;
  const targetM =
    inputs.targetMetric === 'margin'
      ? Math.max(0, inputs.targetMarginPct) / 100
      : Math.max(0, baseAtRlv.devMarginPct) / 100;

  // Build deterministic Tornado drivers (fast, ~15ms)
  const tornado = buildTornadoSensitivity(inputs, baseRlv.rlvAud);

  // 2. Pre-extract monthly base arrays (extend horizon slightly for positive delay draws)
  const baseH = baseCf.horizonMonths;
  const maxDelay = Math.ceil(delayVol);
  const simH = Math.min(60, baseH + maxDelay);

  const mFixedOutflow = new Float64Array(simH); // land + stampDuty + statutory (non-GST-ITC)
  const mCostScalableNet = new Float64Array(simH); // (earthworks + construction + env + softCosts) net of ITC
  const mHoldingBase = new Float64Array(simH);
  const mGrossSalesBase = new Float64Array(simH);
  const mSellingNetBase = new Float64Array(simH);

  const itcFactor = inputs.gstScheme === 'gst-free' ? 1 : 10 / 11;
  let lastHoldingMonthly = 0;

  for (let m = 0; m < baseH; m++) {
    const row = baseCf.monthly[m];
    mFixedOutflow[m] = row.landAud + row.stampDutyAud + row.statutoryAud;
    mCostScalableNet[m] =
      (row.earthworksAud +
        row.constructionAud +
        row.environmentAud +
        row.softCostsAud) *
      itcFactor;
    mHoldingBase[m] = row.holdingAud;
    if (row.holdingAud > 0) lastHoldingMonthly = row.holdingAud;
    mGrossSalesBase[m] = row.grossSalesAud;
    mSellingNetBase[m] = row.sellingAud * itcFactor;
  }

  const baseGrossSalesTotal = baseCf.grossRealisationAud;
  const originalLandCost =
    inputs.originalLandCostOverrideAud !== null
      ? Math.max(0, inputs.originalLandCostOverrideAud)
      : Math.max(0, inputs.landPriceAud);

  const cs = inputs.capitalStack;
  const seniorEnabled = cs.seniorDebtEnabled;
  const seniorLimitIsLtc = cs.seniorLimitType === 'LTC';
  const seniorMaxFrac = Math.max(0, cs.seniorMaxPct) / 100;
  const baseSeniorRate = Math.max(0, cs.seniorInterestRatePct);
  const seniorLineMo = Math.max(0, cs.seniorLineFeePct) / 100 / 12;
  const seniorEstFrac = Math.max(0, cs.seniorEstablishmentFeePct) / 100;
  const interestCap = cs.interestCapitalised;

  const mezzEnabled = cs.mezzanineEnabled;
  const mezzMaxFrac = Math.max(0, cs.mezzanineMaxPct) / 100;
  const baseMezzRate = Math.max(0, cs.mezzanineInterestRatePct);
  const mezzEstFrac = Math.max(0, cs.mezzanineEstablishmentFeePct) / 100;

  const seedMonthlyIrr =
    baseCf.equityIrrPct !== null
      ? Math.pow(1 + Math.max(-0.9, baseCf.equityIrrPct / 100), 1 / 12) - 1
      : 0.015;

  // Pre-allocated scratch buffers (zero heap allocations inside the 10,000 loop!)
  const opCfBuf = new Float64Array(simH);
  const eqCfBuf = new Float64Array(simH);
  const outRlv = new Float64Array(iterations);
  const outMargin = new Float64Array(iterations);
  const outIrr = new Float64Array(iterations);

  const rand = createMulberry32(inputs.monteCarlo.seed || 20261123);

  let meetsTargetCount = 0;
  let positiveProfitCount = 0;

  // Calibration offset so median draw matches exact solved RLV precisely
  const baseDenom = (1 + targetM) * dTdcPerLand - gstLandSlope;
  const baseFormulaDelta =
    baseDenom > 0.1
      ? (baseCf.netRealisationAud -
          (1 + targetM) * baseCf.totalDevelopmentCostAud) /
        baseDenom
      : 0;
  const baseFormulaRlv = Math.max(0, inputs.landPriceAud + baseFormulaDelta);
  const rlvCalibrationOffset = baseRlv.rlvAud - baseFormulaRlv;

  for (let iter = 0; iter < iterations; iter++) {
    const costMult = 1 + sampleTriangular(rand(), -costVol, 0, costVol);
    const priceMult = 1 + sampleTriangular(rand(), -priceVol, 0, priceVol);
    const rateDeltaPct = sampleTriangular(rand(), -rateVolPct, 0, rateVolPct);
    const delayRaw = sampleTriangular(rand(), -delayVol, 0, delayVol);
    const delayShift = Math.round(delayRaw);

    // Compute total simulated gross sales & exact GST on sales
    const simGrossSales = baseGrossSalesTotal * priceMult;
    let simOutputGst = 0;
    if (inputs.gstScheme === 'margin-scheme') {
      simOutputGst = Math.max(0, (simGrossSales - originalLandCost) / 11);
    } else if (inputs.gstScheme === 'full-gst') {
      simOutputGst = simGrossSales / 11;
    }
    const outputGstRatio =
      simGrossSales > 0 ? simOutputGst / simGrossSales : 0;

    // Build shifted monthly operating cashflows
    let unleveredNetCosts = 0;
    let peakDeficit = 0;
    let runUnlev = 0;

    for (let m = 0; m < simH; m++) {
      opCfBuf[m] = 0;
    }

    // First distribute fixed, scaled construction, and holding costs
    for (let m = 0; m < simH; m++) {
      let holding = mHoldingBase[m];
      if (delayShift > 0 && m >= baseH - 1 && m < baseH - 1 + delayShift) {
        holding += lastHoldingMonthly * 0.5;
      }
      const baseCostM = mFixedOutflow[m] + mCostScalableNet[m] * costMult + holding;
      opCfBuf[m] -= baseCostM;
      unleveredNetCosts += baseCostM;
    }

    // Distribute shifted settlements & selling costs
    for (let m = 0; m < baseH; m++) {
      const gs = mGrossSalesBase[m];
      const sc = mSellingNetBase[m];
      if (gs !== 0 || sc !== 0) {
        let targetMIdx = m + delayShift;
        if (targetMIdx < 0) targetMIdx = 0;
        if (targetMIdx >= simH) targetMIdx = simH - 1;
        const scaledSales = gs * priceMult;
        const netSales = scaledSales * (1 - outputGstRatio);
        const scaledSelling = sc * priceMult;
        opCfBuf[targetMIdx] += netSales - scaledSelling;
        unleveredNetCosts += scaledSelling;
      }
    }

    for (let m = 0; m < simH; m++) {
      runUnlev += opCfBuf[m];
      if (-runUnlev > peakDeficit) peakDeficit = -runUnlev;
    }

    const simNetRealisation = simGrossSales - simOutputGst;

    // Monthly capital stack & capitalised interest simulation
    const seniorMo = Math.max(0, baseSeniorRate + rateDeltaPct) / 100 / 12;
    const mezzMo = Math.max(0, baseMezzRate + rateDeltaPct) / 100 / 12;

    const approxTdc =
      unleveredNetCosts +
      baseCf.costBreakdown.totalFinanceCostsAud *
        (baseSeniorRate > 0
          ? Math.max(0.2, (baseSeniorRate + rateDeltaPct) / baseSeniorRate)
          : 1);

    const seniorLimit = seniorEnabled
      ? seniorLimitIsLtc
        ? approxTdc * seniorMaxFrac
        : simNetRealisation * seniorMaxFrac
      : 0;
    const mezzLimit = mezzEnabled ? approxTdc * mezzMaxFrac : 0;

    let remEq = Math.max(
      0,
      approxTdc - seniorLimit - mezzLimit,
      peakDeficit - seniorLimit - mezzLimit,
    );
    let seniorBal = 0;
    let mezzBal = 0;
    let seniorActive = false;
    let mezzActive = false;
    let totalFinance = 0;

    for (let m = 0; m < simH; m++) {
      const opCf = opCfBuf[m];
      const sInt = seniorBal * seniorMo;
      const sLine =
        seniorActive && seniorLimit > 0
          ? Math.max(0, seniorLimit - seniorBal) * seniorLineMo
          : 0;
      const mInt = mezzBal * mezzMo;
      totalFinance += sInt + sLine + mInt;

      let eqContrib = 0;
      let eqDist = 0;

      if (interestCap) {
        const sCharge = sInt + sLine;
        const sRoom = Math.max(0, seniorLimit - seniorBal);
        const sCap = sCharge < sRoom ? sCharge : sRoom;
        seniorBal += sCap;
        eqContrib += sCharge - sCap;

        const mRoom = Math.max(0, mezzLimit - mezzBal);
        const mCap = mInt < mRoom ? mInt : mRoom;
        mezzBal += mCap;
        eqContrib += mInt - mCap;
      } else {
        eqContrib += sInt + sLine + mInt;
      }

      if (opCf < 0) {
        let deficit = -opCf;
        if (remEq > 0) {
          const used = deficit < remEq ? deficit : remEq;
          eqContrib += used;
          remEq -= used;
          deficit -= used;
        }
        if (deficit > 0 && mezzEnabled && mezzLimit > 0) {
          if (!mezzActive) {
            mezzActive = true;
            const mEst = mezzLimit * mezzEstFrac;
            totalFinance += mEst;
            if (interestCap) {
              const room = Math.max(0, mezzLimit - mezzBal);
              const cap = mEst < room ? mEst : room;
              mezzBal += cap;
              eqContrib += mEst - cap;
            } else {
              eqContrib += mEst;
            }
          }
          const mRoom = Math.max(0, mezzLimit - mezzBal);
          const mDraw = deficit < mRoom ? deficit : mRoom;
          mezzBal += mDraw;
          deficit -= mDraw;
        }
        if (deficit > 0 && seniorEnabled && seniorLimit > 0) {
          if (!seniorActive) {
            seniorActive = true;
            const sEst = seniorLimit * seniorEstFrac;
            totalFinance += sEst;
            if (interestCap) {
              const room = Math.max(0, seniorLimit - seniorBal);
              const cap = sEst < room ? sEst : room;
              seniorBal += cap;
              eqContrib += sEst - cap;
            } else {
              eqContrib += sEst;
            }
          }
          const sRoom = Math.max(0, seniorLimit - seniorBal);
          const sDraw = deficit < sRoom ? deficit : sRoom;
          seniorBal += sDraw;
          deficit -= sDraw;
        }
        if (deficit > 0) {
          eqContrib += deficit;
        }
      } else if (opCf > 0) {
        let surplus = opCf;
        if (seniorBal > 0) {
          const repay = surplus < seniorBal ? surplus : seniorBal;
          seniorBal -= repay;
          surplus -= repay;
        }
        if (mezzBal > 0 && surplus > 0) {
          const repay = surplus < mezzBal ? surplus : mezzBal;
          mezzBal -= repay;
          surplus -= repay;
        }
        eqDist += surplus;
      }

      if (m === simH - 1) {
        if (seniorBal > 1e-6) {
          eqContrib += seniorBal;
          seniorBal = 0;
        }
        if (mezzBal > 1e-6) {
          eqContrib += mezzBal;
          mezzBal = 0;
        }
      }

      eqCfBuf[m] = eqDist - eqContrib;
    }

    const simTdc = unleveredNetCosts + totalFinance;
    const simProfit = simNetRealisation - simTdc;
    const simMarginPct = simTdc > 0 ? (simProfit / simTdc) * 100 : -100;
    const simIrrPct = fastAnnualisedIrr(eqCfBuf, simH, seedMonthlyIrr);

    // Rate & delay adjusted marginal land carry multiplier
    const landCarryAdjust =
      (rateDeltaPct / 100) * (baseH / 24) + (delayRaw / 12) * (baseSeniorRate / 100) * 0.5;
    const effLandSlope = Math.max(1.01, dTdcPerLand + landCarryAdjust);
    const denom = (1 + targetM) * effLandSlope - gstLandSlope;
    const deltaLand =
      denom > 0.1
        ? (simNetRealisation - (1 + targetM) * simTdc) / denom
        : 0;
    const simRlv = Math.max(
      0,
      inputs.landPriceAud + deltaLand + rlvCalibrationOffset,
    );

    outRlv[iter] = simRlv;
    outMargin[iter] = simMarginPct;
    outIrr[iter] = simIrrPct;

    if (simMarginPct >= inputs.targetMarginPct) meetsTargetCount++;
    if (simProfit > 0) positiveProfitCount++;
  }

  const t1 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    iterations,
    elapsedMs: Math.max(1, Math.round(t1 - t0)),
    rlv: computePercentileStats(outRlv),
    devMarginPct: computePercentileStats(outMargin),
    equityIrrPct: computePercentileStats(outIrr),
    probMeetsTargetMarginPct: (meetsTargetCount / iterations) * 100,
    probPositiveProfitPct: (positiveProfitCount / iterations) * 100,
    rlvHistogram: buildHistogram(outRlv, 24),
    tornado,
  };
}
