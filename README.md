## SolarPulse : Qashfin

<div align="center">

[![Live App Demo](https://img.shields.io/badge/🌐_Live_App_Demo-Visit_SolarPulse-2563eb?style=for-the-badge)](https://main.d1x9ve942jhft3.amplifyapp.com/)
[![YouTube Demo Video](https://img.shields.io/badge/▶️_YouTube_Demo_Video-Watch_Walkthrough-red?style=for-the-badge)](https://youtu.be/YOUR_DEMO_VIDEO_ID)
[![GitHub Repository](https://img.shields.io/badge/📦_GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/AshQ-ghbi/SolarPulse-Qashfin)

</div>

<br />

Rooftop solar adoption and carbon mitigation intelligence, built for the **Bharat Builds Tour, Track 03: Waste and Energy**.

Enter a monthly power bill, a city and a roof type. SolarPulse returns a recommended system size, roof footprint, annual generation, CO2 offset, monthly savings, PM Surya Ghar subsidy, payback range and an engineering-style advisory written by Amazon Bedrock.

---

## UI & Application Walkthrough

### 1. Landing & Feasibility Overview
Instant rooftop solar feasibility discovery without invasive lead forms or sales pitches.

![SolarPulse Hero & Feasibility Discovery](docs/SolarPulse%20i.png)

---

### 2. Deterministic Audit & Financial Engineering
Separation of deterministic math from generative advice: exact kW sizing, roof footprint, carbon offsets, and PM Surya Ghar central subsidy calculations processed directly in Lambda.

![SolarPulse Rooftop Input and Lambda Audit](docs/SolarPulse%20ii.png)

---

### 3. AI Engineering Advisory (Amazon Bedrock)
Contextual installation advice, mounting recommendations based on roof type, tilt calculations, and grid interconnection guidance synthesized by Amazon Bedrock with a sub-3s response time.

![SolarPulse Amazon Bedrock Advisory](docs/SolarPulse%20iii.png)

---

## Key Features & Highlights

- **Deterministic Math Engine:** Pure engineering equations (`solarFormulas.js`) calculate panel capacity, generation yields, and payback ranges to prevent LLM mathematical hallucinations.
- **Privacy-First (Zero PII):** No names, phone numbers, email addresses, or exact street locations are collected.
- **Anonymous Rate Limiting:** SHA-256 salted IP hashing stored in Amazon DynamoDB with a 60-minute automatic TTL window to prevent API abuse.
- **Graceful Fault Tolerance:** High-availability architecture with an automated in-memory rule engine fallback if upstream AI inference spikes in latency.
- **PM Surya Ghar Scheme Integration:** Built-in central subsidy tiers (up to ₹78,000) modeled directly into the financial statement.

---


## Architecture

```
Browser (React + Tailwind)  ->  AWS Amplify Hosting (CDN, Git CI/CD)
        |
        v  POST /api/audit-solar
Amazon API Gateway (HTTP API, CORS, throttling)
        |
        v
AWS Lambda (Node.js 24)
   |-- DynamoDB: per-IP rate limit (15 req/min, hashed IPs, TTL)
   |-- Deterministic solar math (solarFormulas.js)
   '-- Amazon Bedrock: Claude Haiku 5.5 advisory (falls back to a rule engine on failure)
```

Numbers always come from deterministic code. The model only writes the qualitative advisory and is told not to change any figure.

## Repository layout

```
.github/workflows/deploy.yml   CI: frontend build check + SAM deploy
amplify.yml                    Amplify build spec (appRoot: frontend)
backend/
  template.yaml, samconfig.toml
  lambda/common/               solarFormulas.js, promptTemplates.js
  lambda/audit-handler/        index.js (API handler), package.json
frontend/                      Vite + React + Tailwind app
docs/                          PRD, TRD, app flow, design brief, schema, plan, privacy
```

## Prerequisites

- Node.js 20+ (the Lambda runs on Node.js 24)
- AWS account, AWS CLI configured, [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Amazon Bedrock access to **Anthropic Claude Haiku 5.5** in your chosen region (the stack calls it through the `global.anthropic.claude-haiku-5-5` inference profile; Claude 3 Haiku reached end-of-life on Bedrock on September 10, 2026) (default `us-east-1`). Without it the API still works but returns the rule-based fallback advisory (`metadata.advisorySource: "fallback"`).

## 1. Deploy the backend

```bash
cd backend
sam build
sam deploy --guided   # first time; or `sam deploy` to use samconfig.toml
```

Useful parameters (`--parameter-overrides`):

| Parameter | Default | Notes |
| --- | --- | --- |
| `AllowedOrigin` | `*` | Set to your Amplify URL once known |
| `IpHashSalt` | placeholder | Set a long random value |
| `RateLimitMax` | `15` | Requests per window per client IP |
| `RateLimitWindowSec` | `60` | Window length |

The stack outputs `ApiBaseUrl` and `AuditEndpoint`. Smoke test:

```bash
curl -s -X POST "$AUDIT_ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d '{"monthlyBill":4500,"currency":"INR","location":"Bhopal, MP","roofType":"Concrete Flat","sanctionedLoadKW":5}'
```

## 2. Run the frontend locally

```bash
cp .env.example .env     # set VITE_API_BASE_URL to the ApiBaseUrl output
cd frontend
npm install
npm run dev
```

Without `VITE_API_BASE_URL` the live estimate still works and the audit button reports that the service is not connected.

## 3. Deploy the frontend on AWS Amplify

1. Push this repo to GitHub.
2. In the Amplify console choose **Host web app**, connect the GitHub repo and the `main` branch. Amplify detects `amplify.yml` (monorepo, `appRoot: frontend`).
3. Add two environment variables: `VITE_API_BASE_URL` (the `ApiBaseUrl` stack output) and `AMPLIFY_MONOREPO_APP_ROOT` set to `frontend` (required because `amplify.yml` uses `appRoot`).
4. Deploy, then copy the Amplify URL back into the backend's `AllowedOrigin` parameter and redeploy the backend.

## 4. CI/CD with GitHub Actions (optional)

`.github/workflows/deploy.yml` builds the frontend and deploys the SAM stack on pushes to `main` that touch `backend/` or `frontend/`. It uses GitHub OIDC, so no AWS keys are stored.

Create an IAM role that trusts GitHub's OIDC provider for this repo and can deploy CloudFormation, Lambda, API Gateway, DynamoDB, IAM and S3 resources, then set:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `AWS_ROLE_ARN` | ARN of the role |
| Secret | `IP_HASH_SALT` | Long random string |
| Variable | `AWS_REGION` | e.g. `us-east-1` |
| Variable | `ALLOWED_ORIGIN` | Your Amplify URL |

## Model assumptions

Estimates are indicative. Defaults: tariff Rs 7.5/kWh, 80% bill offset target, 0.82 kg CO2/kWh grid factor, installed cost Rs 50,000 to 58,000 per kW, PM Surya Ghar subsidy of Rs 30,000/kW for the first 2 kW plus Rs 18,000 for the third kW (cap Rs 78,000), and city-level solar yields. All constants live in `backend/lambda/common/solarFormulas.js` and are mirrored in `frontend/src/lib/localEstimate.js`; keep the two in sync.

## Documentation

See [`docs/`](docs/): [PRD](docs/PRD.md), [TRD](docs/TRD.md), [App flow](docs/APP_FLOW.md), [Design brief](docs/DESIGN_BRIEF.md), [Backend schema](docs/BACKEND_SCHEMA.md), [Implementation plan](docs/IMPLEMENTATION_PLAN.md), [Privacy policy](docs/PRIVACY_POLICY.md).

## License

MIT. See [LICENSE](LICENSE).
