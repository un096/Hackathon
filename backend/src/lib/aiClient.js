// Thin client for the Python AI service. Every call has a timeout and returns null on failure,
// so callers always fall back to deterministic behaviour (the demo never depends on it).
const { aiServiceUrl, aiServiceToken } = require('../config/env');

async function call(pathname, body, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${aiServiceUrl}${pathname}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(aiServiceToken ? { 'X-Service-Token': aiServiceToken } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

module.exports = {
  health: () => call('/health', null, 2000),
  explainLearning: (payload) => call('/explain/learning', payload, 10000),
  explainMatch: (payload) => call('/explain/match', payload, 10000),
  processMarketCsv: (payload) => call('/market/process', payload, 120000),
};
