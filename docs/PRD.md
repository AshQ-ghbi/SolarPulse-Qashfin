# Product Requirement Document (PRD)

## 1. Executive Summary

**SolarPulse by Qashfin** is an institutional-grade rooftop solar adoption and carbon mitigation intelligence engine built for the Bharat Builds Tour (Track 03: Waste and Energy). It removes the complexity of rooftop solar feasibility assessments by turning monthly power bills and physical roof profiles into actionable financial forecasts, carbon offset projections and AI-synthesized engineering guidance.

## 2. Problem Statement

Urban homeowners, residential welfare associations (RWAs) and college campus administrators face analysis paralysis when considering rooftop solar. Existing calculators either demand complex engineering metrics (tilt angle, irradiance coefficient, inverter clipping) or supply generic financial figures without explaining regulatory incentives, payback periods or structural feasibility. As a result, solar adoption stalls, clean energy targets are missed, and reliance on coal-heavy grid electricity continues.

## 3. Target Audience

- **Urban homeowners and tenants:** rapid, reliable estimates of capital cost versus monthly utility savings.
- **Campus facilities and RWA managers:** high-level feasibility reports to present to management boards.
- **Environmental hackathon evaluators:** a functional, deployed, cloud-native tool that addresses a real community challenge.

## 4. Core Features and Functional Requirements

- **Zero-jargon input surface:** users enter only monthly average bill (INR), city/locality and roof construction type, plus an optional sanctioned load.
- **Deterministic metric computation:** instant, math-based calculation of recommended system capacity (kW), roof footprint (sq ft), annual generation (kWh), annual CO2 mitigation (kg) and monthly savings (INR).
- **Financial statement:** capital cost range, PM Surya Ghar subsidy, net investment and payback range.
- **AI solar advisory engine:** localized structural tips, subsidy navigation advice and sizing notes generated with Amazon Bedrock, with a rule-based fallback when the model is unavailable.
- **Verifiable architecture drawer:** an interactive UI drawer showing the serverless flow (Amplify, API Gateway, Lambda, DynamoDB, Bedrock) with live latency and engine details from the last audit.

## 5. Out of Scope for Hackathon V1

- Real-time satellite roof detection via computer vision (avoids deployment timeouts).
- Direct online payment processing or vendor bidding networks.
