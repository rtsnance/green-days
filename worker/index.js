/* Green Days Worker — static assets plus the small API.
   Serves greendays.day at the root; 301-redirects the retired
   lab.ryantnance.com/greendays* host to greendays.day.
   Routes: GET  /api/context  → market country, band, season, weather line
           POST /api/recipe   → the recipe engine (Anthropic API)
   Everything else is served from the built front-end by the assets binding. */
import PRODUCE from '../data/produce.json';
import MARKETS from '../data/markets.json';
import { SYSTEM_PROMPT, SYSTEM_PROMPT_HAIKU, pickSystemPrompt, RECIPE_SCHEMA, buildUserMessage } from './prompt.js';
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
  'grab_one_more_tap', 'offseason_added', 'error', 'time_to_first_content',
  'affiliate_cta_tap',
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

    // Old lab.ryantnance.com/greendays* links now live at the greendays.day
    // root — permanently redirect, preserving the rest of the path/query so
    // deep links (e.g. .../greendays/metrics?key=…) keep working.
    if (url.hostname === 'lab.ryantnance.com') {
      const newPath = url.pathname.replace(/^\/greendays/, '') || '/';
      return Response.redirect(`https://greendays.day${newPath}${url.search}`, 301);
    }

    if (url.pathname === '/api/context') return handleContext(request);
    if (url.pathname === '/api/recipe') return handleRecipe(request, env, ctx);
    if (url.pathname === '/api/event') return handleEvent(request, env);
    if (url.pathname === '/metrics') return handleMetrics(request, env);
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};

/* ---- POST /api/event ----
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

/* ---- GET /api/context ----
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

/* ---- POST /api/recipe ---- */
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

  // Light rate limit per IP (cost control). Skipped under the local mock
  // engine so the eval gate can fire 40 requests without throttling.
  if (env.RECIPE_RL && env.MOCK_RECIPES !== '1') {
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
      recipe = mockRecipe(basketItems, inSeasonIds, avoid, prefs);
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
    const basketNames = basketItems.map((i) => i.name_en.toLowerCase());

    // Up to two attempts: generate, then (if the deterministic guard finds a
    // diet/allergy/banned-word violation) send one correction turn. The guard
    // is the safety net behind the prompt — a strong prompt lowers the slip
    // rate but cannot guarantee zero, and an allergen must never be served.
    const messages = [{ role: 'user', content: userMessage }];
    let totalLatency = 0;
    let totalTokens = 0;
    let failStatus = 502;
    let failCode = null;

    for (let attempt = 0; attempt < 2; attempt++) {
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
          // Haiku models get the Haiku-tuned prompt; Sonnet keeps its own.
          system: [{ type: 'text', text: pickSystemPrompt(MODEL), cache_control: { type: 'ephemeral' } }],
          output_config: { format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
          messages,
        }),
      });
      totalLatency += Date.now() - t0;

      if (!apiResponse.ok) {
        const detail = await apiResponse.text().catch(() => '');
        console.error('anthropic error', apiResponse.status, detail.slice(0, 500));
        failCode = String(apiResponse.status);
        failStatus = apiResponse.status === 429 ? 429 : 502;
        break;
      }

      const message = await apiResponse.json();
      const u = message.usage || {};
      totalTokens += (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') {
        console.error('unusable completion', message.stop_reason);
        failCode = message.stop_reason;
        break;
      }
      const text = (message.content || []).find((b) => b.type === 'text')?.text;
      let candidate;
      try {
        candidate = normalizeRecipe(JSON.parse(text), basket);
      } catch (err) {
        console.error('bad recipe JSON', String(err), (text || '').slice(0, 300));
        failCode = 'bad_json';
        break;
      }

      recipe = candidate;
      const problems = auditRecipe(candidate, prefs, basketNames).concat(
        bannedWordHits(recipeText(candidate)).map((b) => `banned-word:${b}`),
      );
      if (problems.length === 0) break; // clean, ship it

      if (attempt === 0) {
        console.warn('recipe guard: repairing', problems.slice(0, 8));
        messages.push({ role: 'assistant', content: text });
        messages.push({
          role: 'user',
          content: `The recipe you gave broke these hard rules: ${problems.join('; ')}. Rewrite it so every one is fixed, keeping the same dish idea and the exact same JSON shape. Do not introduce any banned ingredient or banned word, and do not mention the constraints.`,
        });
      }
    }

    if (recipe == null) {
      rg(MODEL, totalLatency, 0, totalTokens);
      trackErr(failCode || 'guard');
      return json({ error: 'Could not write a recipe for this basket. Try again.' }, failStatus);
    }

    // Deterministic cleanup of any residual banned words (safe, cosmetic), then
    // a final hard check on diet/allergy: if a violation survived the repair,
    // fail safe rather than serve it.
    recipe = sanitizeBannedWords(recipe);
    const unsafe = auditRecipe(recipe, prefs, basketNames);
    if (unsafe.length) {
      console.error('recipe guard: unsafe after repair', unsafe.slice(0, 8));
      rg(MODEL, totalLatency, 0, totalTokens);
      trackErr('unsafe_prefs');
      return json({ error: 'Could not write a recipe that fits your preferences. Try another basket.' }, 502);
    }
    rg(MODEL, totalLatency, 1, totalTokens);
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

