/* The 24-card Portuguese set, anchor-first.
   ANCHORS are days whose own working_name names a produce. They are assigned
   before anything else and are not negotiable. Each is then TESTED against the
   Portuguese data: an anchor whose produce is out of season here does not get
   forced, it gets reported, because that mismatch is the same finding the
   poster made. Remaining days are filled by score. */
import { readFileSync } from 'node:fs';
import { seasonalityOf } from '../src/season.js';
const P = JSON.parse(readFileSync(new URL('../data/produce.json', import.meta.url)));
const D = JSON.parse(readFileSync(new URL('../data/turning-days.json', import.meta.url))).days;
const byId = Object.fromEntries(P.map(p => [p.id, p]));
const plateUsers = {};
for (const p of P) if (p.illustration) (plateUsers[p.illustration] ??= []).push(p.id);
const pt = (id) => byId[id]?.name_local?.pt || id;

const ANCHORS = {
  III:  ['leek',            'os alhos-franceses de São David'],
  X:    ['cherry',          'as cerejas de São João'],
  XI:   ['plum',            'as cerejas dão lugar às ameixas'],
  XIV:  ['greengage',       'a rainha-cláudia, o fruto que dá nome ao jornal'],
  XV:   ['grapes-black',    'a vindima'],
  XVI:  ['pumpkin',         'as abóboras de São Miguel'],
  XVII: ['blackberry',      'as amoras do diabo'],
  XVIII:['medlar',          'a nêspera-europeia chega'],
  XIX:  ['chestnut',        'o fumo das castanhas'],
  XX:   ['chestnut',        'o magusto'],
  XXIV: ['grapes',          'Vicente poda as vinhas'],
};

const used = new Set(), usedPlate = new Set();
const rows = [], problems = [];
// pass 1: anchors
for (const d of D) {
  const a = ANCHORS[d.numeral]; if (!a) continue;
  const [id, why] = a; const p = byId[id];
  const s = p ? seasonalityOf(p, d.opens, 'mediterranean') : 'MISSING';
  const noArt = p && !p.illustration;
  if (!p)            problems.push([d.numeral, id, 'NOT IN CATALOGUE', why]);
  else if (s==='out')problems.push([d.numeral, id, `OUT OF SEASON in PT on ${d.opens}`, why]);
  else if (noArt)    problems.push([d.numeral, id, 'NO PRINT EXISTS', why]);
  else if (used.has(id)) problems.push([d.numeral, id, 'already used on an earlier card', why]);
  else { used.add(id); usedPlate.add(p.illustration); rows.push({n:d.numeral, opens:d.opens, id, kind:'ANCHOR', s}); continue; }
  rows.push({n:d.numeral, opens:d.opens, id:null, kind:'BLOCKED', s});
}
// pass 2: fill
for (const d of D) {
  if (rows.find(r => r.n === d.numeral && r.id)) continue;
  const i = D.indexOf(d), prev = D[(i-1+D.length)%D.length];
  const cands = P.filter(p => p.illustration && !used.has(p.id) && !usedPlate.has(p.illustration))
    .map(p => { const s = seasonalityOf(p,d.opens,'mediterranean'); if (s==='out') return null;
      const was = seasonalityOf(p,prev.opens,'mediterranean');
      let sc = (s==='peak'?100:0) + (was==='out'?60:0) + (plateUsers[p.illustration].length===1?25:0)
             + (['sourced','argued'].includes(p.provenance)?15:0);
      return {id:p.id, sc, s}; }).filter(Boolean).sort((a,b)=>b.sc-a.sc);
  const pick = cands[0];
  const row = rows.find(r => r.n === d.numeral);
  if (pick){ used.add(pick.id); usedPlate.add(byId[pick.id].illustration);
    if(row){row.id=pick.id;row.kind=row.kind==='BLOCKED'?'REPLACED':'fill';row.s=pick.s;}
    else rows.push({n:d.numeral,opens:d.opens,id:pick.id,kind:'fill',s:pick.s}); }
}
rows.sort((a,b)=>D.findIndex(d=>d.numeral===a.n)-D.findIndex(d=>d.numeral===b.n));
for (const r of rows) console.log(`${r.n.padStart(5)} ${r.opens}  ${pt(r.id).padEnd(20)}${String(r.s).padEnd(6)}${r.kind}`);
console.log('\ncards:', rows.filter(r=>r.id).length, ' distinct plates:', usedPlate.size);
console.log('\nANCHORS THAT FAILED:');
for (const [n,id,why,claim] of problems) console.log(`  ${n.padStart(5)}  ${id.padEnd(12)} ${why.padEnd(34)} (${claim})`);
