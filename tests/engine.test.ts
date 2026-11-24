import { describe, expect, it } from 'vitest';
import {
  AUSTRALIAN_STATE_LIST,
  AU_STATUTORY_PRESETS,
  buildSCurveWeights,
  buildSensitivityMatrix,
  calculateAnnualLandTax,
  calculateGstSummary,
  calculateInfrastructureLevy,
  calculateStampDuty,
  createGreenfieldSubdivisionPreset,
  createMidRiseApartmentsPreset,
  createTownhouseInfillPreset,
  runCashflowModel,
  runMonteCarloSimulation,
  solveResidualLandValue,
} from '../src/engine';

describe('Australian State Statutory Module (auStatutory.ts)', () => {
  it('supports all 8 Australian jurisdictions with distinct progressive transfer duty schedules', () => {
    expect(AUSTRALIAN_STATE_LIST).toHaveLength(8);
    const landValue = 10_000_000;

    const nsw = calculateStampDuty(landValue, 'NSW', false);
    const vic = calculateStampDuty(landValue, 'VIC', false);
    const qld = calculateStampDuty(landValue, 'QLD', false);
    const wa = calculateStampDuty(landValue, 'WA', false);
    const nt = calculateStampDuty(landValue, 'NT', false);

    // NSW: 49,070 + (10,000,000 - 1,212,000) * 0.055 = 532,410
    expect(Math.round(nsw.baseDutyAud)).toBe(532410);
    // VIC: 110,000 + (10,000,000 - 2,000,000) * 0.065 = 630,000
    expect(Math.round(vic.baseDutyAud)).toBe(630000);
    // QLD: 38,025 + (10,000,000 - 1,000,000) * 0.0575 = 555,525
    expect(Math.round(qld.baseDutyAud)).toBe(555525);
    // WA: 28,452.50 + (10,000,000 - 725,000) * 0.0515 = 506,115
    expect(Math.round(wa.baseDutyAud)).toBe(506115);
    // NT: flat 5.95% above $5M = 595,000
    expect(Math.round(nt.baseDutyAud)).toBe(595000);

    // VIC > QLD > NSW > WA at $10M
    expect(vic.totalDutyAud).toBeGreaterThan(qld.totalDutyAud);
    expect(qld.totalDutyAud).toBeGreaterThan(nsw.totalDutyAud);
    expect(nsw.totalDutyAud).toBeGreaterThan(wa.totalDutyAud);
  });

  it('applies state-specific foreign purchaser surcharges accurately', () => {
    const landValue = 5_000_000;
    const nswForeign = calculateStampDuty(landValue, 'NSW', true);
    const vicForeign = calculateStampDuty(landValue, 'VIC', true);
    const ntForeign = calculateStampDuty(landValue, 'NT', true);

    expect(nswForeign.foreignSurchargeAud).toBeCloseTo(landValue * 0.09, 2);
    expect(vicForeign.foreignSurchargeAud).toBeCloseTo(landValue * 0.08, 2);
    expect(ntForeign.foreignSurchargeAud).toBe(0);
  });

  it('computes annual land tax (including $0 in NT) and VIC GAIC vs NSW/QLD/WA levies', () => {
    const ntTax = calculateAnnualLandTax(8_000_000, 'NT');
    const vicTax = calculateAnnualLandTax(8_000_000, 'VIC');
    const nswTax = calculateAnnualLandTax(8_000_000, 'NSW');

    expect(ntTax.annualLandTaxAud).toBe(0);
    expect(vicTax.annualLandTaxAud).toBeGreaterThan(0);
    expect(nswTax.annualLandTaxAud).toBeGreaterThan(0);
    expect(vicTax.monthlyLandTaxAud).toBeCloseTo(vicTax.annualLandTaxAud / 12, 4);

    // State preset switching across NSW, VIC, QLD, WA changes statutory costs & RLV
    const base = createGreenfieldSubdivisionPreset('NSW');
    const resultsByState = (['NSW', 'VIC', 'QLD', 'WA'] as const).map((st) => {
      const mod = {
        ...base,
        state: st,
        statutoryOverrides: {
          ...base.statutoryOverrides,
          applyVicGaic: st === 'VIC',
        },
      };
      const cf = runCashflowModel(mod);
      const rlv = solveResidualLandValue(mod);
      return { state: st, cf, rlv };
    });

    const vicLevy = calculateInfrastructureLevy(
      'VIC',
      82,
      48200,
      'greenfield-subdivision',
      { applyVicGaic: true },
    );
    expect(vicLevy.gaicAud).toBeCloseTo(4.82 * AU_STATUTORY_PRESETS.VIC.defaultGaicPerHaAud, 1);

    // Ensure distinct stamp duty & infrastructure levy outputs across all 4 states
    const dutySet = new Set(resultsByState.map((r) => Math.round(r.cf.stampDuty.totalDutyAud)));
    const levySet = new Set(resultsByState.map((r) => Math.round(r.cf.infrastructureLevy.totalLevyAud)));
    expect(dutySet.size).toBe(4);
    expect(levySet.size).toBe(4);
  });
});

