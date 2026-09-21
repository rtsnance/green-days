/* Sweden: the seventh sourced non-Portuguese market.
   node scripts/source-se-calendar.mjs          # dry run: SE vs the temperate inheritance today
   node scripts/source-se-calendar.mjs --write  # writes SE entries into data/produce.json

   ONE SOURCE, read from the browser pane on 2026-09-21: ICA,
   "Säsongskalender frukt, bär och grönsaker"

     ica.se/artikel/svenska-gronsaker-och-frukt-i-sasong

   ICA is a retailer, weaker authority than Denmark's Forbrugerrådet
   Tænk. The list is more variety-detailed (apples are named by
   cultivar, potato is split into färskpotatis / delikatesspotatis /
   skalmogen matpotatis / sommarpotatis) which is helpful for
   separating fresh from stored. The parser folds the potato variants
   and cherry variants into canonical Swedish names, then collates
   months per item.

   Deliberately NOT matched, with the reason:
     morot (carrot), heritage-carrots
                           ICA lists morot 11 of 12 months (missing
                           only May). Same trap as ES's Zanahoria: the
                           source's window is fresh-plus-stored across
                           the year. Left on the fallback for
                           consistency with GB/ES/DK.
     äpple (apple), cooking-apple
                           ICA lists äpple in all 12 months (with named
                           cultivars). GB matched apple Sep-Feb from a
                           more careful source (BBC Good Food) and DK
                           matched Aug-Feb from Tænk. ICA's 12-month is
                           the retail on-shelf story; skipped rather
                           than adopt the wider claim from the weaker
                           source, so the DK/GB numbers own it.
     potatis (potato)      ICA does split potato into fresh
                           (färskpotatis, May-Jul, matched to
                           new-potato below) and stored variants that
                           together cover Sep-May. The stored-only
                           window (potatis, delikatesspotatis,
                           skalmogen matpotatis, sommarpotatis, folded
                           to `potatis`) has the same trap-8 shape as
                           carrot — left on the fallback rather than
                           dress a stored crop as an in-season one.
     lingon                lingonberry; no green-days id.
     nässlor               nettle; no id.
     schalottenlök         listed only in January (1 month) — reads
                           as a stray stored-shallot mention, not a
                           real season signal. Skipped.
     salladskål            Chinese cabbage; no id (same trap as VLAM's
                           Chinese kool, VSGP's Chinakohl, Tænk's kinakål).
     skärböna              cutting/shell beans; ambiguous mapping to
                           runner-beans and other legumes. Skipped.
     vaxböna               wax (yellow) beans; no distinct id.
     kryddor i kruka       "herbs in pots" — a retail category, not a
                           seasonal signal. Dropped in the parser.
     karl johansvamp / trattkantareller
                           porcini and funnel chanterelle appear only
                           one to five months. Porcini/cep IS matched
                           via Karl Johansvamp (Aug only). Funnel
                           chanterelles fold into the chanterelle
                           entry to avoid two id-collision entries.
     Everything not in ICA's list stays on the temperate fallback.

   The stored-crop precedent from the DK loader carries over: crops
   that ICA lists on wide-but-not-full windows (lök 7mo, rödbeta 10mo,
   kålrot 10mo, rotselleri 8mo, palsternacka 5mo, jordärtskocka 6mo,
   grönkål 6mo, vitkål 9mo, rödkål 6mo) are matched. Those windows are
   honest about "on the Swedish stall in that month", which is what
   the reader wants.

   Resolution is 'month' throughout. */
import fs from 'node:fs';
import { rangesOf, TICKS, measureWrite, fmt } from './_source-calendar-util.mjs';

const FILE = 'data/produce.json';
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const WRITE = process.argv.includes('--write');

/* ---- ICA lists, verbatim, one entry per month heading.
   Canonical names via the CANON map: cultivar variants fold to base
   forms, herbs-in-pots is dropped as a non-seasonal retail category. */
