/* Belgium: the fourth sourced non-Portuguese market and the first source
   anywhere in this project that separates *in season* from *peak*.
   node scripts/source-be-calendar.mjs          # dry run: BE vs the temperate inheritance today
   node scripts/source-be-calendar.mjs --write  # writes BE entries into data/produce.json

   THE METHOD is Portugal's, GB's, Spain's, and France's: one publication,
   matched item by item, the match recorded per range in `source_id`. What
   is new here is the four-level data. Each month cell on VLAM's
   Seizoenskalender carries one of:

     s-calender-item__month--none    → not in season
     s-calender-item__month--low     → in season, tail
     s-calender-item__month--normal  → in season
     s-calender-item__month--high    → in season, peak

   The green-days schema (season.js:86-90, "PEAK IS DECLARED, NOT DERIVED")
   already accepts per-range `peak_from` / `peak_to`. Until now, no source
   filled them: peak was a promise. VLAM is the first source that says peak
   with a straight face, and this loader records the levels verbatim.

   TWO SOURCES, both read from the DOM in the browser pane on 2026-09-21
   (never from a WebFetch summary), through the same JS selector:

     document.querySelectorAll('div.s-calender-item.flex-column.flex-md-row')

   with each row's twelve `.s-calender-item__month` cells' `--<level>` class:

     1. Groenten, lekkervanbijons.be/producten/groenten/seizoenskalender-groenten
        55 rows.
     2. Fruit, lekkervanbijons.be/fruit/seizoenskalender-fruit
        14 rows, three of which are all-none (Cassisbes, Kweepeer, Veenbes)
        — VLAM asserts no Belgian season for those, so they're dropped rather
        than matched with an empty range (a "sourced empty" would silently
        paint the item out-of-season year-round for a BE session; Trap 8
        redux, same defence as the ES script's isRealEntry check).

   VLAM is the Flemish public agri-food marketing body (Vlaams Centrum voor
   Agro- en Visserijmarketing / Lekker van bij ons). "Lekker van bij ons" =
   "delicious from close to home". The calendar is a marketing surface, but
   it is authoritative about Flemish supply because that IS what VLAM
   markets, and the four levels reflect real supply thresholds rather than
   a curator's mood.

   THE PEAK RULE. For each contiguous non-none block (= one season range):
     - find the contiguous month-runs of `high` inside it
     - one run → write peak_from / peak_to for that range
     - zero runs → no peak on this range
     - two or more runs → no peak, log the ambiguity to stderr
   Two peak clusters in one range means two harvests separated by an
   in-season-but-not-peak trough (Belgian cauliflower does this: summer
   and autumn). One peak_from / peak_to interval cannot say that honestly
   without lying about the trough, so we say nothing until the schema
   grows or a UI needs it.

   Deliberately NOT matched, with the reason:
     augurk (gherkin)      pickling cucumber, not the same product as
                           cucumber. No green-days id.
     chinese-kool          nappa cabbage (Brassica rapa pekinensis) —
                           different species from pak-choi (B. rapa
                           chinensis, matched separately) and from the
                           head cabbages (B. oleracea). No green-days id
                           and no honest cousin.
     andijvie              broad-leaved escarole. Distinct from krulandijvie
                           (curly frisée, matched to endive-fris-e).
                           Green-days doesn't split escarole out; matching
                           it to endive-fris-e would double-count with
                           krulandijvie. Left on fallback.
     rammenas              black radish. Different from daikon-mooli (white
                           daikon); Belgian rammenas is Raphanus sativus
                           var. niger, daikon is var. longipinnatus. Two
                           weeks off on the season and the wrong flavour.
     schorseneren          salsify. Real Belgian winter root, no green-days
                           id. Same case as ES/FR.
     witloof               Belgian endive / witloof chicory. Culturally the
                           definitive Belgian vegetable and no green-days
                           id — the roster has endive-fris-e and radicchio
                           but not witloof. Skipped rather than mis-matched.
     postelein             purslane. No green-days id.
     tuinkers              garden cress (Lepidium sativum). Different plant
                           from watercress (Nasturtium officinale, matched
                           separately as Waterkers).
     asperge (groen) OR asperge (wit)
                           VLAM lists green and white asparagus separately.
                           Green-days has one `asparagus` id. Matched to
                           Asperge (wit) — white asparagus is the specific
                           Belgian tradition (Mechelen white asparagus is
                           the marker product), and its window (Feb-Jul)
                           subsumes the green window (Apr-Jul). The green
                           row is not matched to any id and is dropped.
     boontjes vs groene boontjes
                           VLAM has both. Groene boontjes → green-french-beans.
                           Boontjes (Jul-Sep high only, else none) reads
                           like fresh runner or shell beans; matched to
                           runner-beans.
     kiwibes               kiwi berry (Actinidia arguta), not kiwifruit
                           (A. deliciosa). Different product; no id.
     cassisbes, kweepeer, veenbes
                           three fruit rows marked --none in all twelve
                           months by VLAM. Dropped rather than sourced-empty.
     Everything absent from either VLAM roster (chestnut, herbs beyond
     parsley, all citrus, all stone fruit except cherry/plum/apricot(no)*,
     etc.) stays on the temperate fallback. (*Apricot is genuinely absent
     from VLAM — not a Belgian crop at scale.)

   ALSO WRITTEN: NL receives `inherit: "BE"` entries for every BE-matched
   item (per the doc's proposed order step 2), so a Dutch session reads
   "Dates are Belgium's. Not yet checked against a source for the
   Netherlands" rather than falling through to the temperate/derived-from-
   label placeholder. Same climate, same language; stays in place until
   the Voedingscentrum PDF is read.

   Resolution is 'month' throughout: VLAM speaks in whole-month cells. */