// --- Deterministic diet/allergy/voice guard -------------------------------
// Term families mirror the offline eval lint (eval/grade.py) so the worker and
// the eval agree on what a violation is. Word-boundary matching keeps compound
// produce safe (butternut !== butter, eggplant !== egg); a couple of compounds
// still need scrubbing (oyster mushroom, plant milks).
const DAIRY = ['butter', 'buttered', 'buttery', 'cream', 'creamed', 'milk', 'cheese', 'yogurt', 'yoghurt', 'burrata', 'mozzarella', 'parmesan', 'parmigiano', 'queijo', 'feta', 'ricotta', 'mascarpone', 'ghee'];
const EGGS = ['egg', 'eggs'];
const GLUTEN = ['bread', 'toast', 'pasta', 'flour', 'breadcrumb', 'breadcrumbs', 'crouton', 'croutons', 'couscous', 'wheat', 'barley', 'bulgur', 'orzo', 'farro', 'pastry'];
const NUTS = ['almond', 'almonds', 'walnut', 'walnuts', 'hazelnut', 'hazelnuts', 'pecan', 'pecans', 'cashew', 'cashews', 'pistachio', 'pistachios', 'peanut', 'peanuts', 'pine nut', 'pine nuts', 'praline'];
const SHELLFISH = ['prawn', 'prawns', 'shrimp', 'crab', 'crabs', 'lobster', 'mussel', 'mussels', 'clam', 'clams', 'scallop', 'scallops', 'langoustine', 'crayfish', 'oyster', 'oysters'];
const SOY = ['soy', 'soya', 'tofu', 'miso', 'tempeh', 'tamari', 'edamame'];
const MEAT = ['beef', 'pork', 'lamb', 'chicken', 'sausage', 'sausages', 'chorizo', 'bacon', 'prosciutto', 'pancetta', 'duck', 'veal', 'turkey', 'salami', 'guanciale'];
const FISH = ['fish', 'sardine', 'sardines', 'anchovy', 'anchovies', 'tuna', 'salmon', 'mackerel', 'cod', 'haddock', 'trout', 'seafood'];
const ALLERGEN_TERMS = { nuts: NUTS, dairy: DAIRY, gluten: GLUTEN, eggs: EGGS, shellfish: SHELLFISH, soy: SOY };

function recipeText(r) {
  const parts = [r.title, r.time, r.note, r.offSeasonAdvice, r.grabOneMore];
  for (const i of r.ingredients || []) parts.push(i.item);
  for (const p of r.protein || []) parts.push(p);
  for (const s of r.method || []) parts.push(s);
  return parts.filter((x) => typeof x === 'string').join(' \n ');
}

function termHits(text, terms, allow = []) {
  const found = [];
  for (const t of terms) {
    if (allow.includes(t)) continue;
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i');
    if (re.test(text)) found.push(t);
  }
  return found;
}

// Returns an array of violation strings for the active diet + allergies.
// Ingredients the shopper put in their own basket are not held against them.
function auditRecipe(recipe, prefs, basketNames = []) {
  const text = recipeText(recipe).toLowerCase();
  const shellText = text.replace(/oyster mushrooms?/g, 'mushroom');
  const dairyText = text.replace(/\b(coconut|almond|oat|soya|soy|rice|cashew|hemp)\s+(milk|cream|yogurt|yoghurt)\b/g, '$1');
  const out = [];
  const push = (tag, hits) => hits.filter((t) => !basketNames.some((n) => n.includes(t))).forEach((t) => out.push(`${tag}:${t}`));

  if (prefs.diet === 'vegan' || prefs.diet === 'vegetarian') {
    push('diet-meat', termHits(text, MEAT));
    push('diet-fish', termHits(shellText, FISH.concat(SHELLFISH)));
  }
  if (prefs.diet === 'vegan') {
    push('vegan-dairy', termHits(dairyText, DAIRY));
    push('vegan-egg', termHits(text, EGGS));
    push('vegan-honey', termHits(text, ['honey']));
  }
  for (const a of prefs.allergies) {
    const terms = ALLERGEN_TERMS[a];
    if (!terms) continue;
    const src = a === 'shellfish' ? shellText : a === 'dairy' ? dairyText : text;
    push(`allergy-${a}`, termHits(src, terms));
  }
  return out;
}

