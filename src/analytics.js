/* Green Days — client analytics beacon.
   Privacy-first: no cookies, no persistent id, no PII, no query text. Events go
   to the Worker's /api/event, which adds country/band from the edge.
   SID groups events within one page load only; it lives in memory and is never
   stored, so it is not a persistent identifier (keeps us consent-banner-free). */

export const SID = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2) + Date.now().toString(36);

// One-time, session-scoped traffic-source hint, read at load and never
// persisted (no localStorage — same non-cookie posture as SID above).
// A utm_source query param wins (explicit campaign intent); otherwise an
// external document.referrer's hostname; otherwise null (direct/unknown),
// in which case app_open sends no detail at all, same as today.
export const SOURCE = (() => {
  try {
    const utm = new URLSearchParams(window.location.search).get('utm_source');
    if (utm) return 'utm:' + utm.slice(0, 60);
    const ref = document.referrer;
    if (ref) {
      const host = new URL(ref).hostname;
      if (host && host !== window.location.hostname) return 'ref:' + host.slice(0, 60);
    }
  } catch (_) { /* malformed referrer/URL, ignore */ }
  return null;
})();

const ENDPOINT = import.meta.env.BASE_URL + 'api/event'; // /api/event

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
