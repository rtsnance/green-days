import { readFileSync, writeFileSync } from 'node:fs';
import { seasonalityOf } from '../src/season.js';
const produce = JSON.parse(readFileSync(new URL('../data/produce.json', import.meta.url)));
const days = JSON.parse(readFileSync(new URL('../data/turning-days.json', import.meta.url))).days;
const BAND = 'mediterranean';
const byId = Object.fromEntries(produce.map(p => [p.id, p]));
const at = (mmdd) => new Set(produce.filter(p => {
  const s = seasonalityOf(p, mmdd, BAND); return s === 'in' || s === 'peak';
}).map(p => p.id));
const peakAt = (mmdd) => new Set(produce.filter(p => seasonalityOf(p, mmdd, BAND) === 'peak').map(p => p.id));

const out = [];
for (let i = 0; i < days.length; i++) {
  const d = days[i], prev = days[(i - 1 + days.length) % days.length];
  const now = at(d.opens), before = at(prev.opens);
  const arrivals = [...now].filter(x => !before.has(x));
  const departures = [...before].filter(x => !now.has(x));
  out.push({
    num: d.num, numeral: d.numeral, opens: d.opens, days: d.days, great: !!d.great_turn,
    name: d.name, working_name: d.working_name,
    total: now.size, peak: [...peakAt(d.opens)],
    arrivals, departures,
  });
  const pt = (id) => byId[id]?.name_local?.pt || id;
  console.log(`${d.numeral.padStart(5)} ${d.opens} ${String(now.size).padStart(3)} in season | +${String(arrivals.length).padStart(2)} -${String(departures.length).padStart(2)}  ${d.name}`);
  if (arrivals.length)   console.log(`        ENTRA: ${arrivals.map(pt).join(', ')}`);
  if (departures.length) console.log(`         SAI : ${departures.map(pt).join(', ')}`);
}
writeFileSync(new URL('./roster.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('\nwritten _pt-calendar/roster.json');
