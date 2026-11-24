import type {
  AustralianState,
  DevelopmentTypology,
  InfrastructureLevyBreakdown,
  LandTaxBreakdown,
  ProgressiveBracket,
  StampDutyBreakdown,
  StateStatutoryPreset,
  StatutoryOverrides,
} from './types';

/**
 * Editable institutional presets for all 8 Australian states and territories.
 * Progressive transfer duty brackets, foreign purchaser surcharges, annual land tax
 * schedules, and state infrastructure contribution defaults (2025/2026 baselines).
 * All rates remain transparently inspectable and user-editable in Feaso OS.
 */
export const AU_STATUTORY_PRESETS: Record<AustralianState, StateStatutoryPreset> = {
  NSW: {
    state: 'NSW',
    name: 'New South Wales',
    capital: 'Sydney',
    revenueOffice: 'Revenue NSW',
    planningAuthority: 'NSW Planning Portal • EP&A Act 1979',
    dutyLabel: 'NSW Transfer Duty (Revenue NSW)',
    levyLabel: 'NSW Housing & Productivity Contribution (HPC) / s7.11',
    landTaxLabel: 'NSW Annual Land Tax (General)',
    dutyBrackets: [
      { min: 0, max: 17000, baseTax: 0, marginalRate: 0.0125 },
      { min: 17000, max: 36000, baseTax: 212.5, marginalRate: 0.015 },
      { min: 36000, max: 97000, baseTax: 497.5, marginalRate: 0.0175 },
      { min: 97000, max: 364000, baseTax: 1565, marginalRate: 0.035 },
      { min: 364000, max: 1212000, baseTax: 10910, marginalRate: 0.045 },
      { min: 1212000, max: null, baseTax: 49070, marginalRate: 0.055 },
    ],
    foreignSurchargeRatePct: 9.0,
    landTaxBrackets: [
      { min: 0, max: 1075000, baseTax: 0, marginalRate: 0 },
      { min: 1075000, max: 6571000, baseTax: 100, marginalRate: 0.016 },
      { min: 6571000, max: null, baseTax: 88036, marginalRate: 0.02 },
    ],
    defaultLevyPerLotAud: 32000,
    defaultLevyPerUnitAud: 18500,
    defaultGaicPerHaAud: 0,
    notes:
      'Commercial/development progressive duty schedule (5.5% marginal above $1.212M); 9% Foreign Surcharge Purchaser Duty; HPC ($12k/lot + local s7.11).',
  },
  VIC: {
    state: 'VIC',
    name: 'Victoria',
    capital: 'Melbourne',
    revenueOffice: 'State Revenue Office Victoria (SRO)',
    planningAuthority: 'VicPlan • Planning & Environment Act 1987',
    dutyLabel: 'VIC Land Transfer Duty (SRO)',
    levyLabel: 'VIC GAIC / Infrastructure Contributions Plan (ICP)',
    landTaxLabel: 'VIC Annual Land Tax (General)',
    dutyBrackets: [
      { min: 0, max: 25000, baseTax: 0, marginalRate: 0.014 },
      { min: 25000, max: 130000, baseTax: 350, marginalRate: 0.024 },
      { min: 130000, max: 960000, baseTax: 2870, marginalRate: 0.06 },
      // Above $960k up to $2M: flat 5.5% of total value (represented via exact bracket continuity at $960k -> $52,800)
      { min: 960000, max: 2000000, baseTax: 52800, marginalRate: 0.055 },
      { min: 2000000, max: null, baseTax: 110000, marginalRate: 0.065 },
    ],
    foreignSurchargeRatePct: 8.0,
    landTaxBrackets: [
      { min: 0, max: 50000, baseTax: 0, marginalRate: 0 },
      { min: 50000, max: 100000, baseTax: 500, marginalRate: 0 },
      { min: 100000, max: 300000, baseTax: 975, marginalRate: 0 },
      { min: 300000, max: 600000, baseTax: 1350, marginalRate: 0.003 },
      { min: 600000, max: 1000000, baseTax: 2250, marginalRate: 0.006 },
      { min: 1000000, max: 1800000, baseTax: 4650, marginalRate: 0.009 },
      { min: 1800000, max: 3000000, baseTax: 11850, marginalRate: 0.0165 },
      { min: 3000000, max: null, baseTax: 31650, marginalRate: 0.0265 },
    ],
    defaultLevyPerLotAud: 24500,
    defaultLevyPerUnitAud: 11500,
    defaultGaicPerHaAud: 138720,
    notes:
      '5.5% ($960k–$2M) stepping to $110k + 6.5% over $2M; 8% Foreign Purchaser Additional Duty (FPAD); optional Growth Areas Infrastructure Contribution (GAIC) per hectare.',
  },
  QLD: {
    state: 'QLD',
    name: 'Queensland',
    capital: 'Brisbane',
    revenueOffice: 'Queensland Revenue Office (QRO)',
    planningAuthority: 'Planning Act 2016 • EDQ PDA',
    dutyLabel: 'QLD Transfer Duty (QRO)',
    levyLabel: 'QLD Infrastructure Charges Notice (ICN)',
    landTaxLabel: 'QLD Annual Land Tax (Companies & Trusts)',
    dutyBrackets: [
      { min: 0, max: 5000, baseTax: 0, marginalRate: 0 },
      { min: 5000, max: 75000, baseTax: 0, marginalRate: 0.015 },
      { min: 75000, max: 540000, baseTax: 1050, marginalRate: 0.035 },
      { min: 540000, max: 1000000, baseTax: 17325, marginalRate: 0.045 },
      { min: 1000000, max: null, baseTax: 38025, marginalRate: 0.0575 },
    ],
    foreignSurchargeRatePct: 8.0,
    landTaxBrackets: [
      { min: 0, max: 350000, baseTax: 0, marginalRate: 0 },
      { min: 350000, max: 2250000, baseTax: 1450, marginalRate: 0.017 },
      { min: 2250000, max: 5000000, baseTax: 33750, marginalRate: 0.015 },
      { min: 5000000, max: 10000000, baseTax: 75000, marginalRate: 0.0225 },
      { min: 10000000, max: null, baseTax: 187500, marginalRate: 0.0275 },
    ],
    defaultLevyPerLotAud: 29500,
    defaultLevyPerUnitAud: 21500,
    defaultGaicPerHaAud: 0,
    notes:
      '$38,025 + 5.75% over $1M; 8% Additional Foreign Acquirer Duty (AFAD); capped statutory Infrastructure Charges Notice per lot/dwelling.',
  },
  WA: {
    state: 'WA',
    name: 'Western Australia',
    capital: 'Perth',
    revenueOffice: 'RevenueWA',
    planningAuthority: 'WAPC • Planning & Development Act 2005',
    dutyLabel: 'WA Transfer Duty (RevenueWA)',
    levyLabel: 'WA DCP / WAPC Headworks & MRIT',
    landTaxLabel: 'WA Annual Land Tax + MRIT',
    dutyBrackets: [
      { min: 0, max: 120000, baseTax: 0, marginalRate: 0.019 },
      { min: 120000, max: 150000, baseTax: 2280, marginalRate: 0.0285 },
      { min: 150000, max: 360000, baseTax: 3135, marginalRate: 0.038 },
      { min: 360000, max: 725000, baseTax: 11115, marginalRate: 0.0475 },
      { min: 725000, max: null, baseTax: 28452.5, marginalRate: 0.0515 },
    ],
    foreignSurchargeRatePct: 7.0,
    landTaxBrackets: [
      { min: 0, max: 300000, baseTax: 0, marginalRate: 0 },
      { min: 300000, max: 420000, baseTax: 300, marginalRate: 0.0014 },
      { min: 420000, max: 1000000, baseTax: 468, marginalRate: 0.0039 },
      { min: 1000000, max: 1800000, baseTax: 2730, marginalRate: 0.0104 },
      { min: 1800000, max: 5000000, baseTax: 11050, marginalRate: 0.0194 },
      { min: 5000000, max: 11000000, baseTax: 73130, marginalRate: 0.0214 },
      { min: 11000000, max: null, baseTax: 201530, marginalRate: 0.0281 },
    ],
    defaultLevyPerLotAud: 18500,
    defaultLevyPerUnitAud: 11000,
    defaultGaicPerHaAud: 0,
    notes:
      '$28,452.50 + 5.15% over $725k; 7% Foreign Transfer Duty; Land Tax includes 0.14% Metropolitan Region Improvement Tax (MRIT) above $300k.',
  },
  SA: {
    state: 'SA',
    name: 'South Australia',
    capital: 'Adelaide',
    revenueOffice: 'RevenueSA',
    planningAuthority: 'PlanSA • Planning & Design Code',
    dutyLabel: 'SA Stamp Duty (RevenueSA — Residential Land)',
    levyLabel: 'PlanSA Open Space & Infrastructure Levy',
    landTaxLabel: 'SA Annual Land Tax (General)',
    dutyBrackets: [
      { min: 0, max: 12000, baseTax: 0, marginalRate: 0.01 },
      { min: 12000, max: 30000, baseTax: 120, marginalRate: 0.02 },
      { min: 30000, max: 50000, baseTax: 480, marginalRate: 0.03 },
      { min: 50000, max: 100000, baseTax: 1080, marginalRate: 0.035 },
      { min: 100000, max: 200000, baseTax: 2830, marginalRate: 0.04 },
      { min: 200000, max: 250000, baseTax: 6830, marginalRate: 0.0425 },
      { min: 250000, max: 300000, baseTax: 8955, marginalRate: 0.0475 },
      { min: 300000, max: 500000, baseTax: 11330, marginalRate: 0.05 },
      { min: 500000, max: null, baseTax: 21330, marginalRate: 0.055 },
    ],
    foreignSurchargeRatePct: 7.0,
    landTaxBrackets: [
      { min: 0, max: 718000, baseTax: 0, marginalRate: 0 },
      { min: 718000, max: 1052000, baseTax: 0, marginalRate: 0.005 },
      { min: 1052000, max: 1578000, baseTax: 1670, marginalRate: 0.01 },
      { min: 1578000, max: 2104000, baseTax: 6930, marginalRate: 0.0165 },
      { min: 2104000, max: 3500000, baseTax: 15609, marginalRate: 0.02 },
      { min: 3500000, max: null, baseTax: 43529, marginalRate: 0.024 },
    ],
    defaultLevyPerLotAud: 14500,
    defaultLevyPerUnitAud: 9500,
    defaultGaicPerHaAud: 0,
    notes:
      'Residential development land ($21,330 + 5.5% over $500k; qualifying commercial land is 0% — use Custom Duty Override if commercial). 7% Foreign Ownership Surcharge.',
  },
  TAS: {
    state: 'TAS',
    name: 'Tasmania',
    capital: 'Hobart',
    revenueOffice: 'State Revenue Office Tasmania',
    planningAuthority: 'Tasmanian Planning Scheme',
    dutyLabel: 'TAS Property Transfer Duty (SRO)',
    levyLabel: 'TasWater & Council Headworks',
    landTaxLabel: 'TAS Annual Land Tax (General)',
    dutyBrackets: [
      { min: 0, max: 3000, baseTax: 50, marginalRate: 0 },
      { min: 3000, max: 25000, baseTax: 50, marginalRate: 0.0175 },
      { min: 25000, max: 75000, baseTax: 435, marginalRate: 0.0225 },
      { min: 75000, max: 200000, baseTax: 1560, marginalRate: 0.035 },
      { min: 200000, max: 375000, baseTax: 5935, marginalRate: 0.04 },
      { min: 375000, max: 725000, baseTax: 12935, marginalRate: 0.0425 },
      { min: 725000, max: null, baseTax: 27810, marginalRate: 0.045 },
    ],
    foreignSurchargeRatePct: 8.0,
    landTaxBrackets: [
      { min: 0, max: 125000, baseTax: 0, marginalRate: 0 },
      { min: 125000, max: 500000, baseTax: 50, marginalRate: 0.0045 },
      { min: 500000, max: null, baseTax: 1737.5, marginalRate: 0.015 },
    ],
    defaultLevyPerLotAud: 13500,
    defaultLevyPerUnitAud: 9000,
    defaultGaicPerHaAud: 0,
    notes:
      '$27,810 + 4.5% over $725k; 8% Foreign Investor Duty Surcharge (residential); TasWater equivalent tenement headworks & council public open space.',
  },
  ACT: {
    state: 'ACT',
    name: 'Australian Capital Territory',
    capital: 'Canberra',
    revenueOffice: 'ACT Revenue Office',
    planningAuthority: 'ACT Territory Plan • EPSDD',
    dutyLabel: 'ACT Conveyance Duty (Commercial / Dev)',
    levyLabel: 'ACT Lease Variation Charge (LVC)',
    landTaxLabel: 'ACT Annual Land Tax / Rates Equivalent',
    dutyBrackets: [
      { min: 0, max: 1900000, baseTax: 0, marginalRate: 0 },
      // ACT commercial duty applies flat 5.0% once consideration exceeds $1.9M threshold
      { min: 1900000, max: null, baseTax: 95000, marginalRate: 0.05 },
    ],
    foreignSurchargeRatePct: 0.0,
    landTaxBrackets: [
      { min: 0, max: 150000, baseTax: 1535, marginalRate: 0.0054 },
      { min: 150000, max: 275000, baseTax: 2345, marginalRate: 0.0064 },
      { min: 275000, max: 2000000, baseTax: 3145, marginalRate: 0.0112 },
      { min: 2000000, max: null, baseTax: 22465, marginalRate: 0.0123 },
    ],
    defaultLevyPerLotAud: 22000,
    defaultLevyPerUnitAud: 18000,
    defaultGaicPerHaAud: 0,
    notes:
      'ACT commercial conveyance duty: 0% up to $1.9M, flat 5.0% above $1.9M (editable for residential schedules); Lease Variation Charge (LVC) per dwelling.',
  },
  NT: {
    state: 'NT',
    name: 'Northern Territory',
    capital: 'Darwin',
    revenueOffice: 'Territory Revenue Office (NT)',
    planningAuthority: 'NT Planning Scheme 2020',
    dutyLabel: 'NT Stamp Duty (Territory Revenue)',
    levyLabel: 'NT Infrastructure Contribution Scheme',
    landTaxLabel: 'NT Annual Land Tax (Nil)',
    dutyBrackets: [
      // Below $525k NT uses quadratic V*(0.06571441*V/1000 + 15)/1000; approximated smoothly via progressive brackets
      { min: 0, max: 200000, baseTax: 0, marginalRate: 0.028 },
      { min: 200000, max: 525000, baseTax: 5600, marginalRate: 0.0564 },
      { min: 525000, max: 3000000, baseTax: 25987.5, marginalRate: 0.0495 },
      { min: 3000000, max: 5000000, baseTax: 172500, marginalRate: 0.0575 },
      { min: 5000000, max: null, baseTax: 297500, marginalRate: 0.0595 },
    ],
    foreignSurchargeRatePct: 0.0,
    landTaxBrackets: [{ min: 0, max: null, baseTax: 0, marginalRate: 0 }],
    defaultLevyPerLotAud: 12000,
    defaultLevyPerUnitAud: 8500,
    defaultGaicPerHaAud: 0,
    notes:
      '4.95% ($525k–$3M), 5.75% ($3M–$5M), 5.95% ($5M+); No Foreign Purchaser Surcharge and No Annual Land Tax in the Northern Territory.',
  },
};

