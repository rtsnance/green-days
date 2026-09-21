/* France: the third sourced non-Portuguese market.
   node scripts/source-fr-calendar.mjs          # dry run: FR vs the temperate inheritance today
   node scripts/source-fr-calendar.mjs --write  # writes FR entries into data/produce.json

   THE METHOD is Portugal's, Great Britain's and Spain's: one published
   calendar, matched item by item, the match recorded per range in `source`.
   Nothing here is derived from any band or from the English labels. Items
   with no FR entry keep falling back to the temperate band, and the app then
   labels them as "derived from label" (until a temperate source lands).

   ONE SOURCE, verified from the browser pane on 2026-09-21: ADEME (the
   French national agency for the ecological transition), "Fruits et
   légumes" API. Read the JSON directly, one endpoint per month:

     https://impactco2.fr/api/v1/fruitsetlegumes?month={1..12}&language=fr

   Each entry carries `{name, slug, category, months: [1..12], ecv}`. The
   `months` array IS the full-year season list; the endpoint parameter only
   filters which items are returned that month. Union across the twelve
   endpoints = 76 items. Verified consistent: every slug returned by more
   than one month endpoint carries the same `months` array both times.

   The source's own category buckets: fruits (36), légumes (33), herbes (1
   — ail), fruits à coque et graines oléagineuses (4 nuts), pommes de terre
   et autres tubercules (1 — topinambour), pâtes riz et céréales (1 — maïs).

   France spans both climate bands (markets.json says temperate), so one
   national calendar is the same compromise Spain already makes: the reader
   in Paris sees the same dates as the reader in Marseille. Better than
   inferring from a label.

   Deliberately NOT matched, with the reason:
     mango (Mangue par avion, par bateau), banana (Banane), pineapple
     (Ananas), coconut (Noix de coco), carambola (Carambole), passion fruit
     (Fruit de la passion), avocado (Avocat, listed under légumes), date
     (Datte), pomegranate (Grenade)
                           imports, per the 2026-09-21 handoff. The API
                           reports these as consumption seasons, not French
                           harvests. Grenade shows Jan-Feb + Nov-Dec (a
                           stored/imported window) and Datte shows
                           Jan + Oct-Dec (imported); both dropped per doc.
     châtaigne, noisette, noix (chestnut, hazelnut, walnut)
                           the source's own "fruits à coque" bucket. Doc
                           says "drop nuts". Châtaigne is a real fresh
                           French autumn crop but the doc's rule is
                           categorical; left unmatched with the shell nuts.
     watercress            "Cresson" is BBBBBBBBBBBB in ADEME (year-round,
                           cultivated hydroponic). A shopper thinks of wild
                           watercress in spring; the year-round claim
                           misleads. Left on the fallback. (Trap 8.)
     button-white-mushroom, chestnut-mushroom, oyster-mushroom, portobello,
     shiitake, chanterelle, porcini-cep
                           ADEME's only mushroom row is "Champignon (morille
                           crue)" and it is marked year-round, which is
                           nonsense — morel is a wild spring forage. No
                           cultivated-mushroom row and no honest wild
                           window. Left unmatched (same as ES and GB).
     potato, new-potato, sweet-potato
                           no potato row in ADEME. Stored potato is on
                           every French stall year-round. Left on the
                           fallback rather than assert a season that a
                           French shopper can see is wrong. Same case as
                           ES/GB.
     carrot, heritage-carrots
                           ADEME "Carotte" is Jan-Mar + Aug-Dec. That is the
                           stored-plus-fresh window (mid-year gap in April
                           to July). The ES script rejected the equivalent
                           Consumer window for the same reason; kept off
                           the fallback here too, for consistency. (Trap
                           8's twin: the source's window is fresh-crop
                           only, and dropping it is honester than dressing
                           winter carrots as domestic.)
     endive-fris-e, radicchio
                           French "Endive" is witloof / Belgian endive
                           (Cichorium intybus var. foliosum), not curly
                           endive / frisée. Same trap the ES script hit
                           with "Achicoria" / "Endibias". No frisée row
                           and no radicchio row.
     mandarin              the source has both "Mandarine" and "Clémentine"
                           with identical months (Jan-Feb + Nov-Dec).
                           Matched to Clémentine, the more specifically
                           French crop; the Mandarine row is redundant.
     salsify               real French winter root but no green-days id.
     blood-orange          not separated; folded into Orange (same as ES/GB).
     damson                "Prune" covers plum generally; damsons (P.
                           insititia) aren't separated. Left on fallback
                           (same as ES).
     physalis              not in ADEME (ES had it as "Alquejenje").
     Herbs (basil, bay, chervil, chives, coriander, dill, marjoram, mint,
     oregano, parsley, rosemary, sage, tarragon, thyme)
                           ADEME's only "herbes" row is Ail; matched
                           separately as garlic.
     olives, samphire, sugar-snap-peas, mangetout, runner-beans, edamame,
     borlotti-beans, broad-beans-fava, prickly-pear, loquat-nespera,
     medlar, gooseberry, lemongrass, ginger, chilli-pepper, padr-n-pepper,
     tomatillo, horseradish, cardoon, kohlrabi, celeriac, swede,
     cavolo-nero, purple-sprouting-broccoli, romanesco, pak-choi,
     rocket-arugula, spring-onion, elephant-garlic, wild-garlic,
     green-tomato, marrow, daikon-mooli, baby-corn
                           not in ADEME's roster.

   Rice: the doc says drop rice; the source has no rice row. Sweetcorn
   (Maïs, Jul-Sep) is in the source's "pâtes, riz et céréales" bucket but
   is a real French summer/autumn crop with a real seasonal window, matched.

   Resolution is 'month' throughout: ADEME speaks in whole-month integers. */
