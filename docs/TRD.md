# Technical Requirements Document (TRD)

## 1. Architecture Overview

SolarPulse by Qashfin runs on an event-driven, serverless architecture on AWS:

- **Hosting and delivery:** AWS Amplify Hosting connected to this repository for Git-based CI/CD (`amplify.yml`, `appRoot: frontend`).
- **API ingress:** Amazon API Gateway (HTTP API) with regional endpoints, strict CORS and route throttling (burst 20, steady 10 req/s). Per-client limiting of 15 requests per minute is enforced in the Lambda with DynamoDB.
- **Compute:** AWS Lambda (Node.js 24.x, arm64) running the deterministic calculation core and coordinating model calls.
- **AI synthesis:** Amazon Bedrock invoking Claude Haiku 5.5 (`global.anthropic.claude-haiku-5-5` inference profile, configurable via the `BedrockModelId` parameter) at temperature 0.2 with thinking disabled for fast, structured JSON. The handler aborts the call after 8 seconds and falls back to a rule-based advisory on timeout, error or invalid JSON.
- **State and rate limiting:** Amazon DynamoDB with Time-To-Live tracking per-IP quotas to prevent credit drain.
- **Infrastructure as code:** AWS SAM (`backend/template.yaml`), default region `us-east-1`.

## 2. Performance and Reliability

- End-to-end API response time target: under 2.2 seconds including Bedrock inference.
- Client bundle: under 150 KB gzipped (current build is about 54 KB JS and 4 KB CSS).
- Availability: serverless, no persistent servers to manage.
- Graceful degradation: rate-limiter failures fail open; Bedrock failures return the fallback advisory with `metadata.advisorySource = "fallback"`.

## 3. Security and IAM

Execution role `SolarPulseLambdaRole-<region>` with least privilege:

- `bedrock:InvokeModel` on the `anthropic.claude-haiku-5-5` foundation model and its inference profile ARNs
- `dynamodb:UpdateItem`, `dynamodb:GetItem` on the `solarpulse-rate-limits` table
- AWS-managed `AWSLambdaBasicExecutionRole` for logs

Other controls:

- No AWS credentials are exposed to the client.
- Client IPs are hashed with SHA-256 and a secret salt before storage.
- Request bodies are limited to 2 KB, inputs are validated and the free-text location is sanitized and length-capped before reaching the prompt.
- The prompt marks the facts block as data, not instructions, to limit prompt injection.
- Security response headers are set by Amplify (`amplify.yml`). Set the `AllowedOrigin` stack parameter to the production Amplify URL.
- GitHub Actions deploys use OIDC; no long-lived AWS keys are stored.
