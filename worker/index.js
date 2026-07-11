/* Green Days Worker — static assets plus the small API.
   Routes: GET  /greendays/api/context  → market country, band, season, weather line
           POST /greendays/api/recipe   → the recipe engine (Anthropic API)
   Everything else is served from the built front-end by the assets binding. */
import PRODUCE from '../data/produce.json';
import MARKETS from '../data/markets.json';
import { SYSTEM_PROMPT, RECIPE_SCHEMA, buildUserMessage } from './prompt.js';
import { handleMetrics } from './metrics.js';

const BY_ID = new Map(PRODUCE.map((p) => [p.id, p]));
const DIETS = new Set(['none', 'vegetarian', 'vegan']);
const ALLERGIES = new Set(['nuts', 'dairy', 'gluten', 'eggs', 'shellfish', 'soy']);
const SEASON_MONTHS = { spring: [2, 3, 4], summer: [5, 6, 7], autumn: [8, 9, 10], winter: [11, 0, 1] };

// Country → { country, lang, band } from markets.json (same source as the app).
const bandOf = (c) => (MARKETS[c] || {}).band || 'temperate';
const countryName = (c) => (MARKETS[c] || {}).country || c;
const seasonForMonth0 = (m) => Object.keys(SEASON_MONTHS).find((s) => SEASON_MONTHS[s].includes(m)) || 'summer';

