// Client-side mirror of backend/lambda/common/solarFormulas.js.
// Powers the instant "live estimate" (State 1). The audited numbers returned by
// the Lambda are authoritative; keep these constants in sync with the backend.

export const ROOF_TYPES = {
  'Concrete Flat': 100,
  'Sloped Concrete': 90,
  'Metal Sheet': 85,
  Tiled: 95,
};

// [display name, annual kWh per kW]
const CITIES = [
  ['Bhopal, MP', 1440], ['Indore, MP', 1450], ['Jabalpur, MP', 1420],
  ['Delhi, DL', 1400], ['Noida, UP', 1400], ['Gurugram, HR', 1400],
  ['Jaipur, RJ', 1520], ['Jodhpur, RJ', 1580], ['Udaipur, RJ', 1500],
  ['Ahmedabad, GJ', 1520], ['Surat, GJ', 1480], ['Vadodara, GJ', 1490], ['Rajkot, GJ', 1530],
  ['Mumbai, MH', 1350], ['Pune, MH', 1450], ['Nagpur, MH', 1470], ['Nashik, MH', 1460],
  ['Hyderabad, TS', 1480], ['Bengaluru, KA', 1470],
  ['Chennai, TN', 1450], ['Coimbatore, TN', 1480], ['Madurai, TN', 1500],
  ['Kochi, KL', 1330], ['Thiruvananthapuram, KL', 1350],
  ['Kolkata, WB', 1300], ['Bhubaneswar, OD', 1380],
  ['Patna, BR', 1350], ['Ranchi, JH', 1380],
  ['Lucknow, UP', 1380], ['Kanpur, UP', 1390], ['Varanasi, UP', 1370],
  ['Chandigarh, CH', 1380], ['Ludhiana, PB', 1390], ['Amritsar, PB', 1380],
  ['Dehradun, UK', 1330], ['Raipur, CG', 1420], ['Guwahati, AS', 1250],
  ['Visakhapatnam, AP', 1450], ['Vijayawada, AP', 1470],
];

export const CITY_OPTIONS = CITIES.map(([name]) => name);
const YIELDS = Object.fromEntries(CITIES.map(([n, y]) => [n.split(',')[0].toLowerCase(), y]));
const DEFAULT_YIELD = 1400;

const TARIFF = 7.5;
const OFFSET_TARGET = 0.8;
const EMISSION = 0.82;
const COST_LOW = 50000;
const COST_HIGH = 58000;

export const BILL_LIMITS = { min: 300, max: 500000 };

const round = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

export const inr = (n) => Number(Math.round(n)).toLocaleString('en-IN');

function subsidy(kw) {
  const first = Math.min(kw, 2) * 30000;
  const third = kw > 2 ? Math.min(kw - 2, 1) * 18000 : 0;
  return Math.min(Math.round(first + third), 78000);
}

/** Returns null when the inputs are not yet valid. */
export function estimateLocally({ monthlyBill, location, roofType, sanctionedLoadKW }) {
  const bill = Number(monthlyBill);
  if (!Number.isFinite(bill) || bill < BILL_LIMITS.min || bill > BILL_LIMITS.max) return null;
  if (!location || !location.trim()) return null;

  const yieldPerKw = YIELDS[location.split(',')[0].trim().toLowerCase()] || DEFAULT_YIELD;
  const areaPerKw = ROOF_TYPES[roofType] || ROOF_TYPES['Concrete Flat'];
  const load = Number(sanctionedLoadKW);
  const hasLoad = Number.isFinite(load) && load > 0;

  const annualConsumed = (bill / TARIFF) * 12;
  let rawKw = (annualConsumed * OFFSET_TARGET) / yieldPerKw;
  const cappedBySanctionedLoad = hasLoad && rawKw > load;
  if (cappedBySanctionedLoad) rawKw = load;
  const kw = round(Math.min(Math.max(rawKw, 1), 10), 1);

  const units = Math.round(kw * yieldPerKw);
  const carbon = Math.floor(units * EMISSION);
  const monthlySavings = Math.round(Math.min((units * TARIFF) / 12, bill));
  const costLowInr = Math.round(kw * COST_LOW);
  const costHighInr = Math.round(kw * COST_HIGH);
  const subsidyInr = subsidy(kw);
  const annualSavings = monthlySavings * 12;

  return {
    deterministicMetrics: {
      recommendedCapacityKW: kw,
      requiredRoofAreaSqFt: Math.round(kw * areaPerKw),
      estimatedAnnualUnitsKWh: units,
      annualCarbonOffsetKg: carbon,
      estimatedMonthlySavingsInr: monthlySavings,
    },
    financials: {
      offsetPercent: Math.round(Math.min((units / annualConsumed) * 100, 100)),
      costLowInr,
      costHighInr,
      subsidyInr,
      paybackYearsMin: round(Math.max(costLowInr - subsidyInr, 0) / annualSavings, 1),
      paybackYearsMax: round(Math.max(costHighInr - subsidyInr, 0) / annualSavings, 1),
      equivalentTrees: Math.round(carbon / 21),
      cappedBySanctionedLoad,
    },
  };
}
