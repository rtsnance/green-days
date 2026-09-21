/* Switzerland (vegetables only): the fifth sourced non-Portuguese market.
   node scripts/source-ch-calendar.mjs          # dry run: CH vs the temperate inheritance today
   node scripts/source-ch-calendar.mjs --write  # writes CH + AT inherit entries into data/produce.json

   THE METHOD is Portugal's, Great Britain's, Spain's, France's and
   Belgium's. Same trap-checks apply.

   ONE SOURCE, vegetables and herbs only, read verbatim from the DOM in
   the browser pane on 2026-09-21 (never from a WebFetch summary):

     VSGP — Verband Schweizer Gemüseproduzenten (Swiss Vegetable Growers'
     Association), "Saisonkalender Schweiz",
     gemuese.ch/saisonkalender

   HTML table, 91 rows across three DOM data-types (`vegetable`, `salad`,
   `herb`), one row per crop, twelve `<td data-month="jan..dec">` cells
   per row, each carrying `<span class="has-season">x</span>` when the
   crop is in season for that month. Binary in/out — VSGP does not
   separate peak from ordinary (unlike VLAM). Ranges only.

   No fruit source here. Swiss fruit stays on the temperate/derived-from-
   label fallback until a Schweizer Obstverband (swissfruit) read lands
   (the 2026-09-21 handoff called it out as the missing counterpart).

   ALSO WRITTEN: AT receives `inherit: "CH"` entries for every CH-matched
   item (per the doc's proposed order step 3, "Alpine, German-speaking,
   disclosed the same way"), so Austrian sessions read Switzerland's
   dates for the vegetables covered here. Austrian fruit still falls to
   the temperate band until an AMA or Greenpeace-AT PDF read is possible.

   VSGP is a growers' association, not a retailer. Unlike Consumer/Eroski
   (retail) which mixes stored/imported with fresh, VSGP's list reflects
   Swiss commercial production, and where it declares a year-round or
   near-year-round window for a stored crop (Karotte Jan-Dec, Kartoffel
   Jan-Apr+Jun-Dec, Zwiebel Jan-Dec, Weisskabis Jan-Dec) that is an
   HONEST domestic-supply claim, not the Trap-8 "fresh window dressed as
   year-round" that ES's Consumer/Zanahoria was. So potato and carrot
   are matched here (unlike the ES/FR/GB pass), with a note on the entry.

   Deliberately NOT matched, with the reason:
     chicorée              Swiss "Chicorée" is witloof / Belgian endive
                           (Cichorium intybus var. foliosum). Same trap
                           as VLAM's "Witloof" — no green-days id for
                           Belgian endive.
     chinakohl             nappa cabbage (Brassica rapa pekinensis); no
                           id, and pak-choi is a different species.
     pfälzerrübe           Swiss "Pfälzer Rübe" (a specific stored winter
                           root, year-round on the VSGP list). No
                           green-days id; matching it to turnip would
                           lie about the crop.
     rettich               Swiss "Rettich" is the large mild
                           Alpine/Bavarian radish; daikon-mooli is the
                           East Asian daikon (Raphanus sativus var.
                           longipinnatus). Different flavour and
                           different window; skipped for the same reason
                           VLAM's Rammenas was.
     bodenkohlrabi         Swiss usage: root kohlrabi = Kohlrübe / swede
                           / rutabaga (Brassica napus rapifera). Distinct
                           from Kohlrabi (B. oleracea gongylodes), which
                           has its own row and is matched separately.
                           Match to `swede`. NOT skipped; see MAP below.
                           (Kept in the not-matched docstring to record
                           the ambiguity.)
     kalettes              flower-sprout hybrid (Brussels-sprout × kale
                           cross); no green-days id.
     zuckerhut             sugarloaf chicory (Cichorium intybus var.
                           foliosum); no id.
     catalogna             Italian dandelion / catalonia chicory; no id.
     petersilienwurzel     Hamburg parsley / parsley root; no id.
     schwarzwurzel         salsify; no id (same as ES/FR/BE).
     portulak              purslane; no id (same as VLAM's Postelein).
     kardy                 cardoon — MATCHED (green-days has `cardoon`).
                           Kept in the docstring for symmetry.
     mairübe               spring baby turnip (Apr-Jun). Distinct from
                           Herbstrübe (autumn storage turnip, matched to
                           turnip). Two rows for the same green-days id
                           would collide; kept the autumn window because
                           it dominates the calendar.
     batavia, eichblatt, eisbergsalat, lollo, schnittsalat, endivie
       (matched separately), salate aus hydroproduktion
                           several lettuce cultivars VSGP splits and
                           green-days does not. Matched to the closest
                           roster id: Kopfsalat → lettuce, Lattich →
                           romaine-cos / little-gem, Rucola →
                           rocket-arugula, Endivie → endive-fris-e. The
                           rest fall to the temperate fallback.
     grünspargel vs bleichspargel
                           VSGP lists green and white asparagus with
                           identical windows (Apr-Jun). Matched to
                           Bleichspargel — the traditional Swiss and
                           Alpine spring product — for the source-note
                           prose, though the range is the same either
                           way.
     pfefferminze, zitronenmelisse, zitronenthymian, bohnenkraut,
     maggikraut/liebstöckel
                           herb variants without a green-days id
                           (peppermint would collide with Minze → mint,
                           lemon balm and lemon thyme have no ids,
                           savory and lovage likewise).
     melone                Swiss "Melone" is a two-month Jul-Aug window
                           (both cantaloupe and honeydew are marketed
                           the same way in the Swiss lowlands). Matched
                           to cantaloupe-melon and honeydew-melon
                           (both), same window.

   Resolution is 'month' throughout: VSGP speaks in whole-month cells. */
