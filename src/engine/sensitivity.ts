import { runCashflowModel } from './cashflowEngine';
import { solveResidualLandValue } from './rlvSolver';
import type {
  FeasibilityInputs,
  SensitivityCell,
  SensitivityMatrixResult,
  TornadoDriver,
} from './types';

function scaleConstructionCosts(
  inputs: FeasibilityInputs,
  deltaPct: number,
): FeasibilityInputs {
  const mult = Math.max(0.1, 1 + deltaPct / 100);
  return {
    ...inputs,
    stages: inputs.stages.map((s) => ({
      ...s,
      constructionRatePerSqmAud: s.constructionRatePerSqmAud * mult,
      carBayCostAud: s.carBayCostAud * mult,
      roadCostPerMAud: s.roadCostPerMAud * mult,
    })),
    earthworks: {
      ...inputs.earthworks,
      cutRatePerM3Aud: inputs.earthworks.cutRatePerM3Aud * mult,
      fillRatePerM3Aud: inputs.earthworks.fillRatePerM3Aud * mult,
      spoilDisposalRatePerM3Aud:
        inputs.earthworks.spoilDisposalRatePerM3Aud * mult,
      retainingRatePerMAud: inputs.earthworks.retainingRatePerMAud * mult,
      directBulkOverrideAud:
        inputs.earthworks.directBulkOverrideAud !== null
          ? inputs.earthworks.directBulkOverrideAud * mult
          : null,
      directRetainingOverrideAud:
        inputs.earthworks.directRetainingOverrideAud !== null
          ? inputs.earthworks.directRetainingOverrideAud * mult
          : null,
    },
  };
}

function scaleRevenue(
  inputs: FeasibilityInputs,
  deltaPct: number,
): FeasibilityInputs {
  const mult = Math.max(0.1, 1 + deltaPct / 100);
  return {
    ...inputs,
    stages: inputs.stages.map((s) => ({
      ...s,
      avgSalePriceAud: s.avgSalePriceAud * mult,
    })),
  };
}

function shiftInterestRate(
  inputs: FeasibilityInputs,
  deltaBps: number,
): FeasibilityInputs {
  const deltaPct = deltaBps / 100;
  return {
    ...inputs,
    capitalStack: {
      ...inputs.capitalStack,
      seniorInterestRatePct: Math.max(
        0,
        inputs.capitalStack.seniorInterestRatePct + deltaPct,
      ),
      mezzanineInterestRatePct: Math.max(
        0,
        inputs.capitalStack.mezzanineInterestRatePct + deltaPct,
      ),
    },
  };
}

function shiftSalesDelay(
  inputs: FeasibilityInputs,
  deltaMonths: number,
): FeasibilityInputs {
  const shift = Math.round(deltaMonths);
  return {
    ...inputs,
    stages: inputs.stages.map((s) => ({
      ...s,
      settlementLagMonths: Math.max(0, s.settlementLagMonths + shift),
    })),
    horizonMonths: Math.min(60, Math.max(inputs.horizonMonths, inputs.horizonMonths + Math.max(0, shift))),
  };
}

/**
 * Generates a 2D Sensitivity Matrix across Construction Cost Δ% (rows)
 * vs. End Sale Price Δ% (columns), computing exact RLV, Dev Margin %, and Equity IRR %.
 */
export function buildSensitivityMatrix(
  inputs: FeasibilityInputs,
  costDeltasPct: number[] = [-10, -5, 0, 5, 10],
  revenueDeltasPct: number[] = [-10, -5, 0, 5, 10],
): SensitivityMatrixResult {
  const cells: SensitivityCell[][] = costDeltasPct.map((costDeltaPct) =>
    revenueDeltasPct.map((revenueDeltaPct) => {
      const stressed = scaleRevenue(
        scaleConstructionCosts(inputs, costDeltaPct),
        revenueDeltaPct,
      );
      const cf = runCashflowModel(stressed);
      const rlv = solveResidualLandValue(stressed, {
        maxIterations: 28,
        tolerancePct: 0.02,
      });
      return {
        costDeltaPct,
        revenueDeltaPct,
        rlvAud: rlv.rlvAud,
        devMarginPct: cf.devMarginPct,
        equityIrrPct: cf.equityIrrPct,
        netProfitAud: cf.netProfitAud,
      };
    }),
  );

  return {
    costDeltasPct,
    revenueDeltasPct,
    cells,
  };
}

/**
 * Deterministic one-at-a-time Tornado Sensitivity breakdown ranking
 * the top RLV deal-breakers across the 4 primary Monte Carlo risk factors
 * plus Earthworks and Statutory Levies.
 */