describe('Australian GST Engine (gstEngine.ts)', () => {
  it('computes GST Margin Scheme vs Full GST vs GST-Free to the exact dollar', () => {
    const grossSales = 44_000_000;
    const originalLand = 11_000_000;
    const gstEligibleCosts = 22_000_000;

    const margin = calculateGstSummary({
      scheme: 'margin-scheme',
      grossSalesInclGstAud: grossSales,
      originalLandCostAud: originalLand,
      gstEligibleGrossCostsAud: gstEligibleCosts,
    });

    const full = calculateGstSummary({
      scheme: 'full-gst',
      grossSalesInclGstAud: grossSales,
      originalLandCostAud: originalLand,
      gstEligibleGrossCostsAud: gstEligibleCosts,
    });

    const exempt = calculateGstSummary({
      scheme: 'gst-free',
      grossSalesInclGstAud: grossSales,
      originalLandCostAud: originalLand,
      gstEligibleGrossCostsAud: gstEligibleCosts,
    });

    // Margin scheme output GST = (44M - 11M) / 11 = $3,000,000 exact
    expect(margin.gstOnSalesAud).toBe(3_000_000);
    // Input Tax Credits = 22M / 11 = $2,000,000 exact
    expect(margin.inputTaxCreditsAud).toBe(2_000_000);
    // Net GST Payable = 3M - 2M = $1,000,000 exact
    expect(margin.netGstPayableAud).toBe(1_000_000);
    expect(margin.netRealisationExclGstAud).toBe(41_000_000);

    // Full GST output GST = 44M / 11 = $4,000,000 exact
    expect(full.gstOnSalesAud).toBe(4_000_000);
    expect(full.inputTaxCreditsAud).toBe(2_000_000);
    expect(full.netGstPayableAud).toBe(2_000_000);
    expect(full.netRealisationExclGstAud).toBe(40_000_000);

    // Exact GST savings from Margin Scheme === Original Land / 11 === $1,000,000
    expect(full.gstOnSalesAud - margin.gstOnSalesAud).toBe(originalLand / 11);
    expect(full.netGstPayableAud - margin.netGstPayableAud).toBe(originalLand / 11);

    // GST-free / exempt
    expect(exempt.gstOnSalesAud).toBe(0);
    expect(exempt.inputTaxCreditsAud).toBe(0);
    expect(exempt.netRealisationExclGstAud).toBe(grossSales);
  });

  it('reconciles Margin Scheme vs Full GST inside full cashflow model to exact dollar savings', () => {
    const base = createGreenfieldSubdivisionPreset('NSW');
    // Disable finance so GST delta is isolated cleanly without secondary interest delta
    const unleveredMargin = runCashflowModel({
      ...base,
      gstScheme: 'margin-scheme',
      capitalStack: {
        ...base.capitalStack,
        seniorDebtEnabled: false,
        mezzanineEnabled: false,
      },
    });
    const unleveredFull = runCashflowModel({
      ...base,
      gstScheme: 'full-gst',
      capitalStack: {
        ...base.capitalStack,
        seniorDebtEnabled: false,
        mezzanineEnabled: false,
      },
    });

    const expectedTaxSaving = base.landPriceAud / 11;
    expect(unleveredFull.gst.gstOnSalesAud - unleveredMargin.gst.gstOnSalesAud).toBeCloseTo(
      expectedTaxSaving,
      2,
    );
    expect(unleveredMargin.netProfitAud - unleveredFull.netProfitAud).toBeCloseTo(
      expectedTaxSaving,
      2,
    );
    // Input Tax Credits equal exact 1/11th of GST-eligible costs
    expect(unleveredMargin.gst.inputTaxCreditsAud).toBeCloseTo(
      unleveredMargin.costBreakdown.gstEligibleGrossCostsAud / 11,
      2,
    );
  });
});

