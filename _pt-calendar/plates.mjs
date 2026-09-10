import { readFileSync } from 'node:fs';
import { seasonalityOf } from '../src/season.js';
const produce = JSON.parse(readFileSync(new URL('../data/produce.json', import.meta.url)));
const days = JSON.parse(readFileSync(new URL('../data/turning-days.json', import.meta.url))).days;
const midpoint = (opens, dcount) => {
  const [m, d] = opens.split('-').map(Number);
  const dt = new Date(Date.UTC(2026, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Math.floor(dcount / 2));
  return String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
};
const all = new Set();
for (const day of days) {
  const mm = midpoint(day.opens, day.days ?? 14);
  const inSeason = produce.filter(p => seasonalityOf(p, mm, 'mediterranean') === 'in');
  console.log(`${day.numeral.padStart(5)} ${day.opens} mid=${mm} ${String(inSeason.length).padStart(3)} items  ${day.name}`);
  inSeason.forEach(p => all.add(p.id));
}
console.log('\nDISTINCT ITEMS RENDERED ON PT PLATES:', all.size);
console.log([...all].sort().join(' '));
