/* Green Days — shared seasonality.
   The one implementation, imported by src/produce.js, worker/index.js and the
   build scripts. Plain ESM with no import.meta and no JSON imports, on purpose:
   node runs the scripts against it unbundled, and wrangler bundles it for the
   Worker. Market knowledge (which band a country is in) stays with the callers.

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
  // NOT 'peak'. The legacy parser cannot know a peak: it only knows the label
  // mentions this quarter. If it were still allowed to say 'peak', the At-peak
  // list would consist entirely of the items that have NOT been migrated, which
  // is exactly backwards. Peak is reserved for declared ranges.
  else base = 'in';
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

// PEAK IS DECLARED, NOT DERIVED.
//
// It used to be the middle third of the window. Measured across the 24 turning
// days that flag was worn by 50-88% of the stall, around 75% most of the year,
// which is not a distinction. The cause is structural: at any date most things
// in season are somewhere in their middle, so "at peak" resolved to "not at the
// very start or end", i.e. nearly everything. Capping the width barely moved it.
//
// So an item is at peak only when someone established that it is: an explicit
// peak_from / peak_to on the range. "At peak" now means a claim was made and
// sourced, the same bar as everything else in this data. The list starts nearly
// empty and fills as entries get written. Three named fruits beat fifty
// computed ones.
export function peakRanges(ranges) {
  return ranges
    .filter((r) => r.peak_from && r.peak_to)
    .map((r) => [doy(r.peak_from), doy(r.peak_to)]);
}

/* ---- scopes: which calendar answers for a market ----
   season_ranges is keyed by SCOPE: a market code ("PT") or a climate band
   ("mediterranean", "temperate"). A market answers with its own key when it has
   one and with its band's key otherwise, so a market can be sourced on its own
   without the band moving. Each entry is one of:
     { ranges: [...], provenance: 'sourced'|'inferred', resolution, source }
     { inherit: "<scope>", provenance: 'inferred', source }
   `inherit` means the same dates as another scope, said honestly: the
   mediterranean band inherits PT, so Spain, Italy and Greece run on Portugal's
   calendar until each has a source of its own, and the app can say so.
   A bare array is the pre-2026-09-15 shape. It still reads, with provenance
   taken from the item-level field and 'inferred' when that is absent, so a
   test fixture or an unmigrated item cannot break anything. */
// A scope entry is "real" only if it is a bare array (legacy shape), OR an
// object with a `ranges` key (a per-market calendar, even an authoritative
// empty one), OR an object with an `inherit` pointer. Anything else — most
// commonly a `{}` from a half-typed save — is treated as absent so the band
// takes over. Without this, `sr.IT = {}` reads as "authoritatively empty for
// Italy" and quietly paints every Italian view of the item out-of-season
// year-round with no diagnostic.
const isRealEntry = (e) => Array.isArray(e) || (e != null && (typeof e === 'object') && ('ranges' in e || 'inherit' in e));

export function seasonEntryFor(item, band, country) {
  const sr = item && item.season_ranges;
  if (!sr) return null;
  const key = country && isRealEntry(sr[country]) ? country : band;
  let e = sr[key], scope = key, hops = 0, via = null;
  while (e && !Array.isArray(e) && e.inherit && hops++ < 4) {
    via = via || e;                   // the entry that pointed away, for its source text
    scope = e.inherit; e = sr[scope];
  }
  if (!e || (!Array.isArray(e) && e.inherit)) return null;   // missing, or a pointer loop
  const own = Array.isArray(e)
    ? { ranges: e, provenance: item.provenance || 'inferred', resolution: item.resolution || null, source: item.source || null, inferred_from: null }
    : { ranges: e.ranges || [], provenance: e.provenance || 'inferred', resolution: e.resolution || null, source: e.source || null, inferred_from: e.inferred_from || null };
  if (!via) return { ...own, scope };
  // Reached through `inherit`: the dates are `scope`'s, the claim is inferred.
  return { ...own, scope, provenance: 'inferred', inferred_from: scope, source: via.source || own.source };
}
export const rangesFor = (item, band, country) => { const e = seasonEntryFor(item, band, country); return e ? e.ranges : null; };

// Whole days until the window the item is in RIGHT NOW closes, counting the
// closing day itself as 0. null when the item has no ranges for this band, or
// has them and is not inside one today — "no answer", not "leaving today", so
// callers must sort it last rather than first. Wrap-safe, same as inRanges.
//
// This is a sort key and a threshold, not a measurement. Most ranges are
// derived from a prose label and snap to the 1st, 15th or month end, so the
// number is only ever accurate to about a fortnight. Never show it.
export function daysLeftIn(item, mmdd, band, country) {
  const ranges = rangesFor(item, band, country);
  if (!ranges || !ranges.length) return null;
  const x = doy(mmdd);
  let soonest = null;
  for (const r of ranges) {
    const a = doy(r.from), b = doy(r.to);
    if (!within(a, b, x)) continue;
    const left = b >= x ? b - x : b + YEAR - x;
    if (soonest === null || left < soonest) soonest = left;
  }
  return soonest;
}

// The 0-indexed month of the next window that opens after `mmdd`, walking
// forward around the year. null when the item has no ranges for this
// market/band (the caller falls back to the legacy prose parser), when
// `mmdd` is inside a range today (all-year included, which is inside every
// day), or when the next window opens partway through its month — a `from`
// like 04-15 would render as "back in April" and promise the item two
// weeks early, so we return null and let the caller say nothing rather
// than name the wrong month.
export function nextRangeStart(item, mmdd, band, country) {
  const ranges = rangesFor(item, band, country);
  if (!ranges || !ranges.length) return null;
  if (inRanges(ranges, mmdd)) return null;
  const x = doy(mmdd);
  let bestGap = Infinity, best = null;
  for (const r of ranges) {
    const a = doy(r.from);
    const gap = a >= x ? a - x : a + YEAR - x;
    if (gap > 0 && gap < bestGap) { bestGap = gap; best = r; }
  }
  if (!best || best.from.slice(3) !== '01') return null;
  return Number(best.from.slice(0, 2)) - 1;
}

export function rangeSeasonalityOf(item, mmdd, band, country) {
  const ranges = rangesFor(item, band, country);
  if (!ranges) return null;
  if (!ranges.length) return 'out';            // no local season in this band
  if (!inRanges(ranges, mmdd)) return 'out';
  if (item.availability === 'imported') return 'in';   // imported is never "peak"
  const x = doy(mmdd);
  return peakRanges(ranges).some(([a, b]) => within(a, b, x)) ? 'peak' : 'in';
}

// The one both callers should use once Phase 1 lands. `country` is optional:
// with it, a market that carries its own calendar answers from that; without
// it, the band answers. Today only PT has its own key and the band inherits
// it, so the two agree; they part the day a second market is sourced.
export function seasonalityOf(item, mmdd, band, country) {
  const r = rangeSeasonalityOf(item, mmdd, band, country);
  return r !== null ? r : legacySeasonalityOf(item.season, Number(mmdd.slice(0, 2)) - 1, band);
}
