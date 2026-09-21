/* Denmark: the sixth sourced non-Portuguese market.
   node scripts/source-dk-calendar.mjs          # dry run: DK vs the temperate inheritance today
   node scripts/source-dk-calendar.mjs --write  # writes DK entries into data/produce.json

   THE METHOD is Portugal's, GB's, Spain's, France's, Belgium's and
   Switzerland's: one publication, matched item by item.

   ONE SOURCE, read from the browser pane on 2026-09-21 (never from a
   WebFetch summary): Forbrugerrådet Tænk, "Vælg danske frugter og
   grøntsager i sæson",

     taenk.dk/forbrugerliv/mad-og-indkoeb/vaelg-danske-frugter-og-groentsager-i-saeson

   Tænk is the Danish Consumer Council. The page's format is month
   headings ("Januar", "Februar", ...) each followed by a comma-separated
   "Grønt: ..." and "Frugt: ..." list. Text parsed month-by-month into
   a per-item month set, then rendered to wrap-safe ranges by the same
   rangesOf helper the other loaders use.

   Tænk says explicitly: "Listen er ikke udtømmende" — the list is not
   exhaustive. So a MISSING item does not mean "no Danish season"; it
   means Tænk didn't list it. Items with no Tænk entry stay on the
   temperate fallback rather than get a sourced-empty entry. (Trap 8:
   a sourced empty range paints out-of-season year-round; the fallback
   is honester.)

   Deliberately NOT matched, with the reason:
     kartofler (potato), new-potato
                           listed all 12 months. Danish "kartoffelfest"
                           in June-August is a real fresh window, but
                           Tænk conflates fresh and stored across the
                           year. Same trap as ES's Zanahoria and GB's
                           carrot. Left on the fallback.
     gulerødder (carrot), heritage-carrots
                           listed all 12 months, same trap. Same
                           precedent as GB and ES.
     hvidløg (garlic), elephant-garlic, wild-garlic
                           listed all 12 months in Tænk. Real Danish
                           garlic is a summer harvest (Jul-Sep). Year-
                           round is stored + import. GB matched Jun-Oct
                           from a fresher source; Tænk offers no fresh
                           window. Left on the fallback.
     kalette               a flower-sprout hybrid (Brussels-sprout ×
                           kale); no green-days id.
     kinakål               nappa cabbage (Brassica rapa pekinensis); no
                           id, and pak-choi is a different species (same
                           trap as VLAM's Chinese kool, VSGP's Chinakohl).
     persillerod           parsley root / Hamburg parsley; no id (same
                           as VSGP's Petersilienwurzel).
     Everything not in Tænk's list (herbs beyond dill/parsley/coriander/
     chives, most citrus, most stone fruit, all tropical fruits, and
     more) stays on the temperate fallback per Tænk's own disclaimer.

   Stored crops that Tænk lists on wide but not-quite-year-round windows
   ARE matched, on the same rule the GB script uses: apple (Aug-Feb),
   parsnip (Sep-Apr), Jerusalem artichoke (Sep-Apr), red cabbage
   (Aug-Mar), Brussels sprouts (Oct-Mar), leek (Jul-Mar), kale (Jul-Mar
   with wrap), beetroot year-round (matches GB's onion / green-cabbage
   precedent for genuinely stored crops).

   Resolution is 'month' throughout: Tænk speaks in whole months
   through its January-December headings. */
import fs from 'node:fs';
import { rangesOf, TICKS, measureWrite, fmt } from './_source-calendar-util.mjs';

const FILE = 'data/produce.json';
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const WRITE = process.argv.includes('--write');

/* ---- Tænk lists, verbatim (comma-separated), one entry per month heading.
   Names are the Danish forms as Tænk writes them (lower-cased, parentheticals
   stripped). Merged across the year into month sets by the parser below. */