import fs from 'node:fs';
import { rangesOf, TICKS, measureWrite, fmt } from './_source-calendar-util.mjs';

const FILE = 'data/produce.json';
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const WRITE = process.argv.includes('--write');

/* ---- ADEME impactco2.fr, verbatim ----
   Format: name|JanFebMarAprMayJunJulAugSepOctNovDec (B = in `months`, . = not)
   Every row is the union across the 12 endpoint calls; verified consistent. */
const ROWS = `Abricot|.....BBB....
Cassis|.....BBB....
Cerise|.....BB.....
Citron|BB..........
Clémentine|BB........BB
Coing|.........B..
Figue|......BBBB..
Fraise|....BBB.....
Framboise|.....BBB....
Groseille|.....BBB....
Kaki|B........BBB
Kiwi|BBB.......BB
Melon|.....BBBB...
Mûre|.......BB...
Myrtille|......BBB...
Nectarine|.......BB...
Orange|BBB.........
Pamplemousse|.BBBBB......
Pastèque|.....BBBB...
Pêche|.....BBBB...
Poire|BBB....BBBBB
Pomme|BBBB...BBBBB
Prune|......BBB...
Raisin|........BB..
Reine claude|........B...
Rhubarbe|...BBB......
Ail|......BBBBBB
Artichaut|....BBBBB...
Asperge|...BBB......
Aubergine|.....BBBB...
Betterave|BBB......BBB
Blette|.....BBBBBB.
Brocoli|........BBB.
Céleri|BBB......BBB
Chou|BBB......BBB
Chou de Bruxelles|BBB......BBB
Chou-fleur|BBB.....BBBB
Concombre|....BBBBBB..
Courge|B.......BBBB
Courgette|....BBBBBB..
Échalote|.........BBB
Épinard|BBBBB...BBBB
Fenouil|...B.BBBBBB.
Haricot vert (cru)|.....BBBBB..
Laitue|....BBBBB...
Mâche|BB.......BBB
Navet|BBBBB....BBB
Oignon|BBBB....BBBB
Panais|BBB......BBB
Petit pois|....BBB.....
Poireau|BBBB....BBBB
Poivron|.....BBBB...
Potiron|B.......BBBB
Radis|..BBBB......
Tomate|.....BBBB...
Topinambour|BB........BB
Maïs|......BBB...`;

const ADEME = new Map(ROWS.split('\n').map((l) => { const [name, months] = l.split('|'); return [name, months]; }));

