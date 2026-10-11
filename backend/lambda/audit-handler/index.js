'use strict';

/**
 * SolarPulse by Qashfin — POST /api/audit-solar (Phase 2).
 *
 * Flow: parse + validate -> per-IP rate limit (DynamoDB) -> deterministic
 * metrics -> Amazon Bedrock advisory (Claude Haiku 5.5) -> fallback advisory on
 * any model failure -> JSON response.
 *
 * Runtime: Node.js 24.x. The AWS SDK v3 clients ship with the Lambda runtime,
 * so no node_modules need to be bundled. SDK clients are created lazily so the
 * handler can be unit-tested with injected mocks (see createHandler).
 */

const crypto = require('crypto');
const {
  validateInput,
  calculateSolarMetrics,
  buildFallbackAdvisory,
} = require('../common/solarFormulas');
const {
  ENGINE_LABEL,
  buildBedrockRequest,
  parseAdvisory,
  extractModelText,
} = require('../common/promptTemplates');

const CONFIG = {
  tableName: process.env.TABLE_NAME || 'solarpulse-rate-limits',
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 15),
  rateLimitWindowSec: Number(process.env.RATE_LIMIT_WINDOW_SEC || 60),
  ipHashSalt: process.env.IP_HASH_SALT || 'solarpulse',
  // TTL kept slightly above the window; privacy policy promises <= 60 minutes.
  ttlSec: Number(process.env.RATE_LIMIT_TTL_SEC || 3600),
  bedrockTimeoutMs: Number(process.env.BEDROCK_TIMEOUT_MS || 8000),
  maxBodyBytes: 2048,
};

// ---------------------------------------------------------------------------
// Response helpers (CORS headers are added by API Gateway's CORS config)
// ---------------------------------------------------------------------------
function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

function parseBody(event) {
  let raw = event && event.body;
  if (typeof raw !== 'string' || !raw) return { error: 'Request body is required.' };
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  if (Buffer.byteLength(raw, 'utf8') > CONFIG.maxBodyBytes) {
    return { error: 'Request body too large.', status: 413 };
  }
  try {
    return { value: JSON.parse(raw) };
  } catch (_) {
    return { error: 'Request body must be valid JSON.' };
  }
}

function hashIp(ip) {
  return crypto
    .createHash('sha256')
    .update(`${CONFIG.ipHashSalt}:${ip || 'unknown'}`)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Default AWS clients (lazy)
// ---------------------------------------------------------------------------
let _ddb;
let _bedrock;

function getDdb() {
  if (!_ddb) {
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    _ddb = new DynamoDBClient({});
  }
  return _ddb;
}

function getBedrock() {
  if (!_bedrock) {
    const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
    _bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || process.env.AWS_REGION });
  }
  return _bedrock;
}

/**
 * Atomic fixed-window counter per hashed IP.
 *  1) Try to start a fresh window (item missing or window expired) -> count = 1.
 *  2) Otherwise increment the existing window's counter.
 * @returns {Promise<{allowed:boolean, count:number, retryAfterSec:number}>}
 */
async function checkRateLimit(ddb, clientKey, nowSec) {
  const { UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
  const windowStart = nowSec - (nowSec % CONFIG.rateLimitWindowSec);
  const ttl = nowSec + CONFIG.ttlSec;
  const key = { client_ip: { S: clientKey } };

  let count;
  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: CONFIG.tableName,
        Key: key,
        UpdateExpression: 'SET request_count = :one, window_epoch = :w, ttl_expiry = :ttl',
        ConditionExpression: 'attribute_not_exists(client_ip) OR window_epoch < :w',
        ExpressionAttributeValues: {
          ':one': { N: '1' },
          ':w': { N: String(windowStart) },
          ':ttl': { N: String(ttl) },
        },
      })
    );
    count = 1;
  } catch (err) {
    if (err && err.name !== 'ConditionalCheckFailedException') throw err;
    const res = await ddb.send(
      new UpdateItemCommand({
        TableName: CONFIG.tableName,
        Key: key,
        UpdateExpression: 'ADD request_count :one SET ttl_expiry = :ttl',
        ExpressionAttributeValues: { ':one': { N: '1' }, ':ttl': { N: String(ttl) } },
        ReturnValues: 'UPDATED_NEW',
      })
    );
    count = Number(res.Attributes.request_count.N);
  }

  return {
    allowed: count <= CONFIG.rateLimitMax,
    count,
    retryAfterSec: windowStart + CONFIG.rateLimitWindowSec - nowSec,
  };
}

