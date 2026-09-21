/* Ireland inherits Great Britain (proposed order step 4 in the 2026-09-21
   handoff).
   node scripts/source-ie-inherit-gb.mjs          # dry run
   node scripts/source-ie-inherit-gb.mjs --write  # writes sr.IE = { inherit: 'GB' } on every item that carries sr.GB

   There is no Irish source yet — Bord Bia's *Best in Season* calendar
   sits behind a Cloudflare bot check that isn't worth bypassing. Instead
   of leaving Irish sessions on temperate/derived-from-label (the
   generic fallback), point them at Britain's dates for the items where
   Britain IS sourced. Same climate, same island group, and the app then
   says "Dates are Britain's. Not yet checked against a source for
   Ireland" instead of the anonymous label fallback.

   The moment Bord Bia (or any Irish source) is read, replace these
   inherit pointers with sourced sr.IE entries. Until then, the honest
   thing is to disclose the surrogate, not paint over the gap. */
import fs from 'node:fs';

const FILE = 'data/produce.json';
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const WRITE = process.argv.includes('--write');

let written = 0, alreadyHad = 0, noGb = 0;
const changes = [];
for (const it of P) {
  const sr = it.season_ranges || {};
  if (!('GB' in sr)) { noGb++; continue; }
  if ('IE' in sr) { alreadyHad++; continue; }
  sr.IE = { inherit: 'GB', provenance: 'inferred', source_id: 'gb_applied_to_ireland' };
  it.season_ranges = sr;
  changes.push(it.id);
  written++;
}

console.log(`Wrote sr.IE = { inherit: "GB" } on ${written} items.`);
console.log(`Already had sr.IE: ${alreadyHad}. No sr.GB present, left alone: ${noGb}.`);
if (WRITE) {
  fs.writeFileSync(FILE, JSON.stringify(P, null, 2) + '\n');
  console.log(`wrote ${FILE}`);
} else {
  console.log(`(dry run — pass --write to persist)`);
}
