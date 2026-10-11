# Implementation Plan

## Build Windows

| Build Window | Focus Area | Deliverables |
| --- | --- | --- |
| Hour 1:00 - 1:30 | Environment and logic spec | Local formulas and Bedrock inference prompts finalized. |
| Hour 1:30 - 3:00 | Serverless backend and infrastructure | Lambda handler, Bedrock invocation client, API Gateway routes and CORS setup. |
| Hour 3:00 - 4:45 | Editorial frontend development | React dashboard, Tailwind off-white theme and dynamic result cards. |
| Hour 4:45 - 5:30 | Amplify deployment and end-to-end testing | Live deployment on AWS Amplify, custom headers and cross-browser testing. |
| Hour 5:30 - 6:30 | Demo video and repository wrap-up | Screen recording, live test run and architecture walkthrough video. |

## Phased Execution

| Phase | Output | Status |
| --- | --- | --- |
| 1. Core calculation engine and Bedrock prompt spec | `backend/lambda/common/*` | Done |
| 2. Serverless Lambda and API Gateway plumbing | `backend/lambda/audit-handler/*`, `template.yaml`, `samconfig.toml` | Done |
| 3. Editorial frontend (Vite, React, Tailwind) | `frontend/*`, `.env.example` | Done |
| 4. Deployment, CI/CD and docs | `.github/workflows/deploy.yml`, `amplify.yml`, `README.md`, `docs/*`, `LICENSE`, `.gitignore` | Done (demo script pending) |

## Deployment Checklist

1. Enable Bedrock access to Claude Haiku 5.5 in the target region.
2. `cd backend && sam build && sam deploy --guided`; note `ApiBaseUrl`.
3. Push the repo to GitHub; connect it in AWS Amplify; set `VITE_API_BASE_URL`.
4. Redeploy the backend with `AllowedOrigin` set to the Amplify URL and a real `IpHashSalt`.
5. Smoke test the endpoint with `curl`, then run an audit in the live UI and check the architecture drawer shows `bedrock` as the advisory source.
6. Exercise the rate limit (16 rapid requests) and confirm the 429 banner.