export const AUSTRALIAN_STATE_LIST: AustralianState[] = [
  'NSW',
  'VIC',
  'QLD',
  'WA',
  'SA',
  'TAS',
  'ACT',
  'NT',
];

export function createDefaultStatutoryOverrides(): StatutoryOverrides {
  return {
    customStampDutyRatePct: null,
    customForeignSurchargePct: null,
    customAnnualLandTaxRatePct: null,
    customInfrastructureLevyPerUnitAud: null,
    customInfrastructureLevyLumpSumAud: null,
    applyVicGaic: false,
    vicGaicPerHaAud: null,
  };
}

/**
 * Pure progressive bracket calculator.
 * Finds the active bracket for `value` and computes `baseTax + (value - min) * marginalRate`.
 */
export function calculateProgressiveTax(
  value: number,
  brackets: ProgressiveBracket[],
): number {
  if (!Number.isFinite(value) || value <= 0 || brackets.length === 0) {
    return 0;
  }

  for (let i = brackets.length - 1; i >= 0; i--) {
    const b = brackets[i];
    if (value > b.min || (i === 0 && value >= b.min)) {
      return Math.max(0, b.baseTax + (value - b.min) * b.marginalRate);
    }
  }
  return 0;
}

/**
 * Computes Australian state transfer/stamp duty + optional foreign purchaser surcharge.
 */
