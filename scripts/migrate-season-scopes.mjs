/* Move season provenance from the item into each calendar it belongs to.
   node scripts/migrate-season-scopes.mjs          # dry run: what would change, and proof nothing moves
   node scripts/migrate-season-scopes.mjs --write  # rewrites data/produce.json

   BEFORE (per item):  season_ranges: { mediterranean: [...], temperate: [...] }
                       provenance / source / resolution at item level, covering
                       both bands with one word — so "sourced" was also stamped
                       on a temperate band nothing ever sourced.

   AFTER (per scope):  season_ranges: {
                         PT:            { ranges, provenance: "sourced", resolution, source },
                         mediterranean: { inherit: "PT", provenance: "inferred", source },
                         temperate:     { ranges, provenance: "inferred", resolution, source },
                       }
   and the three item-level fields are gone. src/season.js resolves a market to
   its own key, then its band's, following `inherit`.

   What this says, and why it is the honest reading of the repo:
     - every real source in the data is Portuguese, so the mediterranean dates
       are PT's. PT gets them as sourced; ES, IT and GR get them by inheritance,
       marked inferred, until each has a source of its own;
     - the temperate dates were derived from the English prose label by
       scripts/derive-season-ranges.mjs (a hand override on 16 items) and no
       northern-European source has ever been recorded, so they are inferred
       everywhere — including on items whose PT dates are sourced;
     - the 16 items whose mediterranean dates were also label-derived stay
       inferred in both bands and get no PT key: nothing there is sourced.
   The DATES DO NOT CHANGE. The dry run proves it by reading every item at every
   half-month tick, per market, before and after, and counting differences. Run
   scripts/season-diff.mjs afterwards anyway and read it. */
import fs from 'node:fs';
import { rangeSeasonalityOf } from '../src/season.js';

const FILE = 'data/produce.json';
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const MARKETS = JSON.parse(fs.readFileSync('data/markets.json', 'utf8'));
const WRITE = process.argv.includes('--write');

const TICKS = [];
for (let m = 1; m <= 12; m++) for (const d of ['01', '16']) TICKS.push(`${String(m).padStart(2, '0')}-${d}`);
const readAll = (item) => Object.entries(MARKETS).map(([c, m]) => TICKS.map((t) => rangeSeasonalityOf(item, t, m.band, c)).join('')).join('|');

const MED_INHERIT_SOURCE = "Portugal's calendar, applied to the whole mediterranean band; no source recorded for Spain, Italy or Greece yet";
const TEMPERATE_SOURCE = (label) =>
  `derived from the "${label}" label by scripts/derive-season-ranges.mjs; no northern-European source recorded`;

let migrated = 0, skipped = 0, sourced = 0, labelOnly = 0, moved = 0;
for (const it of P) {
  const sr = it.season_ranges;
  if (!sr) continue;
  if (!Array.isArray(sr.mediterranean) && !Array.isArray(sr.temperate)) { skipped++; continue; } // already scoped
  const before = readAll(it);
  const med = sr.mediterranean || [], temp = sr.temperate || [];
  const out = {};
  if (it.provenance === 'sourced') {
    sourced++;
    out.PT = { ranges: med, provenance: 'sourced', resolution: it.resolution || 'month', source: it.source || null };
    out.mediterranean = { inherit: 'PT', provenance: 'inferred', source: MED_INHERIT_SOURCE };
    out.temperate = {
      ranges: temp, provenance: 'inferred',
      resolution: it.resolution === 'half-month' ? 'half-month' : 'quarter',
      source: TEMPERATE_SOURCE(it.season),
    };
  } else {
    labelOnly++;
    const res = it.resolution || 'quarter';
    out.mediterranean = { ranges: med, provenance: 'inferred', resolution: res, source: it.source || null };
    out.temperate = { ranges: temp, provenance: 'inferred', resolution: res, source: it.source || null };
  }
  // Rebuild the item so season_ranges keeps its place and the three item-level
  // fields disappear rather than lingering as stale duplicates.
  const next = {};
  for (const [k, v] of Object.entries(it)) {
    if (k === 'provenance' || k === 'source' || k === 'resolution') continue;
    next[k] = k === 'season_ranges' ? out : v;
  }
  for (const k of Object.keys(it)) delete it[k];
  Object.assign(it, next);
  migrated++;
  const after = readAll(it);
  if (before !== after) { moved++; console.log(`MOVED: ${it.id}`); }
}

console.log(`${migrated} items migrated (${sourced} PT-sourced, ${labelOnly} label-only), ${skipped} already scoped, ${P.length - migrated - skipped} without ranges.`);
console.log(moved ? `${moved} items CHANGED their seasonality — do not write this.` : 'No item reads differently at any half-month tick in any market.');
if (WRITE && !moved) {
  fs.writeFileSync(FILE, JSON.stringify(P, null, 2) + '\n');
  console.log(`wrote ${FILE}`);
} else if (WRITE) {
  process.exit(1);
}
