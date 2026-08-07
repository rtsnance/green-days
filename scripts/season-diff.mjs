/* What moves when ranges replace the parser.
   node scripts/season-diff.mjs

   Reads nothing but data. Changes nothing. Run it after every batch of ranges
   and READ IT, rather than trusting that the ranges are right. This is the
   artifact that tells you what will move before it moves. */
import fs from 'node:fs';
import { legacySeasonalityOf, rangeSeasonalityOf } from '../src/season.js';

const P = JSON.parse(fs.readFileSync('data/produce.json', 'utf8'));
const BANDS = ['mediterranean', 'temperate'];
const TICKS = [];
for (let m = 1; m <= 12; m++) for (const d of ['01', '16']) TICKS.push(`${String(m).padStart(2,'0')}-${d}`);

let pairs = 0, moved = 0, totalTicks = 0;
const net = { 'out->in': 0, 'out->peak': 0, 'in->out': 0, 'peak->out': 0, 'peak->in': 0, 'in->peak': 0 };

for (const it of P) {
  if (!it.season_ranges) continue;
  for (const band of BANDS) {
    pairs++;
    const diffs = TICKS.map((t) => {
      const before = legacySeasonalityOf(it.season, Number(t.slice(0, 2)) - 1, band);
      const after = rangeSeasonalityOf(it, t, band);
      return [t, before, after];
    }).filter(([, a, b]) => a !== b);
    totalTicks += diffs.length;
    if (!diffs.length) continue;
    moved++;
    console.log(`\n${it.id}  (${band})   label "${it.season}"  ->  ${JSON.stringify(it.season_ranges[band])}`);
    for (const [t, a, b] of diffs) {
      console.log(`    ${t}   ${a.padEnd(4)} -> ${b}`);
      const k = `${a}->${b}`; if (k in net) net[k]++;
    }
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`${pairs} item/band pairs carry ranges. ${moved} of them move.`);
console.log(`${totalTicks} of ${pairs * TICKS.length} half-month readings change.`);
console.log('net:', Object.entries(net).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join('   '));
