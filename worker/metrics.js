/* Green Days — private metrics page at /metrics.
   Access-gated (METRICS_TOKEN via HTTP Basic). Queries the Analytics
   Engine SQL API and renders the KPIs from KPIs_and_Dashboard.md. Cross-event
   ratios are computed here from grouped rows (no reliance on IF() in SQL). */
import MARKETS from '../data/markets.json';
import AFFILIATES from '../data/affiliates.json';

const DATASET = 'Green_Days_Early_Days';
// Countries where a CTA actually renders — the denominator for tap rate tracks
// data/affiliates.json, so adding a partner needs no change here. Codes are
// re-filtered to A-Z since they are interpolated into SQL.
const COVERED = Object.keys(AFFILIATES).filter((c) => /^[A-Z]{2}$/.test(c));
const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
const pct = (x) => (x == null || !Number.isFinite(x) ? '—' : (x * 100).toFixed(1) + '%');
const countryName = (c) => (MARKETS[c] && MARKETS[c].country) || (c || 'Unknown');

// --- Analytics Engine SQL client ---
async function aeSql(env, query) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    { method: 'POST', headers: { Authorization: `Bearer ${env.AE_API_TOKEN}`, 'content-type': 'text/plain' }, body: query }
  );
  if (!res.ok) throw new Error(`AE ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return Array.isArray(j.data) ? j.data : [];
}

// Constant-time string compare, so a wrong token leaks nothing through timing.
// Lengths are compared first (they are not secret); equal-length inputs are
// diffed byte by byte with no early exit.
function safeEqual(a, b) {
  const A = new TextEncoder().encode(a);
  const B = new TextEncoder().encode(b);
  if (A.length !== B.length) return false;
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= A[i] ^ B[i];
  return diff === 0;
}

// --- auth: HTTP Basic carrying METRICS_TOKEN, or the session cookie it mints ---
// No `?key=` in the URL, deliberately: it would land in Cloudflare access
// logs, browser history, and any outbound Referer header. Basic covers the
// first visit; a successful Basic login also sets a year-long cookie (a hash
// of the token, scoped to /metrics) so a plain bookmark stays signed in long
// after the browser has forgotten the Basic credentials. Rotating
// METRICS_TOKEN invalidates every outstanding cookie at once.
const COOKIE_NAME = 'gd_metrics';

async function sessionValue(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gd-metrics-v1:' + token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function cookieFrom(request) {
  const h = request.headers.get('Cookie') || '';
  for (const part of h.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === COOKIE_NAME) return part.slice(eq + 1).trim();
  }
  return '';
}

// Returns 'basic', 'cookie', or null. 'basic' means the key was typed fresh —
// the caller uses that to (re)issue the session cookie.
async function authorized(request, env) {
  const token = env.METRICS_TOKEN;
  if (!token) return null; // never open when the secret is unset
  const h = request.headers.get('Authorization') || '';
  if (h.startsWith('Basic ')) {
    try {
      const [user, pass] = atob(h.slice(6)).split(':');
      // Either field may hold the token — browsers prompt for both.
      if (safeEqual(user || '', token) || safeEqual(pass || '', token)) return 'basic';
    } catch (_) { /* malformed header — fall through to the cookie */ }
  }
  const c = cookieFrom(request);
  if (c && safeEqual(c, await sessionValue(token))) return 'cookie';
  return null;
}

export async function handleMetrics(request, env) {
  const auth = await authorized(request, env);
  if (!auth) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Green Days metrics"' } });
  }
  // A fresh Basic login mints the bookmarkable session. HttpOnly + Secure +
  // Path=/metrics keeps it away from scripts and off the rest of the site,
  // which stays cookieless.
  const withSession = auth !== 'basic' ? ((r) => r) : await (async () => {
    const cookie = `${COOKIE_NAME}=${await sessionValue(env.METRICS_TOKEN)}; Max-Age=31536000; Path=/metrics; Secure; HttpOnly; SameSite=Lax`;
    return (r) => { r.headers.append('set-cookie', cookie); return r; };
  })();

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days'), 10) || 7));
  const format = url.searchParams.get('format');
  const wantJson = format === 'json';
  const wantCsv = format === 'csv';

  if (!env.CF_ACCOUNT_ID || !env.AE_API_TOKEN) {
    const msg = { error: 'metrics_not_configured', detail: 'Set CF_ACCOUNT_ID and AE_API_TOKEN secrets.' };
    if (wantJson) return withSession(json(msg, 200));
    if (wantCsv) return withSession(csv('error,detail\nmetrics_not_configured,"Set CF_ACCOUNT_ID and AE_API_TOKEN secrets."\n', days));
    return withSession(html(renderNotConfigured(days), 200));
  }

  const I = `NOW() - INTERVAL '${days}' DAY`;
  const Q = {
    // Grouped by blob2 (edge country) so the rate can be split in-market vs
    // out-of-market below. recipe_generated rows before 15 Sep 2026 carry the
    // requested market in blob2, not the edge country: in a window reaching
    // back past that date the split undercounts out-of-market recipes.
    activation: `SELECT blob1 AS event, blob2 AS country, COUNT(DISTINCT blob6) AS sessions FROM ${DATASET} WHERE blob1 IN ('app_open','recipe_generated') AND timestamp > ${I} GROUP BY event, country`,
    onboarding: `SELECT blob4 AS step, blob5 AS action, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1='onboarding_step' AND timestamp > ${I} GROUP BY step, action ORDER BY n DESC`,
    recipes: `SELECT SUM(_sample_interval) AS recipes, COUNT(DISTINCT blob6) AS sessions FROM ${DATASET} WHERE blob1='recipe_generated' AND timestamp > ${I}`,
    tryAnother: `SELECT blob1 AS event, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1 IN ('recipe_generated','recipe_try_another') AND timestamp > ${I} GROUP BY event`,
    search: `SELECT double1 AS has_results, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1='search' AND timestamp > ${I} GROUP BY has_results`,
    // blob2 = edge country (Cloudflare's request.cf.country), on every event.
    edge: `SELECT blob2 AS country, COUNT(DISTINCT blob6) AS sessions FROM ${DATASET} WHERE blob1='app_open' AND timestamp > ${I} GROUP BY country ORDER BY sessions DESC`,
    // blob7 = the market the session ran on (src/analytics.js setMarket):
    // present on a returning session's app_open, and on market_locked when a
    // first-run session finishes onboarding. Empty before 15 Sep 2026.
    market: `SELECT blob7 AS market, COUNT(DISTINCT blob6) AS sessions FROM ${DATASET} WHERE blob1 IN ('app_open','market_locked') AND blob7 != '' AND timestamp > ${I} GROUP BY market ORDER BY sessions DESC`,
    // blob5 on market_locked = how the market was arrived at (see
    // src/GreenDaysApp.jsx marketOrigin): edge / default / picked / stored.
    locked: `SELECT blob5 AS origin, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1='market_locked' AND timestamp > ${I} GROUP BY origin ORDER BY n DESC`,
    fieldGuide: `SELECT blob4 AS produce, SUM(_sample_interval) AS adds FROM ${DATASET} WHERE blob1='field_guide_add' AND timestamp > ${I} GROUP BY produce ORDER BY adds DESC`,
    fieldNote: `SELECT blob4 AS produce, SUM(_sample_interval) AS shares FROM ${DATASET} WHERE blob1='field_note_share_tap' AND timestamp > ${I} GROUP BY produce ORDER BY shares DESC`,
    notifyIntent: `SELECT blob4 AS produce, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1='notify_intent' AND timestamp > ${I} GROUP BY produce ORDER BY n DESC`,
    notifyPerm: `SELECT blob4 AS result, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1='notify_permission' AND timestamp > ${I} GROUP BY result ORDER BY n DESC`,
    displayMode: `SELECT blob5 AS mode, COUNT(DISTINCT blob6) AS sessions FROM ${DATASET} WHERE blob1='app_open' AND timestamp > ${I} GROUP BY mode`,
    pwaInstall: `SELECT SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1='pwa_install' AND timestamp > ${I}`,
    health: `SELECT quantileWeighted(0.5)(double1, _sample_interval) AS p50_ms, quantileWeighted(0.95)(double1, _sample_interval) AS p95_ms, SUM(double2 * _sample_interval) / SUM(_sample_interval) AS ok_rate, SUM(double3 * _sample_interval) / SUM(_sample_interval) AS avg_tokens, SUM(_sample_interval) AS recipes FROM ${DATASET} WHERE blob1='recipe_generated' AND timestamp > ${I}`,
    // double2 on app_open = returning (1) vs first-ever-visit (0), set client-side
    // from the non-cookie gd_last_visit flag (see src/GreenDaysApp.jsx).
    retention: `SELECT double2 AS returning, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1='app_open' AND timestamp > ${I} GROUP BY returning`,
    recency: `SELECT quantileWeighted(0.5)(double3, _sample_interval) AS median_days FROM ${DATASET} WHERE blob1='app_open' AND double2=1 AND timestamp > ${I}`,
    // blob4 on affiliate_cta_tap = partner_id (see src/GreenDaysApp.jsx Zone 8).
    affiliate: `SELECT blob4 AS partner, blob2 AS country, SUM(_sample_interval) AS taps FROM ${DATASET} WHERE blob1='affiliate_cta_tap' AND timestamp > ${I} GROUP BY partner, country ORDER BY taps DESC`,
    // Denominator: recipes generated in covered markets only. A tap rate against
    // all recipes would be meaningless while most markets render no CTA at all.
    // The CTA renders by market, so this reads blob7; recipes before 15 Sep
    // 2026 have no blob7 and drop out of the denominator.
    affiliateBase: COVERED.length
      ? `SELECT SUM(_sample_interval) AS recipes FROM ${DATASET} WHERE blob1='recipe_generated' AND blob7 IN (${COVERED.map((c) => `'${c}'`).join(',')}) AND timestamp > ${I}`
      : null,
    // blob4 on app_open = SOURCE from src/analytics.js ('utm:x' / 'ref:host'),
    // empty when the visit was direct or the referrer was same-origin.
    source: `SELECT blob4 AS source, COUNT(DISTINCT blob6) AS sessions FROM ${DATASET} WHERE blob1='app_open' AND timestamp > ${I} GROUP BY source ORDER BY sessions DESC`,
  };

  // Run all queries; a single failing query degrades only its own card.
  const errors = {};
  const rows = {};
  await Promise.all(Object.entries(Q).map(async ([k, q]) => {
    if (!q) { rows[k] = []; return; } // query disabled for this config (e.g. no covered markets)
    try { rows[k] = await aeSql(env, q); } catch (e) { errors[k] = String(e.message || e); rows[k] = []; }
  }));

  // --- derive the KPIs from the grouped rows ---
  const byEvent = (arr, key = 'event', val = 'n') => Object.fromEntries((arr || []).map((r) => [r[key], num(r[val])]));

  // Activation, split by whether the edge country is one of the 14 markets.
  // About three quarters of loads are out of market, and until 15 Sep 2026
  // every rate on this page was computed over that mixed audience. This split
  // is what says whether the out-of-market majority is people or automation.
  const IN_MARKET = new Set(Object.keys(MARKETS));
  const actIn = { app_open: 0, recipe_generated: 0 }, actOut = { app_open: 0, recipe_generated: 0 };
  (rows.activation || []).forEach((r) => {
    const b = IN_MARKET.has(r.country) ? actIn : actOut;
    if (b[r.event] != null) b[r.event] += num(r.sessions);
  });
  const actRate = (b) => ({
    app_open_sessions: b.app_open, recipe_sessions: b.recipe_generated,
    rate: b.app_open ? b.recipe_generated / b.app_open : null,
  });
  const activation = {
    ...actRate({ app_open: actIn.app_open + actOut.app_open, recipe_generated: actIn.recipe_generated + actOut.recipe_generated }),
    in_market: actRate(actIn),
    out_of_market: actRate(actOut),
  };

  const ONB_STEPS = ['welcome', 'market', 'diet'];
  const onbMap = {};
  ONB_STEPS.forEach((s) => { onbMap[s] = { next: 0, complete: 0, abandon: 0 }; });
  (rows.onboarding || []).forEach((r) => {
    const s = r.step, a = r.action;
    if (onbMap[s] && onbMap[s][a] != null) onbMap[s][a] = num(r.n);
  });
  const onboarding = { steps: ONB_STEPS.map((s) => ({ step: s, ...onbMap[s] })), completed: onbMap.diet.complete };

  const rec = (rows.recipes && rows.recipes[0]) || {};
  const recipesPerSession = {
    recipes: num(rec.recipes), sessions: num(rec.sessions),
    value: num(rec.sessions) ? num(rec.recipes) / num(rec.sessions) : null,
  };

  const ta = byEvent(rows.tryAnother, 'event', 'n');
  const tryAnother = {
    recipe_generated: ta.recipe_generated || 0,
    recipe_try_another: ta.recipe_try_another || 0,
    rate: ta.recipe_generated ? (ta.recipe_try_another || 0) / ta.recipe_generated : null,
  };

  let hit = 0, miss = 0;
  (rows.search || []).forEach((r) => { (num(r.has_results) === 1 ? (hit += num(r.n)) : (miss += num(r.n))); });
  const search = { has_results: hit, no_results: miss, miss_rate: (hit + miss) ? miss / (hit + miss) : null };

  // Edge country: where Cloudflare saw the request come from. This list was
  // titled "Market distribution" until 15 Sep 2026 and never showed a market,
  // which is why it rendered "US US" beside "Portugal PT".
  const edge = (rows.edge || []).map((r) => ({ country: r.country || '', name: countryName(r.country), sessions: num(r.sessions) }));
  // Market: the one each session actually ran on.
  const market = (rows.market || []).map((r) => ({ country: r.market || '', name: countryName(r.market), sessions: num(r.sessions) }));
  // How the locked market was arrived at. 'default' is the number that
  // matters: out-of-market arrivals who were served Portugal and never picked.
  const lockedByOrigin = {};
  (rows.locked || []).forEach((r) => { const o = r.origin || '(unknown)'; lockedByOrigin[o] = (lockedByOrigin[o] || 0) + num(r.n); });
  const marketLocked = { total: Object.values(lockedByOrigin).reduce((s, n) => s + n, 0), by_origin: lockedByOrigin };

  const fieldGuideByProduce = (rows.fieldGuide || []).map((r) => ({ produce: r.produce || '(unknown)', adds: num(r.adds) }));
  const fieldGuide = { total: fieldGuideByProduce.reduce((s, r) => s + r.adds, 0), by_produce: fieldGuideByProduce };

  // field_note_share_tap carries no detail (see src/GreenDaysApp.jsx) — this is
  // a top-of-funnel "someone tried to share" count, not a confirmed-share count.
  const fieldNoteByProduce = (rows.fieldNote || []).map((r) => ({ produce: r.produce || '(unknown)', shares: num(r.shares) }));
  const fieldNote = { total: fieldNoteByProduce.reduce((s, r) => s + r.shares, 0), by_produce: fieldNoteByProduce };

  // "Tell me when it's back": intent (platform-independent) and the permission
  // result are deliberately two measurements — high intent with a low grant
  // rate is a readable outcome, not a failure. See HANDOFF §5.
  const notifyByProduce = (rows.notifyIntent || []).map((r) => ({ produce: r.produce || '(unknown)', n: num(r.n) }));
  const notifyPermRows  = (rows.notifyPerm || []).map((r) => ({ result: r.result || '(unknown)', n: num(r.n) }));
  const notifyIntentTotal = notifyByProduce.reduce((s, r) => s + r.n, 0);
  const granted = (notifyPermRows.find((r) => r.result === 'granted') || {}).n || 0;
  const permTotal = notifyPermRows.reduce((s, r) => s + r.n, 0);
  const notify = {
    intent_total: notifyIntentTotal,
    by_produce: notifyByProduce,
    permission: notifyPermRows,
    grant_rate: permTotal ? granted / permTotal : null,
  };

  let standalone = 0, browser = 0;
  (rows.displayMode || []).forEach((r) => {
    if (r.mode === 'standalone') standalone += num(r.sessions); else browser += num(r.sessions);
  });
  const install = {
    standalone_sessions: standalone,
    browser_sessions: browser,
    standalone_rate: (standalone + browser) ? standalone / (standalone + browser) : null,
    android_installs: num(((rows.pwaInstall || [])[0] || {}).n),
  };

  const h = (rows.health && rows.health[0]) || {};
  const health = {
    p50_ms: rows.health && rows.health.length ? num(h.p50_ms) : null,
    p95_ms: rows.health && rows.health.length ? num(h.p95_ms) : null,
    ok_rate: rows.health && rows.health.length && h.ok_rate != null ? num(h.ok_rate) : null,
    avg_tokens: rows.health && rows.health.length && h.avg_tokens != null ? num(h.avg_tokens) : null,
    recipes: num(h.recipes),
  };

  const ret = byEvent(rows.retention, 'returning', 'n');
  const returningSessions = ret['1'] || 0, newSessions = ret['0'] || 0;
  const rc = (rows.recency && rows.recency[0]) || {};
  const retention = {
    returning_sessions: returningSessions,
    new_sessions: newSessions,
    rate: (returningSessions + newSessions) ? returningSessions / (returningSessions + newSessions) : null,
    median_days_since_return: rows.recency && rows.recency.length && rc.median_days != null ? num(rc.median_days) : null,
  };

  // Affiliate CTA: taps by partner, over recipes generated in covered markets.
  // The rate is directional, not a true CTR — a recipe reopened from history
  // shows the CTA again without generating a second recipe.
  const affiliateByPartner = (rows.affiliate || []).map((r) => ({
    partner: r.partner || '(unknown)', country: r.country || '', taps: num(r.taps),
  }));
  const affiliateTaps = affiliateByPartner.reduce((s, r) => s + r.taps, 0);
  const affiliateBase = num(((rows.affiliateBase || [])[0] || {}).recipes);
  const affiliate = {
    covered_markets: COVERED,
    taps: affiliateTaps,
    by_partner: affiliateByPartner,
    recipes_in_covered_markets: affiliateBase,
    tap_rate: affiliateBase ? affiliateTaps / affiliateBase : null,
  };

  // Traffic source: blob4 on app_open. Empty means direct or same-origin.
  const sourceRows = (rows.source || []).map((r) => ({ source: r.source || '(direct)', sessions: num(r.sessions) }));
  const sourceTotal = sourceRows.reduce((s, r) => s + r.sessions, 0);
  const known = sourceRows.filter((r) => r.source !== '(direct)').reduce((s, r) => s + r.sessions, 0);
  const source = { total_sessions: sourceTotal, attributed_sessions: known, by_source: sourceRows };

  const metrics = { dataset: DATASET, days, generated_at: new Date().toISOString(), activation, onboarding, recipes_per_session: recipesPerSession, try_another: tryAnother, search, edge, market, market_locked: marketLocked, field_guide: fieldGuide, field_note: fieldNote, install, notify, health, retention, affiliate, source, errors };

  if (wantJson) return withSession(json(metrics, 200));
  if (wantCsv) return withSession(csv(renderCsv(metrics), days));
  return withSession(html(renderPage(metrics), 200));
}

/* ================= rendering ================= */
const json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const html = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const csv = (body, days) => new Response(body, { status: 200, headers: {
  'content-type': 'text/csv; charset=utf-8',
  'cache-control': 'no-store',
  'content-disposition': `attachment; filename="green-days-metrics-${days}d-${new Date().toISOString().slice(0,10)}.csv"`,
} });

// Long-format CSV: one row per (section, dimension, key, value). Handles the
// mixed shapes on the page without needing a wide header per section.
function csvCell(v) {
  if (v == null) return '';
  const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function renderCsv(m) {
  const rows = [['section', 'dimension', 'key', 'value']];
  const push = (section, dimension, key, value) => rows.push([section, dimension || '', key, value]);
  push('meta', '', 'dataset', m.dataset);
  push('meta', '', 'days', m.days);
  push('meta', '', 'generated_at', m.generated_at);

  const A = m.activation;
  push('activation', 'total', 'rate', A.rate);
  push('activation', 'total', 'app_open_sessions', A.app_open_sessions);
  push('activation', 'total', 'recipe_sessions', A.recipe_sessions);
  for (const d of ['in_market', 'out_of_market']) {
    push('activation', d, 'rate', A[d].rate);
    push('activation', d, 'app_open_sessions', A[d].app_open_sessions);
    push('activation', d, 'recipe_sessions', A[d].recipe_sessions);
  }

  const R = m.retention;
  push('retention', '', 'rate', R.rate);
  push('retention', '', 'returning_sessions', R.returning_sessions);
  push('retention', '', 'new_sessions', R.new_sessions);
  push('retention', '', 'median_days_since_return', R.median_days_since_return);

  for (const s of m.onboarding.steps) {
    push('onboarding', s.step, 'next', s.next);
    push('onboarding', s.step, 'complete', s.complete);
    push('onboarding', s.step, 'abandon', s.abandon);
  }
  push('onboarding', '', 'completed', m.onboarding.completed);

  const RPS = m.recipes_per_session;
  push('recipes_per_session', '', 'value', RPS.value);
  push('recipes_per_session', '', 'recipes', RPS.recipes);
  push('recipes_per_session', '', 'sessions', RPS.sessions);

  const T = m.try_another;
  push('try_another', '', 'rate', T.rate);
  push('try_another', '', 'recipe_generated', T.recipe_generated);
  push('try_another', '', 'recipe_try_another', T.recipe_try_another);

  push('search', '', 'miss_rate', m.search.miss_rate);
  push('search', '', 'has_results', m.search.has_results);
  push('search', '', 'no_results', m.search.no_results);

  for (const r of m.edge) push('edge_country', `${r.country} ${r.name}`, 'sessions', r.sessions);
  for (const r of m.market) push('market', `${r.country} ${r.name}`, 'sessions', r.sessions);
  push('market_locked', '', 'total', m.market_locked.total);
  for (const [o, n] of Object.entries(m.market_locked.by_origin || {})) push('market_locked', o, 'n', n);

  push('field_guide', '', 'total', m.field_guide.total);
  for (const r of m.field_guide.by_produce) push('field_guide', r.produce, 'adds', r.adds);
  push('field_note', '', 'total', m.field_note.total);
  for (const r of m.field_note.by_produce) push('field_note', r.produce, 'shares', r.shares);

  const I = m.install;
  push('install', '', 'standalone_rate', I.standalone_rate);
  push('install', '', 'standalone_sessions', I.standalone_sessions);
  push('install', '', 'browser_sessions', I.browser_sessions);
  push('install', '', 'android_installs', I.android_installs);

  const N = m.notify;
  push('notify', '', 'intent_total', N.intent_total);
  push('notify', '', 'grant_rate', N.grant_rate);
  for (const r of N.permission) push('notify_permission', r.result, 'n', r.n);
  for (const r of N.by_produce) push('notify_intent', r.produce, 'n', r.n);

  const H = m.health;
  push('health', '', 'recipes', H.recipes);
  push('health', '', 'p50_ms', H.p50_ms);
  push('health', '', 'p95_ms', H.p95_ms);
  push('health', '', 'ok_rate', H.ok_rate);
  push('health', '', 'avg_tokens', H.avg_tokens);

  const AF = m.affiliate;
  push('affiliate', '', 'taps', AF.taps);
  push('affiliate', '', 'tap_rate', AF.tap_rate);
  push('affiliate', '', 'recipes_in_covered_markets', AF.recipes_in_covered_markets);
  push('affiliate', '', 'covered_markets', AF.covered_markets.join('|'));
  for (const r of AF.by_partner) push('affiliate', `${r.partner}${r.country ? ' ' + r.country : ''}`, 'taps', r.taps);

  const S = m.source;
  push('source', '', 'total_sessions', S.total_sessions);
  push('source', '', 'attributed_sessions', S.attributed_sessions);
  for (const r of S.by_source) push('source', r.source, 'sessions', r.sessions);

  for (const [k, v] of Object.entries(m.errors || {})) push('errors', k, 'message', v);

  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NO_DATA = '<div class="empty">no data yet</div>';

function shell(inner, days) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Green Days · metrics</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root { --accent:#529d7f; --accent-strong:#42917c; --ground:#fcf8ee; --ink:#1a2023; --muted:#4d606b; --card:#ffffff; --line:#e3ddcd; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--ground); color:var(--ink); font-family:'Nunito',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:1080px; margin:0 auto; padding:28px 20px 60px; }
  header { display:flex; align-items:baseline; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:6px; }
  h1 { font-size:26px; font-weight:900; margin:0; letter-spacing:-0.01em; }
  h1 .g { color:var(--accent); }
  .sub { color:var(--muted); font-size:13px; font-weight:600; }
  .windows { display:flex; gap:8px; margin:14px 0 10px; flex-wrap:wrap; }
  .windows a { text-decoration:none; font-size:13px; font-weight:700; color:var(--muted); border:1px solid var(--line); background:var(--card); padding:6px 12px; border-radius:999px; }
  .windows a.on { background:var(--accent); color:#fff; border-color:var(--accent); }
  .exports { display:flex; gap:8px; margin:0 0 22px; flex-wrap:wrap; align-items:center; }
  .exports a { text-decoration:none; font-size:12px; font-weight:700; color:var(--muted); border:1px solid var(--line); background:var(--card); padding:5px 10px; border-radius:999px; }
  .exports a:hover { color:var(--accent-strong); border-color:var(--accent); }
  .exports .lbl { font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; margin-right:2px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:18px 18px 16px; }
  .card h2 { font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); margin:0 0 12px; }
  .big { font-size:40px; font-weight:900; line-height:1; color:var(--accent); }
  .big.small { font-size:30px; }
  .unit { font-size:15px; font-weight:700; color:var(--muted); margin-left:4px; }
  .note { font-size:12.5px; color:var(--muted); margin-top:8px; }
  .row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:6px 0; border-top:1px solid var(--line); font-size:13.5px; }
  .row:first-of-type { border-top:0; }
  .row .k { font-weight:700; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .row .v { font-family:'JetBrains Mono',monospace; font-weight:700; color:var(--ink); flex-shrink:0; }
  .row .bar { flex:1; height:6px; background:#eef4f0; border-radius:999px; overflow:hidden; margin:0 10px; }
  .row .bar > i { display:block; height:100%; background:var(--accent); border-radius:999px; }
  .steps .st { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-top:1px solid var(--line); font-size:13.5px; }
  .steps .st:first-child { border-top:0; }
  .steps .st .lbl { font-weight:800; text-transform:capitalize; }
  .steps .st .cts { font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--muted); }
  .steps .st .cts b { color:var(--accent); }
  .hstat { display:flex; gap:22px; flex-wrap:wrap; }
  .hstat > div .n { font-size:26px; font-weight:900; color:var(--accent); font-family:'JetBrains Mono',monospace; }
  .hstat > div .l { font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em; }
  .empty { color:var(--muted); font-size:13px; font-style:italic; padding:8px 0; }
  .err { margin-top:8px; font-size:11px; color:#b0472e; font-family:'JetBrains Mono',monospace; word-break:break-word; }
  footer { margin-top:26px; color:var(--muted); font-size:12px; }
</style></head><body><div class="wrap">
<header><h1><span class="g">green days</span> · metrics</h1><div class="sub">last ${days} day${days === 1 ? '' : 's'}</div></header>
<div class="windows">${[1, 7, 14, 30, 90].map((d) => `<a class="${d === days ? 'on' : ''}" href="?days=${d}">${d}d</a>`).join('')}</div>
<div class="exports">
  <span class="lbl">export</span>
  <a href="?days=${days}&format=csv" download>CSV</a>
  <a href="?days=${days}&format=json" download="green-days-metrics-${days}d.json">JSON</a>
</div>
${inner}
<footer>Aggregate-only, cookieless. Generated ${esc(new Date().toUTCString())}.</footer>
</div></body></html>`;
}