/* ---- the match: produce id -> name in the ADEME source ---- */
const MAP = {
  // fruits, fresh
  apricot: 'Abricot',
  blackcurrant: 'Cassis',
  cherry: 'Cerise',
  lemon: 'Citron',
  'mandarin-clementine': 'Clémentine',
  quince: 'Coing',
  fig: 'Figue',
  strawberry: 'Fraise',
  raspberry: 'Framboise',
  redcurrant: 'Groseille',
  'persimmon-kaki': 'Kaki',
  kiwi: 'Kiwi',
  blackberry: 'Mûre',
  blueberry: 'Myrtille',
  nectarine: 'Nectarine',
  orange: 'Orange',
  grapefruit: 'Pamplemousse',
  watermelon: 'Pastèque',
  peach: 'Pêche',
  pear: 'Poire', 'conference-pear': 'Poire',
  apple: 'Pomme', 'cooking-apple': 'Pomme',
  plum: 'Prune',
  grapes: 'Raisin', 'grapes-black': 'Raisin',
  greengage: 'Reine claude',
  rhubarb: 'Rhubarbe',
  'cantaloupe-melon': 'Melon', 'honeydew-melon': 'Melon',
  // vegetables and vegetables-treated-as-veg
  garlic: 'Ail',
  'globe-artichoke': 'Artichaut',
  asparagus: 'Asperge',
  aubergine: 'Aubergine',
  beetroot: 'Betterave', 'golden-beetroot': 'Betterave',
  chard: 'Blette',
  'broccoli-calabrese': 'Brocoli', 'tenderstem-broccoli': 'Brocoli',
  celery: 'Céleri',
  'green-cabbage': 'Chou', 'red-cabbage': 'Chou', 'savoy-cabbage': 'Chou',
  'pointed-hispi-cabbage': 'Chou', 'spring-greens': 'Chou',
  'brussels-sprouts': 'Chou de Bruxelles',
  cauliflower: 'Chou-fleur',
  cucumber: 'Concombre',
  pumpkin: 'Potiron',
  'butternut-squash': 'Courge', 'acorn-squash': 'Courge',
  'crown-prince-squash': 'Courge', 'spaghetti-squash': 'Courge', kabocha: 'Courge',
  courgette: 'Courgette',
  shallot: 'Échalote',
  spinach: 'Épinard',
  fennel: 'Fenouil',
  'green-french-beans': 'Haricot vert (cru)',
  lettuce: 'Laitue', 'romaine-cos': 'Laitue', 'little-gem': 'Laitue',
  'lamb-s-lettuce-m-che': 'Mâche',
  turnip: 'Navet',
  onion: 'Oignon', 'red-onion': 'Oignon',
  parsnip: 'Panais',
  'garden-peas': 'Petit pois',
  leek: 'Poireau',
  'bell-pepper': 'Poivron',
  radish: 'Radis', 'breakfast-radish': 'Radis',
  tomato: 'Tomate', 'cherry-tomato': 'Tomate',
  'beefsteak-tomato': 'Tomate', 'plum-san-marzano-tomato': 'Tomate',
  // tuber
  'jerusalem-artichoke': 'Topinambour',
  // cereal bucket, sweetcorn
  sweetcorn: 'Maïs',
};

// source_id lives in data/sources.json (one publication string per id).
// matched_on is per-item context: the ADEME French name for the item plus
// the API-read note (months array as returned by the endpoint).
const SOURCE = {
  id: 'ademe_impactco2_2026',
  matched: (name) => `${name}; months read from the \`months\` array of impactco2.fr/api/v1/fruitsetlegumes`,
};

/* ---- apply, and measure against what a temperate-band session sees today ---- */
let written = 0, unmatched = [], movedItems = 0, movedTicks = 0, totalTicks = 0;
const report = [];
for (const it of P) {
  const name = MAP[it.id];
  if (!name) { unmatched.push(it.id); continue; }
  const months = ADEME.get(name);
  if (!months) { console.error(`NO SOURCE ROW for ${it.id}: "${name}"`); process.exit(1); }
  const ranges = rangesOf(months);
  const diff = measureWrite(it, 'temperate', 'FR', (sr) => {
    sr.FR = { ranges, provenance: 'sourced', resolution: 'month', source_id: SOURCE.id, matched_on: SOURCE.matched(name) };
  });
  totalTicks += TICKS.length; movedTicks += diff; if (diff) movedItems++;
  const tempEntry = it.season_ranges.temperate;
  const tempRanges = tempEntry ? (Array.isArray(tempEntry) ? tempEntry : tempEntry.ranges) : null;
  report.push(`${it.id.padEnd(26)} ${months}  FR ${fmt(ranges).padEnd(28)} temperate ${(tempRanges ? fmt(tempRanges) : '(no temperate)').padEnd(28)} ${diff ? diff + ' ticks move' : ''}`);
  written++;
}

console.log(report.join('\n'));
console.log(`\n${'='.repeat(60)}`);
console.log(`${written} items matched to ADEME impactco2.fr; ${unmatched.length} unmatched and left on the temperate-band fallback.`);
console.log(`Against the temperate band (derived_from_label) today: ${movedItems} of ${written} items read differently somewhere; ${movedTicks} of ${totalTicks} half-month readings change for an FR session.`);
console.log(`unmatched: ${unmatched.join(', ')}`);
if (WRITE) {
  fs.writeFileSync(FILE, JSON.stringify(P, null, 2) + '\n');
  console.log(`wrote ${FILE}`);
}
