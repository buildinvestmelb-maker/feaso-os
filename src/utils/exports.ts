import {
  AU_STATUTORY_PRESETS,
  type CashflowResult,
  type FeasibilityInputs,
  type MonteCarloResult,
  type RlvResult,
} from '../engine';
import { formatAud, formatAudCompact, formatPct } from './formatters';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'feaso-os'
  );
}

/**
 * Generates and downloads a complete Monthly Cashflow CSV ledger
 * with project totals reconciliation row.
 */
export function exportMonthlyCashflowCsv(
  inputs: FeasibilityInputs,
  cashflow: CashflowResult,
): void {
  const headers = [
    'Month',
    'Land ($)',
    'Stamp Duty ($)',
    'Earthworks ($)',
    'Construction ($)',
    'Environment ($)',
    'Statutory ($)',
    'Soft Costs ($)',
    'Holding ($)',
    'Selling ($)',
    'Gross Sales ($)',
    'Output GST ($)',
    'ITC Credit ($)',
    'Net Operating CF ($)',
    'Senior Draw ($)',
    'Senior Repay ($)',
    'Senior Interest ($)',
    'Senior Line Fee ($)',
    'Senior Balance ($)',
    'Mezz Draw ($)',
    'Mezz Repay ($)',
    'Mezz Interest ($)',
    'Mezz Balance ($)',
    'Total Debt Balance ($)',
    'Equity Contrib ($)',
    'Equity Dist ($)',
    'Net Equity CF ($)',
    'Cumulative Equity CF ($)',
  ];

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const lines: string[] = [headers.join(',')];
  const totals = new Float64Array(headers.length);

  for (const row of cashflow.monthly) {
    const vals = [
      row.landAud,
      row.stampDutyAud,
      row.earthworksAud,
      row.constructionAud,
      row.environmentAud,
      row.statutoryAud,
      row.softCostsAud,
      row.holdingAud,
      row.sellingAud,
      row.grossSalesAud,
      row.outputGstAud,
      row.itcCreditAud,
      row.netOperatingCfAud,
      row.seniorDrawAud,
      row.seniorRepayAud,
      row.seniorInterestAud,
      row.seniorLineFeeAud,
      row.seniorBalanceAud,
      row.mezzDrawAud,
      row.mezzRepayAud,
      row.mezzInterestAud,
      row.mezzBalanceAud,
      row.totalDebtBalanceAud,
      row.equityContributionAud,
      row.equityDistributionAud,
      row.netEquityCfAud,
      row.cumulativeEquityCfAud,
    ];

    vals.forEach((v, i) => {
      totals[i] += v;
    });

    lines.push([row.label, ...vals.map((v) => round2(v))].join(','));
  }

  // Totals row (leave closing balance columns blank or peak)
  const balanceIndices = new Set([17, 21, 22, 26]);
  const totalRow = [
    'TOTAL',
    ...Array.from({ length: headers.length - 1 }, (_, i) =>
      balanceIndices.has(i) ? '' : round2(totals[i]),
    ),
  ];
  lines.push(totalRow.join(','));

  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerDownload(blob, `${slugify(inputs.projectName)}-monthly-cashflow.csv`);
}

/**
 * Generates an institutional 1-page Lender Summary PDF using jsPDF.
 */
