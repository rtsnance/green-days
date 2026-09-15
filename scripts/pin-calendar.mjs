/* Green Days — Pinterest pin calendar.

   Pinterest is a forward-planning surface: its own 2026 brand-moments guidance
   is "if the moment peaks in June, launch in April", roughly an eight-week
   lead. Stack that on our own accumulation rule (a pin needs ~3 weeks of public
   life before it can be read at all) and the publish rule falls out:

       a produce pin goes public ~7 weeks BEFORE its season opens, not during it.

   So this prints, for every field-guide entry, the date its pin should be
   public — season start minus LEAD_DAYS — ordered from today forward across one
   market year. A pin is a perennial: each entry needs its slot filled ONCE and
   then re-peaks every year, so this calendar repeats rather than expires.

   Season start is read from season_ranges (the sourced PT layer), NOT from any
   peak or density figure: those are declared-only and have moved by 20+ in five
   weeks. A range start is stable.

   Usage:  node scripts/pin-calendar.mjs            (mediterranean band, today)
           GD_BAND=temperate node scripts/pin-calendar.mjs
           GD_TODAY=2026-11-01 node scripts/pin-calendar.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rangesFor, seasonEntryFor } from '../src/season.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEAD_DAYS = 49; // 7 weeks
const BAND = process.env.GD_BAND || 'mediterranean';

const produce = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/produce.json'), 'utf8'));
const byId = new Map((Array.isArray(produce) ? produce : Object.values(produce)[0]).map((p) => [p.id, p]));

const entryIds = fs.readdirSync(path.join(ROOT, 'content/produce'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''));

const today = process.env.GD_TODAY ? new Date(process.env.GD_TODAY + 'T00:00:00Z') : new Date();
const YEAR = today.getUTCFullYear();

// Roll forward on the SEASON OPEN, not on the publish date. An entry whose
// ideal publish date slipped past by a few days is late by days, not by a year
// — pushing it to the next open would silently cost it a whole season.
function publishDateFor(mmdd) {
  const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (const y of [YEAR, YEAR + 1, YEAR + 2]) {
    const [m, d] = mmdd.split('-').map(Number);
    const open = Date.UTC(y, m - 1, d);
    if (open < midnight) continue;
    return { publish: new Date(open - LEAD_DAYS * 86400000), open: new Date(open), midnight };
  }
  return null;
}

const iso = (d) => d.toISOString().slice(0, 10);

const rows = [];
for (const id of entryIds) {
  const p = byId.get(id);
  if (!p) { rows.push({ id, err: 'no produce record' }); continue; }
  const ranges = rangesFor(p, BAND) || rangesFor(p, 'mediterranean') || rangesFor(p, 'temperate') || [];
  if (!ranges.length) { rows.push({ id, err: 'no season range' }); continue; }
  // Earliest upcoming publish date across this item's ranges.
  const best = ranges.map((r) => publishDateFor(r.from)).filter(Boolean)
    .sort((a, b) => a.publish - b.publish)[0];
  if (!best) { rows.push({ id, err: 'no upcoming window' }); continue; }
  rows.push({ id, name: p.name_en, publish: best.publish, open: best.open, availability: p.availability, provenance: (seasonEntryFor(p, BAND) || {}).provenance });
}

const ok = rows.filter((r) => !r.err).sort((a, b) => a.publish - b.publish);
const bad = rows.filter((r) => r.err);

console.log(`\nPIN CALENDAR — ${BAND} band, ${LEAD_DAYS}-day lead, from ${iso(today)}`);
console.log(`${ok.length} of ${entryIds.length} field-guide entries placed\n`);
console.log('PUBLISH     SEASON OPENS  ENTRY');
let overdue = 0;
for (const r of ok) {
  const daysLate = Math.round((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - r.publish.getTime()) / 86400000);
  const late = daysLate >= 0;
  if (late) overdue++;
  console.log(`${iso(r.publish)}  ${iso(r.open)}    ${r.name}${late ? `   <- PUBLISH NOW (${daysLate}d late, season opens in ${Math.round((r.open - today) / 86400000)}d)` : ''}`);
}
if (bad.length) {
  console.log('\nUNPLACED:');
  for (const r of bad) console.log(`  ${r.id}: ${r.err}`);
}
console.log(`\n${overdue} entr${overdue === 1 ? 'y is' : 'ies are'} already inside the publish window.`);