export function calculateStampDuty(
  landPriceAud: number,
  state: AustralianState,
  foreignPurchaser: boolean,
  overrides?: Partial<StatutoryOverrides>,
): StampDutyBreakdown {
  const preset = AU_STATUTORY_PRESETS[state];
  const value = Math.max(0, landPriceAud);

  let baseDutyAud = 0;
  let usedCustomRate = false;
  let explanation = '';

  if (
    overrides?.customStampDutyRatePct !== null &&
    overrides?.customStampDutyRatePct !== undefined &&
    Number.isFinite(overrides.customStampDutyRatePct)
  ) {
    baseDutyAud = value * (Math.max(0, overrides.customStampDutyRatePct) / 100);
    usedCustomRate = true;
    explanation = `Custom flat rate override: ${overrides.customStampDutyRatePct.toFixed(2)}% × $${Math.round(value).toLocaleString('en-AU')}`;
  } else {
    // Handle flat-step rules accurately for NT ($525k-$3M flat 4.95%, $3M-$5M flat 5.75%, $5M+ flat 5.95%) and ACT (> $1.9M flat 5.0%)
    if (state === 'NT' && value > 0 && value <= 525000) {
      const v = value / 1000;
      baseDutyAud = (0.06571441 * v * v + 15 * v);
      explanation = `NT statutory formula: (0.06571441 × V² + 15 × V) where V = ${(v).toFixed(1)}`;
    } else if (state === 'NT' && value > 525000) {
      const rate = value > 5000000 ? 0.0595 : value > 3000000 ? 0.0575 : 0.0495;
      baseDutyAud = value * rate;
      explanation = `NT flat bracket rate ${(rate * 100).toFixed(2)}% on full dutiable value`;
    } else if (state === 'ACT' && value > 1900000) {
      baseDutyAud = value * 0.05;
      explanation = `ACT commercial conveyance duty: flat 5.00% above $1.90M threshold`;
    } else if (state === 'VIC' && value > 960000 && value <= 2000000) {
      baseDutyAud = value * 0.055;
      explanation = `VIC SRO flat 5.50% bracket ($960k–$2.00M)`;
    } else {
      baseDutyAud = calculateProgressiveTax(value, preset.dutyBrackets);
      explanation = `${preset.dutyLabel} progressive schedule (${preset.revenueOffice})`;
    }
  }

  const foreignRatePct =
    overrides?.customForeignSurchargePct !== null &&
    overrides?.customForeignSurchargePct !== undefined &&
    Number.isFinite(overrides.customForeignSurchargePct)
      ? Math.max(0, overrides.customForeignSurchargePct)
      : preset.foreignSurchargeRatePct;

  const foreignSurchargeAud = foreignPurchaser
    ? value * (foreignRatePct / 100)
    : 0;

  const totalDutyAud = baseDutyAud + foreignSurchargeAud;
  const effectiveRatePct = value > 0 ? (totalDutyAud / value) * 100 : 0;

  if (foreignPurchaser && foreignRatePct > 0) {
    explanation += ` + ${foreignRatePct.toFixed(1)}% Foreign Purchaser Surcharge`;
  }

  return {
    state,
    dutiableValueAud: value,
    baseDutyAud,
    foreignSurchargeAud,
    totalDutyAud,
    effectiveRatePct,
    usedCustomRate,
    explanation,
  };
}

