/* What moves when ranges replace the parser.
   node scripts/season-diff.mjs

   Reads nothing but data. Changes nothing. Run it after every batch of ranges
   and READ IT, rather than trusting that the ranges are right. This is the
   artifact that tells you what will move before it moves. */
import fs from 'node:fs';
import { legacySeasonalityOf, rangeSeasonalityOf, rangesFor } from '../src/season.js';

const P = JSON.parse(fs.readFileSync('data/produce.json', 'utf8'));
const MARKETS = JSON.parse(fs.readFileSync('data/markets.json', 'utf8'));
// Scopes, not bands: PT is its own calendar (the mediterranean band inherits
// it), so it is read on its own. A newly sourced market is one more entry here.
const SCOPES = ['PT', 'ES', 'GB', 'FR', 'BE', 'NL', 'CH', 'AT', 'IE', 'DK', 'SE', 'mediterranean', 'temperate'];
// A market scope reads through the label parser as its climate band; a bare
// band scope IS its band. Reading MARKETS keeps this in sync with the shared
// truth — one place per new sourced market instead of two parallel lists.
const legacyBand = (scope) => MARKETS[scope]?.band ?? scope;
const TICKS = [];
for (let m = 1; m <= 12; m++) for (const d of ['01', '16']) TICKS.push(`${String(m).padStart(2,'0')}-${d}`);

let pairs = 0, moved = 0, totalTicks = 0;
const net = { 'out->in': 0, 'out->peak': 0, 'in->out': 0, 'peak->out': 0, 'peak->in': 0, 'in->peak': 0 };

for (const it of P) {
  if (!it.season_ranges) continue;
  for (const scope of SCOPES) {
    if (rangesFor(it, scope) == null) continue;   // no calendar at this scope (a label-only item has no PT key)
    pairs++;
    const diffs = TICKS.map((t) => {
      const before = legacySeasonalityOf(it.season, Number(t.slice(0, 2)) - 1, legacyBand(scope));
      const after = rangeSeasonalityOf(it, t, scope);
      return [t, before, after];
    }).filter(([, a, b]) => a !== b);
    totalTicks += diffs.length;
    if (!diffs.length) continue;
    moved++;
    console.log(`\n${it.id}  (${scope})   label "${it.season}"  ->  ${JSON.stringify(rangesFor(it, scope))}`);
    for (const [t, a, b] of diffs) {
      console.log(`    ${t}   ${a.padEnd(4)} -> ${b}`);
      const k = `${a}->${b}`; if (k in net) net[k]++;
    }
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`${pairs} item/scope pairs carry ranges. ${moved} of them move.`);
console.log(`${totalTicks} of ${pairs * TICKS.length} half-month readings change.`);
console.log('net:', Object.entries(net).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join('   '));
