'use strict';

/**
 * SolarPulse by Qashfin — deterministic calculation core (Phase 1).
 *
 * Pure functions only: no AWS SDK, no I/O, no randomness. Everything here is
 * shared by the Lambda handler (authoritative numbers) and, later, the
 * frontend (instant local estimates), so keep it dependency-free.
 *
 * All assumptions are named constants so judges / reviewers can audit them.
 */

// ---------------------------------------------------------------------------
// Assumptions (documented, India residential rooftop grid-tied)
// ---------------------------------------------------------------------------
const ASSUMPTIONS = Object.freeze({
  // Blended effective residential tariff incl. fixed charges & duty (INR/kWh).
  DEFAULT_TARIFF_INR_PER_KWH: 7.5,
  // Share of current consumption the system is sized to offset.
  TARGET_OFFSET_FRACTION: 0.8,
  // Grid emission factor (kg CO2 per kWh) — CEA-style national baseline.
  GRID_EMISSION_FACTOR_KG_PER_KWH: 0.82,
  // Installed cost band per kW, pre-subsidy (INR/kW).
  COST_PER_KW_LOW_INR: 50000,
  COST_PER_KW_HIGH_INR: 58000,
  // Residential sizing limits (kW).
  MIN_CAPACITY_KW: 1,
  MAX_CAPACITY_KW: 10,
  // PM Surya Ghar: Rs 30,000/kW for first 2 kW, Rs 18,000 for 3rd kW, cap 78,000.
  SUBSIDY_FIRST_2KW_PER_KW_INR: 30000,
  SUBSIDY_THIRD_KW_INR: 18000,
  SUBSIDY_MAX_INR: 78000,
  // Input bounds.
  MIN_BILL_INR: 300,
  MAX_BILL_INR: 500000,
  // Annual performance degradation (informational, used in text only).
  ANNUAL_DEGRADATION: 0.005,
});

// Specific yield: annual kWh generated per installed kW, by city (approximate
// long-term averages for fixed-tilt systems). Lower-cased lookup keys.
const CITY_YIELD_KWH_PER_KW = Object.freeze({
  'bhopal': 1440,
  'indore': 1450,
  'jabalpur': 1420,
  'delhi': 1400,
  'new delhi': 1400,
  'noida': 1400,
  'gurugram': 1400,
  'gurgaon': 1400,
  'jaipur': 1520,
  'jodhpur': 1580,
  'udaipur': 1500,
  'ahmedabad': 1520,
  'surat': 1480,
  'vadodara': 1490,
  'rajkot': 1530,
  'mumbai': 1350,
  'pune': 1450,
  'nagpur': 1470,
  'nashik': 1460,
  'hyderabad': 1480,
  'bengaluru': 1470,
  'bangalore': 1470,
  'chennai': 1450,
  'coimbatore': 1480,
  'madurai': 1500,
  'kochi': 1330,
  'thiruvananthapuram': 1350,
  'kolkata': 1300,
  'bhubaneswar': 1380,
  'patna': 1350,
  'ranchi': 1380,
  'lucknow': 1380,
  'kanpur': 1390,
  'varanasi': 1370,
  'chandigarh': 1380,
  'ludhiana': 1390,
  'amritsar': 1380,
  'dehradun': 1330,
  'raipur': 1420,
  'guwahati': 1250,
  'visakhapatnam': 1450,
  'vijayawada': 1470,
});
const DEFAULT_YIELD_KWH_PER_KW = 1400;

// Roof footprint per kW (sq ft) and mounting notes by roof type.
const ROOF_TYPES = Object.freeze({
  'Concrete Flat': { areaPerKwSqFt: 100, tiltNote: 'elevated tilted structures' },
  'Sloped Concrete': { areaPerKwSqFt: 90, tiltNote: 'flush-to-slope mounting' },
  'Metal Sheet': { areaPerKwSqFt: 85, tiltNote: 'clamp-on rail mounting' },
  'Tiled': { areaPerKwSqFt: 95, tiltNote: 'hook-based mounting under tiles' },
});
const DEFAULT_ROOF_TYPE = 'Concrete Flat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const round = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Indian digit grouping, e.g. 160000 -> "1,60,000". */
function formatInr(n) {
  return Number(round(n)).toLocaleString('en-IN');
}

