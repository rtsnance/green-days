/* Green Days — produce data layer.
   Single source of truth is data/produce.json (149 items); this module derives
   seasonality for the current month, the market language from the country, and
   the climate band for the recipe banner. Do not invent produce outside it. */
import RAW from '../data/produce.json';

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
export function seasonalityOf(seasonStr, month) {
  const set = seasonMonths(seasonStr);
  if (set === null) return 'in';            // year-round
  if (set.size === 0) return 'in';          // unknown wording → assume available
  if (!set.has(month)) return 'out';
  return (seasonStr || '').toLowerCase().includes(seasonNameForMonth(month)) ? 'peak' : 'in';
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
  seasonality: seasonalityOf(it.season, MONTH),
}));

export const byId = (id) => PRODUCE.find((p) => p.id === id);

/* ---- market country → display language and climate band ---- */
// Which name_local key each market country reads. Countries without language
// data in produce.json fall back to English alone.
const LANG_BY_COUNTRY = { PT: 'pt', ES: 'es', FR: 'fr', DE: 'de', AT: 'de', CH: 'de', IT: 'it', NL: 'nl', BE: 'nl', DK: 'da' };
export const langOf = (country) => LANG_BY_COUNTRY[(country || '').toUpperCase()] || null;

// Mediterranean = PT, ES, IT, GR + southern France (approximated by country);
// temperate otherwise. Drives the recipe-banner choice.
const MEDITERRANEAN = new Set(['PT', 'ES', 'IT', 'GR', 'FR']);
export const bandOf = (country) => (MEDITERRANEAN.has((country || '').toUpperCase()) ? 'mediterranean' : 'temperate');

// The correctable market list for the location line.
export const COUNTRIES = [
  ['PT', 'Portugal'], ['ES', 'Spain'], ['FR', 'France'], ['IT', 'Italy'],
  ['GR', 'Greece'], ['DE', 'Germany'], ['AT', 'Austria'], ['CH', 'Switzerland'],
  ['NL', 'Netherlands'], ['BE', 'Belgium'], ['DK', 'Denmark'], ['GB', 'United Kingdom'],
  ['IE', 'Ireland'], ['SE', 'Sweden'],
];
export const countryLabel = (code) => {
  const hit = COUNTRIES.find(([c]) => c === (code || '').toUpperCase());
  return hit ? hit[1] : (code || 'Europe');
};

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
