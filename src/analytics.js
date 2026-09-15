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

// Is this session running as an installed home-screen app, or in a browser tab?
// Read once at load. Sent as app_open's `extra` so install adoption can be
// measured as a share of all sessions, without a second beacon.
export const DISPLAY_MODE = (() => {
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
    if (window.navigator.standalone === true) return 'standalone'; // iOS Safari
    return 'browser';
  } catch (_) { return 'browser'; }
})();

// --- Session market -------------------------------------------------------
// The market the session runs on (an ISO code from data/markets.json). Not
// blob2: that is the edge country Cloudflare stamps on the request, which
// /metrics mislabelled "Market distribution" until 15 Sep 2026. Before this
// no event recorded which market a session actually ran on; only a hand
// change after onboarding fired market_selected.
//
// Read once from the key the app persists the market under, so a returning
// session's app_open already carries it. A first-run session carries nothing
// until onboarding locks a market in (market_locked, via setMarket), and every
// event after that carries it. Sent as `market`, stored server-side as blob7.
export const COUNTRY_KEY = 'gd_country';
let MARKET = (() => {
  try { return localStorage.getItem(COUNTRY_KEY) || null; } catch (_) { return null; }
})();
export function setMarket(code) { MARKET = code || null; }

// --- Operator exclusion ---------------------------------------------------
// Green Days is installed on Ryan's own home screen and there was no exclusion
// of any kind, so every figure on /metrics counted him: ~12% of events at 224
// sessions/month, ~40% at 18/week. No rate could be read past it and no Welcome
// fix could be evaluated against it.
//
// A first-party preference flag in localStorage marks this device as the
// operator's and silences the beacon entirely. The app already stores
// gd_onboarded, so this is the same class of state: never sent anywhere, not a
// cross-site identifier, consent-banner-free posture unchanged.
//
// Set it from INSIDE the installed app (five taps on the home wordmark). A
// ?operator=1 query param would NOT work: the manifest start_url is '/', so the
// param does not survive a home-screen launch, and an iOS home-screen web app
// does not share Safari's storage container.
const OPERATOR_KEY = 'gd_operator';

let IS_OPERATOR = (() => {
  try { return localStorage.getItem(OPERATOR_KEY) === '1'; } catch (_) { return false; }
})();

export function isOperator() { return IS_OPERATOR; }

// Flips the flag and returns the NEW state, so the caller can confirm it to
// whoever tapped. If storage throws (private mode), the in-memory flag still
// holds for this page load.
export function toggleOperator() {
  IS_OPERATOR = !IS_OPERATOR;
  try {
    if (IS_OPERATOR) localStorage.setItem(OPERATOR_KEY, '1');
    else localStorage.removeItem(OPERATOR_KEY);
  } catch (_) { /* nothing persisted, but this load is still silenced */ }
  return IS_OPERATOR;
}

const ENDPOINT = import.meta.env.BASE_URL + 'api/event'; // /api/event

// Send one event. Only schema fields are ever included — never a query string.
export function ev(name, data = {}) {
  if (IS_OPERATOR) return; // operator's own device — see the block above
  try {
    const payload = { name, sid: SID };
    if (MARKET) payload.market = MARKET;
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