/** Call Bedrock; returns a parsed advisory or null on any failure. */
async function getAiAdvisory(bedrock, input, metrics) {
  const { InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CONFIG.bedrockTimeoutMs);
  try {
    const res = await bedrock.send(new InvokeModelCommand(buildBedrockRequest(input, metrics)), {
      abortSignal: ac.signal,
    });
    const decoded = JSON.parse(Buffer.from(res.body).toString('utf8'));
    return parseAdvisory(extractModelText(decoded));
  } catch (err) {
    console.error('Bedrock invocation failed:', err && err.name, err && err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Handler factory (dependency injection for tests)
// ---------------------------------------------------------------------------
function createHandler(deps = {}) {
  const now = deps.now || (() => Date.now());

  return async function handler(event) {
    const started = now();

    // 1. Parse + validate.
    const parsed = parseBody(event);
    if (parsed.error) {
      return json(parsed.status || 400, { success: false, error: 'BAD_REQUEST', message: parsed.error });
    }
    const check = validateInput(parsed.value);
    if (!check.valid) {
      return json(400, { success: false, error: 'VALIDATION_FAILED', details: check.errors });
    }
    const input = check.value;

    // 2. Rate limit (fail open if DynamoDB itself is unavailable).
    const sourceIp =
      (event.requestContext && event.requestContext.http && event.requestContext.http.sourceIp) ||
      'unknown';
    try {
      const rl = await checkRateLimit(deps.ddb || getDdb(), hashIp(sourceIp), Math.floor(now() / 1000));
      if (!rl.allowed) {
        return json(
          429,
          {
            success: false,
            error: 'RATE_LIMITED',
            message: 'Too many audit requests. Please wait a moment and try again.',
            retryAfterSec: rl.retryAfterSec,
          },
          { 'Retry-After': String(rl.retryAfterSec) }
        );
      }
    } catch (err) {
      console.error('Rate limiter unavailable, failing open:', err && err.name, err && err.message);
    }

    // 3. Deterministic metrics (authoritative numbers).
    const m = calculateSolarMetrics(input);

    // 4. AI advisory with graceful fallback.
    const ai = await getAiAdvisory(deps.bedrock || getBedrock(), input, m);
    const advisory = ai || buildFallbackAdvisory(input, m);

    return json(200, {
      success: true,
      metadata: {
        engine: ai ? ENGINE_LABEL : 'SolarPulse rule engine (fallback)',
        advisorySource: ai ? 'bedrock' : 'fallback',
        latencyMs: now() - started,
      },
      deterministicMetrics: {
        recommendedCapacityKW: m.recommendedCapacityKW,
        requiredRoofAreaSqFt: m.requiredRoofAreaSqFt,
        estimatedAnnualUnitsKWh: m.estimatedAnnualUnitsKWh,
        annualCarbonOffsetKg: m.annualCarbonOffsetKg,
        estimatedMonthlySavingsInr: m.estimatedMonthlySavingsInr,
      },
      financials: {
        offsetPercent: m.offsetPercent,
        costLowInr: m.costLowInr,
        costHighInr: m.costHighInr,
        subsidyInr: m.subsidyInr,
        paybackYearsMin: m.paybackYearsMin,
        paybackYearsMax: m.paybackYearsMax,
        equivalentTrees: m.equivalentTrees,
      },
      assumptions: m.assumptions,
      strategicAdvisory: advisory,
    });
  };
}

module.exports = { handler: createHandler(), createHandler };