const TAENK = {
  1: ['grønkål','gulerødder','hokkaido','hvidkål','hvidløg','jordskokker','kartofler','kalette','knoldselleri','løg','pastinakker','persillerod','porrer','rosenkål','rødbeder','rødkål','æbler'],
  2: ['grønkål','gulerødder','hvidkål','hvidløg','jordskokker','kalette','kartofler','knoldselleri','løg','pastinakker','persillerod','porrer','rosenkål','rødbeder','rødkål','æbler'],
  3: ['grønkål','gulerødder','hvidkål','hvidløg','jordskokker','kalette','kartofler','knoldselleri','løg','pastinakker','persillerod','porrer','purløg','rosenkål','rødbeder','rødkål'],
  4: ['gulerødder','hvidkål','hvidløg','jordskokker','kartofler','løg','pastinakker','persille','purløg','radiser','rucola','rødbeder','salat','spinat'],
  5: ['asparges','dild','forårsløg','gulerødder','hvidkål','hvidløg','kartofler','koriander','løg','persille','purløg','radiser','rucola','rødbeder','salat','spinat','jordbær','rabarber'],
  6: ['agurk','asparges','bladbeder','bladselleri','blomkål','broccoli','dild','fenikel','forårsløg','glaskål','gulerødder','hestebønner','hvidkål','hvidløg','kartofler','kinakål','koriander','løg','persille','purløg','radiser','rucola','rødbeder','salat','spidskål','spinat','squash','sukkerærter','ærter','jordbær','rabarber','stikkelsbær'],
  7: ['agurk','bladbeder','bladselleri','blomkål','broccoli','dild','fenikel','forårsløg','glaskål','grønkål','grønne bønner','gulerødder','hestebønner','hvidkål','hvidløg','kartofler','kinakål','koriander','løg','majs','persille','porrer','purløg','radiser','rucola','rødbeder','salat','spidskål','spinat','squash','sukkerærter','tomater','ærter','blommer','blåbær','hindbær','jordbær','kirsebær','melon','ribs','solbær','stikkelsbær'],
  8: ['agurk','bladbeder','bladselleri','blomkål','broccoli','dild','fenikel','forårsløg','glaskål','grønkål','grønne bønner','gulerødder','hestebønner','hokkaido','hvidkål','hvidløg','kartofler','kinakål','koriander','løg','majs','peberfrugt','persille','persillerod','porrer','purløg','radiser','rucola','rødbeder','rødkål','salat','spidskål','spinat','squash','sukkerærter','tomater','ærter','blommer','blåbær','brombær','hindbær','jordbær','kirsebær','melon','pærer','ribs','solbær','vindruer','æbler'],
  9: ['agurk','bladbeder','bladselleri','blomkål','broccoli','grønne bønner','dild','fenikel','glaskål','grønkål','gulerødder','hestebønner','hvidkål','hvidløg','hokkaido','jordskokker','kartofler','kinakål','knoldselleri','koriander','løg','majs','pastinakker','peberfrugt','persille','persillerod','porrer','purløg','radiser','rucola','rødbeder','rødkål','salat','spidskål','spinat','squash','tomater','blommer','blåbær','brombær','hindbær','pærer','vindruer','æbler'],
  10: ['bladbeder','bladselleri','blomkål','broccoli','fenikel','glaskål','grønkål','gulerødder','hokkaido','hvidkål','hvidløg','jordskokker','kartofler','kinakål','knoldselleri','løg','majs','pastinakker','peberfrugt','persille','persillerod','porrer','radiser','rosenkål','rucola','rødbeder','rødkål','salat','spidskål','spinat','squash','tomater','pærer','æbler'],
  11: ['bladselleri','blomkål','broccoli','grønkål','gulerødder','hokkaido','hvidkål','hvidløg','jordskokker','kartofler','kalette','kinakål','knoldselleri','løg','pastinakker','persille','persillerod','porrer','radiser','rosenkål','rucola','rødbeder','rødkål','spidskål','pærer','æbler'],
  12: ['bladselleri','broccoli','grønkål','gulerødder','hokkaido','hvidkål','hvidløg','jordskokker','kartofler','kalette','kinakål','knoldselleri','løg','pastinakker','persillerod','porrer','rosenkål','rødbeder','rødkål','pærer','æbler'],
};

const byName = new Map();
for (const [m, list] of Object.entries(TAENK)) {
  const mi = Number(m) - 1;
  for (const raw of list) {
    const n = raw.toLowerCase().trim();
    if (!byName.has(n)) byName.set(n, new Set());
    byName.get(n).add(mi);
  }
}
const marksOf = (name) => {
  const s = byName.get(name);
  if (!s) return null;
  const arr = Array(12).fill('.');
  for (const i of s) arr[i] = 'B';
  return arr.join('');
};

