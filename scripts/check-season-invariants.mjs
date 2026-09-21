/* Season invariants on data/produce.json. Runs in predeploy; fails the gate
   if any check trips. The point is to catch data shape drift no other test
   would notice — the kinds of silent regressions the code-review pass on
   d589425 flagged as latent hazards.

   Add a new check by adding to INVARIANTS below, or by adding a new
   collectFailures block. Print one line per failure and exit 1 if any. */
import fs from 'node:fs';

const P = JSON.parse(fs.readFileSync('data/produce.json', 'utf8'));
const SOURCES = JSON.parse(fs.readFileSync('data/sources.json', 'utf8'));

const failures = [];

/* ---- twin-write: sourcing a mediterranean-band market brings its
   climate-band siblings along. Right now the only rule: an item that
   carries sr.ES must also carry sr.IT and sr.GR, so Italian and Greek
   sessions read Spain's dates via inherit — not silently fall through
   the mediterranean band to Portugal.

   A future direct sourcing of IT or GR would keep sr.IT/sr.GR present
   (as their own sourced entries, not inherit pointers), and the check
   stays green. So the invariant is "the key exists", not "the key is
   an inherit-from-ES pointer". Update INHERITORS when the next
   inheritance-based sourcing pass lands. */
const INHERITORS = {
  ES: ['IT', 'GR'],
  BE: ['NL'],
};

for (const it of P) {
  const sr = it.season_ranges || {};
  for (const [src, targets] of Object.entries(INHERITORS)) {
    if (!(src in sr)) continue;
    for (const t of targets) {
      if (!(t in sr)) {
        failures.push(`${it.id}: has sr.${src} but no sr.${t} (twin-write invariant)`);
      }
    }
  }
}

/* ---- shape: every scope entry is either a bare array (legacy shape), or
   an object with `ranges`, or an object with `inherit`. `sr.IT = {}` was
   a real latent hazard — season.js:isRealEntry now falls through, but
   catching it at the data level is cheaper than debugging a silent
   out-of-season year-round paint. */
for (const it of P) {
  const sr = it.season_ranges || {};
  for (const [scope, e] of Object.entries(sr)) {
    if (e === null || Array.isArray(e)) continue;
    if (typeof e !== 'object') {
      failures.push(`${it.id}: sr.${scope} is ${typeof e}, expected object or array`);
      continue;
    }
    if (!('ranges' in e) && !('inherit' in e)) {
      failures.push(`${it.id}: sr.${scope} has neither ranges nor inherit — a typo or a half-write`);
    }
  }
}

/* ---- source_id resolves: every source_id on a scope entry must exist in
   data/sources.json. Migrating the shared prose out of produce.json only
   pays off if the ids don't dangle. A typo like `source_id: "bbc_2024"`
   (missing the `_good_food`) would render an empty source line silently;
   catch it at the gate. */
for (const it of P) {
  const sr = it.season_ranges || {};
  for (const [scope, e] of Object.entries(sr)) {
    if (e === null || Array.isArray(e) || typeof e !== 'object') continue;
    if (e.source_id && !(e.source_id in SOURCES)) {
      failures.push(`${it.id}: sr.${scope}.source_id "${e.source_id}" is not in data/sources.json`);
    }
  }
}

if (failures.length) {
  for (const f of failures) console.error(f);
  console.error(`\n${failures.length} season invariant violation(s) in data/produce.json`);
  process.exit(1);
}

const nInheritSrc = Object.keys(INHERITORS).length;
const nInheritTgt = Object.values(INHERITORS).reduce((n, ts) => n + ts.length, 0);
console.log(`season invariants OK — ${P.length} items, ${nInheritSrc} inheritance source(s), ${nInheritTgt} target(s)`);
