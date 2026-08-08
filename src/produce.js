/* Green Days — produce data layer.
   Single source of truth is data/produce.json (149 items); this module derives
   seasonality for the current month, the market language from the country, and
   the climate band for the recipe banner. Do not invent produce outside it. */
import RAW from '../data/produce.json';
import MARKETS from '../data/markets.json';
import AFFILIATES from '../data/affiliates.json';
import {
  SEASON_MONTHS, SEASON_CYCLE, seasonNameForMonth, seasonalityOf, legacySeasonMonths, daysLeftIn,
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

// Recompute seasonality for a market's band and return a shallow copy the
// components can read `.seasonality` from, so vivid/faded tracks the band.
export const seasonalityFor = (p, band) => (p ? seasonalityOf(p, TODAY, band) : 'out');
// Days until this item's current window closes, or null for "no answer" —
// unranged, or ranged and out of season today. Both bands' answers differ, so
// it belongs here beside seasonality rather than on the base PRODUCE record.
// It orders the home list and gates the Going soon chip. It is never displayed:
// most ranges snap to the 1st or 15th, so the number is a sort key, not a
// measurement (see daysLeftIn in season.js).
export const daysLeftFor = (p, band) => (p ? daysLeftIn(p, TODAY, band) : null);
export const decorate = (p, band) =>
  (p ? { ...p, seasonality: seasonalityFor(p, band), daysLeft: daysLeftFor(p, band) } : p);

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
