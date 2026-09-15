/* Green Days — produce data layer.
   Single source of truth is data/produce.json (149 items); this module derives
   seasonality for the current month, the market language from the country, and
   the climate band for the recipe banner. Do not invent produce outside it. */
import RAW from '../data/produce.json';
import MARKETS from '../data/markets.json';
import AFFILIATES from '../data/affiliates.json';
import {
  SEASON_MONTHS, SEASON_CYCLE, seasonNameForMonth, seasonalityOf, legacySeasonMonths, daysLeftIn, seasonEntryFor, nextRangeStart,
} from './season.js';

export { MARKETS };
export const ASSET = (p) => import.meta.env.BASE_URL + p;

/* ---- seasons ----
   The parser used to live here in duplicate (a third copy sat in worker/index.js).
   It is now src/season.js, the single implementation, and these are re-exports so
   nothing that imports them from produce.js breaks. `seasonMonths` keeps its old
   name: it is the legacy prose-label parser, which nextSeasonMonth() below still
   rides on. seasonalityOf is the shared one — note the signature is now
   (item, "MM-DD", band), not (seasonString, monthIndex, band). */
export { SEASON_MONTHS, SEASON_CYCLE, seasonNameForMonth, seasonalityOf };
export { legacySeasonMonths as seasonMonths };

/* ---- catalogue, computed for the shopper's current day ---- */
const NOW = new Date();
// Quarters survive as a VISUAL device only: seasonBannerSrc() picks one of the
// 16 banner assets by month, and seasonNameForMonth() needs a month to do it.
export const MONTH = NOW.getMonth(); // 0-indexed
// "MM-DD" — what the range model actually reads. Seasonality is a day question.
export const TODAY = String(NOW.getMonth() + 1).padStart(2, '0') + '-' + String(NOW.getDate()).padStart(2, '0');

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// For an out-of-season item: the next month index its season begins, walking
// forward from `from`. Returns null when there is no meaningful "next" —
// year-round/unparseable seasons, or a "(Med)" item viewed from a temperate
// market, where seasonalityOf() reports 'out' all year and a month label would
// be a lie.
// Still on the legacy prose path this pass, deliberately: it reads the season
// string and it still works. Making it range-aware is a follow-up, and one
// deploy should carry one change.
export function nextSeasonMonth(seasonStr, from = MONTH, band) {
  const s = (seasonStr || '').toLowerCase();
  if (band && band !== 'mediterranean' && /\(med/.test(s)) return null;
  const set = legacySeasonMonths(seasonStr);
  if (set === null || set.size === 0) return null;
  for (let i = 1; i <= 12; i++) {
    const m = (from + i) % 12;
    if (set.has(m)) return m;
  }
  return null;
}

export const nextSeasonLabel = (seasonStr, from = MONTH, band) => {
  const m = nextSeasonMonth(seasonStr, from, band);
  return m == null ? null : MONTH_NAMES[m];
};

// Range-aware next-window-start for the market being looked at. Reads the
// market's own dates when it has them, its band's otherwise, then walks
// forward from today. Returns the 0-indexed month or null; the 46 unranged
// items and year-round ranges both fall through to the legacy label parser
// at the call sites, which is the same shape nextSeasonMonth already uses.
export const nextSeasonStart = (p, country) => (p ? nextRangeStart(p, TODAY, bandOf(country), country) : null);
export const nextSeasonStartLabel = (p, country) => {
  const m = nextSeasonStart(p, country);
  return m == null ? null : MONTH_NAMES[m];
};

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
  // These two are what seasonalityOf() reads. They MUST be carried through: the
  // map rebuilds each item from a fixed field list, and without them every item
  // silently falls back to the prose parser and the range model does nothing.
  season_ranges: it.season_ranges,
  availability: it.availability,
  // Placeholder for the default band; screens recompute per the active market
  // via decorate(). 'temperate' matches bandOf()'s own fallback.
  seasonality: seasonalityOf(it, TODAY, 'temperate'),
}));

export const byId = (id) => PRODUCE.find((p) => p.id === id);

// `scope` is a market code (preferred: a market answers from its own calendar
// when it has one, its band's otherwise) or a bare band name (the band
// answers). Older call sites pass the band and still get the same answer; the
// two only part once a market other than PT is sourced on its own.
const scopeOf = (scope) => (MARKETS[scope] ? { band: MARKETS[scope].band, country: scope } : { band: scope, country: null });
// Recompute seasonality for a market and return a shallow copy the components
// can read `.seasonality` from, so vivid/faded tracks the market.
export const seasonalityFor = (p, scope) => {
  if (!p) return 'out';
  const { band, country } = scopeOf(scope);
  return seasonalityOf(p, TODAY, band, country);
};
// Days until this item's current window closes, or null for "no answer" —
// unranged, or ranged and out of season today. Both bands' answers differ, so
// it belongs here beside seasonality rather than on the base PRODUCE record.
// It orders the home list and gates the Going soon chip. It is never displayed:
// most ranges snap to the 1st or 15th, so the number is a sort key, not a
// measurement (see daysLeftIn in season.js).
export const daysLeftFor = (p, scope) => {
  if (!p) return null;
  const { band, country } = scopeOf(scope);
  return daysLeftIn(p, TODAY, band, country);
};
export const decorate = (p, scope) =>
  (p ? { ...p, seasonality: seasonalityFor(p, scope), daysLeft: daysLeftFor(p, scope) } : p);

/* ---- where an item's dates come from, for the market being looked at ----
   kind: 'sourced'   a published calendar for this market (`source` names it)
         'inherited' another market's dates; `from` says whose (ES/IT/GR read PT)
         'inferred'  derived from the prose label; no source for this market
         'label'     no dated ranges at all: the prose season label is all there is
   The app shows this beside every season claim so an estimate never reads as a
   measurement. Until a second market is sourced, only PT is ever 'sourced'. */
export function timingFor(p, country) {
  const e = p ? seasonEntryFor(p, bandOf(country), country) : null;
  if (!e) return { kind: 'label', from: null, source: null };
  if (e.provenance === 'sourced') return { kind: 'sourced', from: e.scope, source: e.source };
  if (e.inferred_from && MARKETS[e.inferred_from]) return { kind: 'inherited', from: e.inferred_from, source: e.source };
  return { kind: 'inferred', from: e.inferred_from, source: e.source };
}

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

/* ---- affiliate delivery partners: ISO country → partner, or null if uncovered ----
   Countries absent from data/affiliates.json get no CTA — that is the gating.
   The https:// check is a second belt: a partner whose `url` is still a
   placeholder (outreach not landed yet) is treated as uncovered rather than
   rendered as a dead link, so a half-filled data file can never ship one. */
export const affiliatePartnerOf = (country) => {
  const a = AFFILIATES[(country || '').toUpperCase()];
  return a && typeof a.url === 'string' && a.url.startsWith('https://') ? a : null;
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