/**
 * Computes annual & monthly state land tax holding cost on unimproved site value.
 */
export function calculateAnnualLandTax(
  unimprovedSiteValueAud: number,
  state: AustralianState,
  overrides?: Partial<StatutoryOverrides>,
): LandTaxBreakdown {
  const preset = AU_STATUTORY_PRESETS[state];
  const taxableValue = Math.max(0, unimprovedSiteValueAud);

  let annualLandTaxAud = 0;
  let usedCustomRate = false;

  if (
    overrides?.customAnnualLandTaxRatePct !== null &&
    overrides?.customAnnualLandTaxRatePct !== undefined &&
    Number.isFinite(overrides.customAnnualLandTaxRatePct)
  ) {
    annualLandTaxAud =
      taxableValue * (Math.max(0, overrides.customAnnualLandTaxRatePct) / 100);
    usedCustomRate = true;
  } else {
    annualLandTaxAud = calculateProgressiveTax(
      taxableValue,
      preset.landTaxBrackets,
    );
  }

  const monthlyLandTaxAud = annualLandTaxAud / 12;
  const effectiveRatePct =
    taxableValue > 0 ? (annualLandTaxAud / taxableValue) * 100 : 0;

  return {
    state,
    taxableLandValueAud: taxableValue,
    annualLandTaxAud,
    monthlyLandTaxAud,
    effectiveRatePct,
    usedCustomRate,
  };
}