import fs from 'node:fs';
import { rangesOf, TICKS, measureWrite, fmt } from './_source-calendar-util.mjs';

const FILE = 'data/produce.json';
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const WRITE = process.argv.includes('--write');

/* ---- VLAM Groenten, verbatim from the DOM.
   Format: name|12 dot-separated level codes (n=none, l=low, m=normal, h=high) */
const GROENTEN_ROWS = `Aardpeer|m,m,l,l,n,n,n,n,n,l,m,h
Ajuin|m,m,m,m,m,m,m,m,m,m,m,m
Andijvie|n,n,l,m,m,m,m,m,h,h,m,l
Asperge (groen)|n,n,n,m,h,m,l,n,n,n,n,n
Asperge (wit)|n,l,m,m,h,m,l,n,n,n,n,n
Aubergine|n,l,l,m,h,h,h,m,m,l,l,n
Augurk|n,n,n,l,m,m,h,h,h,m,n,n
Bloemkool|l,l,l,l,m,h,m,m,h,m,l,l
Boerenkool|h,h,m,n,n,n,n,n,l,m,m,m
Boontjes|n,n,n,n,n,n,h,h,h,n,n,n
Broccoli|n,n,n,n,l,m,m,m,h,m,l,l
Broccolini|n,m,m,m,m,m,m,m,m,m,n,n
Champignon|m,m,m,m,m,m,m,m,m,m,m,h
Chinese kool|m,m,m,l,m,l,l,l,m,m,m,m
Courgette|n,n,l,l,m,h,h,h,h,m,l,n
Erwtjes|n,n,n,n,l,h,m,l,n,n,n,n
Groene boontjes|n,n,l,l,m,m,h,h,m,l,n,n
Knolselder|h,h,h,h,h,h,m,l,m,m,h,h
Komkommer|l,l,m,h,h,h,h,h,m,l,l,l
Koolrabi|n,n,n,n,l,m,m,m,h,h,h,l
Krulandijvie|m,m,m,m,m,m,m,m,m,m,m,m
Lente-uitjes|m,m,m,m,m,m,m,m,m,m,m,m
Oesterzwam|m,m,m,m,m,m,m,m,m,m,m,h
Paksoi|l,l,m,m,h,h,h,h,h,h,m,m
Paprika|n,n,l,m,m,h,h,h,m,l,n,n
Pastinaak|h,h,h,m,l,l,l,l,l,m,h,h
Peterselie|l,l,l,l,m,h,h,h,h,h,m,m
Pompoen|l,l,l,n,n,n,l,l,h,h,h,m
Postelein|n,n,m,m,m,m,m,m,m,m,n,n
Prei|h,h,h,h,m,m,m,m,h,h,h,h
Raap|h,h,m,n,n,n,n,n,m,h,h,h
Rabarber|n,l,l,m,h,h,h,m,l,l,n,n
Radicchio Rosso|n,n,n,n,n,m,m,m,m,m,m,n
Radijsjes|l,l,m,m,h,h,m,m,m,m,m,m
Rammenas|h,m,m,l,l,l,l,n,l,h,h,h
Rode biet|h,h,h,h,m,m,m,m,m,m,m,h
Rode kool|h,h,h,h,l,l,l,l,m,h,h,h
Savooikool|h,h,m,l,l,l,l,m,h,h,h,h
Schorseneren|h,h,m,l,n,n,n,n,m,h,h,h
Selder|l,n,n,l,m,h,h,h,h,h,m,l
Shii-take|m,m,m,m,m,l,l,l,m,h,h,h
Sjalot|m,l,l,l,l,l,l,l,l,l,l,m
Sla|m,m,h,h,h,m,m,m,m,m,h,h
Spinazie|l,l,l,m,h,h,m,m,h,h,m,l
Spitskool|l,l,n,n,m,m,l,l,m,m,l,l
Spruitjes|h,h,m,l,n,n,n,l,m,h,h,h
Tomaat|l,l,m,m,h,h,h,h,h,h,l,l
Tuinkers|m,m,m,m,m,m,m,m,m,m,m,m
Venkel|n,n,n,l,m,h,h,h,h,h,l,n
Warmoes/snijbiet|n,n,n,n,l,m,m,m,m,l,n,n
Waterkers|h,m,m,m,m,m,m,m,m,m,m,h
Witloof|h,h,h,m,m,l,l,l,m,h,h,h
Witte kool|h,h,n,m,l,m,l,l,h,h,h,h
Wortelen|l,l,n,l,m,h,h,h,h,h,m,l
Zoete aardappel|h,h,h,m,l,n,n,n,n,l,m,h`;

