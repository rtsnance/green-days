/* Check season_ranges against the turning days' own editorial claims.
   node scripts/season-lore-check.mjs

   season-diff.mjs tells you WHAT moved. This tells you whether it moved
   CORRECTLY, which produce.json cannot answer about itself.

   Every assertion below is a claim written into data/turning-days.json's
   working_name or lore_leads, by a different pass, for a different reason.
   That independence is the whole value: a range derived from a prose label can
   only be checked against that label unless something outside vouches for it.

   A FAIL is not automatically a bad range. It means the lore and the data
   disagree, and one of them is wrong. Decide which. Record the answer. */

import fs from 'node:fs';
import { rangeSeasonalityOf } from '../src/season.js';

const P = JSON.parse(fs.readFileSync('data/produce.json', 'utf8'));
const byId = (id) => P.find((x) => x.id === id);
const at = (id, date, band) => {
  const it = byId(id);
  if (!it) return 'NO-SUCH-ITEM';
  const r = rangeSeasonalityOf(it, date, band);
  return r === null ? 'unranged' : r;
};
const shift = (d, days) => {           // MM-DD +/- n days, non-leap
  const CUM = [0,31,59,90,120,151,181,212,243,273,304,334];
  const [m, dd] = d.split('-').map(Number);
  let n = ((CUM[m-1] + dd + days - 1) % 365 + 365) % 365 + 1, mo = 11;
  while (CUM[mo] >= n) mo--;
  return String(mo+1).padStart(2,'0') + '-' + String(n - CUM[mo]).padStart(2,'0');
};

/* A miss of a few days is NOT a miss: the ranges are half-month resolution by
   design, so anything inside one tick is corroboration, not disagreement. NEAR
   marks that; only FAIL means the lore and the data actually contradict. */
const TICK = 15;
let pass = 0, near = 0, fail = 0, skip = 0;
const results = [];
function check(turn, claim, band, fn) {
  const r = fn();
  if (r.skip) { skip++; results.push(['SKIP', turn, claim, band, r.note]); return; }
  if (r.ok) { pass++; results.push(['PASS', turn, claim, band, r.note]); return; }
  const nearby = [-TICK, -7, -2, 2, 7, TICK].some((d) => { const alt = fn.withDate ? fn.withDate(d) : null; return alt && alt.ok; });
  if (nearby) { near++; results.push(['NEAR', turn, claim, band, r.note + '  (agrees within one half-month tick)']); }
  else { fail++; results.push(['FAIL', turn, claim, band, r.note]); }
}
const IN = (s) => s === 'in' || s === 'peak';

// "in season on this date"
const onDay = (id, date, band, want) => { const f = (off = 0) => {
  const d = shift(date, off);
  const s = at(id, d, band);
  if (s === 'unranged' || s === 'NO-SUCH-ITEM') return { ok: false, note: `${id}: ${s}`, skip: true };
  const ok = want === 'in' ? IN(s) : want === 'out' ? s === 'out' : s === want;
  return { ok, note: `${id} reads ${s}, wanted ${want}` };
}; const g = () => f(0); g.withDate = f; return g; };
// "gone by this date, present a fortnight before"
const leavesBy = (id, date, band) => { const f = (off = 0) => { const date2 = shift(date, off);
  const b = at(id, shift(date2, -14), band), a = at(id, date2, band);
  if ([b, a].some((x) => x === 'unranged' || x === 'NO-SUCH-ITEM')) return { ok: false, note: `${id}: unranged`, skip: true };
  return { ok: IN(b) && a === 'out', note: `${id}: ${shift(date2,-14)}=${b} -> ${date2}=${a}` };
}; const g = () => f(0); g.withDate = f; return g; };
// "arrives by this date, absent a fortnight before"
const arrivesBy = (id, date, band) => { const f = (off = 0) => { const date2 = shift(date, off);
  const b = at(id, shift(date2, -14), band), a = at(id, date2, band);
  if ([b, a].some((x) => x === 'unranged' || x === 'NO-SUCH-ITEM')) return { ok: false, note: `${id}: unranged`, skip: true };
  return { ok: b === 'out' && IN(a), note: `${id}: ${shift(date2,-14)}=${b} -> ${date2}=${a}` };
}; const g = () => f(0); g.withDate = f; return g; };

const T = 'temperate', M = 'mediterranean';

/* --- the claims --- */
check('III  St David 03-01',  'early-Mar arrivals: asparagus, rhubarb', T, onDay('asparagus','03-01',T,'in'));
check('III  St David 03-01',  "St David's leeks",                       T, onDay('leek','03-01',T,'in'));
check('V    Cuckoo 04-14',    'first pods: broad beans',                T, onDay('broad-beans-fava','04-14',T,'in'));
check('V    Cuckoo 04-14',    'first pods: new potato',                 T, onDay('new-potato','04-14',T,'in'));
check('X    Midsummer 06-24', 'cherries at peak',                       T, onDay('cherry','06-24',T,'peak'));
check('XI   Swithin 07-15',   'cherries out',                           T, leavesBy('cherry','07-15',T));
check('XI   Swithin 07-15',   'gooseberries out',                       T, leavesBy('gooseberry','07-15',T));
check('XI   Swithin 07-15',   'plum family in',                         T, onDay('plum','07-15',T,'in'));
check('XII  Santiago 07-31',  'Abricot day',                            M, onDay('apricot','07-31',M,'in'));
check('XIII Lammas 08-18',    'Prune (plum) day',                       M, onDay('plum','08-18',M,'in'));
check('XV   Marymas 09-22',   'Raisin day / the vindima',               M, onDay('grapes','09-22',M,'in'));
check('XVI  Michaelmas 09-29','the squashes',                           T, onDay('pumpkin','09-29',T,'in'));
check('XVII Old Mich. 10-11', 'no blackberries after Old Michaelmas',   T, onDay('blackberry','10-11',T,'out'));
check('XVIII St Luke 10-18',  'the last tomatoes leave',                T, leavesBy('tomato','10-18',T));
check('XVIII St Luke 10-18',  'medlar arrives',                         T, arrivesBy('medlar','10-18',T));
check('XIX  All Hallows 11-04','Endive day',                            T, onDay('endive-fris-e','11-04',T,'in'));
check('XX   Martinmas 11-14', 'Orange day',                             M, onDay('orange','11-14',M,'in'));
check('XXI  Nicholas 12-06',  'the south turns to citrus',              M, onDay('lemon','12-06',M,'in'));
check('XXI  Nicholas 12-06',  'the north empties of citrus',            T, onDay('orange','12-06',T,'out'));
check('XXIII Epiphany 01-15', 'mid-Jan: PSB alone',                     T, onDay('purple-sprouting-broccoli','01-15',T,'in'));

for (const [st, turn, claim, band, note] of results) {
  const mark = st === 'PASS' ? '  ok  ' : st === 'NEAR' ? ' near ' : st === 'FAIL' ? ' FAIL ' : ' skip ';
  console.log(`${mark}${turn.padEnd(22)} ${claim.padEnd(40)} [${band.slice(0,4)}]  ${note}`);
}
console.log(`\n${pass} pass, ${near} near (within one half-month tick), ${fail} fail, ${skip} unranged.`);
console.log('A FAIL means the lore and the data disagree. Decide which is wrong.');
