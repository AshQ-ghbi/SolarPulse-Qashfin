// API wiring. Set VITE_API_BASE_URL to the `ApiBaseUrl` output of the SAM stack
// (locally in a repo-root .env, on Amplify under Environment variables).

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
export const AUDIT_URL = API_BASE_URL ? `${API_BASE_URL}/api/audit-solar` : '';
export const API_CONFIGURED = Boolean(AUDIT_URL);

// A malformed VITE_API_BASE_URL (e.g. missing https://) must not crash the app at import time.
export const API_HOST = (() => {
  try {
    return API_CONFIGURED ? new URL(AUDIT_URL).host : 'not configured';
  } catch (_) {
    return 'invalid URL';
  }
})();

/**
 * POST the audit request.
 * Resolves to { status, data }. Network failures and timeouts reject with an
 * Error whose message is safe to show to the user.
 */
export async function requestAudit(payload, timeoutMs = 12000) {
  if (!API_CONFIGURED) throw new Error('API endpoint is not configured (VITE_API_BASE_URL).');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(AUDIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* non-JSON body */
    }
    return { status: res.status, data };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The audit service took too long to respond.');
    throw new Error('Could not reach the audit service. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
}