/* ---- VLAM Fruit, verbatim. Three all-none rows omitted. */
const FRUIT_ROWS = `Aardbei|l,l,m,h,h,h,h,h,h,m,m,l
Appel|h,h,h,h,h,h,m,m,h,h,h,h
Blauwe bes|n,n,n,l,m,h,h,m,m,m,n,n
Braambes|n,n,n,l,m,h,h,h,m,m,m,l
Framboos|n,n,n,l,m,h,h,h,m,m,l,n
Kers|n,n,n,n,n,m,m,n,n,n,n,n
Peer|h,h,h,m,m,m,l,l,h,h,h,h
Pruim|n,n,n,n,n,n,h,h,m,l,n,n
Rode bes|n,n,n,n,n,m,h,h,m,l,l,n
Stekelbes|n,n,n,n,l,l,h,h,l,n,n,n`;

const parseRows = (text) => new Map(text.split('\n').map((l) => {
  const [name, codes] = l.split('|');
  const levels = codes.split(',').map((c) => ({ n: 'none', l: 'low', m: 'normal', h: 'high' }[c.trim()]));
  return [name, levels];
}));

const GROENTEN = parseRows(GROENTEN_ROWS);
const FRUIT = parseRows(FRUIT_ROWS);

/* ---- ranges + peaks. See docstring's PEAK RULE. ---- */
const END = ['31', '28', '31', '30', '31', '30', '31', '31', '30', '31', '30', '31'];
const mm = (m) => String(m + 1).padStart(2, '0');

function monthsInRange(from, to) {
  const start = Number(from.slice(0, 2)) - 1;
  const end = Number(to.slice(0, 2)) - 1;
  const out = [];
  let i = start;
  while (true) { out.push(i); if (i === end) break; i = (i + 1) % 12; }
  return out;
}

function rangesWithPeaks(levels, itemId) {
  const marks = levels.map((l) => (l === 'none' ? '.' : 'B')).join('');
  const seasonRanges = rangesOf(marks).map((r) => ({ ...r }));
  for (const r of seasonRanges) {
    const months = monthsInRange(r.from, r.to);
    const runs = [];
    let curStart = null;
    for (let i = 0; i < months.length; i++) {
      if (levels[months[i]] === 'high') {
        if (curStart === null) curStart = i;
      } else if (curStart !== null) { runs.push([curStart, i - 1]); curStart = null; }
    }
    if (curStart !== null) runs.push([curStart, months.length - 1]);
    // Merge a wrap-peak: if this range wraps (first ≠ last chronologically) and
    // both the first and last month are high, the run touching index 0 and the
    // run touching index N-1 are the same continuous peak split by the range's
    // own iteration boundary, not by a real trough. Wrap ranges here are
    // either the year-round case (Jan-Dec, always wraps in this sense) or any
    // range produced by rangesOf whose from-month > to-month (e.g., 10-01..02-28).
    const rangeWraps = months.length === 12 || Number(r.from.slice(0, 2)) > Number(r.to.slice(0, 2));
    if (rangeWraps && runs.length >= 2) {
      const first = runs[0], last = runs[runs.length - 1];
      if (first[0] === 0 && last[1] === months.length - 1) {
        runs.pop();
        runs.shift();
        runs.unshift([last[0], first[1] + months.length]); // encode wrap span; boundary indices only used for length
        // Use the actual months at last[0] and first[1] for the date fields:
        const wrappedStartMonth = months[last[0]];
        const wrappedEndMonth = months[first[1]];
        runs[0] = [null, null, wrappedStartMonth, wrappedEndMonth];
      }
    }
    if (runs.length === 1) {
      const run = runs[0];
      const startMonth = run.length === 4 ? run[2] : months[run[0]];
      const endMonth = run.length === 4 ? run[3] : months[run[1]];
      r.peak_from = `${mm(startMonth)}-01`;
      r.peak_to = `${mm(endMonth)}-${END[endMonth]}`;
    } else if (runs.length > 1) {
      console.error(`  ambiguous peak (${runs.length} clusters) in ${itemId} range ${r.from}..${r.to}; no peak emitted for this range`);
    }
  }
  return seasonRanges;
}