/**
 * Computes state & local statutory infrastructure contributions (NSW HPC/s7.11,
 * VIC GAIC/ICP, QLD ICN, WA DCP, SA PlanSA, TAS Headworks, ACT LVC, NT Scheme).
 */
export function calculateInfrastructureLevy(
  state: AustralianState,
  totalLotsOrUnits: number,
  grossAreaSqm: number,
  typology: DevelopmentTypology,
  overrides?: Partial<StatutoryOverrides>,
): InfrastructureLevyBreakdown {
  const preset = AU_STATUTORY_PRESETS[state];
  const units = Math.max(0, totalLotsOrUnits);
  const grossHa = Math.max(0, grossAreaSqm) / 10000;

  if (
    overrides?.customInfrastructureLevyLumpSumAud !== null &&
    overrides?.customInfrastructureLevyLumpSumAud !== undefined &&
    Number.isFinite(overrides.customInfrastructureLevyLumpSumAud)
  ) {
    const lump = Math.max(0, overrides.customInfrastructureLevyLumpSumAud);
    return {
      state,
      levyLabel: preset.levyLabel,
      baseLevyAud: lump,
      gaicAud: 0,
      totalLevyAud: lump,
      perUnitEffectiveAud: units > 0 ? lump / units : 0,
      explanation: `Custom lump sum override ($${Math.round(lump).toLocaleString('en-AU')})`,
    };
  }

  const defaultPerUnit =
    typology === 'greenfield-subdivision'
      ? preset.defaultLevyPerLotAud
      : preset.defaultLevyPerUnitAud;

  const perUnitRate =
    overrides?.customInfrastructureLevyPerUnitAud !== null &&
    overrides?.customInfrastructureLevyPerUnitAud !== undefined &&
    Number.isFinite(overrides.customInfrastructureLevyPerUnitAud)
      ? Math.max(0, overrides.customInfrastructureLevyPerUnitAud)
      : defaultPerUnit;

  const baseLevyAud = units * perUnitRate;

  const shouldApplyGaic =
    state === 'VIC' &&
    (overrides?.applyVicGaic ?? typology === 'greenfield-subdivision');

  const gaicRatePerHa =
    overrides?.vicGaicPerHaAud !== null &&
    overrides?.vicGaicPerHaAud !== undefined &&
    Number.isFinite(overrides.vicGaicPerHaAud)
      ? Math.max(0, overrides.vicGaicPerHaAud)
      : preset.defaultGaicPerHaAud;

  const gaicAud = shouldApplyGaic ? grossHa * gaicRatePerHa : 0;
  const totalLevyAud = baseLevyAud + gaicAud;

  const parts = [
    `${units} ${typology === 'greenfield-subdivision' ? 'lots' : 'dwellings'} × $${Math.round(perUnitRate).toLocaleString('en-AU')}`,
  ];
  if (gaicAud > 0) {
    parts.push(
      `VIC GAIC ${grossHa.toFixed(2)} ha × $${Math.round(gaicRatePerHa).toLocaleString('en-AU')}/ha`,
    );
  }

  return {
    state,
    levyLabel: preset.levyLabel,
    baseLevyAud,
    gaicAud,
    totalLevyAud,
    perUnitEffectiveAud: units > 0 ? totalLevyAud / units : 0,
    explanation: parts.join(' + '),
  };
}
