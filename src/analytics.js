/* Green Days — client analytics beacon.
   Privacy-first: no cookies, no persistent id, no PII, no query text. Events go
   to the Worker's /greendays/api/event, which adds country/band from the edge.
   SID groups events within one page load only; it lives in memory and is never
   stored, so it is not a persistent identifier (keeps us consent-banner-free). */

export const SID = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2) + Date.now().toString(36);

const ENDPOINT = import.meta.env.BASE_URL + 'api/event'; // /greendays/api/event

// Send one event. Only schema fields are ever included — never a query string.
export function ev(name, data = {}) {
  try {
    const payload = { name, sid: SID };
    if (data.detail != null) payload.detail = String(data.detail).slice(0, 64);
    if (data.extra != null) payload.extra = String(data.extra).slice(0, 64);
    if (data.v1 != null) payload.v1 = data.v1;
    if (data.v2 != null) payload.v2 = data.v2;
    if (data.v3 != null) payload.v3 = data.v3;
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, blob);
    else fetch(ENDPOINT, { method: 'POST', body: blob, keepalive: true }).catch(() => {});
  } catch (_) { /* analytics must never break the app */ }
}

// Fire a given event at most once per page load (e.g. fallback_shown per item).
const once = new Set();
export function evOnce(key, name, data) {
  if (once.has(key)) return;
  once.add(key);
  ev(name, data);
}