/* ---- the match: produce id -> [source (g|f), name in that VLAM roster] ---- */
const MAP = {
  // vegetables
  'jerusalem-artichoke': ['g', 'Aardpeer'],
  onion: ['g', 'Ajuin'], 'red-onion': ['g', 'Ajuin'],
  asparagus: ['g', 'Asperge (wit)'],
  aubergine: ['g', 'Aubergine'],
  cauliflower: ['g', 'Bloemkool'],
  kale: ['g', 'Boerenkool'], 'cavolo-nero': ['g', 'Boerenkool'],
  'runner-beans': ['g', 'Boontjes'],
  'broccoli-calabrese': ['g', 'Broccoli'],
  'tenderstem-broccoli': ['g', 'Broccolini'],
  'button-white-mushroom': ['g', 'Champignon'],
  courgette: ['g', 'Courgette'], marrow: ['g', 'Courgette'],
  'garden-peas': ['g', 'Erwtjes'],
  'green-french-beans': ['g', 'Groene boontjes'],
  celeriac: ['g', 'Knolselder'],
  cucumber: ['g', 'Komkommer'],
  kohlrabi: ['g', 'Koolrabi'],
  'endive-fris-e': ['g', 'Krulandijvie'],
  'spring-onion': ['g', 'Lente-uitjes'],
  'oyster-mushroom': ['g', 'Oesterzwam'],
  'pak-choi': ['g', 'Paksoi'],
  'bell-pepper': ['g', 'Paprika'],
  parsnip: ['g', 'Pastinaak'],
  parsley: ['g', 'Peterselie'],
  pumpkin: ['g', 'Pompoen'], 'butternut-squash': ['g', 'Pompoen'], 'acorn-squash': ['g', 'Pompoen'],
  'crown-prince-squash': ['g', 'Pompoen'], 'spaghetti-squash': ['g', 'Pompoen'], kabocha: ['g', 'Pompoen'],
  leek: ['g', 'Prei'],
  turnip: ['g', 'Raap'],
  rhubarb: ['g', 'Rabarber'],
  radicchio: ['g', 'Radicchio Rosso'],
  radish: ['g', 'Radijsjes'], 'breakfast-radish': ['g', 'Radijsjes'],
  beetroot: ['g', 'Rode biet'], 'golden-beetroot': ['g', 'Rode biet'],
  'red-cabbage': ['g', 'Rode kool'],
  'savoy-cabbage': ['g', 'Savooikool'],
  celery: ['g', 'Selder'],
  shiitake: ['g', 'Shii-take'],
  shallot: ['g', 'Sjalot'],
  lettuce: ['g', 'Sla'], 'romaine-cos': ['g', 'Sla'], 'little-gem': ['g', 'Sla'],
  spinach: ['g', 'Spinazie'],
  'pointed-hispi-cabbage': ['g', 'Spitskool'],
  'brussels-sprouts': ['g', 'Spruitjes'],
  tomato: ['g', 'Tomaat'], 'cherry-tomato': ['g', 'Tomaat'],
  'beefsteak-tomato': ['g', 'Tomaat'], 'plum-san-marzano-tomato': ['g', 'Tomaat'],
  fennel: ['g', 'Venkel'],
  chard: ['g', 'Warmoes/snijbiet'],
  watercress: ['g', 'Waterkers'],
  'green-cabbage': ['g', 'Witte kool'], 'spring-greens': ['g', 'Witte kool'],
  carrot: ['g', 'Wortelen'], 'heritage-carrots': ['g', 'Wortelen'],
  'sweet-potato': ['g', 'Zoete aardappel'],
  // fruits
  strawberry: ['f', 'Aardbei'],
  apple: ['f', 'Appel'], 'cooking-apple': ['f', 'Appel'],
  blueberry: ['f', 'Blauwe bes'],
  blackberry: ['f', 'Braambes'],
  raspberry: ['f', 'Framboos'],
  cherry: ['f', 'Kers'],
  pear: ['f', 'Peer'], 'conference-pear': ['f', 'Peer'],
  plum: ['f', 'Pruim'], damson: ['f', 'Pruim'], greengage: ['f', 'Pruim'],
  redcurrant: ['f', 'Rode bes'],
  gooseberry: ['f', 'Stekelbes'],
};

