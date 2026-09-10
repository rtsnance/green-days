/* Candidate set for a 24-postcard year: one per turning day.
   Rules, in order:
     1. must have a print (no pending illustration)
     2. must be `peak` on the day, else `in` and entering on that day
     3. prefer items not already used on an earlier card (a year, not a repeat)
     4. prefer items whose plate is NOT shared with another id (no lying plates) */
import { readFileSync } from 'node:fs';
import { seasonalityOf } from '../src/season.js';
const P = JSON.parse(readFileSync(new URL('../data/produce.json', import.meta.url)));
const D = JSON.parse(readFileSync(new URL('../data/turning-days.json', import.meta.url))).days;
const byId = Object.fromEntries(P.map(p => [p.id, p]));
const plateUsers = {};
for (const p of P) if (p.illustration) (plateUsers[p.illustration] ??= []).push(p.id);
const pt = (id) => byId[id]?.name_local?.pt || id;

const used = new Set();
const usedPlate = new Set();
const out = [];
for (let i = 0; i < D.length; i++) {
  const d = D[i], prev = D[(i - 1 + D.length) % D.length];
  const now = new Map(P.map(p => [p.id, seasonalityOf(p, d.opens, 'mediterranean')]));
  const before = new Map(P.map(p => [p.id, seasonalityOf(p, prev.opens, 'mediterranean')]));
  const cands = P.filter(p => p.illustration && !used.has(p.id) && !usedPlate.has(p.illustration))
    .map(p => {
      const s = now.get(p.id), was = before.get(p.id);
      if (s === 'out') return null;
      let score = 0;
      if (s === 'peak') score += 100;
      if (was === 'out') score += 60;                        // arrives on this turn
      if (plateUsers[p.illustration].length === 1) score += 25; // plate tells the truth
      if (p.provenance === 'sourced' || p.provenance === 'argued') score += 15;
      return { id: p.id, score, s, arriving: was === 'out' };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
  const pick = cands[0];
  if (pick) { used.add(pick.id); usedPlate.add(byId[pick.id].illustration); }
  out.push({ n: d.numeral, opens: d.opens, day: d.name, pick });
  console.log(`${d.numeral.padStart(5)} ${d.opens}  ${(pick ? pt(pick.id) : 'NONE').padEnd(22)}` +
    `${pick ? (pick.s === 'peak' ? 'no auge' : pick.arriving ? 'chega' : 'na banca').padEnd(9) : ''.padEnd(9)}${d.name}`);
}
console.log('\ndistinct produce:', used.size, ' distinct plates:', usedPlate.size);