describe('Multi-Stage Monthly Cashflow, Capitalised Interest & JV Waterfall (cashflowEngine.ts)', () => {
  it('normalizes S-curve weights strictly to 1.0 across all curve shapes', () => {
    for (const shape of ['standard', 'front-loaded', 'back-loaded'] as const) {
      const weights = buildSCurveWeights(14, shape);
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
      expect(weights.every((w) => w >= 0)).toBe(true);
    }
  });

  it('compounds multi-stage monthly capitalised interest accurately and reconciles equity cashflows to net profit', () => {
    const base = createGreenfieldSubdivisionPreset('NSW');
    const capitalised = runCashflowModel({
      ...base,
      capitalStack: {
        ...base.capitalStack,
        seniorDebtEnabled: true,
        interestCapitalised: true,
      },
    });
    const nonCapitalised = runCashflowModel({
      ...base,
      capitalStack: {
        ...base.capitalStack,
        seniorDebtEnabled: true,
        interestCapitalised: false,
      },
    });

    // Monthly compounding on capitalised interest strictly increases total senior interest
    expect(capitalised.costBreakdown.seniorInterestAud).toBeGreaterThan(
      nonCapitalised.costBreakdown.seniorInterestAud,
    );
    expect(capitalised.peakDebtAud).toBeGreaterThan(0);

    // Check month-by-month interest formula: interest[m] = prevBalance * (r / 12)
    const monthlyRate = base.capitalStack.seniorInterestRatePct / 100 / 12;
    for (let m = 1; m < capitalised.monthly.length; m++) {
      const prevBal = capitalised.monthly[m - 1].seniorBalanceAud;
      const expectedInt = prevBal * monthlyRate;
      expect(capitalised.monthly[m].seniorInterestAud).toBeCloseTo(expectedInt, 4);
    }

    // Strict cash conservation identity: sum(netEquityCf) === netProfitAud
    const sumEquityCf = capitalised.monthly.reduce(
      (acc, r) => acc + r.netEquityCfAud,
      0,
    );
    expect(sumEquityCf).toBeCloseTo(capitalised.netProfitAud, 1);

    // JV Waterfall reconciliation
    const jv = capitalised.jvWaterfall;
    expect(jv.enabled).toBe(true);
    expect(jv.developerContributionAud + jv.partnerContributionAud).toBeCloseTo(
      jv.totalEquityContributedAud,
      1,
    );
    expect(jv.developerTotalDistributionAud + jv.partnerTotalDistributionAud).toBeCloseTo(
      jv.totalEquityDistributedAud,
      1,
    );
    expect(jv.developerNetProfitAud + jv.partnerNetProfitAud).toBeCloseTo(
      capitalised.netProfitAud,
      1,
    );
    // When project IRR exceeds preferred hurdle, sponsor promoted IRR > JV partner IRR
    if (
      capitalised.equityIrrPct !== null &&
      capitalised.equityIrrPct > base.capitalStack.preferredIrrHurdlePct
    ) {
      expect(jv.developerIrrPct!).toBeGreaterThan(jv.partnerIrrPct!);
    }
  });
});