export function buildTornadoSensitivity(
  inputs: FeasibilityInputs,
  baseRlvAud?: number,
): TornadoDriver[] {
  const baseRlv =
    baseRlvAud ?? solveResidualLandValue(inputs, { maxIterations: 32 }).rlvAud;

  const mc = inputs.monteCarlo;
  const costVol = Math.max(1, mc.constructionCostVolPct);
  const priceVol = Math.max(1, mc.salePriceVolPct);
  const rateVolBps = Math.max(25, mc.interestRateVolBps);
  const delayVol = Math.max(1, Math.round(mc.salesDelayVolMonths));

  const solve = (mod: FeasibilityInputs) =>
    solveResidualLandValue(mod, { maxIterations: 30, tolerancePct: 0.02 }).rlvAud;

  const drivers: TornadoDriver[] = [];

  const pushDriver = (
    id: string,
    label: string,
    unitLabel: string,
    lowInputLabel: string,
    highInputLabel: string,
    lowRlvAud: number,
    highRlvAud: number,
  ) => {
    const minVal = Math.min(lowRlvAud, highRlvAud);
    const maxVal = Math.max(lowRlvAud, highRlvAud);
    drivers.push({
      id,
      label,
      unitLabel,
      lowInputLabel,
      highInputLabel,
      baseRlvAud: baseRlv,
      lowRlvAud,
      highRlvAud,
      downsideDeltaAud: minVal - baseRlv,
      upsideDeltaAud: maxVal - baseRlv,
      spreadAud: maxVal - minVal,
    });
  };

  // 1. End Sale Price (±priceVol%)
  pushDriver(
    'sale-price',
    'End Sale Price (GRV)',
    `±${priceVol.toFixed(1)}%`,
    `-${priceVol.toFixed(1)}%`,
    `+${priceVol.toFixed(1)}%`,
    solve(scaleRevenue(inputs, -priceVol)),
    solve(scaleRevenue(inputs, priceVol)),
  );

  // 2. Construction & Civil Cost (±costVol%)
  pushDriver(
    'construction-cost',
    'Construction & Civil Cost',
    `±${costVol.toFixed(1)}%`,
    `+${costVol.toFixed(1)}% cost`,
    `-${costVol.toFixed(1)}% cost`,
    solve(scaleConstructionCosts(inputs, costVol)),
    solve(scaleConstructionCosts(inputs, -costVol)),
  );

  // 3. Sales Absorption Delay (±delayVol months)
  pushDriver(
    'sales-delay',
    'Sales Settlement Timing',
    `±${delayVol} mo`,
    `+${delayVol} mo delay`,
    `-${delayVol} mo faster`,
    solve(shiftSalesDelay(inputs, delayVol)),
    solve(shiftSalesDelay(inputs, -delayVol)),
  );

  // 4. Debt Interest Rate (±rateVolBps bps)
  pushDriver(
    'interest-rate',
    'Funding Interest Rate',
    `±${rateVolBps} bps`,
    `+${rateVolBps} bps`,
    `-${rateVolBps} bps`,
    solve(shiftInterestRate(inputs, rateVolBps)),
    solve(shiftInterestRate(inputs, -rateVolBps)),
  );

  // 5. Bulk Earthworks & Spoil (±25%)
  const ewPlus = {
    ...inputs,
    earthworks: {
      ...inputs.earthworks,
      cutRatePerM3Aud: inputs.earthworks.cutRatePerM3Aud * 1.25,
      fillRatePerM3Aud: inputs.earthworks.fillRatePerM3Aud * 1.25,
      spoilDisposalRatePerM3Aud:
        inputs.earthworks.spoilDisposalRatePerM3Aud * 1.25,
      retainingRatePerMAud: inputs.earthworks.retainingRatePerMAud * 1.25,
      directBulkOverrideAud:
        inputs.earthworks.directBulkOverrideAud !== null
          ? inputs.earthworks.directBulkOverrideAud * 1.25
          : null,
      directRetainingOverrideAud:
        inputs.earthworks.directRetainingOverrideAud !== null
          ? inputs.earthworks.directRetainingOverrideAud * 1.25
          : null,
    },
  };
  const ewMinus = {
    ...inputs,
    earthworks: {
      ...inputs.earthworks,
      cutRatePerM3Aud: inputs.earthworks.cutRatePerM3Aud * 0.75,
      fillRatePerM3Aud: inputs.earthworks.fillRatePerM3Aud * 0.75,
      spoilDisposalRatePerM3Aud:
        inputs.earthworks.spoilDisposalRatePerM3Aud * 0.75,
      retainingRatePerMAud: inputs.earthworks.retainingRatePerMAud * 0.75,
      directBulkOverrideAud:
        inputs.earthworks.directBulkOverrideAud !== null
          ? inputs.earthworks.directBulkOverrideAud * 0.75
          : null,
      directRetainingOverrideAud:
        inputs.earthworks.directRetainingOverrideAud !== null
          ? inputs.earthworks.directRetainingOverrideAud * 0.75
          : null,
    },
  };
  pushDriver(
    'earthworks',
    'Earthworks & Retaining',
    '±25%',
    '+25% cost',
    '-25% cost',
    solve(ewPlus),
    solve(ewMinus),
  );

  return drivers.sort((a, b) => b.spreadAud - a.spreadAud);
}