function card(title, inner, err) {
  return `<div class="card"><h2>${esc(title)}</h2>${inner}${err ? `<div class="err">query error: ${esc(err)}</div>` : ''}</div>`;
}

function renderPage(m) {
  const e = m.errors;

  const actRow = (label, a) => `<div class="row"><span class="k">${label}</span><span class="v">${pct(a.rate)} <span style="color:var(--muted);font-weight:600">${a.recipe_sessions}/${a.app_open_sessions}</span></span></div>`;
  const activation = card('Activation rate',
    m.activation.rate == null ? NO_DATA :
      `<div class="big">${pct(m.activation.rate)}</div>
       <div class="note">${m.activation.recipe_sessions} of ${m.activation.app_open_sessions} visits generated a recipe</div>
       <div style="margin-top:10px">${actRow('in market', m.activation.in_market)}${actRow('out of market', m.activation.out_of_market)}</div>
       <div class="note">in market = the edge country is one of the 14 markets</div>`, e.activation);

  const R = m.retention;
  const retention = card('Return-visit rate', (R.returning_sessions + R.new_sessions) ?
    `<div class="big small">${pct(R.rate)}</div>
     <div class="note">${R.returning_sessions} returning of ${R.returning_sessions + R.new_sessions} sessions${R.median_days_since_return != null ? ` · median ${R.median_days_since_return}d since last visit` : ''}</div>` : NO_DATA, e.retention);

  const anyOnb = m.onboarding.steps.some((s) => s.next || s.complete || s.abandon);
  const onboarding = card('Onboarding drop-off', anyOnb ?
    `<div class="steps">${m.onboarding.steps.map((s) => `
      <div class="st"><span class="lbl">${esc(s.step)}</span>
        <span class="cts">next <b>${s.next}</b> · abandon ${s.abandon}${s.complete ? ` · <b>complete ${s.complete}</b>` : ''}</span></div>`).join('')}
     </div><div class="note">${m.onboarding.completed} completed the walkthrough</div>` : NO_DATA, e.onboarding);

  const rps = card('Recipes per session',
    m.recipes_per_session.value == null ? NO_DATA :
      `<div class="big small">${m.recipes_per_session.value.toFixed(2)}</div>
       <div class="note">${m.recipes_per_session.recipes} recipes ÷ ${m.recipes_per_session.sessions} cooking sessions</div>`, e.recipes);

  const ta = card('Try-another rate',
    m.try_another.rate == null ? NO_DATA :
      `<div class="big small">${pct(m.try_another.rate)}</div>
       <div class="note">${m.try_another.recipe_try_another} “try another” ÷ ${m.try_another.recipe_generated} recipes · lower is better</div>`, e.tryAnother);

  const search = card('Search no-results rate',
    m.search.miss_rate == null ? NO_DATA :
      `<div class="big small">${pct(m.search.miss_rate)}</div>
       <div class="note">${m.search.no_results} misses ÷ ${m.search.has_results + m.search.no_results} searches</div>`, e.search);

  const countryRows = (list) => {
    const max = Math.max(1, ...list.map((r) => r.sessions));
    return list.map((r) => `<div class="row"><span class="k">${esc(r.name)}${r.country ? ` <span style="color:var(--muted);font-weight:600">${esc(r.country)}</span>` : ''}</span><span class="bar"><i style="width:${(r.sessions / max * 100).toFixed(0)}%"></i></span><span class="v">${r.sessions}</span></div>`).join('');
  };
  const L = m.market_locked;
  const originLabel = { edge: 'edge-detected', default: 'default (Portugal, never picked)', picked: 'picked', stored: 'stored' };
  const originNote = L.total
    ? `locked at onboarding: ${Object.keys(L.by_origin).map((o) => `${L.by_origin[o]} ${originLabel[o] || esc(o)}`).join(' · ')}`
    : 'no onboarding lock-ins in this window';
  const market = card('Market', m.market.length ?
    `${countryRows(m.market)}<div class="note">the market each session ran on · ${originNote}</div>`
    : `${NO_DATA}<div class="note">sessions carry their market from 15 Sep 2026; earlier windows cannot be sliced this way</div>`, e.market || e.locked);
  const edgeCard = card('Edge country', m.edge.length ?
    `${countryRows(m.edge)}<div class="note">where Cloudflare saw the request come from · not the market, see the Market card</div>`
    : NO_DATA, e.edge);

  const maxFg = Math.max(1, ...m.field_guide.by_produce.map((f) => f.adds));
  const fieldGuideCard = card('Field guide → basket', m.field_guide.total ?
    `<div class="big small">${m.field_guide.total}</div>
     <div class="note">adds via the ?src=field_guide deep link, tagged per produce below</div>
     ${m.field_guide.by_produce.map((f) => `<div class="row"><span class="k">${esc(f.produce)}</span><span class="bar"><i style="width:${(f.adds / maxFg * 100).toFixed(0)}%"></i></span><span class="v">${f.adds}</span></div>`).join('')}`
    : NO_DATA, e.fieldGuide);

  const maxFn = Math.max(1, ...m.field_note.by_produce.map((f) => f.shares));
  const fieldNoteCard = card('Field note shares', m.field_note.total ?
    `<div class="big small">${m.field_note.total}</div>
     <div class="note">share-sheet taps on the recipe screen — top-of-funnel only, not a confirmed-share count</div>
     ${m.field_note.by_produce.map((f) => `<div class="row"><span class="k">${esc(f.produce)}</span><span class="bar"><i style="width:${(f.shares / maxFn * 100).toFixed(0)}%"></i></span><span class="v">${f.shares}</span></div>`).join('')}`
    : NO_DATA, e.fieldNote);

  const I2 = m.install;
  const installCard = card('Install / standalone', (I2.standalone_sessions + I2.browser_sessions) ?
    `<div class="big">${I2.standalone_rate == null ? '—' : (I2.standalone_rate * 100).toFixed(1)}<span class="unit">%</span></div>
     <div class="note">${I2.standalone_sessions} of ${I2.standalone_sessions + I2.browser_sessions} sessions ran as an installed app · ${I2.android_installs} Android install events (iOS fires none)</div>`
    : NO_DATA, e.displayMode || e.pwaInstall);

  const maxNi = Math.max(1, ...m.notify.by_produce.map((f) => f.n));
  const notifyCard = card('Tell me when it\'s back', m.notify.intent_total ?
    `<div class="big small">${m.notify.intent_total}</div>
     <div class="note">taps on out-of-season produce · ${m.notify.grant_rate == null ? 'no permission results yet' : (m.notify.grant_rate * 100).toFixed(0) + '% granted'}</div>
     ${m.notify.permission.map((r) => `<div class="row"><span class="k">${esc(r.result)}</span><span class="v">${r.n}</span></div>`).join('')}
     <div class="note">declared demand, ranked — this is the authoring queue</div>
     ${m.notify.by_produce.map((f) => `<div class="row"><span class="k">${esc(f.produce)}</span><span class="bar"><i style="width:${(f.n / maxNi * 100).toFixed(0)}%"></i></span><span class="v">${f.n}</span></div>`).join('')}`
    : NO_DATA, e.notifyIntent || e.notifyPerm);

  const H = m.health;
  const health = card('Recipe engine health', H.recipes ?
    `<div class="hstat">
       <div><div class="n">${H.p50_ms == null ? '—' : Math.round(H.p50_ms)}<span class="unit">ms</span></div><div class="l">p50 latency</div></div>
       <div><div class="n">${H.p95_ms == null ? '—' : Math.round(H.p95_ms)}<span class="unit">ms</span></div><div class="l">p95 latency</div></div>
       <div><div class="n">${H.ok_rate == null ? '—' : (H.ok_rate * 100).toFixed(1)}<span class="unit">%</span></div><div class="l">ok rate</div></div>
       <div><div class="n">${H.avg_tokens == null ? '—' : Math.round(H.avg_tokens)}</div><div class="l">avg tokens</div></div>
     </div><div class="note">${H.recipes} recipes generated</div>` : NO_DATA, e.health);

  const A = m.affiliate;
  const maxAf = Math.max(1, ...A.by_partner.map((r) => r.taps));
  const affiliateCard = card('Affiliate CTA taps', A.taps ?
    `<div class="big small">${A.taps}</div>
     <div class="note">${A.tap_rate == null ? 'no recipes in covered markets yet' : `${(A.tap_rate * 100).toFixed(1)}% of ${A.recipes_in_covered_markets} recipes cooked in ${A.covered_markets.join(', ')}`} · directional, not a true CTR</div>
     ${A.by_partner.map((r) => `<div class="row"><span class="k">${esc(r.partner)}${r.country ? ` <span style="color:var(--muted);font-weight:600">${esc(r.country)}</span>` : ''}</span><span class="bar"><i style="width:${(r.taps / maxAf * 100).toFixed(0)}%"></i></span><span class="v">${r.taps}</span></div>`).join('')}`
    : `${NO_DATA}<div class="note">CTA renders in ${A.covered_markets.length ? esc(A.covered_markets.join(', ')) : 'no markets — data/affiliates.json is empty'}</div>`,
    e.affiliate || e.affiliateBase);

  const S = m.source;
  const maxSrc = Math.max(1, ...S.by_source.map((r) => r.sessions));
  const sourceCard = card('Traffic source', S.total_sessions ?
    `<div class="big small">${S.attributed_sessions}</div>
     <div class="note">of ${S.total_sessions} sessions arrived with a utm_source or external referrer</div>
     ${S.by_source.map((r) => `<div class="row"><span class="k">${esc(r.source)}</span><span class="bar"><i style="width:${(r.sessions / maxSrc * 100).toFixed(0)}%"></i></span><span class="v">${r.sessions}</span></div>`).join('')}`
    : NO_DATA, e.source);

  const grid = `<div class="grid">${activation}${retention}${onboarding}${rps}${ta}${search}${market}${edgeCard}${fieldGuideCard}${fieldNoteCard}${installCard}${notifyCard}${affiliateCard}${sourceCard}${health}</div>`;
  return shell(grid, m.days);
}

function renderNotConfigured(days) {
  const inner = `<div class="card"><h2>Not configured</h2>
    <div class="empty">Set the <b>CF_ACCOUNT_ID</b> and <b>AE_API_TOKEN</b> secrets, then reload.</div>
    <div class="note">wrangler secret put CF_ACCOUNT_ID · wrangler secret put AE_API_TOKEN</div></div>`;
  return shell(inner, days);
}
