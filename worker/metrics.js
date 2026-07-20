/* Green Days — private metrics page at /metrics.
   Access-gated (METRICS_TOKEN via ?key= or HTTP Basic). Queries the Analytics
   Engine SQL API and renders the KPIs from KPIs_and_Dashboard.md. Cross-event
   ratios are computed here from grouped rows (no reliance on IF() in SQL). */
import MARKETS from '../data/markets.json';

const DATASET = 'Green_Days_Early_Days';
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

// --- auth: ?key= or HTTP Basic must equal METRICS_TOKEN; 401 otherwise ---
function authorized(request, env) {
  const token = env.METRICS_TOKEN;
  if (!token) return false; // never open when the secret is unset
  const url = new URL(request.url);
  if (url.searchParams.get('key') === token) return true;
  const h = request.headers.get('Authorization') || '';
  if (h.startsWith('Basic ')) {
    try {
      const [user, pass] = atob(h.slice(6)).split(':');
      if (user === token || pass === token) return true;
    } catch (_) { /* malformed header */ }
  }
  return false;
}

export async function handleMetrics(request, env) {
  if (!authorized(request, env)) {
    return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Green Days metrics"' } });
  }

  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days'), 10) || 7));
  const wantJson = url.searchParams.get('format') === 'json';
  const key = url.searchParams.get('key') || ''; // carried into pill links so switching windows keeps auth

  if (!env.CF_ACCOUNT_ID || !env.AE_API_TOKEN) {
    const msg = { error: 'metrics_not_configured', detail: 'Set CF_ACCOUNT_ID and AE_API_TOKEN secrets.' };
    if (wantJson) return json(msg, 200);
    return html(renderNotConfigured(days, key), 200);
  }

  const I = `NOW() - INTERVAL '${days}' DAY`;
  const Q = {
    activation: `SELECT blob1 AS event, COUNT(DISTINCT blob6) AS sessions FROM ${DATASET} WHERE blob1 IN ('app_open','recipe_generated') AND timestamp > ${I} GROUP BY event`,
    onboarding: `SELECT blob4 AS step, blob5 AS action, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1='onboarding_step' AND timestamp > ${I} GROUP BY step, action ORDER BY n DESC`,
    recipes: `SELECT SUM(_sample_interval) AS recipes, COUNT(DISTINCT blob6) AS sessions FROM ${DATASET} WHERE blob1='recipe_generated' AND timestamp > ${I}`,
    tryAnother: `SELECT blob1 AS event, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1 IN ('recipe_generated','recipe_try_another') AND timestamp > ${I} GROUP BY event`,
    search: `SELECT double1 AS has_results, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1='search' AND timestamp > ${I} GROUP BY has_results`,
    fallback: `SELECT blob4 AS produce, SUM(_sample_interval) AS shows FROM ${DATASET} WHERE blob1='fallback_shown' AND timestamp > ${I} GROUP BY produce ORDER BY shows DESC LIMIT 15`,
    market: `SELECT blob2 AS country, COUNT(DISTINCT blob6) AS sessions FROM ${DATASET} WHERE blob1='app_open' AND timestamp > ${I} GROUP BY country ORDER BY sessions DESC`,
    health: `SELECT quantileWeighted(0.5)(double1, _sample_interval) AS p50_ms, quantileWeighted(0.95)(double1, _sample_interval) AS p95_ms, SUM(double2 * _sample_interval) / SUM(_sample_interval) AS ok_rate, SUM(double3 * _sample_interval) / SUM(_sample_interval) AS avg_tokens, SUM(_sample_interval) AS recipes FROM ${DATASET} WHERE blob1='recipe_generated' AND timestamp > ${I}`,
    // double2 on app_open = returning (1) vs first-ever-visit (0), set client-side
    // from the non-cookie gd_last_visit flag (see src/GreenDaysApp.jsx).
    retention: `SELECT double2 AS returning, SUM(_sample_interval) AS n FROM ${DATASET} WHERE blob1='app_open' AND timestamp > ${I} GROUP BY returning`,
    recency: `SELECT quantileWeighted(0.5)(double3, _sample_interval) AS median_days FROM ${DATASET} WHERE blob1='app_open' AND double2=1 AND timestamp > ${I}`,
  };

  // Run all queries; a single failing query degrades only its own card.
  const errors = {};
  const rows = {};
  await Promise.all(Object.entries(Q).map(async ([k, q]) => {
    try { rows[k] = await aeSql(env, q); } catch (e) { errors[k] = String(e.message || e); rows[k] = []; }
  }));

  // --- derive the KPIs from the grouped rows ---
  const byEvent = (arr, key = 'event', val = 'n') => Object.fromEntries((arr || []).map((r) => [r[key], num(r[val])]));

  const act = byEvent(rows.activation, 'event', 'sessions');
  const activation = {
    app_open_sessions: act.app_open || 0,
    recipe_sessions: act.recipe_generated || 0,
    rate: act.app_open ? (act.recipe_generated || 0) / act.app_open : null,
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

  const fallback = (rows.fallback || []).map((r) => ({ produce: r.produce || '(unknown)', shows: num(r.shows) }));
  const market = (rows.market || []).map((r) => ({ country: r.country || '', name: countryName(r.country), sessions: num(r.sessions) }));

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

  const metrics = { dataset: DATASET, days, generated_at: new Date().toISOString(), activation, onboarding, recipes_per_session: recipesPerSession, try_another: tryAnother, search, fallback, market, health, retention, errors };

  if (wantJson) return json(metrics, 200);
  return html(renderPage(metrics, key), 200);
}

/* ================= rendering ================= */
const json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const html = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NO_DATA = '<div class="empty">no data yet</div>';

function shell(inner, days, key) {
  const kq = key ? `&key=${encodeURIComponent(key)}` : '';
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
  .windows { display:flex; gap:8px; margin:14px 0 22px; flex-wrap:wrap; }
  .windows a { text-decoration:none; font-size:13px; font-weight:700; color:var(--muted); border:1px solid var(--line); background:var(--card); padding:6px 12px; border-radius:999px; }
  .windows a.on { background:var(--accent); color:#fff; border-color:var(--accent); }
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
<div class="windows">${[1, 7, 14, 30, 90].map((d) => `<a class="${d === days ? 'on' : ''}" href="?days=${d}${kq}">${d}d</a>`).join('')}</div>
${inner}
<footer>Aggregate-only, cookieless. Generated ${esc(new Date().toUTCString())}.</footer>
</div></body></html>`;
}

function card(title, inner, err) {
  return `<div class="card"><h2>${esc(title)}</h2>${inner}${err ? `<div class="err">query error: ${esc(err)}</div>` : ''}</div>`;
}

function renderPage(m, key) {
  const e = m.errors;

  const activation = card('Activation rate',
    m.activation.rate == null ? NO_DATA :
      `<div class="big">${pct(m.activation.rate)}</div>
       <div class="note">${m.activation.recipe_sessions} of ${m.activation.app_open_sessions} visits generated a recipe</div>`, e.activation);

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

  const maxFb = Math.max(1, ...m.fallback.map((f) => f.shows));
  const fallback = card('Top fallback produce', m.fallback.length ?
    m.fallback.map((f) => `<div class="row"><span class="k">${esc(f.produce)}</span><span class="bar"><i style="width:${(f.shows / maxFb * 100).toFixed(0)}%"></i></span><span class="v">${f.shows}</span></div>`).join('')
    : NO_DATA, e.fallback);

  const maxMk = Math.max(1, ...m.market.map((r) => r.sessions));
  const market = card('Market distribution', m.market.length ?
    m.market.map((r) => `<div class="row"><span class="k">${esc(r.name)}${r.country ? ` <span style="color:var(--muted);font-weight:600">${esc(r.country)}</span>` : ''}</span><span class="bar"><i style="width:${(r.sessions / maxMk * 100).toFixed(0)}%"></i></span><span class="v">${r.sessions}</span></div>`).join('')
    : NO_DATA, e.market);

  const H = m.health;
  const health = card('Recipe engine health', H.recipes ?
    `<div class="hstat">
       <div><div class="n">${H.p50_ms == null ? '—' : Math.round(H.p50_ms)}<span class="unit">ms</span></div><div class="l">p50 latency</div></div>
       <div><div class="n">${H.p95_ms == null ? '—' : Math.round(H.p95_ms)}<span class="unit">ms</span></div><div class="l">p95 latency</div></div>
       <div><div class="n">${H.ok_rate == null ? '—' : (H.ok_rate * 100).toFixed(1)}<span class="unit">%</span></div><div class="l">ok rate</div></div>
       <div><div class="n">${H.avg_tokens == null ? '—' : Math.round(H.avg_tokens)}</div><div class="l">avg tokens</div></div>
     </div><div class="note">${H.recipes} recipes generated</div>` : NO_DATA, e.health);

  const grid = `<div class="grid">${activation}${retention}${onboarding}${rps}${ta}${search}${fallback}${market}${health}</div>`;
  return shell(grid, m.days, key);
}

function renderNotConfigured(days, key) {
  const inner = `<div class="card"><h2>Not configured</h2>
    <div class="empty">Set the <b>CF_ACCOUNT_ID</b> and <b>AE_API_TOKEN</b> secrets, then reload.</div>
    <div class="note">wrangler secret put CF_ACCOUNT_ID · wrangler secret put AE_API_TOKEN</div></div>`;
  return shell(inner, days, key);
}
