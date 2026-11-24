import type { GstCalculationResult, GstScheme } from './types';

/**
 * Pure Australian ATO GST Engine for Property Development Feasibility.
 *
 * Supported regimes:
 * - 'margin-scheme': Output GST = max(0, (Gross Sales - Original Land Cost) / 11)
 *                    Input Tax Credits (ITCs) = GST-inclusive eligible outflows / 11
 * - 'full-gst':      Output GST = Gross Sales / 11
 *                    Input Tax Credits (ITCs) = GST-inclusive eligible outflows / 11
 * - 'gst-free':      Output GST = 0, ITCs = 0 (Exempt / GST-Free supply basis)
 *
 * Note: Under Australian GST law, Stamp Duty, Land Tax, Council Statutory Levies,
 * and Financial Supplies (Interest / Finance Fees) are GST-exempt / input-taxed
 * and therefore excluded from `gstEligibleGrossCostsAud`.
 */
export function calculateGstSummary(params: {
  scheme: GstScheme;
  grossSalesInclGstAud: number;
  originalLandCostAud: number;
  gstEligibleGrossCostsAud: number;
}): GstCalculationResult {
  const grossSales = Math.max(0, params.grossSalesInclGstAud);
  const originalLand = Math.max(0, params.originalLandCostAud);
  const eligibleCosts = Math.max(0, params.gstEligibleGrossCostsAud);

  if (params.scheme === 'gst-free') {
    return {
      scheme: 'gst-free',
      grossSalesInclGstAud: grossSales,
      originalLandCostAud: originalLand,
      gstMarginBaseAud: 0,
      gstOnSalesAud: 0,
      gstEligibleGrossCostsAud: eligibleCosts,
      inputTaxCreditsAud: 0,
      netGstPayableAud: 0,
      netRealisationExclGstAud: grossSales,
      formulaDescription:
        'GST-Free / Exempt Supply: Output GST = $0; Input Tax Credits = $0',
    };
  }

  const inputTaxCreditsAud = eligibleCosts / 11;

  if (params.scheme === 'margin-scheme') {
    const gstMarginBaseAud = Math.max(0, grossSales - originalLand);
    const gstOnSalesAud = gstMarginBaseAud / 11;
    const netGstPayableAud = gstOnSalesAud - inputTaxCreditsAud;
    const netRealisationExclGstAud = grossSales - gstOnSalesAud;

    return {
      scheme: 'margin-scheme',
      grossSalesInclGstAud: grossSales,
      originalLandCostAud: originalLand,
      gstMarginBaseAud,
      gstOnSalesAud,
      gstEligibleGrossCostsAud: eligibleCosts,
      inputTaxCreditsAud,
      netGstPayableAud,
      netRealisationExclGstAud,
      formulaDescription:
        'Margin Scheme (Div 75): Output GST = max(0, Gross Sales − Original Land) / 11; ITC = Eligible GST-Incl. Costs / 11',
    };
  }

  // Full GST (1/11th of Gross Sales)
  const gstOnSalesAud = grossSales / 11;
  const netGstPayableAud = gstOnSalesAud - inputTaxCreditsAud;
  const netRealisationExclGstAud = grossSales - gstOnSalesAud;

  return {
    scheme: 'full-gst',
    grossSalesInclGstAud: grossSales,
    originalLandCostAud: originalLand,
    gstMarginBaseAud: grossSales,
    gstOnSalesAud,
    gstEligibleGrossCostsAud: eligibleCosts,
    inputTaxCreditsAud,
    netGstPayableAud,
    netRealisationExclGstAud,
    formulaDescription:
      'Full GST (Div 9): Output GST = Gross Sales / 11; ITC = Eligible GST-Incl. Costs / 11',
  };
}

/**
 * Helper for monthly Input Tax Credit (1/11th on GST-inclusive eligible outflows).
 */
export function calculateMonthlyItc(
  scheme: GstScheme,
  gstEligibleGrossOutflowAud: number,
): number {
  if (scheme === 'gst-free' || gstEligibleGrossOutflowAud <= 0) {
    return 0;
  }
  return gstEligibleGrossOutflowAud / 11;
}