// Mirror of the front-end's rough-season parser so both sides agree on
// what is in season (src/produce.js).
function seasonMonthSet(str) {
  str = (str || '').toLowerCase();
  if (str.includes('year-round')) return null;
  const cycle = ['spring', 'summer', 'autumn', 'winter'];
  const found = cycle.map((s) => ({ s, i: str.indexOf(s) })).filter((o) => o.i >= 0).sort((a, b) => a.i - b.i).map((o) => o.s);
  if (found.length === 0) return new Set();
  let names = found;
  if (found.length > 1 && (str.includes('–') || str.includes('-'))) {
    names = [];
    let i = cycle.indexOf(found[0]);
    const end = cycle.indexOf(found[found.length - 1]);
    while (true) { names.push(cycle[i]); if (i === end) break; i = (i + 1) % 4; }
  }
  const set = new Set();
  names.forEach((n) => SEASON_MONTHS[n].forEach((m) => set.add(m)));
  return set;
}
function seasonalityOf(seasonStr, month0, band) {
  const s = (seasonStr || '').toLowerCase();
  const set = seasonMonthSet(seasonStr);
  let base;
  if (set === null || set.size === 0) base = 'in';
  else if (!set.has(month0)) base = 'out';
  else base = s.includes(seasonForMonth0(month0)) ? 'peak' : 'in';
  // A "(Med)" season is only in season in the Mediterranean band.
  if (base !== 'out' && band && band !== 'mediterranean' && /\(med/.test(s)) return 'out';
  return base;
}

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

/* ---- product analytics (Workers Analytics Engine) ----
   Aggregate-only, no user IDs, no PII, no free-text. One dataset, one shape. */
const str = (x, max = 64) => (x == null ? '' : String(x)).slice(0, max);
const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
// Client-postable events (recipe_generated is server-only and not in this set).
const CLIENT_EVENTS = new Set([
  'app_open', 'onboarding_step', 'market_selected', 'prefs_set', 'search', 'tab_view',
  'product_view', 'produce_added', 'fallback_shown', 'basket_cook', 'recipe_try_another',
  'grab_one_more_tap', 'offseason_added', 'error',
]);
function track(env, name, f = {}) {
  if (!env.GD_EVENTS) return; // binding absent (e.g. vite-only dev) → no-op
  try {
    env.GD_EVENTS.writeDataPoint({
      indexes: [name],
      blobs: [name, str(f.country, 2), str(f.band, 16), str(f.detail), str(f.extra), str(f.sid)],
      doubles: [num(f.v1), num(f.v2), num(f.v3)],
    });
  } catch (_) { /* never let analytics break a request */ }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/greendays/api/context') return handleContext(request);
    if (url.pathname === '/greendays/api/recipe') return handleRecipe(request, env, ctx);
    if (url.pathname === '/greendays/api/event') return handleEvent(request, env);
    if (url.pathname === '/greendays/metrics') return handleMetrics(request, env);
    if (url.pathname.startsWith('/greendays/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};

/* ---- POST /greendays/api/event ----
   Client beacon. Allowlist the event name, add country/band from the edge, and
   track. Only schema fields are read; a `query` field (or anything else) is
   ignored, so search text can never be logged. Always 204. */
async function handleEvent(request, env) {
  if (request.method !== 'POST') return new Response(null, { status: 204 });
  const b = await request.json().catch(() => null);
  if (!b || !CLIENT_EVENTS.has(b.name)) return new Response(null, { status: 204 });
  const country = (request.cf && request.cf.country) || '';
  track(env, b.name, {
    country, band: bandOf(country),
    detail: b.detail, extra: b.extra, v1: b.v1, v2: b.v2, v3: b.v3, sid: b.sid,
  });
  return new Response(null, { status: 204 });
}

/* ---- GET /greendays/api/context ----
   Edge country → language + climate band, with the v1 static weather line. */
function handleContext(request) {
  const country = (request.cf && request.cf.country) || 'PT';
  const now = new Date();
  return json(
    {
      country,
      band: bandOf(country),
      season: seasonForMonth0(now.getMonth()),
      month: now.getMonth() + 1,
      weather: '21°, clear', // static placeholder for v1; real provider later
    },
    200,
    { 'cache-control': 'no-store' }
  );
}

/* ---- POST /greendays/api/recipe ---- */
async function handleRecipe(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  // Validate the basket against produce.json — the only produce vocabulary.
  const rawBasket = Array.isArray(body.basket) ? body.basket : null;
  if (!rawBasket || rawBasket.length === 0) return json({ error: 'basket is empty' }, 400);
  const basket = [...new Set(rawBasket.filter((id) => typeof id === 'string'))].slice(0, 24);
  const unknown = basket.filter((id) => !BY_ID.has(id));
  if (unknown.length) return json({ error: `unknown produce: ${unknown.join(', ')}` }, 400);
  if (basket.length === 0) return json({ error: 'basket is empty' }, 400);

  const cfCountry = (request.cf && request.cf.country) || 'PT';
  const country = /^[A-Z]{2}$/.test(body.country || '') ? body.country : cfCountry;
  const month1 = Number.isInteger(body.month) && body.month >= 1 && body.month <= 12 ? body.month : new Date().getMonth() + 1;
  const month0 = month1 - 1;
  const band = bandOf(country); // seasonality is band-aware ("(Med)" seasons)

  const prefs = {
    diet: DIETS.has(body?.prefs?.diet) ? body.prefs.diet : 'none',
    allergies: Array.isArray(body?.prefs?.allergies)
      ? body.prefs.allergies.map((a) => String(a).toLowerCase()).filter((a) => ALLERGIES.has(a))
      : [],
  };
  const avoid = Array.isArray(body.avoid)
    ? body.avoid.filter((t) => typeof t === 'string').map((t) => t.slice(0, 140)).slice(0, 8)
    : [];
  const sid = str(body.sid); // per-visit grouping, shared with client events

  // recipe_generated is the money metric — record it (and errors) with the
  // session so activation/health queries line up with client events.
  const rg = (model, latencyMs, ok, tokens) =>
    track(env, 'recipe_generated', { country, band, detail: model, v1: latencyMs, v2: ok, v3: tokens, sid });
  const trackErr = (code) => track(env, 'error', { country, band, detail: 'recipe', extra: code, sid });

  // Light rate limit per IP (cost control).
  if (env.RECIPE_RL) {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const { success } = await env.RECIPE_RL.limit({ key: ip });
    if (!success) return json({ error: 'A moment between recipes. Try again shortly.' }, 429);
  }

  // Identical baskets share a cached recipe for the month — but never when the
  // shopper explicitly asked for another one.
  const cache = caches.default;
  let cacheKey = null;
  if (avoid.length === 0) {
    const keyMaterial = JSON.stringify({
      basket: [...basket].sort(),
      country,
      month: month1,
      diet: prefs.diet,
      allergies: [...prefs.allergies].sort(),
      model: env.RECIPE_MODEL || 'claude-sonnet-5',
      v: 1,
    });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(keyMaterial));
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    cacheKey = new Request(`https://greendays-recipe-cache.internal/${hash}`);
    const hit = await cache.match(cacheKey);
    if (hit) {
      const cached = new Response(hit.body, hit);
      cached.headers.set('x-recipe-cache', 'hit');
      return cached;
    }
  }

  const basketItems = basket.map((id) => {
    const p = BY_ID.get(id);
    return { id, name_en: p.name_en, season: p.season, seasonality: seasonalityOf(p.season, month0, band) };
  });

  // Candidates for "grab one more": in season now, not in the basket, peak first.
  const inSeasonIds = PRODUCE
    .map((p) => ({ id: p.id, s: seasonalityOf(p.season, month0, band) }))
    .filter((x) => x.s !== 'out' && !basket.includes(x.id))
    .sort((a, b) => (a.s === 'peak' ? 0 : 1) - (b.s === 'peak' ? 0 : 1))
    .slice(0, 40)
    .map((x) => x.id);

  const MODEL = env.RECIPE_MODEL || 'claude-sonnet-5';
  let recipe;
  if (!env.ANTHROPIC_API_KEY) {
    if (env.MOCK_RECIPES === '1') {
      recipe = mockRecipe(basketItems, inSeasonIds, avoid);
      rg('mock', 0, 1, 0);
    } else {
      return json({ error: 'recipe engine not configured' }, 503);
    }
  } else {
    const userMessage = buildUserMessage({
      basketItems,
      country,
      countryName: countryName(country),
      month1,
      season: seasonForMonth0(month0),
      band,
      prefs,
      inSeasonIds,
      avoid,
    });

    const t0 = Date.now();
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        thinking: { type: 'disabled' },
        // The big fixed half of the prompt is cacheable across shoppers.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        output_config: { format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    const latencyMs = Date.now() - t0;

    if (!apiResponse.ok) {
      const detail = await apiResponse.text().catch(() => '');
      console.error('anthropic error', apiResponse.status, detail.slice(0, 500));
      rg(MODEL, latencyMs, 0, 0);
      trackErr(String(apiResponse.status));
      const status = apiResponse.status === 429 ? 429 : 502;
      return json({ error: 'The kitchen is busy. Try again in a moment.' }, status);
    }

    const message = await apiResponse.json();
    const u = message.usage || {};
    const tokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') {
      console.error('unusable completion', message.stop_reason);
      rg(MODEL, latencyMs, 0, tokens);
      trackErr(message.stop_reason);
      return json({ error: 'Could not write a recipe for this basket. Try again.' }, 502);
    }
    const text = (message.content || []).find((b) => b.type === 'text')?.text;
    try {
      recipe = normalizeRecipe(JSON.parse(text), basket);
      rg(MODEL, latencyMs, 1, tokens);
    } catch (err) {
      console.error('bad recipe JSON', String(err), (text || '').slice(0, 300));
      rg(MODEL, latencyMs, 0, tokens);
      trackErr('bad_json');
      return json({ error: 'Could not write a recipe for this basket. Try again.' }, 502);
    }
  }

  const response = json(recipe, 200, {
    'cache-control': 'no-store',
    'x-recipe-cache': 'miss',
  });
  if (cacheKey) {
    const forCache = json(recipe, 200, { 'cache-control': 's-maxage=43200' });
    ctx.waitUntil(cache.put(cacheKey, forCache));
  }
  return response;
}

// Belt-and-braces on top of the schema-constrained output: coerce shapes and
// keep stars/grabOneMore inside the produce vocabulary.
function normalizeRecipe(r, basket) {
  if (!r || typeof r.title !== 'string' || !Array.isArray(r.method) || r.method.length === 0) {
    throw new Error('missing title or method');
  }
  const stars = (Array.isArray(r.stars) ? r.stars : []).filter((id) => basket.includes(id));
  // Prefer a valid catalogue id (skip anything already in the basket); if the
  // model returned a name instead, pass it through so the client can resolve it
  // to a produce detail or fall back to a Home search.
  let grab = null;
  if (typeof r.grabOneMore === 'string') {
    const g = r.grabOneMore.trim();
    if (g) grab = BY_ID.has(g) ? (basket.includes(g) ? null : g) : g.slice(0, 60);
  }
  return {
    title: r.title,
    time: typeof r.time === 'string' ? r.time : '',
    note: typeof r.note === 'string' ? r.note : '',
    stars: stars.length ? stars : basket.slice(0, 3),
    ingredients: (Array.isArray(r.ingredients) ? r.ingredients : [])
      .filter((i) => i && typeof i.item === 'string')
      .map((i) => ({ item: i.item, pantry: !!i.pantry })),
    offSeasonAdvice: typeof r.offSeasonAdvice === 'string' && r.offSeasonAdvice.trim() ? r.offSeasonAdvice : null,
    grabOneMore: grab,
    protein: Array.isArray(r.protein) && r.protein.length ? r.protein.filter((p) => typeof p === 'string').slice(0, 2) : null,
    method: r.method.filter((s) => typeof s === 'string'),
  };
}

// Local development without an API key (MOCK_RECIPES=1 in .dev.vars).
function mockRecipe(basketItems, inSeasonIds, avoid) {
  const lead = basketItems.find((i) => i.seasonality !== 'out') || basketItems[0];
  const out = basketItems.find((i) => i.seasonality === 'out');
  return {
    title: `${lead.name_en}${avoid.length ? ', another way' : ', barely touched'} (mock)`,
    time: 'Quick, about 15 minutes',
    note: 'A canned recipe from the local mock engine, so the flow can be tested without a key.',
    stars: basketItems.filter((i) => i.seasonality !== 'out').map((i) => i.id),
    ingredients: [
      ...basketItems.map((i) => ({ item: i.name_en.toLowerCase(), pantry: false })),
      { item: 'olive oil', pantry: true },
      { item: '1 clove garlic', pantry: true },
      { item: 'flaky salt', pantry: true },
    ],
    offSeasonAdvice: out ? `${out.name_en} is out of season here, so it will taste flatter. Roast it hard to concentrate what is there.` : null,
    grabOneMore: inSeasonIds[0] || null,
    protein: ['a soft-boiled egg', 'grilled sardines'],
    method: [
      `Slice the ${lead.name_en.toLowerCase()} and season it well.`,
      'Get a pan very hot and char until blistered and just tender.',
      'A flood of olive oil, a rub of garlic, flaky salt. Eat warm.',
    ],
  };
}
