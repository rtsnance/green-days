/* Migrate season_ranges[*].source (a monolithic prose string) to
   source_id + optional matched_on + optional source_note, resolved via
   data/sources.json at read time.

   node scripts/migrate-source-ids.mjs           # dry run: print unmapped
   node scripts/migrate-source-ids.mjs --write   # writes data/produce.json

   Every entry in season_ranges falls into one of these classes:
   - shared publisher (bbc, apn, eroski_*, vegsoc, continente, deco, med_inherits_pt,
     es_applied_to_*): source_id + optional matched_on
   - derived-from-label (autumn/spring/summer/winter labels + variants):
     source_id="derived_from_label" + matched_on=the label + optional
     source_note="not checked against a stall"
   - hand-annotated one-offs (greengage correction, avocado edge, olive
     note, EDGE SPLIT tail on some APN entries): source_id resolves to the
     nearest publisher; the annotation lives in source_note.

   Anything the migration can't classify prints in the dry run so we can
   see it before writing. */
import fs from 'node:fs';

const P = JSON.parse(fs.readFileSync('data/produce.json', 'utf8'));
const SOURCES = JSON.parse(fs.readFileSync('data/sources.json', 'utf8'));
const WRITE = process.argv.includes('--write');

// Match order matters: check the more specific stems first (EDGE SPLIT
// before plain APN, "not checked against a stall" variant before plain
// derived_from_label).
const RULES = [
  {
    id: 'bbc_good_food_2024',
    test: (s) => s.startsWith('UK seasonality, BBC Good Food'),
    matched: (s) => {
      const m = s.match(/matched on \"([^\"]+)\"(.*)$/);
      if (!m) return null;
      const name = m[1];
      const tail = m[2].replace(/^;\s*/, '').trim();
      return tail ? `${name}; ${tail}` : name;
    },
  },
  {
    id: 'vegetarian_society_2022',
    test: (s) => s.startsWith('UK-grown produce by month, The Vegetarian Society'),
    matched: (s) => {
      const m = s.match(/matched on \"([^\"]+)\"/);
      return m ? m[1] : null;
    },
  },
  {
    id: 'eroski_frutas_2026',
    test: (s) => s.startsWith('Spanish seasonality, Eroski Consumer \"Calendario anual de frutas\"'),
    matched: (s) => {
      const m = s.match(/matched on \"([^\"]+)\"(.*)$/);
      if (!m) return null;
      const name = m[1];
      const tail = m[2].replace(/^;\s*/, '').trim();
      return tail ? `${name}; ${tail}` : name;
    },
  },
  {
    id: 'eroski_hortalizas_2026',
    test: (s) => s.startsWith('Spanish seasonality, Eroski Consumer \"Calendario anual de verduras y hortalizas\"'),
    matched: (s) => {
      const m = s.match(/matched on \"([^\"]+)\"(.*)$/);
      if (!m) return null;
      const name = m[1];
      const tail = m[2].replace(/^;\s*/, '').trim();
      return tail ? `${name}; ${tail}` : name;
    },
  },
  {
    id: 'continente_2024',
    test: (s) => s.startsWith('Portuguese national seasonality, Continente feed') || s.startsWith('Portuguese produce availability, Continente feed'),
    matched: (s) => {
      const m = s.match(/matched on \"([^\"]+)\"(?:\s*\(([^)]+)\))?/);
      if (!m) return null;
      const name = m[1];
      const local = m[2];
      return local ? `${name} (${local})` : name;
    },
  },
  {
    id: 'deco_proteste_2024',
    test: (s) => s.startsWith('Portuguese national seasonality, DECO PROteste'),
    matched: (s) => {
      const m = s.match(/matched on \"([^\"]+)\"/);
      return m ? m[1] : null;
    },
  },
  // APN, with a couple of hand-annotated variants
  {
    id: 'apn_2021',
    test: (s) => s.startsWith('Portuguese national seasonality, Alianca contra a Fome') || s.startsWith('mediterranean band corrected'),
    matched: (s) => {
      const m = s.match(/matched on \"([^\"]+)\"(?:\s*\(([^)]+)\))?/);
      if (!m) return null;
      const name = m[1];
      const local = m[2];
      return local ? `${name} (${local})` : name;
    },
    note: (s) => {
      // "EDGE SPLIT: ..." trailing note, or the greengage-correction preamble
      let note = null;
      const edge = s.match(/EDGE SPLIT:\s*([\s\S]+?)(?=;\s*matched on |$)/);
      if (edge) note = 'EDGE SPLIT: ' + edge[1].trim();
      if (s.startsWith('mediterranean band corrected')) {
        const corrected = s.match(/^([\s\S]+?)Portuguese national seasonality/);
        if (corrected) note = corrected[1].trim().replace(/[.;]$/, '');
      }
      return note;
    },
  },
  {
    id: 'med_inherits_pt',
    test: (s) => s === 'Portugal\'s calendar, applied to the whole mediterranean band; no source recorded for Spain, Italy or Greece yet',
  },
  {
    id: 'es_applied_to_italy',
    test: (s) => s === 'Spain\'s calendar, applied to Italy; no Italian source recorded yet',
  },
  {
    id: 'es_applied_to_greece',
    test: (s) => s === 'Spain\'s calendar, applied to Greece; no Greek source recorded yet',
  },
  // derived-from-label, both "no source" and "not checked" variants
  {
    id: 'derived_from_label',
    test: (s) => /^derived from the \"[^\"]+\" label by scripts\/derive-season-ranges\.mjs/.test(s),
    matched: (s) => {
      const m = s.match(/^derived from the \"([^\"]+)\" label/);
      return m ? m[1] : null;
    },
    note: (s) => (s.includes('not checked against a stall') ? 'not checked against a stall' : null),
  },
];

const HAND_ANNOTATED = new Map([
  // olive-specific note — the one starting "Portuguese national seasonality, calendarios.info"
  ['calendarios.info', { id: 'apn_2021', note: 'olive harvest window per calendarios.info, "A apanha da azeitona em Portugal"; APN calendar is the underlying stem' }],
  // avocado edge — starts "DECO PROteste calendar lists Abacate year-round"
  ['DECO PROteste calendar lists Abacate', { id: 'deco_proteste_2024', note: 'Abacate is import availability year-round; Med winter (Nov-Mar) is the honest season, per the label' }],
]);

let migrated = 0;
const unmapped = [];
const stems = new Map();

for (const it of P) {
  const sr = it.season_ranges || {};
  for (const scope of Object.keys(sr)) {
    const e = sr[scope];
    if (Array.isArray(e) || !e.source) continue;
    const src = e.source;

    // Hand-annotated one-offs first
    let hit = null;
    for (const [needle, spec] of HAND_ANNOTATED) {
      if (src.includes(needle)) { hit = { id: spec.id, matched_on: null, source_note: spec.note }; break; }
    }

    if (!hit) {
      for (const rule of RULES) {
        if (!rule.test(src)) continue;
        hit = {
          id: rule.id,
          matched_on: rule.matched ? rule.matched(src) : null,
          source_note: rule.note ? rule.note(src) : null,
        };
        break;
      }
    }

    if (!hit) {
      unmapped.push({ id: it.id, scope, src: src.slice(0, 200) });
      continue;
    }
    if (!(hit.id in SOURCES)) {
      unmapped.push({ id: it.id, scope, src: `UNKNOWN SOURCE_ID: ${hit.id}` });
      continue;
    }

    delete e.source;
    e.source_id = hit.id;
    if (hit.matched_on) e.matched_on = hit.matched_on;
    if (hit.source_note) e.source_note = hit.source_note;
    migrated++;
    stems.set(hit.id, (stems.get(hit.id) || 0) + 1);
  }
}

console.log('\nmigrated by source_id:');
for (const [id, n] of [...stems.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(4)}  ${id}`);
console.log(`\nmigrated ${migrated} entries total`);
console.log(`unmapped: ${unmapped.length}`);
for (const u of unmapped.slice(0, 20)) console.log(`  ${u.id}/${u.scope}: ${u.src}`);
if (unmapped.length > 20) console.log(`  ... ${unmapped.length - 20} more`);

if (WRITE) {
  if (unmapped.length) {
    console.error(`\nrefusing to write — ${unmapped.length} unmapped entries need a rule or a hand annotation`);
    process.exit(1);
  }
  fs.writeFileSync('data/produce.json', JSON.stringify(P, null, 2) + '\n');
  console.log('\nwrote data/produce.json');
}