describe('Residual Land Value Goal-Seek Solver (rlvSolver.ts)', () => {
  it('converges so re-feeding computed RLV reproduces exact target margin within 0.05% across all presets', () => {
    const presets = [
      createGreenfieldSubdivisionPreset('NSW'),
      createTownhouseInfillPreset('VIC'),
      createMidRiseApartmentsPreset('QLD'),
    ];

    for (const preset of presets) {
      const targetMargin = preset.targetMarginPct;
      const rlvResult = solveResidualLandValue(preset, {
        targetMetric: 'margin',
        targetMarginPct: targetMargin,
      });

      expect(rlvResult.converged).toBe(true);
      expect(rlvResult.feasible).toBe(true);
      expect(rlvResult.rlvAud).toBeGreaterThan(0);

      // Re-feed solved RLV into cashflow engine
      const verified = runCashflowModel({
        ...preset,
        landPriceAud: rlvResult.rlvAud,
        originalLandCostOverrideAud: rlvResult.rlvAud,
      });

      expect(Math.abs(verified.devMarginPct - targetMargin)).toBeLessThan(0.05);
    }
  });

  it('converges accurately for Target Equity IRR goal-seek', () => {
    const preset = createTownhouseInfillPreset('VIC');
    const targetIrr = 24.0;
    const rlvResult = solveResidualLandValue(preset, {
      targetMetric: 'irr',
      targetIrrPct: targetIrr,
    });

    expect(rlvResult.converged).toBe(true);
    expect(rlvResult.feasible).toBe(true);
    expect(rlvResult.rlvAud).toBeGreaterThan(0);

    const verified = runCashflowModel({
      ...preset,
      landPriceAud: rlvResult.rlvAud,
      originalLandCostOverrideAud: rlvResult.rlvAud,
    });

    expect(verified.equityIrrPct).not.toBeNull();
    expect(Math.abs(verified.equityIrrPct! - targetIrr)).toBeLessThan(0.15);
  });
});

describe('10,000-Run Monte Carlo Risk Simulator & Sensitivity (monteCarlo.ts)', () => {
  it('runs 10,000 iterations in <500ms with strict P10 < P50 < P90 monotonicity', () => {
    const preset = createGreenfieldSubdivisionPreset('NSW');
    const mc = runMonteCarloSimulation(preset);

    expect(mc.iterations).toBe(10000);
    expect(mc.elapsedMs).toBeLessThan(500);

    // Strict P10 < P50 < P90 monotonicity across RLV, Margin %, and Equity IRR %
    expect(mc.rlv.p10).toBeLessThan(mc.rlv.p50);
    expect(mc.rlv.p50).toBeLessThan(mc.rlv.p90);

    expect(mc.devMarginPct.p10).toBeLessThan(mc.devMarginPct.p50);
    expect(mc.devMarginPct.p50).toBeLessThan(mc.devMarginPct.p90);

    expect(mc.equityIrrPct.p10).toBeLessThan(mc.equityIrrPct.p50);
    expect(mc.equityIrrPct.p50).toBeLessThan(mc.equityIrrPct.p90);

    // Histogram sums exactly to 10,000 runs
    const totalCount = mc.rlvHistogram.reduce((acc, b) => acc + b.count, 0);
    expect(totalCount).toBe(10000);

    // Tornado drivers sorted descending by RLV impact spread
    expect(mc.tornado.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < mc.tornado.length; i++) {
      expect(mc.tornado[i - 1].spreadAud).toBeGreaterThanOrEqual(
        mc.tornado[i].spreadAud,
      );
    }
  });

  it('builds a monotonic 2D Cost vs Revenue sensitivity matrix', () => {
    const preset = createGreenfieldSubdivisionPreset('NSW');
    const matrix = buildSensitivityMatrix(preset);
    expect(matrix.cells).toHaveLength(5);
    expect(matrix.cells[0]).toHaveLength(5);

    // Higher revenue at same cost => strictly higher RLV
    expect(matrix.cells[2][4].rlvAud).toBeGreaterThan(matrix.cells[2][0].rlvAud);
    // Higher cost at same revenue => strictly lower RLV
    expect(matrix.cells[4][2].rlvAud).toBeLessThan(matrix.cells[0][2].rlvAud);
  });
});
