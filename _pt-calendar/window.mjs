/* Window sampling, per SEASON-SEAM Part 5: a turn is 7 to 25 days, not a point.
   For each turn and each item, compute the fraction of the turn's days the item
   is in season for. Fraction 1 = present throughout. 0 < f < 1 = the transition,
   which is what a turning day actually means. */
import { readFileSync, writeFileSync } from 'node:fs';
import { seasonalityOf } from '../src/season.js';
const produce = JSON.parse(readFileSync(new URL('../data/produce.json', import.meta.url)));
const days = JSON.parse(readFileSync(new URL('../data/turning-days.json', import.meta.url))).days;
const BAND = 'mediterranean';
const pt = (p) => p.name_local?.pt || p.name_en;
const pad = (n) => String(n).padStart(2, '0');

const out = [];
for (const d of days) {
  const [m0, d0] = d.opens.split('-').map(Number);
  const start = new Date(Date.UTC(2026, m0 - 1, d0));
  const ticks = [];
  for (let i = 0; i < d.days; i++) {
    const t = new Date(start); t.setUTCDate(t.getUTCDate() + i);
    ticks.push(`${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`);
  }
  const rows = [];
  for (const p of produce) {
    let n = 0;
    for (const t of ticks) { const s = seasonalityOf(p, t, BAND); if (s === 'in' || s === 'peak') n++; }
    if (n > 0) rows.push({ id: p.id, pt: pt(p), f: n / d.days });
  }
  const whole   = rows.filter(r => r.f === 1);
  const rising  = rows.filter(r => r.f < 1 && seasonalityOf(produce.find(p=>p.id===r.id), ticks[ticks.length-1], BAND) !== 'out');
  const falling = rows.filter(r => r.f < 1 && seasonalityOf(produce.find(p=>p.id===r.id), ticks[ticks.length-1], BAND) === 'out');
  out.push({ num: d.num, numeral: d.numeral, opens: d.opens, days: d.days, name: d.name,
             whole: whole.length, rising: rising.map(r=>r.pt), falling: falling.map(r=>r.pt),
             transitions: rising.length + falling.length });
  console.log(`${d.numeral.padStart(5)} ${d.opens} ${String(d.days).padStart(2)}d  whole ${String(whole.length).padStart(3)}  em transição ${String(rising.length+falling.length).padStart(2)}  ${d.name}`);
  if (rising.length)  console.log(`        A CHEGAR: ${rising.map(r=>r.pt).join(', ')}`);
  if (falling.length) console.log(`        A SAIR  : ${falling.map(r=>r.pt).join(', ')}`);
}
writeFileSync(new URL('./window.json', import.meta.url), JSON.stringify(out, null, 2));
const empty = out.filter(o => o.transitions === 0);
console.log(`\nTURNS WITH NO TRANSITION AT ALL: ${empty.length} of 24`);
empty.forEach(o => console.log(`   ${o.numeral} ${o.name}`));