/** Resolve annual yield (kWh/kW) from a free-text "City, State" string. */
function getYieldForLocation(location) {
  if (typeof location !== 'string') return DEFAULT_YIELD_KWH_PER_KW;
  const city = location.split(',')[0].trim().toLowerCase();
  return CITY_YIELD_KWH_PER_KW[city] || DEFAULT_YIELD_KWH_PER_KW;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
/**
 * Validate and normalise a raw request body.
 * @returns {{ valid: boolean, errors: string[], value?: object }}
 */
function validateInput(raw) {
  const errors = [];
  const body = raw && typeof raw === 'object' ? raw : {};

  const monthlyBill = Number(body.monthlyBill);
  if (!Number.isFinite(monthlyBill)) {
    errors.push('monthlyBill must be a number.');
  } else if (
    monthlyBill < ASSUMPTIONS.MIN_BILL_INR ||
    monthlyBill > ASSUMPTIONS.MAX_BILL_INR
  ) {
    errors.push(
      `monthlyBill must be between ${ASSUMPTIONS.MIN_BILL_INR} and ${ASSUMPTIONS.MAX_BILL_INR} INR.`
    );
  }

  // Strip control chars / markup-ish characters; cap length (prompt-injection hygiene).
  const location =
    typeof body.location === 'string'
      ? body.location.replace(/[^\p{L}\p{N}\s,.\-]/gu, '').trim().slice(0, 60)
      : '';
  if (!location) errors.push('location is required (e.g. "Bhopal, MP").');

  const roofType = ROOF_TYPES[body.roofType] ? body.roofType : DEFAULT_ROOF_TYPE;

  let sanctionedLoadKW = null;
  if (body.sanctionedLoadKW !== undefined && body.sanctionedLoadKW !== null && body.sanctionedLoadKW !== '') {
    const s = Number(body.sanctionedLoadKW);
    if (!Number.isFinite(s) || s <= 0 || s > 100) {
      errors.push('sanctionedLoadKW must be a positive number up to 100.');
    } else {
      sanctionedLoadKW = s;
    }
  }

  if (errors.length) return { valid: false, errors };
  return {
    valid: true,
    errors: [],
    value: { monthlyBill, currency: 'INR', location, roofType, sanctionedLoadKW },
  };
}

// ---------------------------------------------------------------------------
// Core calculations
// ---------------------------------------------------------------------------
/** PM Surya Ghar central subsidy (INR) for a residential system of `kw`. */
function calculateSubsidy(kw) {
  const first = Math.min(kw, 2) * ASSUMPTIONS.SUBSIDY_FIRST_2KW_PER_KW_INR;
  const third = kw > 2 ? Math.min(kw - 2, 1) * ASSUMPTIONS.SUBSIDY_THIRD_KW_INR : 0;
  return Math.min(round(first + third), ASSUMPTIONS.SUBSIDY_MAX_INR);
}

/**
 * Compute every deterministic metric from validated input.
 * @param {{monthlyBill:number, location:string, roofType:string, sanctionedLoadKW:(number|null)}} input
 */
function calculateSolarMetrics(input) {
  const {
    monthlyBill,
    location,
    roofType = DEFAULT_ROOF_TYPE,
    sanctionedLoadKW = null,
  } = input;

  const tariff = ASSUMPTIONS.DEFAULT_TARIFF_INR_PER_KWH;
  const yieldPerKw = getYieldForLocation(location);
  const roof = ROOF_TYPES[roofType] || ROOF_TYPES[DEFAULT_ROOF_TYPE];

  // 1. Consumption estimate.
  const monthlyUnitsKWh = monthlyBill / tariff;
  const annualUnitsConsumedKWh = monthlyUnitsKWh * 12;

  // 2. Capacity sizing: offset target, bounded by load, residential limits.
  let rawKw = (annualUnitsConsumedKWh * ASSUMPTIONS.TARGET_OFFSET_FRACTION) / yieldPerKw;
  let cappedBySanctionedLoad = false;
  if (sanctionedLoadKW && rawKw > sanctionedLoadKW) {
    rawKw = sanctionedLoadKW;
    cappedBySanctionedLoad = true;
  }
  const recommendedCapacityKW = round(
    Math.min(Math.max(rawKw, ASSUMPTIONS.MIN_CAPACITY_KW), ASSUMPTIONS.MAX_CAPACITY_KW),
    1
  );

  // 3. Generation, footprint, carbon, savings.
  const estimatedAnnualUnitsKWh = Math.round(recommendedCapacityKW * yieldPerKw);
  const requiredRoofAreaSqFt = Math.round(recommendedCapacityKW * roof.areaPerKwSqFt);
  const annualCarbonOffsetKg = Math.floor(
    estimatedAnnualUnitsKWh * ASSUMPTIONS.GRID_EMISSION_FACTOR_KG_PER_KWH
  );
  const estimatedMonthlySavingsInr = Math.round(
    Math.min((estimatedAnnualUnitsKWh * tariff) / 12, monthlyBill)
  );
  const offsetPercent = Math.round(
    Math.min((estimatedAnnualUnitsKWh / annualUnitsConsumedKWh) * 100, 100)
  );

  // 4. Financials.
  const costLowInr = Math.round(recommendedCapacityKW * ASSUMPTIONS.COST_PER_KW_LOW_INR);
  const costHighInr = Math.round(recommendedCapacityKW * ASSUMPTIONS.COST_PER_KW_HIGH_INR);
  const subsidyInr = calculateSubsidy(recommendedCapacityKW);
  const annualSavingsInr = estimatedMonthlySavingsInr * 12;
  const paybackYearsMin = round(Math.max(costLowInr - subsidyInr, 0) / annualSavingsInr, 1);
  const paybackYearsMax = round(Math.max(costHighInr - subsidyInr, 0) / annualSavingsInr, 1);
  // Equivalent trees: ~21 kg CO2 absorbed per mature tree per year.
  const equivalentTrees = Math.round(annualCarbonOffsetKg / 21);

  return {
    recommendedCapacityKW,
    requiredRoofAreaSqFt,
    estimatedAnnualUnitsKWh,
    annualCarbonOffsetKg,
    estimatedMonthlySavingsInr,
    // Extended fields used by the advisory prompt / UI cards.
    offsetPercent,
    costLowInr,
    costHighInr,
    subsidyInr,
    paybackYearsMin,
    paybackYearsMax,
    equivalentTrees,
    cappedBySanctionedLoad,
    assumptions: {
      tariffInrPerKWh: tariff,
      yieldKWhPerKwYear: yieldPerKw,
      emissionFactorKgPerKWh: ASSUMPTIONS.GRID_EMISSION_FACTOR_KG_PER_KWH,
      targetOffsetFraction: ASSUMPTIONS.TARGET_OFFSET_FRACTION,
    },
  };
}

/**
 * Rule-based advisory with the same shape Bedrock must return. Used when
 * Bedrock fails, times out, or returns invalid JSON, so the UI never breaks.
 */
function buildFallbackAdvisory(input, m) {
  const roof = ROOF_TYPES[input.roofType] || ROOF_TYPES[DEFAULT_ROOF_TYPE];
  const loadNote = m.cappedBySanctionedLoad
    ? 'sized down to your sanctioned load'
    : 'within typical sanctioned load limits';
  return {
    systemSizingNote: `A ${m.recommendedCapacityKW} kW grid-tied setup offsets ~${m.offsetPercent}% of current consumption, ${loadNote}.`,
    capitalExpenditureEst: `INR ${formatInr(m.costLowInr)} - ${formatInr(m.costHighInr)} (pre-subsidy)`,
    centralSubsidyEligibility:
      m.subsidyInr > 0
        ? `Eligible for PM Surya Ghar scheme benefits up to INR ${formatInr(m.subsidyInr)} for residential rooftops.`
        : 'Check eligibility under the PM Surya Ghar scheme for residential rooftops.',
    paybackTimeframe: `${m.paybackYearsMin} to ${m.paybackYearsMax} Years`,
    structuralGuidance: [
      `Use ${roof.tiltNote} suited to a ${input.roofType} roof and have a structural engineer confirm load capacity.`,
      'Orient panels south-facing at a tilt close to the local latitude, and avoid shading from water tanks or parapets.',
      'Apply through the national rooftop portal and use an empanelled vendor to claim the subsidy.',
    ],
  };
}

module.exports = {
  ASSUMPTIONS,
  ROOF_TYPES,
  DEFAULT_ROOF_TYPE,
  CITY_YIELD_KWH_PER_KW,
  DEFAULT_YIELD_KWH_PER_KW,
  formatInr,
  getYieldForLocation,
  validateInput,
  calculateSubsidy,
  calculateSolarMetrics,
  buildFallbackAdvisory,
};
