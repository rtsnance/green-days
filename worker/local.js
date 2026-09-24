/* Local growers: one grower's public weekly list, read against our calendar.

   GET /api/local?place=ibiza
     → { ok, place, label, partner:{id,name,order_url,method,next_pickup,whatsapp},
         have:[produce ids on their list this week], names:{id: their product name},
         score:{ listed, tracked, called, missed:[ids we had as out of season] },
         unmapped:[their slugs we have not sorted yet], fetched_at }

   On any upstream failure it still answers 200 with ok:false and the
   partner block, so the app can show a plain order link without the list.

   The grower's list is read server-side (no CORS, and one cached subrequest
   per colo per hour instead of one per visitor). Nothing about the visitor is
   sent to them. The mapping from their slugs to produce ids is hand-written
   in data/local-partners.json. */
import PLACES from '../data/local-partners.json';
import { seasonalityOf } from '../src/season.js';

const UPSTREAM_TTL = 3600; // seconds; their list changes weekly

// Which place, if any, the edge location puts a visitor in.
export function placeForEdge(cf) {
  if (!cf || !cf.country) return '';
  for (const [key, p] of Object.entries(PLACES)) {
    if (key.startsWith('_')) continue;
    if (p.country === cf.country && p.regions.includes(String(cf.regionCode || '').toUpperCase())) return key;
  }
  return '';
}

export const placeInfo = (key) => (key && !key.startsWith('_') && PLACES[key]) || null;

// Pure: their catalogue JSON + our produce → the week, scored.
// `band` and `country` are the market the place sits in.
export function scoreWeek(catalogue, place, byId, mmdd, band) {
  const products = (catalogue && Array.isArray(catalogue.products)) ? catalogue.products : [];
  const ignore = new Set(place.ignore || []);
  const have = [];
  const names = {}; // produce id → their product name, for an order message they recognise
  const seen = {};
  const unmapped = [];
  for (const pr of products) {
    const slug = pr && pr.slug;
    if (!slug) continue;
    const id = place.map[slug];
    if (id && byId.has(id)) {
      if (!have.includes(id)) have.push(id);
      // Their name only when exactly one of their products is that id: one
      // "Figs" reads right, but chilli-pepper is Habaneros AND Jalapeños AND
      // Mixed Chillies, and picking one would order the wrong thing. Shared ids
      // are deleted here and the app falls back to our own English name.
      if (pr.name) seen[id] = (seen[id] || 0) + 1;
      if (seen[id] === 1 && pr.name) names[id] = String(pr.name).slice(0, 60);
      else delete names[id];
    }
    else if (!ignore.has(slug)) unmapped.push(slug);
  }
  const missed = have.filter((id) => seasonalityOf(byId.get(id), mmdd, band, place.country) === 'out');
  return {
    have,
    names,
    unmapped,
    score: { listed: products.length, tracked: have.length, called: have.length - missed.length, missed },
  };
}

// Earliest pickup date on or after today, from their config. 'YYYY-MM-DD' or ''.
export function nextPickup(config, todayIso) {
  const ds = (config && Array.isArray(config.pickup_dates)) ? config.pickup_dates : [];
  return ds.filter((d) => typeof d === 'string' && d >= todayIso).sort()[0] || '';
}

async function getJson(url) {
  const r = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'GreenDays/1 (+https://greendays.day)' },
    cf: { cacheTtl: UPSTREAM_TTL, cacheEverything: true },
  });
  if (!r.ok) throw new Error('upstream ' + r.status);
  return r.json();
}

export async function handleLocal(request, { byId, bandOf }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('place') || '';
  const place = placeInfo(key);
  const headers = { 'cache-control': 'public, max-age=900' };
  if (!place) return new Response(JSON.stringify({ ok: false, error: 'unknown place' }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } });

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const mmdd = todayIso.slice(5);
  const partner = {
    id: place.partner.id, name: place.partner.name, order_url: place.partner.order_url,
    method: 'collection', next_pickup: '', whatsapp: '',
  };
  const base = { place: key, label: place.label, partner };
  try {
    const [catalogue, config] = await Promise.all([
      getJson(place.partner.catalogue_url),
      getJson(place.partner.config_url).catch(() => null),
    ]);
    if (config && Array.isArray(config.methods) && config.methods.length && !config.methods.includes('collection')) {
      partner.method = String(config.methods[0]);
    }
    partner.next_pickup = nextPickup(config, todayIso);
    // Their own order number, published on their order page. Digits only, for wa.me.
    const wa = String((config && config.whatsapp) || '').replace(/\D/g, '');
    if (wa.length >= 8 && wa.length <= 15) partner.whatsapp = wa;
    const orders_open = !(config && config.orders_open === false);
    const week = scoreWeek(catalogue, place, byId, mmdd, bandOf(place.country));
    return new Response(JSON.stringify({ ok: true, ...base, orders_open, ...week, fetched_at: now.toISOString() }), {
      status: 200, headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, ...base, error: 'list unavailable' }), {
      status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=120' },
    });
  }
}