import fs from 'node:fs';
import { rangesOf, TICKS, measureWrite, fmt } from './_source-calendar-util.mjs';

const FILE = 'data/produce.json';
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const WRITE = process.argv.includes('--write');

/* ---- VSGP Saisonkalender, verbatim from the DOM.
   Format: name|JanFebMarAprMayJunJulAugSepOctNovDec (B = has-season, . = empty) */
const VSGP_ROWS = `Artischocke|......BBBB..
Aubergine|...BBBBBBB..
Basilikum|.....BBB....
Bleichspargel|...BBB......
Blumenkohl|....BBBBBBB.
Bodenkohlrabi|BBBB..BBBBBB
Bohnen|.....BBBBB..
Broccoli|....BBBBBBB.
Brunnenkresse|....BBBBBB..
Bundzwiebel|...BBBBBBB..
Cherrytomate|...BBBBBBBB.
Cicorino rot|BB...BBBBBBB
Datteltomate|...BBBBBBBB.
Dill|....BBBBBB..
Endivie glatt/gekraust|....BBBBBBB.
Erbsen|.....BB.....
Estragon|...BBBBBBB..
Federkohl|BBB......BBB
Fenchel|....BBBBBBB.
Gurke|...BBBBBB...
Herbstrübe|BB........BB
Kardy|..........BB
Karotte|BBBBBBBBBBBB
Kartoffel|BBBB.BBBBBBB
Kefe|.....BB.....
Kerbel|..BBBBBBB...
Knoblauch|.....BBBBBBB
Knollensellerie|BBBBBBBBBBBB
Kohlrabi|...BBBBBBBB.
Kopfsalat|..BBBBBBBBBB
Koriander|....BBBBBB..
Krautstiel|..BBBBBBBBB.
Kürbis|BB....BBBBBB
Lattich|...BBBBBBB..
Lauch|BBBBBBBBBBBB
Majoran|.....BBBBB..
Melone|......BB....
Minze|....BBBBBB..
Nüsslisalat|BBBBBBBBBBBB
Oregano|.....BBBB...
Pak-Choi|...BBBBBBBB.
Pastinake|BBB...BBBBBB
Peperoni|.....BBBBB..
Perettitomate|...BBBBBBBB.
Petersilie|....BBBBBBB.
Radieschen|..BBBBBBBBBB
Rande|BBBBBBBBBBBB
Rhabarber|...BBB......
Rispentomate|...BBBBBBBB.
Romanesco|....BBBBBBB.
Rosenkohl|B.......BBBB
Rosmarin|....BBBBB...
Rotkabis|BBBBBBBBBBBB
Rucola|...BBBBBBB..
Salbei|.....BBBBB..
Schalotte|BBBBB.BBBBBB
Schnittlauch|BBBBBBBBBBBB
Spinat|..BBBBBBBBB.
Stangensellerie|....BBBBBBBB
Süsskartoffel|BB......BBBB
Thymian|....BBBBBB..
Tomate|...BBBBBBBB.
Topinambur|BBB.......BB
Weisskabis|BBBBBBBBBBBB
Wirz|BBBBBBBBBBBB
Zucchetti|....BBBBBB..
Zuckermais|......BBBB..
Zwiebel|BBBBBBBBBBBB`;

const VSGP = new Map(VSGP_ROWS.split('\n').map((l) => { const [name, months] = l.split('|'); return [name, months]; }));