// Banned by the voice rules and safe to strip deterministically. "just" is not
// here: it is legitimate as a degree adverb ("just tender") and only warned on.
function bannedWordHits(text) {
  const b = [];
  if (text.includes('—')) b.push('em-dash');
  if (/\bsimply\b/i.test(text)) b.push('simply');
  if (text.includes('!')) b.push('exclamation');
  return b;
}

function scrubText(s) {
  if (typeof s !== 'string') return s;
  if (!/[—!]/.test(s) && !/\bsimply\b/i.test(s)) return s; // nothing banned, leave untouched
  const out = s
    .replace(/\s*—\s*/g, ', ')
    .replace(/\bsimply\s+/gi, '')
    .replace(/,?\s*\bsimply\b/gi, '')
    .replace(/!+/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function sanitizeBannedWords(r) {
  return {
    ...r,
    title: scrubText(r.title),
    time: scrubText(r.time),
    note: scrubText(r.note),
    offSeasonAdvice: r.offSeasonAdvice == null ? null : scrubText(r.offSeasonAdvice),
    grabOneMore: r.grabOneMore == null ? null : r.grabOneMore, // an id, leave as-is
    ingredients: (r.ingredients || []).map((i) => ({ ...i, item: scrubText(i.item) })),
    protein: r.protein == null ? null : r.protein.map(scrubText),
    method: (r.method || []).map(scrubText),
  };
}

// Local development without an API key (MOCK_RECIPES=1 in .dev.vars).
function mockRecipe(basketItems, inSeasonIds, avoid, prefs = { diet: 'none', allergies: [] }) {
  const lead = basketItems.find((i) => i.seasonality !== 'out') || basketItems[0];
  const out = basketItems.find((i) => i.seasonality === 'out');
  const inSeasonStars = basketItems.filter((i) => i.seasonality !== 'out').map((i) => i.id);
  // stars is a required field — if nothing in the basket is in season, still
  // highlight the whole basket rather than ship an empty array.
  const stars = inSeasonStars.length ? inSeasonStars : basketItems.map((i) => i.id);

  // Honor diet/allergy silently, same contract as the real engine.
  const allergies = new Set(prefs.allergies || []);
  const candidates = [
    { text: 'a soft-boiled egg', vegan: false, vegetarian: true, allergen: 'eggs' },
    { text: 'grilled sardines', vegan: false, vegetarian: false, allergen: null },
    { text: 'a spoon of chickpeas', vegan: true, vegetarian: true, allergen: null },
  ];
  const protein = candidates
    .filter((p) => (prefs.diet === 'vegan' ? p.vegan : prefs.diet === 'vegetarian' ? p.vegetarian : true))
    .filter((p) => !(p.allergen && allergies.has(p.allergen)))
    .slice(0, 2)
    .map((p) => p.text);

  return {
    title: `${lead.name_en}${avoid.length ? ', another way' : ', barely touched'} (mock)`,
    time: 'Quick, about 15 minutes',
    note: 'A canned recipe from the local mock engine, so the flow can be tested without a key.',
    stars,
    ingredients: [
      ...basketItems.map((i) => ({ item: i.name_en.toLowerCase(), pantry: false })),
      { item: 'olive oil', pantry: true },
      { item: '1 clove garlic', pantry: true },
      { item: 'flaky salt', pantry: true },
    ],
    offSeasonAdvice: out ? `${out.name_en} is out of season here, so it will taste flatter. Roast it hard to concentrate what is there.` : null,
    grabOneMore: inSeasonIds[0] || null,
    protein,
    method: [
      `Slice the ${lead.name_en.toLowerCase()} and season it well.`,
      'Get a pan very hot and char until blistered and just tender.',
      'A flood of olive oil, a rub of garlic, flaky salt. Eat warm.',
    ],
  };
}
