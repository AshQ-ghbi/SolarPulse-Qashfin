# App Flow

```
[ Visitor lands on SolarPulse (Amplify CDN) ]
                    |
                    v
[ Enters bill amount, location and roof type ]
                    |
                    v
[ Local math engine shows a live estimate instantly ]
                    |
                    v
[ Clicks "Generate solar audit" ]
                    |
                    v
[ POST /api/audit-solar -> Amazon API Gateway -> Lambda ]
                    |
          +---------+---------+
          v                   v
 [ Rate limit exceeded ]  [ Under quota ]
          |                   |
          v                   v
 [ HTTP 429 + Retry-After ] [ Deterministic metrics + Bedrock advisory ]
          |                   |           (fallback advisory on failure)
          v                   v
 [ Banner: cool down ]   [ Dashboard updates with audited numbers ]
                              |
                              v
              [ User opens the AWS architecture drawer ]
```

## State Machine

| State | Name | Description |
| --- | --- | --- |
| 0 | Idle | Form pre-filled with realistic sample defaults (Rs 4,500 bill, Bhopal, Concrete Flat, 5 kW load). |
| 1 | Local calculated | Live estimate cards and financial statement update as the user changes any input. |
| 2 | Evaluating | Skeleton cards animate while Lambda and Bedrock process the request. |
| 3 | Audited | Cards show the authoritative Lambda numbers; the advisory section shows sizing, cost, subsidy, payback and structural guidance, tagged with its source (Bedrock or rule engine) and latency. If inputs change afterwards the advisory is marked stale. |
| 4 | Throttled / error | A banner explains the rate-limit safeguard (with retry time) or the service error; the live estimate stays visible. |
