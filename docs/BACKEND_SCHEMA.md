# Backend Schema

## 1. DynamoDB Table: `solarpulse-rate-limits`

- **Partition key:** `client_ip` (String): SHA-256 hash of `salt:clientIp`, never the raw IP.
- **Billing:** pay per request. **TTL attribute:** `ttl_expiry`.
- **Attributes:**
  - `request_count` (Number): requests in the current window.
  - `window_epoch` (Number): Unix timestamp of the window start (fixed 60-second windows).
  - `ttl_expiry` (Number): Unix epoch after which DynamoDB deletes the item (about 60 minutes after the last request).

Counter logic: an atomic conditional `UpdateItem` starts a new window when the item is missing or its window has expired; otherwise `ADD request_count 1` increments it. A request is allowed while `request_count <= 15`.

## 2. API Contract: `POST /api/audit-solar`

### Request

```json
{
  "monthlyBill": 4500,
  "currency": "INR",
  "location": "Bhopal, MP",
  "roofType": "Concrete Flat",
  "sanctionedLoadKW": 5
}
```

| Field | Rules |
| --- | --- |
| `monthlyBill` | number, 300 to 500000 (INR) |
| `location` | required string, sanitized, max 60 characters |
| `roofType` | `Concrete Flat`, `Sloped Concrete`, `Metal Sheet` or `Tiled` (defaults to `Concrete Flat`) |
| `sanctionedLoadKW` | optional number, greater than 0 and up to 100 |

Bodies larger than 2 KB are rejected with HTTP 413.

### Response (HTTP 200)

Values below are illustrative of the shape; real values come from the formulas in `solarFormulas.js`.

```json
{
  "success": true,
  "metadata": {
    "engine": "Amazon Bedrock (Claude Haiku 5.5)",
    "advisorySource": "bedrock",
    "latencyMs": 1180
  },
  "deterministicMetrics": {
    "recommendedCapacityKW": 4,
    "requiredRoofAreaSqFt": 400,
    "estimatedAnnualUnitsKWh": 5760,
    "annualCarbonOffsetKg": 4723,
    "estimatedMonthlySavingsInr": 3600
  },
  "financials": {
    "offsetPercent": 80,
    "costLowInr": 200000,
    "costHighInr": 232000,
    "subsidyInr": 78000,
    "paybackYearsMin": 2.8,
    "paybackYearsMax": 3.6,
    "equivalentTrees": 225
  },
  "assumptions": {
    "tariffInrPerKWh": 7.5,
    "yieldKWhPerKwYear": 1440,
    "emissionFactorKgPerKWh": 0.82,
    "targetOffsetFraction": 0.8
  },
  "strategicAdvisory": {
    "systemSizingNote": "A 4 kW grid-tied setup offsets about 80% of current consumption.",
    "capitalExpenditureEst": "INR 2,00,000 - 2,32,000 (pre-subsidy)",
    "centralSubsidyEligibility": "Eligible for PM Surya Ghar scheme benefits up to INR 78,000.",
    "paybackTimeframe": "2.8 to 3.6 Years",
    "structuralGuidance": [
      "Use non-penetrating mounting to protect flat concrete roof waterproofing.",
      "Orient panels south-facing at a tilt close to local latitude.",
      "Confirm roof load capacity with a structural engineer."
    ]
  }
}
```

`metadata.advisorySource` is `"bedrock"` or `"fallback"`. When it is `"fallback"`, `metadata.engine` is `"SolarPulse rule engine (fallback)"`.

### Error responses

| Status | `error` | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Missing body or invalid JSON |
| 400 | `VALIDATION_FAILED` | Field errors listed in `details` |
| 413 | `BAD_REQUEST` | Body over 2 KB |
| 429 | `RATE_LIMITED` | Over 15 requests per minute; includes `retryAfterSec` and a `Retry-After` header |