export async function exportLenderSummaryPdf(
  inputs: FeasibilityInputs,
  cashflow: CashflowResult,
  rlv: RlvResult,
  mc: MonteCarloResult | null,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  let y = 38;

  const statePreset = AU_STATUTORY_PRESETS[inputs.state];

  // Header Banner
  doc.setFillColor(16, 20, 26);
  doc.rect(0, 0, pageW, 74, 'F');
  doc.setTextColor(61, 174, 233);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('FEASO-OS  •  INSTITUTIONAL LENDER FEASIBILITY SUMMARY', margin, 26);

  doc.setTextColor(230, 237, 243);
  doc.setFontSize(16);
  doc.text(inputs.projectName, margin, 47);

  doc.setTextColor(147, 161, 178);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${inputs.address || inputs.lga || 'Australia'}  |  ${statePreset.name} (${inputs.state})  |  Parcel: ${inputs.parcelId || 'N/A'}  |  Generated: ${new Date().toISOString().slice(0, 10)}`,
    margin,
    63,
  );

  y = 92;

  // Headline KPI Strip (6 boxes)
  const kpis = [
    {
      label: 'RESIDUAL LAND VALUE',
      val: formatAudCompact(rlv.rlvAud),
      sub: `${formatAud(rlv.rlvPerSqmGrossAud)}/m²`,
    },
    {
      label: 'DEV MARGIN ON COST',
      val: formatPct(cashflow.devMarginPct, 2),
      sub: `Target ${inputs.targetMarginPct.toFixed(1)}%`,
    },
    {
      label: 'EQUITY IRR (P.A.)',
      val: formatPct(cashflow.equityIrrPct, 1),
      sub: `Proj IRR ${formatPct(cashflow.projectIrrPct, 1)}`,
    },
    {
      label: 'PEAK DEBT',
      val: formatAudCompact(cashflow.peakDebtAud),
      sub: `${cashflow.peakLtcPct.toFixed(1)}% LTC`,
    },
    {
      label: 'NET DEV PROFIT',
      val: formatAudCompact(cashflow.netProfitAud),
      sub: `GRV ${formatAudCompact(cashflow.grossRealisationAud)}`,
    },
    {
      label: 'P50 MONTE CARLO RLV',
      val: mc ? formatAudCompact(mc.rlv.p50) : 'Not Run',
      sub: mc
        ? `P10 ${formatAudCompact(mc.rlv.p10)} / P90 ${formatAudCompact(mc.rlv.p90)}`
        : '10,000 runs',
    },
  ];

  const boxGap = 6;
  const boxW = (pageW - margin * 2 - boxGap * 5) / 6;
  kpis.forEach((k, idx) => {
    const x = margin + idx * (boxW + boxGap);
    doc.setFillColor(244, 247, 250);
    doc.setDrawColor(214, 222, 232);
    doc.roundedRect(x, y, boxW, 48, 3, 3, 'FD');

    doc.setTextColor(95, 108, 125);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(k.label, x + 6, y + 13);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(k.val, x + 6, y + 29);

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(k.sub, x + 6, y + 41);
  });

  y += 66;

  // Section helper
  const drawSectionHeader = (title: string) => {
    doc.setFillColor(232, 240, 248);
    doc.rect(margin, y, pageW - margin * 2, 18, 'F');
    doc.setTextColor(15, 41, 66);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, margin + 6, y + 12);
    y += 24;
  };

  const drawRow = (label: string, val: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(bold ? 15 : 51, bold ? 23 : 65, bold ? 42 : 85);
    doc.text(label, margin + 6, y);
    doc.text(val, pageW - margin - 6, y, { align: 'right' });
    doc.setDrawColor(235, 240, 245);
    doc.line(margin, y + 4, pageW - margin, y + 4);
    y += 15;
  };

  // 1. Development Feasibility & Cost Summary
  drawSectionHeader('1. REVENUE, GST & TOTAL DEVELOPMENT COST (AUD)');
  const cb = cashflow.costBreakdown;
  drawRow(
    `Gross Realisation (GRV Incl. GST — ${cashflow.totalLotsOrUnits} lots/units)`,
    formatAud(cashflow.grossRealisationAud),
    true,
  );
  drawRow(
    `Less: Output GST (${cashflow.gst.scheme.toUpperCase()})`,
    `(${formatAud(cashflow.gst.gstOnSalesAud)})`,
  );
  drawRow(
    'Net Realisation (Excl. GST)',
    formatAud(cashflow.netRealisationAud),
    true,
  );
  drawRow('Land Acquisition & Legal Fees', formatAud(cb.landPriceAud + cb.legalAcquisitionAud));
  drawRow(
    `${statePreset.dutyLabel} (${cashflow.stampDuty.effectiveRatePct.toFixed(2)}%)`,
    formatAud(cb.stampDutyAud),
  );
  drawRow(
    `Bulk Earthworks, Spoil & Retaining (${inputs.earthworks.cutM3.toLocaleString()}m³ cut / ${inputs.earthworks.fillM3.toLocaleString()}m³ fill)`,
    formatAud(cb.totalEarthworksGrossAud),
  );
  drawRow(
    'Construction, Car Bays, Roads & Environment (GST-Incl.)',
    formatAud(
      cb.buildingAndCivilConstructionGrossAud +
        cb.carBaysGrossAud +
        cb.roadsGrossAud +
        cb.acousticAllowanceGrossAud +
        cb.balAndFloodGrossAud,
    ),
  );
  drawRow(
    `Professional Fees (${inputs.professionalFeesPct}%), PM (${inputs.projectManagementPct}%) & Contingency (${inputs.contingencyPct}%)`,
    formatAud(
      cb.professionalFeesGrossAud +
        cb.projectManagementGrossAud +
        cb.contingencyGrossAud,
    ),
  );
  drawRow(
    `Statutory Contributions (${statePreset.levyLabel}) + DA`,
    formatAud(cb.infrastructureLeviesAud + cb.daApprovalFeesAud),
  );
  drawRow(
    'Selling, Marketing & Holding Costs (Land Tax & Rates)',
    formatAud(
      cb.agentCommissionGrossAud +
        cb.marketingGrossAud +
        cb.sellingLegalGrossAud +
        cb.landTaxHoldingAud +
        cb.ratesHoldingAud,
    ),
  );
  drawRow(
    'Less: Recoverable Input Tax Credits (1/11th GST-Eligible Costs)',
    `(${formatAud(cb.inputTaxCreditsAud)})`,
  );
  drawRow(
    `Total Finance Costs (Senior ${inputs.capitalStack.seniorInterestRatePct}% + Mezz)`,
    formatAud(cb.totalFinanceCostsAud),
  );
  drawRow(
    'TOTAL DEVELOPMENT COST (TDC, Net of ITCs)',
    formatAud(cashflow.totalDevelopmentCostAud),
    true,
  );
  drawRow(
    'NET DEVELOPMENT PROFIT',
    `${formatAud(cashflow.netProfitAud)} (${formatPct(cashflow.devMarginPct, 2)} MDC)`,
    true,
  );

  y += 10;

  // 2. Capital Stack & JV Waterfall
  drawSectionHeader('2. CAPITAL STACK, FACILITY LIMITS & JV WATERFALL');
  drawRow(
    `Senior Debt Facility (${inputs.capitalStack.seniorLimitType} ${inputs.capitalStack.seniorMaxPct}% • ${inputs.capitalStack.interestCapitalised ? 'Capitalised' : 'Serviced'})`,
    `Limit ${formatAud(cashflow.seniorFacilityLimitAud)}  |  Peak ${formatAud(cashflow.peakSeniorDebtAud)}`,
  );
  if (inputs.capitalStack.mezzanineEnabled) {
    drawRow(
      `Mezzanine Tranche (${inputs.capitalStack.mezzanineMaxPct}% TDC @ ${inputs.capitalStack.mezzanineInterestRatePct}%)`,
      `Limit ${formatAud(cashflow.mezzFacilityLimitAud)}  |  Peak ${formatAud(cashflow.peakMezzDebtAud)}`,
    );
  }
  drawRow(
    'Peak Equity Required / Peak LTC / Peak LVR',
    `${formatAud(cashflow.peakEquityAud)}  |  ${cashflow.peakLtcPct.toFixed(1)}% LTC  |  ${cashflow.peakLvrPct.toFixed(1)}% LVR`,
  );
  if (cashflow.jvWaterfall.enabled) {
    const jv = cashflow.jvWaterfall;
    drawRow(
      `Sponsor (${jv.developerEquitySharePct}%) vs JV Partner (${jv.partnerEquitySharePct}%) — ${jv.preferredIrrHurdlePct}% Pref / ${jv.promoteSplitDeveloperPct}% Promote`,
      `Sponsor IRR ${formatPct(jv.developerIrrPct, 1)} (${jv.developerMoic.toFixed(2)}x)  |  Partner IRR ${formatPct(jv.partnerIrrPct, 1)} (${jv.partnerMoic.toFixed(2)}x)`,
    );
  }

  y += 10;

  // 3. Risk & Monte Carlo Summary
  if (mc) {
    drawSectionHeader(
      `3. MONTE CARLO RISK PROFILE (${mc.iterations.toLocaleString()} ITERATIONS • ${mc.elapsedMs}ms)`,
    );
    drawRow(
      'Residual Land Value (P10 / P50 / P90)',
      `${formatAud(mc.rlv.p10)}  /  ${formatAud(mc.rlv.p50)}  /  ${formatAud(mc.rlv.p90)}`,
      true,
    );
    drawRow(
      'Development Margin % (P10 / P50 / P90)',
      `${formatPct(mc.devMarginPct.p10, 1)}  /  ${formatPct(mc.devMarginPct.p50, 1)}  /  ${formatPct(mc.devMarginPct.p90, 1)}`,
    );
    drawRow(
      'Equity IRR % (P10 / P50 / P90)',
      `${formatPct(mc.equityIrrPct.p10, 1)}  /  ${formatPct(mc.equityIrrPct.p50, 1)}  /  ${formatPct(mc.equityIrrPct.p90, 1)}`,
    );
    drawRow(
      `Probability ≥ Target Margin (${inputs.targetMarginPct}%)  |  Top Deal-Breaker`,
      `${mc.probMeetsTargetMarginPct.toFixed(1)}%  |  ${mc.tornado[0]?.label ?? 'N/A'}`,
    );
  }

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(120, 132, 146);
  doc.text(
    'Generated by feaso-os (devaware-os Australian Feasibility Engine). All figures in AUD. Statutory schedules editable.',
    margin,
    doc.internal.pageSize.getHeight() - 22,
  );

  doc.save(`${slugify(inputs.projectName)}-lender-summary.pdf`);
}
