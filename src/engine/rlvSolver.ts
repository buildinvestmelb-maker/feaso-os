import { runCashflowModel } from './cashflowEngine';
import type {
  FeasibilityInputs,
  GoalSeekTargetMetric,
  RlvResult,
} from './types';

export interface RlvSolveOptions {
  targetMetric?: GoalSeekTargetMetric;
  targetMarginPct?: number;
  targetIrrPct?: number;
  maxIterations?: number;
  tolerancePct?: number;
}

/**
 * Iterative Residual Land Value (RLV) Goal-Seek Solver.
 * Finds exact land acquisition price reproducing either a Target Development Margin (%)
 * or Target Annualised Equity IRR (%), dynamically accounting for progressive Australian
 * state stamp duty, GST Margin Scheme land cost base, annual land tax, and capitalised interest.
 */
export function solveResidualLandValue(
  inputs: FeasibilityInputs,
  options: RlvSolveOptions = {},
): RlvResult {
  const targetMetric = options.targetMetric ?? inputs.targetMetric;
  const targetValuePct =
    targetMetric === 'margin'
      ? (options.targetMarginPct ?? inputs.targetMarginPct)
      : (options.targetIrrPct ?? inputs.targetIrrPct);
  const maxIterations = options.maxIterations ?? 48;
  const tolerancePct = options.tolerancePct ?? 0.002;

  const evaluateAtLand = (candidateLand: number) => {
    const clampedLand = Math.max(0, candidateLand);
    const res = runCashflowModel({
      ...inputs,
      landPriceAud: clampedLand,
      // Unless user explicitly locked an original historical land cost, Margin Scheme tracks RLV
      originalLandCostOverrideAud:
        inputs.originalLandCostOverrideAud !== null
          ? inputs.originalLandCostOverrideAud
          : clampedLand,
    });
    const metricVal =
      targetMetric === 'margin'
        ? res.devMarginPct
        : (res.equityIrrPct ?? res.projectIrrPct ?? -100);
    return { res, metricVal, error: metricVal - targetValuePct };
  };

  // Evaluate lower bound ($0 land) and upper bound (GRV)
  const atZero = evaluateAtLand(0);
  const grv = Math.max(1_000_000, atZero.res.grossRealisationAud);

  // If even $0 land cannot achieve the target margin/IRR, deal is infeasible at positive RLV
  if (atZero.error < 0) {
    return {
      targetMetric,
      targetValuePct,
      rlvAud: 0,
      rlvPerSqmGrossAud: 0,
      rlvPerSqmNdaAud: 0,
      rlvPerLotOrUnitAud: 0,
      achievedMarginPct: atZero.res.devMarginPct,
      achievedIrrPct: atZero.res.equityIrrPct,
      stampDutyAtRlvAud: 0,
      deltaVsCurrentLandAud: -inputs.landPriceAud,
      iterations: 1,
      converged: true,
      feasible: false,
    };
  }

  let lo = 0;
  let fLo = atZero.error;
  let hi = grv;
  let atHi = evaluateAtLand(hi);
  let fHi = atHi.error;

  // Ensure upper bound brackets below target
  let expandCount = 0;
  while (fHi > 0 && expandCount < 6) {
    hi *= 2;
    atHi = evaluateAtLand(hi);
    fHi = atHi.error;
    expandCount++;
  }

  let bestLand = lo;
  let iterations = 0;
  let converged = false;

  // Hybrid secant / bisection for fast, rock-solid monotonic convergence
  for (let i = 1; i <= maxIterations; i++) {
    iterations = i;

    let candidate: number;
    if (Math.abs(fHi - fLo) > 1e-9 && i % 3 !== 0) {
      // Secant proposal clamped safely inside (lo, hi)
      const secant = lo - (fLo * (hi - lo)) / (fHi - fLo);
      const margin = (hi - lo) * 0.08;
      if (secant > lo + margin && secant < hi - margin) {
        candidate = secant;
      } else {
        candidate = 0.5 * (lo + hi);
      }
    } else {
      candidate = 0.5 * (lo + hi);
    }

    const curr = evaluateAtLand(candidate);
    bestLand = candidate;

    if (Math.abs(curr.error) <= tolerancePct || hi - lo < 1) {
      converged = true;
      break;
    }

    if (curr.error > 0) {
      lo = candidate;
      fLo = curr.error;
    } else {
      hi = candidate;
      fHi = curr.error;
    }
  }

  const rlvAud = Math.round(bestLand);
  const finalCheck = evaluateAtLand(rlvAud);
  const grossArea = Math.max(1, inputs.grossAreaSqm);
  const nda = Math.max(1, inputs.netDevelopableAreaSqm || grossArea);
  const totalLots = Math.max(1, finalCheck.res.totalLotsOrUnits);

  return {
    targetMetric,
    targetValuePct,
    rlvAud,
    rlvPerSqmGrossAud: Math.round(rlvAud / grossArea),
    rlvPerSqmNdaAud: Math.round(rlvAud / nda),
    rlvPerLotOrUnitAud: Math.round(rlvAud / totalLots),
    achievedMarginPct: finalCheck.res.devMarginPct,
    achievedIrrPct: finalCheck.res.equityIrrPct,
    stampDutyAtRlvAud: Math.round(finalCheck.res.stampDuty.totalDutyAud),
    deltaVsCurrentLandAud: rlvAud - inputs.landPriceAud,
    iterations,
    converged: converged || Math.abs(finalCheck.error) <= 0.05,
    feasible: true,
  };
}