const ICA = {
  1: ['Brysselkål','Delikatesspotatis','Grönkål','Gulbeta','Gul lök','Jordärtskocka','Kryddor i kruka','Kålrot','Lök','Morötter','Palsternacka','Polkabeta','Potatis','Rotselleri','Röd lök','Rödbeta','Schalottenlök','Skalmogen matpotatis','Vitkål','Äpple'],
  2: ['Delikatesspotatis','Gulbeta','Gul lök','Jordärtskocka','Kryddor i kruka','Kålrot','Morot','Palsternacka','Polkabeta','Potatis','Rotselleri','Röd lök','Rödkål','Rödbeta','Skalmogen matpotatis','Vitkål','Äpple'],
  3: ['Delikatesspotatis','Gul lök','Gurka','Kryddor i kruka','Kålrot','Morot','Rotselleri','Röd lök','Rödbeta','Skalmogen matpotatis','Svenska äpplen'],
  4: ['Delikatesspotatis','Gurka','Kryddor i kruka','Morot','Nässlor','Ramslök','Rotselleri','Skalmogen matpotatis','Tomat','Äpplen'],
  5: ['Färskpotatis','Gräslök','Gurka','Isbergssallad','Kryddor i kruka','Rabarber','Salladslök','Skalmogen matpotatis','Sparris grön','Sparris vit','Tomat','Äpplen'],
  6: ['Blomkål','Broccoli','Dill','Färskpotatis','Gurka','Gräslök','Grönkål','Isbergssallad','Jordgubbar','Knipplök','Knippmorot','Knipprödbeta','Krispsallat','Kryddor i kruka','Kålrot','Persilja','Rabarber','Salladskål','Sparris','Spenat','Spetskål','Tomat','Vitkål','Äpple'],
  7: ['Bigarråer','Blomkål','Blåbär','Bondböna','Broccoli','Brytböna','Dill','Fänkål','Färskpotatis','Gulbeta','Gurka','Gräslök','Grönkål','Hallon','Isbergssallad','Jordgubbar','Kantareller','Knipplök','Knippmorot','Knipprödbeta','Kryddor i kruka','Kålrot','Körsbär','Polkabeta','Purjolök','Rabarber','Rödbeta','Rödkål','Salladskål','Savoykål','Skärböna','Sockerärta','Spenat','Spetskål','Tomat','Vaxböna','Vitkål','Zucchini','Äpple'],
  8: ['Bigarråer','Blekselleri','Blomkål','Blåbär','Bondböna','Broccoli','Brytböna','Dill','Fänkål','Gurka','Gräslök','Hallon','Isbergssallad','Jordgubbar','Karl Johansvamp','Knipplök','Knippmorot','Knipprödbeta','Krondill','Kryddor i kruka','Kålrot','Körsbär','Lingon','Majskolv','Morot','Pepparrot','Persilja','Plommon','Pumpa','Purjolök','Päron','Rabarber','Rödbeta','Salladskål','Savoykål','Sockerärta','Sommarpotatis','Spenat','Spetskål','Stjälkselleri','Svartkål','Tomat','Trattkantareller','Vitkål','Zucchini','Äpple'],
  9: ['Blekselleri','Blomkål','Broccoli','Brysselkål','Fänkål','Gurka','Jordärtskocka','Isbergssallad','Kantareller','Kryddor i kruka','Kålrabbi','Kålrot','Lök','Majs','Morot','Palsternacka','Persilja','Potatis','Pumpa','Purjolök','Päron','Rotselleri','Rödbeta','Rödkål','Salladskål','Savoykål','Spenat','Spetskål','Stjälkselleri','Tomat','Trattkantareller','Vitkål','Zucchini','Äpple'],
  10: ['Blekselleri','Blomkål','Broccoli','Brysselkål','Delikatesspotatis','Grönkål','Gul lök','Jordärtskocka','Kantareller','Kryddor i kruka','Kålrabbi','Kålrot','Lingon','Lök','Morot','Palsternacka','Pepparrot','Persilja','Potatis','Pumpa','Purjolök','Päron','Rotselleri','Röd lök','Rödbeta','Rödkål','Savoykål','Skalmogen matpotatis','Spetskål','Stjälkselleri','Tomat','Vitkål','Äpple'],
  11: ['Blomkål','Brysselkål','Delikatesspotatis','Grönkål','Gul lök','Jordärtskocka','Kantareller','Kryddor i kruka','Kålrot','Lök','Morot','Palsternacka','Persilja','Potatis','Pumpa','Purjolök','Rotselleri','Röd lök','Rödbeta','Rödkål','Savoykål','Skalmogen matpotatis','Spetskål','Vitkål','Äpple'],
  12: ['Brysselkål','Delikatesspotatis','Grönkål','Gul lök','Jordärtskocka','Kryddor i kruka','Kålrot','Morot','Rotselleri','Rödbeta','Rödkål','Röd lök','Savoykål','Skalmogen matpotatis','Spetskål','Vitkål','Äpple'],
};

const CANON = {
  'morötter': 'morot',
  'svenska äpplen': 'äpple', 'äpplen': 'äpple',
  'sparris grön': 'sparris', 'sparris vit': 'sparris',
  'knipplök': 'salladslök',
  'knippmorot': 'morot',
  'knipprödbeta': 'rödbeta',
  'polkabeta': 'rödbeta',
  'krispsallat': 'isbergssallad',
  'körsbär': 'körsbär', 'bigarråer': 'körsbär',
  'majskolv': 'majs',
  'sommarpotatis': 'potatis',
  'delikatesspotatis': 'potatis',
  'skalmogen matpotatis': 'potatis',
  'trattkantareller': 'kantareller',
  'gul lök': 'lök', 'röd lök': 'lök',
  'kryddor i kruka': '__drop__',
  'krondill': 'dill',
  'stjälkselleri': 'blekselleri',
};