const SOURCE = {
  g: {
    id: 'vlam_groenten_2026',
    matched: (name) => `${name}; --none/--low/--normal/--high month cells read verbatim from lekkervanbijons.be/producten/groenten/seizoenskalender-groenten`,
  },
  f: {
    id: 'vlam_fruit_2026',
    matched: (name) => `${name}; --none/--low/--normal/--high month cells read verbatim from lekkervanbijons.be/fruit/seizoenskalender-fruit`,
  },
};

/* ---- apply, and measure against what a temperate-band session sees today ---- */
let written = 0, unmatched = [], movedItems = 0, movedTicks = 0, totalTicks = 0;
let withPeak = 0, ambiguousPeakItems = 0;
const report = [];
for (const it of P) {
  const m = MAP[it.id];
  if (!m) { unmatched.push(it.id); continue; }
  const [src, name] = m;
  const levels = (src === 'g' ? GROENTEN : FRUIT).get(name);
  if (!levels) { console.error(`NO SOURCE ROW for ${it.id}: ${src} "${name}"`); process.exit(1); }
  const priorAmbiguous = process.stderr.writableLength || 0; // not reliable; use a sentinel
  const ranges = rangesWithPeaks(levels, it.id);
  const spec = SOURCE[src];
  const levelCode = levels.map((l) => ({ none: 'n', low: 'l', normal: 'm', high: 'h' }[l])).join('');
  const diff = measureWrite(it, 'temperate', 'BE', (sr) => {
    sr.BE = {
      ranges,
      provenance: 'sourced',
      resolution: 'month',
      source_id: spec.id,
      matched_on: spec.matched(name),
      levels: levelCode,
    };
    sr.NL = { inherit: 'BE', provenance: 'inferred', source_id: 'be_applied_to_netherlands' };
  });
  totalTicks += TICKS.length; movedTicks += diff; if (diff) movedItems++;
  const hasPeak = ranges.some((r) => r.peak_from);
  if (hasPeak) withPeak++;
  const tempEntry = it.season_ranges.temperate;
  const tempRanges = tempEntry ? (Array.isArray(tempEntry) ? tempEntry : tempEntry.ranges) : null;
  const rangeStr = ranges.map((r) => (r.peak_from ? `${r.from}..${r.to}[peak ${r.peak_from}..${r.peak_to}]` : `${r.from}..${r.to}`)).join(',') || '(none)';
  report.push(`${it.id.padEnd(26)} ${levelCode}  BE ${rangeStr.padEnd(46)} temperate ${(tempRanges ? fmt(tempRanges) : '(none)').padEnd(24)} ${diff ? diff + ' ticks move' : ''}`);
  written++;
}

console.log(report.join('\n'));
console.log(`\n${'='.repeat(60)}`);
const nG = Object.values(MAP).filter(([s]) => s === 'g').length;
const nF = Object.values(MAP).filter(([s]) => s === 'f').length;
console.log(`${written} items matched to VLAM (${nG} groenten, ${nF} fruit); ${unmatched.length} unmatched and left on the temperate-band fallback.`);
console.log(`${withPeak} of ${written} items carry at least one peak_from/peak_to; ambiguous multi-cluster ranges dropped their peaks (logged above).`);
console.log(`Against the temperate band today: ${movedItems} of ${written} items read differently somewhere; ${movedTicks} of ${totalTicks} half-month readings change for a BE session.`);
console.log(`Also written: ${written} NL "inherit: BE" entries, so Dutch sessions read Belgium's dates for these items instead of derived_from_label. UI: "Dates are Belgium's. Not yet checked against a source for the Netherlands."`);
console.log(`unmatched: ${unmatched.join(', ')}`);
if (WRITE) {
  fs.writeFileSync(FILE, JSON.stringify(P, null, 2) + '\n');
  console.log(`wrote ${FILE}`);
}