/* ---- the match: produce id -> name in Tænk's list ---- */
const MAP = {
  // fruits
  apple: 'æbler', 'cooking-apple': 'æbler',
  pear: 'pærer', 'conference-pear': 'pærer',
  strawberry: 'jordbær',
  raspberry: 'hindbær',
  blackberry: 'brombær',
  blueberry: 'blåbær',
  redcurrant: 'ribs',
  blackcurrant: 'solbær',
  gooseberry: 'stikkelsbær',
  cherry: 'kirsebær',
  plum: 'blommer', damson: 'blommer', greengage: 'blommer',
  grapes: 'vindruer', 'grapes-black': 'vindruer',
  'cantaloupe-melon': 'melon', 'honeydew-melon': 'melon',
  rhubarb: 'rabarber',
  // vegetables
  onion: 'løg', 'red-onion': 'løg',
  'spring-onion': 'forårsløg',
  shallot: 'løg',            // Tænk doesn't split shallot; shallot behaves like onion in Danish home-stall terms
  leek: 'porrer',
  chives: 'purløg',
  kale: 'grønkål', 'cavolo-nero': 'grønkål',
  'brussels-sprouts': 'rosenkål',
  cauliflower: 'blomkål',
  'broccoli-calabrese': 'broccoli', 'tenderstem-broccoli': 'broccoli',
  'green-cabbage': 'hvidkål', 'spring-greens': 'hvidkål',
  'red-cabbage': 'rødkål',
  'pointed-hispi-cabbage': 'spidskål',
  kohlrabi: 'glaskål',
  beetroot: 'rødbeder', 'golden-beetroot': 'rødbeder',
  celeriac: 'knoldselleri',
  celery: 'bladselleri',
  parsnip: 'pastinakker',
  'jerusalem-artichoke': 'jordskokker',
  // turnip: Tænk has no clear turnip row (majrove is Danish for turnip but doesn't appear). Left on fallback.
  radish: 'radiser', 'breakfast-radish': 'radiser',
  lettuce: 'salat', 'romaine-cos': 'salat', 'little-gem': 'salat',
  spinach: 'spinat',
  chard: 'bladbeder',
  'rocket-arugula': 'rucola',
  fennel: 'fenikel',
  cucumber: 'agurk',
  courgette: 'squash', marrow: 'squash',
  pumpkin: 'hokkaido',
  kabocha: 'hokkaido', 'butternut-squash': 'hokkaido',
  'acorn-squash': 'hokkaido', 'crown-prince-squash': 'hokkaido', 'spaghetti-squash': 'hokkaido',
  tomato: 'tomater', 'cherry-tomato': 'tomater',
  'beefsteak-tomato': 'tomater', 'plum-san-marzano-tomato': 'tomater',
  'bell-pepper': 'peberfrugt',
  sweetcorn: 'majs',
  asparagus: 'asparges',
  'garden-peas': 'ærter',
  'sugar-snap-peas': 'sukkerærter',
  'broad-beans-fava': 'hestebønner',
  'green-french-beans': 'grønne bønner',
  'runner-beans': 'grønne bønner',
  // herbs
  parsley: 'persille',
  'coriander-cilantro': 'koriander',
  dill: 'dild',
};

const SOURCE = {
  id: 'taenk_2024',
  matched: (name) => `${name}; months collated from the "Grønt:" / "Frugt:" lists under each month heading at taenk.dk/forbrugerliv/mad-og-indkoeb/vaelg-danske-frugter-og-groentsager-i-saeson`,
};

let written = 0, unmatched = [], missing = [], movedItems = 0, movedTicks = 0, totalTicks = 0;
const report = [];
for (const it of P) {
  const name = MAP[it.id];
  if (!name) { unmatched.push(it.id); continue; }
  const marks = marksOf(name);
  if (!marks) { missing.push(`${it.id}→${name}`); continue; }
  const ranges = rangesOf(marks);
  const diff = measureWrite(it, 'temperate', 'DK', (sr) => {
    sr.DK = { ranges, provenance: 'sourced', resolution: 'month', source_id: SOURCE.id, matched_on: SOURCE.matched(name) };
  });
  totalTicks += TICKS.length; movedTicks += diff; if (diff) movedItems++;
  const tempEntry = it.season_ranges.temperate;
  const tempRanges = tempEntry ? (Array.isArray(tempEntry) ? tempEntry : tempEntry.ranges) : null;
  report.push(`${it.id.padEnd(26)} ${marks}  DK ${fmt(ranges).padEnd(28)} temperate ${(tempRanges ? fmt(tempRanges) : '(none)').padEnd(24)} ${diff ? diff + ' ticks move' : ''}`);
  written++;
}

console.log(report.join('\n'));
console.log(`\n${'='.repeat(60)}`);
console.log(`${written} items matched to Tænk; ${unmatched.length} unmatched (no MAP entry) and left on the temperate fallback.`);
console.log(`${missing.length} MAP entries pointed at a name Tænk does not list (dropped): ${missing.join(', ')}`);
console.log(`Against the temperate band today: ${movedItems} of ${written} items read differently somewhere; ${movedTicks} of ${totalTicks} half-month readings change for a DK session.`);
if (WRITE) {
  fs.writeFileSync(FILE, JSON.stringify(P, null, 2) + '\n');
  console.log(`wrote ${FILE}`);
}