const byName = new Map();
for (const [m, list] of Object.entries(ICA)) {
  const mi = Number(m) - 1;
  for (const raw of list) {
    let n = raw.toLowerCase().trim();
    n = CANON[n] || n;
    if (n === '__drop__') continue;
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

/* ---- the match: produce id -> canonical name in ICA's list ---- */
const MAP = {
  // fruits and berries
  pear: 'päron', 'conference-pear': 'päron',
  plum: 'plommon', damson: 'plommon', greengage: 'plommon',
  cherry: 'körsbär',
  strawberry: 'jordgubbar',
  raspberry: 'hallon',
  blueberry: 'blåbär',
  rhubarb: 'rabarber',
  // vegetables
  onion: 'lök', 'red-onion': 'lök',
  'spring-onion': 'salladslök',
  'wild-garlic': 'ramslök',
  leek: 'purjolök',
  chives: 'gräslök',
  kale: 'grönkål',
  'cavolo-nero': 'svartkål',
  'brussels-sprouts': 'brysselkål',
  cauliflower: 'blomkål',
  'broccoli-calabrese': 'broccoli', 'tenderstem-broccoli': 'broccoli',
  'green-cabbage': 'vitkål', 'spring-greens': 'vitkål',
  'red-cabbage': 'rödkål',
  'savoy-cabbage': 'savoykål',
  'pointed-hispi-cabbage': 'spetskål',
  kohlrabi: 'kålrabbi',
  swede: 'kålrot',
  beetroot: 'rödbeta',
  'golden-beetroot': 'gulbeta',
  celeriac: 'rotselleri',
  celery: 'blekselleri',
  parsnip: 'palsternacka',
  horseradish: 'pepparrot',
  'jerusalem-artichoke': 'jordärtskocka',
  'new-potato': 'färskpotatis',
  lettuce: 'isbergssallad', 'romaine-cos': 'isbergssallad', 'little-gem': 'isbergssallad',
  spinach: 'spenat',
  fennel: 'fänkål',
  cucumber: 'gurka',
  courgette: 'zucchini', marrow: 'zucchini',
  pumpkin: 'pumpa',
  kabocha: 'pumpa', 'butternut-squash': 'pumpa',
  'acorn-squash': 'pumpa', 'crown-prince-squash': 'pumpa', 'spaghetti-squash': 'pumpa',
  tomato: 'tomat', 'cherry-tomato': 'tomat',
  'beefsteak-tomato': 'tomat', 'plum-san-marzano-tomato': 'tomat',
  asparagus: 'sparris',
  'garden-peas': 'sockerärta',      // ICA lumps garden peas under sockerärta; not ideal, note
  'sugar-snap-peas': 'sockerärta',
  'broad-beans-fava': 'bondböna',
  'green-french-beans': 'brytböna',
  sweetcorn: 'majs',
  chanterelle: 'kantareller',
  'porcini-cep': 'karl johansvamp',
  // herbs
  parsley: 'persilja',
  dill: 'dild',                       // wrong — no such name; will be dropped by missing pass
};
// dild was a typo for the Danish; ICA uses "dill"
MAP.dill = 'dill';

const SOURCE = {
  id: 'ica_2026',
  matched: (name) => `${name}; months collated from the January–December headings at ica.se/artikel/svenska-gronsaker-och-frukt-i-sasong (retailer listing; cultivar variants folded to the canonical Swedish name)`,
};

let written = 0, unmatched = [], missing = [], movedItems = 0, movedTicks = 0, totalTicks = 0;
const report = [];
for (const it of P) {
  const name = MAP[it.id];
  if (!name) { unmatched.push(it.id); continue; }
  const marks = marksOf(name);
  if (!marks) { missing.push(`${it.id}→${name}`); continue; }
  const ranges = rangesOf(marks);
  const diff = measureWrite(it, 'temperate', 'SE', (sr) => {
    sr.SE = { ranges, provenance: 'sourced', resolution: 'month', source_id: SOURCE.id, matched_on: SOURCE.matched(name) };
  });
  totalTicks += TICKS.length; movedTicks += diff; if (diff) movedItems++;
  const tempEntry = it.season_ranges.temperate;
  const tempRanges = tempEntry ? (Array.isArray(tempEntry) ? tempEntry : tempEntry.ranges) : null;
  report.push(`${it.id.padEnd(26)} ${marks}  SE ${fmt(ranges).padEnd(28)} temperate ${(tempRanges ? fmt(tempRanges) : '(none)').padEnd(24)} ${diff ? diff + ' ticks move' : ''}`);
  written++;
}

console.log(report.join('\n'));
console.log(`\n${'='.repeat(60)}`);
console.log(`${written} items matched to ICA; ${unmatched.length} unmatched (no MAP entry) and left on the temperate fallback.`);
console.log(`${missing.length} MAP entries pointed at a name ICA does not list (dropped): ${missing.join(', ')}`);
console.log(`Against the temperate band today: ${movedItems} of ${written} items read differently somewhere; ${movedTicks} of ${totalTicks} half-month readings change for an SE session.`);
if (WRITE) {
  fs.writeFileSync(FILE, JSON.stringify(P, null, 2) + '\n');
  console.log(`wrote ${FILE}`);
}
