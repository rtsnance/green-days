/* Green Days — produce data layer.
   Single source of truth is data/produce.json (149 items); this module derives
   seasonality for the current month, the market language from the country, and
   the climate band for the recipe banner. Do not invent produce outside it. */
import RAW from '../data/produce.json';
import MARKETS from '../data/markets.json';

export { MARKETS };
export const ASSET = (p) => import.meta.env.BASE_URL + p;

/* ---- seasons ---- */
export const SEASON_MONTHS = { spring: [2, 3, 4], summer: [5, 6, 7], autumn: [8, 9, 10], winter: [11, 0, 1] };
export const SEASON_CYCLE = ['spring', 'summer', 'autumn', 'winter'];

// Parse a rough season string ("Autumn–winter", "Year-round", "Winter (Med)")
// → Set of month indices it covers, or null for year-round.
export function seasonMonths(str) {
  str = (str || '').toLowerCase();
  if (str.includes('year-round')) return null;
  const found = SEASON_CYCLE
    .map((s) => ({ s, i: str.indexOf(s) }))
    .filter((o) => o.i >= 0)
    .sort((a, b) => a.i - b.i)
    .map((o) => o.s);
  if (found.length === 0) return new Set();
  let names = found;
  if (found.length > 1 && (str.includes('–') || str.includes('-'))) {
    // written as a range: walk the cycle from the first to the last (wrapping)
    names = [];
    let i = SEASON_CYCLE.indexOf(found[0]);
    const end = SEASON_CYCLE.indexOf(found[found.length - 1]);
    while (true) { names.push(SEASON_CYCLE[i]); if (i === end) break; i = (i + 1) % 4; }
  }
  const set = new Set();
  names.forEach((n) => SEASON_MONTHS[n].forEach((m) => set.add(m)));
  return set;
}

export function seasonNameForMonth(m) {
  return SEASON_CYCLE.find((s) => SEASON_MONTHS[s].includes(m)) || 'summer';
}

// 'peak' (its named season is now) | 'in' | 'out' for the given month (0-11).
// band ('mediterranean' | 'temperate') is optional: a season tagged "(Med)"
// is only in season in the Mediterranean band, so it reads out (imported,
// faded) in temperate markets.
export function seasonalityOf(seasonStr, month, band) {
  const s = (seasonStr || '').toLowerCase();
  const set = seasonMonths(seasonStr);
  let base;
  if (set === null || set.size === 0) base = 'in';   // year-round / unknown → available
  else if (!set.has(month)) base = 'out';
  else base = s.includes(seasonNameForMonth(month)) ? 'peak' : 'in';
  if (base !== 'out' && band && band !== 'mediterranean' && /\(med/.test(s)) return 'out';
  return base;
}

/* ---- catalogue, computed for the shopper's current month ---- */
export const MONTH = new Date().getMonth(); // 0-indexed

export const PRODUCE = RAW.map((it) => ({
  id: it.id,
  name: it.name_en,
  name_local: it.name_local || {},
  tab: it.tab,               // 'Fruit' | 'Veg' | 'Herb'
  category: it.category,
  season: it.season,         // human-readable season text
  slug: it.illustration,     // image slug, or null
  hasPrint: !!it.illustration,
  status: it.illustration_status,
  notes: it.notes || '',
  selection: it.selection || '',
  // Band-agnostic default; screens recompute per the active market's band.
  seasonality: seasonalityOf(it.season, MONTH),
}));

export const byId = (id) => PRODUCE.find((p) => p.id === id);

// Recompute seasonality for a market's band and return a shallow copy the
// components can read `.seasonality` from, so vivid/faded tracks the band.
export const seasonalityFor = (p, band) => (p ? seasonalityOf(p.season, MONTH, band) : 'out');
export const decorate = (p, band) => (p ? { ...p, seasonality: seasonalityFor(p, band) } : p);

/* ---- markets: ISO country → { country, lang, band } (data/markets.json) ---- */
const market = (country) => MARKETS[(country || '').toUpperCase()];
// name_local key for the market's language; 'en' (UK/IE) and any missing key
// fall back to name_en (a single line) in the name components.
export const langOf = (country) => (market(country) || {}).lang || 'en';
// climate band drives the recipe banner and the vivid/faded treatment.
export const bandOf = (country) => (market(country) || {}).band || 'temperate';
// The correctable market list for the picker (14 countries).
export const COUNTRIES = Object.entries(MARKETS).map(([code, m]) => [code, m.country]);
export const countryLabel = (code) => (market(code) || {}).country || code || 'Europe';

// {band}-{season} banner asset, e.g. "mediterranean-summer".
export function seasonBannerSrc(country, month) {
  const base = ASSET('assets/seasons/' + bandOf(country) + '-' + seasonNameForMonth(month));
  return { src: base + '@2x.png', srcSet: base + '@2x.png 2x, ' + base + '@3x.png 3x' };
}

/* ---- search across every language in the data ---- */
export const stripDia = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function matchesQuery(p, q) {
  if (!q) return true;
  if (stripDia(p.name).includes(q) || stripDia(p.category).includes(q)) return true;
  for (const k in p.name_local) {
    if (stripDia(p.name_local[k]).includes(q)) return true;
  }
  return false;
}