/* ---- the match: produce id -> name in the VSGP roster ---- */
const MAP = {
  // vegetables
  aubergine: 'Aubergine',
  cauliflower: 'Blumenkohl',
  swede: 'Bodenkohlrabi',
  'green-french-beans': 'Bohnen',
  'broccoli-calabrese': 'Broccoli', 'tenderstem-broccoli': 'Broccoli',
  watercress: 'Brunnenkresse',
  'spring-onion': 'Bundzwiebel',
  'cherry-tomato': 'Cherrytomate',
  radicchio: 'Cicorino rot',
  'garden-peas': 'Erbsen',
  kale: 'Federkohl', 'cavolo-nero': 'Federkohl',
  fennel: 'Fenchel',
  cucumber: 'Gurke',
  turnip: 'Herbstrübe',
  cardoon: 'Kardy',
  carrot: 'Karotte', 'heritage-carrots': 'Karotte',
  potato: 'Kartoffel',
  mangetout: 'Kefe',
  garlic: 'Knoblauch',
  celeriac: 'Knollensellerie',
  kohlrabi: 'Kohlrabi',
  lettuce: 'Kopfsalat',
  chard: 'Krautstiel',
  pumpkin: 'Kürbis', 'butternut-squash': 'Kürbis', 'acorn-squash': 'Kürbis',
  'crown-prince-squash': 'Kürbis', 'spaghetti-squash': 'Kürbis', kabocha: 'Kürbis',
  'romaine-cos': 'Lattich', 'little-gem': 'Lattich',
  'cantaloupe-melon': 'Melone', 'honeydew-melon': 'Melone',
  'lamb-s-lettuce-m-che': 'Nüsslisalat',
  'pak-choi': 'Pak-Choi',
  parsnip: 'Pastinake',
  'bell-pepper': 'Peperoni',
  'plum-san-marzano-tomato': 'Perettitomate',
  radish: 'Radieschen', 'breakfast-radish': 'Radieschen',
  beetroot: 'Rande', 'golden-beetroot': 'Rande',
  rhubarb: 'Rhabarber',
  'beefsteak-tomato': 'Rispentomate',
  romanesco: 'Romanesco',
  'brussels-sprouts': 'Rosenkohl',
  'red-cabbage': 'Rotkabis',
  'rocket-arugula': 'Rucola',
  shallot: 'Schalotte',
  spinach: 'Spinat',
  celery: 'Stangensellerie',
  'sweet-potato': 'Süsskartoffel',
  tomato: 'Tomate',
  'jerusalem-artichoke': 'Topinambur',
  'green-cabbage': 'Weisskabis', 'spring-greens': 'Weisskabis',
  'savoy-cabbage': 'Wirz',
  courgette: 'Zucchetti', marrow: 'Zucchetti',
  sweetcorn: 'Zuckermais',
  onion: 'Zwiebel', 'red-onion': 'Zwiebel',
  'globe-artichoke': 'Artischocke',
  asparagus: 'Bleichspargel',
  'pointed-hispi-cabbage': 'Weisskabis',
  'endive-fris-e': 'Endivie glatt/gekraust',
  leek: 'Lauch',
  // herbs
  basil: 'Basilikum',
  dill: 'Dill',
  tarragon: 'Estragon',
  chervil: 'Kerbel',
  coriander: 'Koriander',           // no such id in produce.json; will drop below
  'coriander-cilantro': 'Koriander',
  marjoram: 'Majoran',
  mint: 'Minze',
  oregano: 'Oregano',
  parsley: 'Petersilie',
  rosemary: 'Rosmarin',
  sage: 'Salbei',
  chives: 'Schnittlauch',
  thyme: 'Thymian',
};
// Drop the placeholder key I added for clarity — coriander is not a green-days id.
delete MAP.coriander;

const SOURCE = {
  id: 'vsgp_2026',
  matched: (name) => `${name}; in-season months read from <span class="has-season">x</span> cells in the DOM at gemuese.ch/saisonkalender`,
};

const INHERIT_SOURCE_ID = { Austria: 'ch_veg_applied_to_austria' };

/* ---- apply, and measure against what a temperate-band session sees today ---- */
let written = 0, unmatched = [], movedItems = 0, movedTicks = 0, totalTicks = 0;
const report = [];
for (const it of P) {
  const name = MAP[it.id];
  if (!name) { unmatched.push(it.id); continue; }
  const months = VSGP.get(name);
  if (!months) { console.error(`NO SOURCE ROW for ${it.id}: "${name}"`); process.exit(1); }
  const ranges = rangesOf(months);
  const diff = measureWrite(it, 'temperate', 'CH', (sr) => {
    sr.CH = { ranges, provenance: 'sourced', resolution: 'month', source_id: SOURCE.id, matched_on: SOURCE.matched(name) };
    sr.AT = { inherit: 'CH', provenance: 'inferred', source_id: INHERIT_SOURCE_ID.Austria };
  });
  totalTicks += TICKS.length; movedTicks += diff; if (diff) movedItems++;
  const tempEntry = it.season_ranges.temperate;
  const tempRanges = tempEntry ? (Array.isArray(tempEntry) ? tempEntry : tempEntry.ranges) : null;
  report.push(`${it.id.padEnd(26)} ${months}  CH ${fmt(ranges).padEnd(28)} temperate ${(tempRanges ? fmt(tempRanges) : '(none)').padEnd(24)} ${diff ? diff + ' ticks move' : ''}`);
  written++;
}

console.log(report.join('\n'));
console.log(`\n${'='.repeat(60)}`);
console.log(`${written} items matched to VSGP; ${unmatched.length} unmatched and left on the temperate-band fallback.`);
console.log(`Against the temperate band today: ${movedItems} of ${written} items read differently somewhere; ${movedTicks} of ${totalTicks} half-month readings change for a CH session.`);
console.log(`Also written: ${written} AT "inherit: CH" entries. Swiss fruit not sourced here; Swiss fruit and Austrian fruit both stay on the temperate/derived-from-label fallback.`);
console.log(`unmatched: ${unmatched.join(', ')}`);
if (WRITE) {
  fs.writeFileSync(FILE, JSON.stringify(P, null, 2) + '\n');
  console.log(`wrote ${FILE}`);
}
