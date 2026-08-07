/* Green Days — shared seasonality.
   Phase 1 of Code_Handoff_Computed_Seasons.md. NOT YET IMPORTED by src/produce.js
   or worker/index.js; both still carry their own copies. This module is inert
   until those are switched over, and exists now so scripts/season-diff.mjs can
   compare the two answers before anything changes.

   Quarters survive here as a VISUAL device only: seasonBannerSrc() needs
   seasonNameForMonth() to pick one of the 16 banner assets. They stop being a
   data model the moment an item has season_ranges. */

export const SEASON_MONTHS = { spring: [2, 3, 4], summer: [5, 6, 7], autumn: [8, 9, 10], winter: [11, 0, 1] };
export const SEASON_CYCLE = ['spring', 'summer', 'autumn', 'winter'];
export const seasonNameForMonth = (m) =>
  SEASON_CYCLE.find((s) => SEASON_MONTHS[s].includes(m)) || 'summer';

/* ---- legacy: today's parser, verbatim, renamed. Delete when nothing falls back. ---- */

export function legacySeasonMonths(str) {
  str = (str || '').toLowerCase();
  if (str.includes('year-round')) return null;
  const found = SEASON_CYCLE.map((s) => ({ s, i: str.indexOf(s) })).filter((o) => o.i >= 0)
    .sort((a, b) => a.i - b.i).map((o) => o.s);
  if (found.length === 0) return new Set();
  let names = found;
  if (found.length > 1 && (str.includes('–') || str.includes('-'))) {
    names = [];
    let i = SEASON_CYCLE.indexOf(found[0]);
    const end = SEASON_CYCLE.indexOf(found[found.length - 1]);
    while (true) { names.push(SEASON_CYCLE[i]); if (i === end) break; i = (i + 1) % 4; }
  }
  const set = new Set();
  names.forEach((n) => SEASON_MONTHS[n].forEach((m) => set.add(m)));
  return set;
}

export function legacySeasonalityOf(seasonStr, month, band) {
  const s = (seasonStr || '').toLowerCase();
  const set = legacySeasonMonths(seasonStr);
  let base;
  if (set === null || set.size === 0) base = 'in';
  else if (!set.has(month)) base = 'out';
  else base = s.includes(seasonNameForMonth(month)) ? 'peak' : 'in';
  if (base !== 'out' && band && band !== 'mediterranean' && /\(med/.test(s)) return 'out';
  return base;
}

/* ---- ranges ---- */

// Day-of-year, non-leap. Needed rather than a packed MM*100+DD key because the
// peak calculation does arithmetic on window LENGTH, and packed months are not
// linear (there is no 08-32).
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
export const YEAR = 365;
export const doy = (mmdd) => { const [m, d] = mmdd.split('-').map(Number); return CUM[m - 1] + d; };
export const fromDoy = (n) => {
  let x = ((n - 1) % YEAR + YEAR) % YEAR + 1, m = 11;
  while (CUM[m] >= x) m--;
  return String(m + 1).padStart(2, '0') + '-' + String(x - CUM[m]).padStart(2, '0');
};

// A window wraps the new year when `to` sorts before `from` (e.g. 11-01 to 02-15).
const within = (a, b, x) => (a <= b ? x >= a && x <= b : x >= a || x <= b);

export function inRanges(ranges, mmdd) {
  const x = doy(mmdd);
  return ranges.some((r) => within(doy(r.from), doy(r.to), x));
}

// Default peak is the middle third of each window, unless the item declares
// peak_from / peak_to. Wrap-safe: length is measured forward from the start.
export function peakRanges(ranges) {
  return ranges.map((r) => {
    if (r.peak_from && r.peak_to) return [doy(r.peak_from), doy(r.peak_to)];
    const a = doy(r.from), b = doy(r.to);
    const len = (b >= a ? b - a : b + YEAR - a) + 1;
    const s = a + Math.floor(len / 3);
    const e = a + Math.ceil((2 * len) / 3) - 1;
    return [((s - 1) % YEAR) + 1, ((e - 1) % YEAR) + 1];
  });
}

// 'peak' | 'in' | 'out', or null when the item has no ranges for this band and
// the caller should fall back to legacySeasonalityOf. THIS null IS THE THING
// that lets the migration ship one item at a time.
export function rangeSeasonalityOf(item, mmdd, band) {
  const ranges = item.season_ranges?.[band];
  if (!ranges) return null;
  if (!ranges.length) return 'out';            // no local season in this band
  if (!inRanges(ranges, mmdd)) return 'out';
  if (item.availability === 'imported') return 'in';   // imported is never "peak"
  const x = doy(mmdd);
  return peakRanges(ranges).some(([a, b]) => within(a, b, x)) ? 'peak' : 'in';
}

// The one both callers should use once Phase 1 lands.
export function seasonalityOf(item, mmdd, band) {
  const r = rangeSeasonalityOf(item, mmdd, band);
  return r !== null ? r : legacySeasonalityOf(item.season, Number(mmdd.slice(0, 2)) - 1, band);
}
