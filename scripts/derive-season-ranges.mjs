/* Derive season_ranges from the existing prose labels, for the field-guide items.
   node scripts/derive-season-ranges.mjs          # dry run, prints what it would write
   node scripts/derive-season-ranges.mjs --write  # writes data/produce.json

   THE POINT: these ranges are NOT new knowledge. They are the judgment already
   written into the `season` strings, recovered at a finer resolution by ONE
   STATED CONVENTION rather than by forty separate guesses. Everything it emits
   is provenance:"inferred". Narrow them by hand afterwards; that is when they
   become worth something.

   The convention, in full:
     - A season is six half-month ticks.   spring = 03-01, summer = 06-01, etc.
     - bare "Summer"        -> all six ticks of summer
     - "Early summer"       -> first three
     - "Late summer"        -> last three
     - "Summer-autumn"      -> start of summer to end of autumn (walks the cycle)
     - "Late summer-autumn" -> start of late summer to end of autumn
     - "Summer-early autumn"-> start of summer to end of early autumn
     - "Year-round"         -> the whole year
     - MEDITERRANEAN RUNS 15 DAYS EARLIER at both ends. One assumption, applied
       uniformly, easy to reject. It does not apply to imported or stored items.
     - "(Med)"              -> temperate: []   (no local season there)
     - "(imported)"         -> availability "imported"
     - "stores" / "harvest" -> availability "stored"
*/
import fs from 'node:fs';
import { doy, fromDoy, YEAR } from '../src/season.js';

/* TARGETS = the 20 field-guide entries (the only items with public pages)
   PLUS every produce id named in a turning day's working_name or lore_leads.

   That second set is the point. Those items are the ONLY ones in the catalogue
   carrying an independent dated claim: "cherries give way to the plums" on
   15 July, "the last tomatoes" on 18 October, "the devil spits on the
   blackberries" after 10 October. Everything else can only be checked against
   the prose label it was derived from, which is circular. These can be checked
   against something that was written down for a different reason.
   See scripts/season-lore-check.mjs and SEASON-SEAM.md Part 5. */

const FIELD_GUIDE = ['blackberry','cantaloupe-melon','fig','damson','greengage','plum','lemongrass',
  'pineapple','samphire','date','medlar','persimmon-kaki','physalis','pomegranate','turnip',
  'wild-garlic','daikon-mooli','jerusalem-artichoke','prickly-pear','rhubarb'];

const LORE_NAMED = [
  'asparagus','leek',                                        // III St David, early-Mar arrivals
  'broad-beans-fava','garden-peas','new-potato',             // V Cuckoo Day, first pods
  'cherry','gooseberry',                                     // X cherries at peak; XI both out
  'apricot',                                                 // XII Abricot day, 31 Jul
  'grapes','grapes-black',                                   // XV Raisin day / the vindima
  'pumpkin','acorn-squash','kabocha','spaghetti-squash',
  'butternut-squash','crown-prince-squash',                  // XVI the squashes; Potiron day 4 Oct
  'tomato','cherry-tomato','beefsteak-tomato',
  'plum-san-marzano-tomato','green-tomato',                  // XVIII "the five tomatoes leave"
  'endive-fris-e',                                           // XIX Endive day, 4 Nov
  'orange','blood-orange','lemon','mandarin-clementine','grapefruit', // XX Orange day; XXI the citrus turn
  'purple-sprouting-broccoli',                               // XXIII mid-Jan, PSB alone
];

const TARGETS = [...new Set([...FIELD_GUIDE, ...LORE_NAMED])]

const START = { spring: '03-01', summer: '06-01', autumn: '09-01', winter: '12-01' };
const CYCLE = ['spring','summer','autumn','winter'];
const TICK = 15;                       // half-month, in days
const seasonStart = (s) => doy(START[s]);
const seasonEnd   = (s) => doy(START[CYCLE[(CYCLE.indexOf(s)+1)%4]]) - 1;

function windowFor(str) {
  const s = (str||'').toLowerCase();
  if (s.includes('year-round')) return { from: '01-01', to: '12-31' };
  const found = CYCLE.map((n)=>({n,i:s.indexOf(n)})).filter(o=>o.i>=0).sort((a,b)=>a.i-b.i).map(o=>o.n);
  if (!found.length) return null;
  const first = found[0], last = found[found.length-1];
  const qual = (name) => {                        // "early"/"late" immediately before the season word
    const i = s.indexOf(name);
    const before = s.slice(Math.max(0,i-7), i);
    return before.includes('early') ? 'early' : before.includes('late') ? 'late' : null;
  };
  let a = seasonStart(first);
  if (qual(first) === 'late')  a = seasonStart(first) + 3*TICK;
  let b = seasonEnd(last);
  if (qual(last) === 'early')  b = seasonStart(last) + 3*TICK - 1;
  return { from: fromDoy(a), to: fromDoy(b) };
}

// Every boundary lands on a half-month edge. `from` takes the 1st or the 16th;
// `to` takes the 15th or the month's last day, so consecutive windows abut
// instead of overlapping by a day. Half-month resolution is the whole honesty
// argument: day precision here would be invented.
const LAST = [31,28,31,30,31,30,31,31,30,31,30,31];
const pad = (n) => String(n).padStart(2, '0');
function snapFrom(mmdd) {
  const [m, d] = mmdd.split('-').map(Number);
  if (d <= 8) return `${pad(m)}-01`;
  if (d <= 23) return `${pad(m)}-16`;
  return `${pad((m % 12) + 1)}-01`;
}
function snapTo(mmdd) {
  const [m, d] = mmdd.split('-').map(Number);
  if (d <= 7) return `${pad(m === 1 ? 12 : m - 1)}-${LAST[(m === 1 ? 12 : m - 1) - 1]}`;
  if (d <= 22) return `${pad(m)}-15`;
  return `${pad(m)}-${LAST[m - 1]}`;
}
const isYear = (w) => w.from === '01-01' && w.to === '12-31';
const snapW = (w) => (isYear(w) ? w : { from: snapFrom(w.from), to: snapTo(w.to) });
const shift = (w, days) => (isYear(w) ? w
  : snapW({ from: fromDoy(doy(w.from) + days), to: fromDoy(doy(w.to) + days) }));

/* HAND OVERRIDES.
   The convention faithfully propagates whatever the label said, which means a
   label that was wrong stays wrong. Corrections live HERE, not edited into the
   JSON, so re-running this script does not silently undo them.

   Each override must say where it came from. */
/* PT_SOURCED — Portuguese seasonality taken from PUBLISHED NATIONAL SOURCES,
   not derived from our own prose labels.

   The TARGETS comment above says everything outside the lore set can only be
   checked against the label it came from, which is circular. That was true
   until these three calendars were captured on 2026-09-01. They are written
   for a different reason, by Portuguese bodies, and they break the circle for
   the mediterranean band.

   Precedence, applied in derive(): a hand OVERRIDE beats this table, because
   an override encodes a dated folk claim (St David's leeks, Old Michaelmas
   blackberries) that a production calendar cannot know. This table beats the
   label derivation. Temperate ranges are NOT touched here — these sources
   speak only for Portugal.

   Sources:
     APN  Alianca contra a Fome/APN, Calendarios de Producao Nacional, 2021 (national production)
     DECO DECO PROteste, Fruta e legumes da epoca, updated 2024-09-24
     CNT  Continente feed, Fruta e legumes da epoca, updated 2024-01-25 (retail; imports stripped by hand)

   Full transcription with per-item attribution: _pt-calendar/pt-sources.json */

const PT_SOURCE_NAMES = {
  APN:  'Alianca contra a Fome e a Ma-nutricao / APN, "Calendarios de Producao Nacional", 2021',
  DECO: 'DECO PROteste, "Fruta e legumes da epoca: calendario anual", updated 2024-09-24',
  AZT:  'calendarios.info, "A apanha da azeitona em Portugal", quoting the harvest as "entre novembro e janeiro"; GREEN TABLE olives are picked earlier and that earlier window is NOT verified',
  CNT:  'Continente feed, "Fruta e legumes da epoca", updated 2024-01-25 (retail listing, imports removed by hand)',
};

/* PT_WINS_MED — the three overrides whose reasoning is NORTHERN.
   Ruled on 2026-09-01 while building the Fruta Feia calendar.

   The general rule is that a hand OVERRIDE beats PT_SOURCED, because an
   override carries a dated claim a production calendar cannot know. These
   three are the exception, and the reason is that their dated claims are not
   Portuguese ones:

     leek       extended to 15 Mar so leeks stand on ST DAVID'S DAY. Wales.
     blackberry tail set by OLD MICHAELMAS, "the devil spits on the
                blackberries". England.
     orange     start pulled to 8 Nov to catch REPUBLICAN ORANGE DAY. France.

   Each is a good argument about the temperate band and a bad one about the
   Algarve. So for the MEDITERRANEAN band only, the published Portuguese
   figure wins; the temperate range keeps the folk date untouched.

   greengage is deliberately NOT in this list. DECO's window is for 'ameixa'
   generally, not the gage, and the stall lost the rainha-clau^dia on
   18 Aug 2026, which beats both. */
const PT_WINS_MED = ['leek', 'blackberry', 'orange'];


/* SOURCE_SPLITS — the only honest way to get off the month grain.

   Spec_Computed_Seasons chose half-months on purpose: "Snap every boundary to
   the 1st or the 16th. Twenty-four buckets a year." The 2026-09-01 Portuguese
   import put 381 of 398 boundaries on the 1st and 17 on the 16th, which is a
   12-bucket model being read by a 24-day grid. Every "what enters at turning N"
   answer then depends on whether N's window happens to straddle the 1st.

   Mid-month precision cannot be invented: the sources speak in whole months.
   But where APN and DECO, both national-facing, differ by EXACTLY ONE MONTH at
   one edge, the disagreement is itself evidence. Both are right within their
   own grain and the boundary lies between their claims. Placing it on the 16th
   (start) or the 15th (end) asserts less than either source does alone.

   A two-month or wider gap is NOT split: that is real disagreement about the
   crop, not grain, and it stays on the national-production figure. Continente
   is excluded entirely here, being retail, where storage and imports move the
   edges for reasons that have nothing to do with when the thing grows. */
const SOURCE_SPLITS_WHY = 'APN and DECO differ by one month at this edge; the boundary is placed between their claims, on the half-month grid, rather than picking a winner';

const SOURCE_SPLITS = {
  'apple': { from: '08-16', key: 'maca' },
  'apricot': { to: '08-15', key: 'damasco/alperce' },
  'blueberry': { from: '05-16', to: '08-15', key: 'mirtilo' },
  'cooking-apple': { from: '08-16', key: 'maca' },
  'fig': { from: '07-16', key: 'figo' },
  'grapes': { to: '11-15', key: 'uva' },
  'grapes-black': { to: '11-15', key: 'uva' },
  'honeydew-melon': { to: '09-15', key: 'melao' },
  'mandarin-clementine': { to: '03-15', key: 'tangerina' },
  'nectarine': { to: '09-15', key: 'pessego' },
  'peach': { to: '09-15', key: 'pessego' },
  'watermelon': { to: '09-15', key: 'melancia' },
};

const PT_SOURCED = {
  'chestnut': { from: '10-01', to: '12-31', src: 'DECO', pt: 'Castanha', key: 'castanha' },
  'loquat-nespera': { from: '04-01', to: '06-30', src: 'DECO', pt: 'Nespera', key: 'nespera' },
  'olives': { from: '11-01', to: '01-31', src: 'AZT', pt: 'Azeitonas', key: 'azeitona' },
  'acorn-squash': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora-bolota', key: 'abobora' },
  'apple': { from: '08-01', to: '05-31', src: 'APN', pt: 'Maçã', key: 'maca' },
  'apricot': { from: '05-01', to: '07-31', src: 'APN', pt: 'Alperce', key: 'damasco/alperce' },
  'asparagus': { from: '02-01', to: '06-30', src: 'CNT', pt: 'Espargos', key: 'espargos' },
  'aubergine': { from: '06-01', to: '10-31', src: 'APN', pt: 'Beringela', key: 'beringela' },
  'avocado': { from: '01-01', to: '12-31', src: 'DECO', pt: 'Abacate', key: 'abacate' },
  'beefsteak-tomato': { from: '05-01', to: '09-30', src: 'APN', pt: 'Tomate coração-de-boi', key: 'tomate' },
  'beetroot': { from: '08-01', to: '04-30', src: 'APN', pt: 'Beterraba', key: 'beterraba' },
  'bell-pepper': { from: '06-01', to: '10-31', src: 'APN', pt: 'Pimento', key: 'pimento' },
  'blackberry': { from: '06-01', to: '08-31', src: 'DECO', pt: 'Amora', key: 'amora' },
  'blueberry': { from: '06-01', to: '08-31', src: 'APN', pt: 'Mirtilo', key: 'mirtilo' },
  'breakfast-radish': { from: '05-01', to: '06-30', src: 'CNT', pt: 'Rabanete comprido', key: 'rabanete' },
  'broad-beans-fava': { from: '03-01', to: '10-31', src: 'CNT', pt: 'Favas', key: 'favas' },
  'broccoli-calabrese': { from: '10-01', to: '05-31', src: 'APN', pt: 'Brócolos', key: 'brocolo' },
  'butternut-squash': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora-manteiga', key: 'abobora' },
  'cantaloupe-melon': { from: '06-01', to: '09-30', src: 'DECO', pt: 'Meloa', key: 'meloa' },
  'carrot': { from: '01-01', to: '12-31', src: 'APN', pt: 'Cenoura', key: 'cenoura' },
  'cauliflower': { from: '10-01', to: '05-31', src: 'APN', pt: 'Couve-flor', key: 'couve-flor' },
  'cavolo-nero': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-negra', key: 'couve' },
  'chard': { from: '01-01', to: '04-30', src: 'CNT', pt: 'Acelga', key: 'acelga' },
  'cherry': { from: '05-01', to: '06-30', src: 'APN', pt: 'Cereja', key: 'cereja' },
  'cherry-tomato': { from: '05-01', to: '09-30', src: 'APN', pt: 'Tomate-cereja', key: 'tomate' },
  'chilli-pepper': { from: '06-01', to: '10-31', src: 'APN', pt: 'Malagueta', key: 'pimento' },
  'conference-pear': { from: '08-01', to: '11-30', src: 'APN', pt: 'Pera conference', key: 'pera' },
  'cooking-apple': { from: '08-01', to: '05-31', src: 'APN', pt: 'Maçã para cozer', key: 'maca' },
  'courgette': { from: '06-01', to: '09-30', src: 'APN', pt: 'Courgette', key: 'curgete' },
  'crown-prince-squash': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora crown prince', key: 'abobora' },
  'cucumber': { from: '03-01', to: '10-31', src: 'CNT', pt: 'Pepino', key: 'pepino' },
  'damson': { from: '06-01', to: '09-30', src: 'DECO', pt: 'Abrunho', key: 'ameixa' },
  'fig': { from: '08-01', to: '09-30', src: 'APN', pt: 'Figo', key: 'figo' },
  'garden-peas': { from: '03-01', to: '06-30', src: 'APN', pt: 'Ervilhas', key: 'ervilha' },
  'garlic': { from: '06-01', to: '12-31', src: 'APN', pt: 'Alho', key: 'alho' },
  'globe-artichoke': { from: '07-01', to: '08-31', src: 'CNT', pt: 'Alcachofra', key: 'alcachofra' },
  'golden-beetroot': { from: '08-01', to: '04-30', src: 'APN', pt: 'Beterraba dourada', key: 'beterraba' },
  'grapes': { from: '08-01', to: '10-31', src: 'APN', pt: 'Uvas brancas', key: 'uva' },
  'grapes-black': { from: '08-01', to: '10-31', src: 'APN', pt: 'Uvas pretas', key: 'uva' },
  'green-cabbage': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Repolho', key: 'couve' },
  'green-french-beans': { from: '06-01', to: '09-30', src: 'APN', pt: 'Feijão-verde', key: 'feijao-verde' },
  'greengage': { from: '06-01', to: '09-30', src: 'DECO', pt: 'Rainha-cláudia', key: 'ameixa' },
  'heritage-carrots': { from: '01-01', to: '12-31', src: 'APN', pt: 'Cenouras coloridas', key: 'cenoura' },
  'honeydew-melon': { from: '06-01', to: '08-31', src: 'APN', pt: 'Melão', key: 'melao' },
  'kabocha': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora kabocha', key: 'abobora' },
  'kale': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-frisada', key: 'couve' },
  'kiwi': { from: '10-01', to: '03-31', src: 'APN', pt: 'Kiwi', key: 'kiwi' },
  'leek': { from: '10-01', to: '04-30', src: 'APN', pt: 'Alho-francês', key: 'alho-frances' },
  'lemon': { from: '01-01', to: '12-31', src: 'APN', pt: 'Limão', key: 'limao' },
  'lettuce': { from: '01-01', to: '12-31', src: 'APN', pt: 'Alface', key: 'alface' },
  'little-gem': { from: '01-01', to: '12-31', src: 'APN', pt: 'Alface mini-romana', key: 'alface' },
  'mandarin-clementine': { from: '10-01', to: '02-28', src: 'APN', pt: 'Tangerina', key: 'tangerina' },
  'mangetout': { from: '03-01', to: '06-30', src: 'APN', pt: 'Ervilha-torta', key: 'ervilha' },
  'marrow': { from: '06-01', to: '09-30', src: 'APN', pt: 'Courgette grande', key: 'curgete' },
  'nectarine': { from: '06-01', to: '08-31', src: 'APN', pt: 'Nectarina', key: 'pessego' },
  'new-potato': { from: '05-01', to: '08-31', src: 'CNT', pt: 'Batata nova', key: 'batata-nova' },
  'onion': { from: '01-01', to: '12-31', src: 'APN', pt: 'Cebola', key: 'cebola' },
  'orange': { from: '11-01', to: '04-30', src: 'APN', pt: 'Laranja', key: 'laranja' },
  'padr-n-pepper': { from: '06-01', to: '10-31', src: 'APN', pt: 'Pimento de Padrón', key: 'pimento' },
  'peach': { from: '06-01', to: '08-31', src: 'APN', pt: 'Pêssego', key: 'pessego' },
  'pear': { from: '08-01', to: '11-30', src: 'APN', pt: 'Pera', key: 'pera' },
  'persimmon-kaki': { from: '10-01', to: '12-31', src: 'DECO', pt: 'Dióspiro', key: 'diospiro' },
  'plum': { from: '06-01', to: '09-30', src: 'DECO', pt: 'Ameixa', key: 'ameixa' },
  'plum-san-marzano-tomato': { from: '05-01', to: '09-30', src: 'APN', pt: 'Tomate-chucha', key: 'tomate' },
  'pointed-hispi-cabbage': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-coração', key: 'couve' },
  'pomegranate': { from: '09-01', to: '11-30', src: 'APN', pt: 'Romã', key: 'roma' },
  'potato': { from: '01-01', to: '12-31', src: 'APN', pt: 'Batata', key: 'batata' },
  'pumpkin': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora', key: 'abobora' },
  'purple-sprouting-broccoli': { from: '10-01', to: '05-31', src: 'APN', pt: 'Brócolos roxos', key: 'brocolo' },
  'quince': { from: '09-01', to: '10-31', src: 'CNT', pt: 'Marmelo', key: 'marmelo' },
  'radish': { from: '05-01', to: '06-30', src: 'CNT', pt: 'Rabanete', key: 'rabanete' },
  'raspberry': { from: '05-01', to: '07-31', src: 'APN', pt: 'Framboesa', key: 'framboesa' },
  'red-cabbage': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-roxa', key: 'couve' },
  'red-onion': { from: '01-01', to: '12-31', src: 'APN', pt: 'Cebola roxa', key: 'cebola' },
  'romaine-cos': { from: '01-01', to: '12-31', src: 'APN', pt: 'Alface-romana', key: 'alface' },
  'romanesco': { from: '10-01', to: '05-31', src: 'APN', pt: 'Couve romanesco', key: 'couve-flor' },
  'runner-beans': { from: '06-01', to: '09-30', src: 'APN', pt: 'Feijão-de-trepar', key: 'feijao-verde' },
  'savoy-cabbage': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-lombarda', key: 'couve' },
  'spaghetti-squash': { from: '09-01', to: '02-28', src: 'APN', pt: 'Abóbora-espaguete', key: 'abobora' },
  'spinach': { from: '10-01', to: '05-31', src: 'APN', pt: 'Espinafre', key: 'espinafre' },
  'spring-greens': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Couve-galega', key: 'couve' },
  'strawberry': { from: '03-01', to: '06-30', src: 'APN', pt: 'Morango', key: 'morango' },
  'sugar-snap-peas': { from: '03-01', to: '06-30', src: 'APN', pt: 'Ervilha-doce', key: 'ervilha' },
  'sweetcorn': { from: '09-01', to: '10-31', src: 'CNT', pt: 'Milho-doce', key: 'milho' },
  'tenderstem-broccoli': { from: '10-01', to: '05-31', src: 'APN', pt: 'Brócolos-de-haste', key: 'brocolo' },
  'tomato': { from: '05-01', to: '09-30', src: 'APN', pt: 'Tomate', key: 'tomate' },
  'turnip': { from: '11-01', to: '04-30', src: 'CNT', pt: 'Nabo', key: 'nabo' },
  'watercress': { from: '03-01', to: '10-31', src: 'CNT', pt: 'Agrião', key: 'agriao' },
  'watermelon': { from: '06-01', to: '08-31', src: 'APN', pt: 'Melancia', key: 'melancia' },
};

const OVERRIDES = {
  orange: {
    // "Winter (Med)" derives to 01 Dec - 15 Feb, which puts oranges out of
    // season on 14 November. That is Orange day in the Republican calendar and
    // it is named by turning day XX (Martinmas). Mediterranean oranges start in
    // November; the label is a season name doing a month's work.
    // Surfaced by season-lore-check.mjs only after the bad Mediterranean shift
    // was removed, which had been masking it.
    // NOTE: the other four citrus (lemon, blood-orange, mandarin-clementine,
    // grapefruit) sit on the same "Winter (Med)" label and are NOT examined.
    // blood-orange really is later. Do not blanket-copy this.
    mediterranean: [{ from: '11-08', to: '03-15' }],
    temperate:     [],
    availability: 'local',
    source: 'start pulled back so Republican Orange day (14 Nov, named by turning day XX) falls INSIDE the window rather than two days before it; end carried from the "Winter (Med)" label',
  },

  leek: {
    // "Autumn-winter" derived to 01 Sep - 28 Feb, which puts leeks OUT on
    // St David's Day. Leeks are the Welsh emblem precisely because they are on
    // the stall on 1 March. Caught by scripts/season-lore-check.mjs.
    mediterranean: [{ from: '09-01', to: '03-15' }],
    temperate:     [{ from: '09-16', to: '03-31' }],
    availability: 'local',
    source: "tail extended past the label's 28 Feb because turning day III (St David, 1 Mar) names leeks; the label was truncating a crop that stands through March",
  },

  blackberry: {
    // The mechanical derivation of "Late summer-autumn" ran to 30 November and
    // put blackberry at PEAK on 10 October. Old Michaelmas is the folk date
    // after which blackberries are not to be picked, and it is the working_name
    // of turning day XVII. The lore is older and more specific than the label.
    // First range corrected by the harness rather than by a diff.
    mediterranean: [{ from: '07-16', to: '09-30' }],
    temperate:     [{ from: '08-01', to: '10-10' }],
    availability: 'local',
    source: 'tail set by the Old Michaelmas folk date (10 Oct, "the devil spits on the blackberries"), which contradicted the derived range; head carried from the "Late summer-autumn" label',
  },

  greengage: {
    // The label "Summer" (Jun-Aug) is the broadest in the catalogue and it is
    // wrong: it claims June. The dispatch-one research puts the real season at
    // roughly August. The paper is named after this fruit and the 24 Aug
    // dispatch links to /produce/greengage/, so this one cannot ride on a
    // derived guess.
    mediterranean: [{ from: '07-16', to: '09-15' }],
    temperate:     [{ from: '08-01', to: '09-15' }],
    availability: 'local',
    source: 'hand-set from the dispatch-one greengage research (real season roughly August); NOT derived from the "Summer" label, which was wrong',
  },
};


/* DECLARED PEAKS.
   Peak is no longer derived (see src/season.js). An item is at peak only where
   somebody said so, and here that somebody is the Republican calendar, which
   named a day of the year after a fruit or vegetable. That is a dated claim
   about when a thing is worth eating, made by people who had to buy food, and
   it is exactly the kind of independent source the derived labels lack.

   Convention: the named day, plus and minus seven days. One half-month tick,
   centred on the declaration. Anything narrower would be inventing precision
   the source does not carry.

   Every entry cites its day. Add nothing here without one. */
const DECLARED_PEAKS = {
  rhubarb:            { day: '04-30', src: 'Republican Rhubarbe day, 30 Apr (turning day VI)' },
  cherry:             { day: '06-24', src: 'turning day X names it: "São João fires / the cherries", cherries at peak' },
  'cantaloupe-melon': { day: '07-21', src: 'Republican Melon day, 21 Jul (turning day XI)' },
  apricot:            { day: '07-31', src: 'Republican Abricot day, 31 Jul (turning day XII)' },
  plum:               { day: '08-18', src: 'Republican Prune day, 18 Aug (turning day XIII)' },
  greengage:          { day: '08-24', src: 'St Bartholomew, 24 Aug (turning day XIV), and the dispatch-one greengage research' },
  grapes:             { day: '09-22', src: 'Republican Raisin day, 22 Sep, and the vindima (turning day XV)' },
  'grapes-black':     { day: '09-22', src: 'Republican Raisin day, 22 Sep, and the vindima (turning day XV)' },
  pumpkin:            { day: '10-04', src: 'Republican Potiron day, 4 Oct (turning day XVII)' },
  'endive-fris-e':    { day: '11-04', src: 'Republican Endive day, 4 Nov (turning day XIX)' },
  orange:             { day: '11-14', src: 'Republican Orange day, 14 Nov (turning day XX)' },
};

// Clip the declared peak to the range it sits in; drop it if they do not overlap.
function applyPeak(ranges, day) {
  const lo = fromDoy(doy(day) - 7), hi = fromDoy(doy(day) + 7);
  return ranges.map((r) => {
    const a = doy(r.from), b = doy(r.to), inR = (x) => (a <= b ? x >= a && x <= b : x >= a || x <= b);
    if (!inR(doy(lo)) && !inR(doy(hi)) && !inR(doy(day))) return r;
    return { ...r, peak_from: inR(doy(lo)) ? lo : r.from, peak_to: inR(doy(hi)) ? hi : r.to };
  });
}

// PT_SOURCED breaks the circularity for the mediterranean band, so those ids
// are now derivable too. Union, not replacement: the lore set still rules.
const TARGETS_ALL = [...new Set([...TARGETS, ...Object.keys(PT_SOURCED)])];

const P = JSON.parse(fs.readFileSync('data/produce.json','utf8'));
let n = 0;
for (const it of P) {
  if (!TARGETS_ALL.includes(it.id)) continue;
  const s = (it.season||'').toLowerCase();
  const w = windowFor(it.season);
  if (!w) { console.log(`SKIP ${it.id}: cannot parse "${it.season}"`); continue; }

  const imported = /\(imported|\/imported/.test(s) || (s.includes('year-round') && /imported/.test(s));
  const stored   = /stores|harvest/.test(s);
  const medOnly  = /\(med/.test(s);
  // The Mediterranean-runs-earlier shift applies to SPRING AND SUMMER crops only.
  // An autumn or winter crop does not arrive earlier in Lisbon: a stored squash
  // or a winter root is governed by harvest-and-store, not by a warmer spring.
  // Shifting them put six winter squashes, turnip, daikon and jerusalem
  // artichoke on the St Bartholomew stall in late August, which is visibly wrong
  // on the page dispatch one is named for.
  const startsWarm = /spring|summer/.test((s.split(/[-\u2013]/)[0] || ''));
  const movable  = !imported && !stored && !s.includes('year-round') && startsWarm;

  const temperate = medOnly ? [] : [snapW(w)];
  const mediterranean = [movable ? shift(w, -TICK) : snapW(w)];

  const ov = OVERRIDES[it.id];
  const ptx = PT_SOURCED[it.id];
  /* Precedence for the MEDITERRANEAN band only:
       hand OVERRIDE  >  PT_SOURCED  >  label derivation
     An override carries a dated folk claim a production calendar cannot know.
     PT_SOURCED carries a published Portuguese figure, which beats a range we
     reverse-engineered from our own English prose label. Temperate is never
     touched by PT_SOURCED: these sources speak for Portugal only. */
  const ptWins = ptx && PT_WINS_MED.includes(it.id);
  /* A split edge refines a PT_SOURCED boundary onto the half-month grid. It
     never overrides a hand OVERRIDE, and it never invents an edge the sources
     did not already bracket. */
  const sp = SOURCE_SPLITS[it.id];
  const ptRange = ptx ? { from: sp?.from ?? ptx.from, to: sp?.to ?? ptx.to } : null;
  const medFinal = ptWins ? [ptRange]
                  : ov ? ov.mediterranean
                  : ptRange ? [ptRange]
                  : mediterranean;
  let medRanges = medFinal, tempRanges = ov ? ov.temperate : temperate;
  const dp = DECLARED_PEAKS[it.id];
  if (dp) {
    medRanges  = applyPeak(medRanges, dp.day);
    tempRanges = applyPeak(tempRanges, dp.day);
    it.peak_source = dp.src;
  }
  it.availability  = ov?.availability ?? (imported ? 'imported' : stored ? 'stored' : 'local');
  /* provenance was hardcoded 'inferred' for everything, including hand
     overrides argued from a dated source. It is the field the Fruta Feia
     calendar's honesty rests on, so it tells the truth — per CALENDAR, not per
     item, since 2026-09-15 (scripts/migrate-season-scopes.mjs, src/season.js):
     a Portuguese source is PT's own calendar, the mediterranean band inherits
     it, and the temperate dates are the label's and say so. */
  const provenance = ptWins ? 'sourced' : ov ? 'argued' : ptx ? 'sourced' : 'inferred';
  const resolution = ov ? 'half-month' : sp ? 'half-month' : ptx ? 'month' : 'quarter';
  const source     = (ptWins ? null : ov?.source)
    ?? (ptx ? `Portuguese national seasonality, ${PT_SOURCE_NAMES[ptx.src]}; matched on "${ptx.pt}" (${ptx.key})${sp ? `. EDGE SPLIT: ${SOURCE_SPLITS_WHY}` : ''}`
            : `derived from the "${it.season}" label by scripts/derive-season-ranges.mjs; not checked against a stall`);
  const labelSource = `derived from the "${it.season}" label by scripts/derive-season-ranges.mjs; no northern-European source recorded`;
  it.season_ranges = provenance === 'sourced'
    ? {
        PT: { ranges: medRanges, provenance: 'sourced', resolution, source },
        mediterranean: { inherit: 'PT', provenance: 'inferred', source: "Portugal's calendar, applied to the whole mediterranean band; no source recorded for Spain, Italy or Greece yet" },
        temperate: { ranges: tempRanges, provenance: 'inferred', resolution: ov ? 'half-month' : 'quarter', source: labelSource },
      }
    : {
        mediterranean: { ranges: medRanges, provenance, resolution, source },
        temperate: { ranges: tempRanges, provenance, resolution, source },
      };
  delete it.provenance; delete it.resolution; delete it.source;

  const fmt = (r) => r.length ? `${r[0].from}..${r[0].to}` : '(none)';
  console.log(`${it.id.padEnd(20)} ${String(it.season).padEnd(24)} med ${fmt(medRanges).padEnd(14)} temp ${fmt(tempRanges).padEnd(14)} [${it.availability}]${ptWins ? '  <-- PT SOURCE BEATS OVERRIDE (med only)' : ov ? '  <-- HAND OVERRIDE' : ptx ? '  <-- PT SOURCED' : ''}`);
  n++;
}
console.log(`\n${n} items derived.`);
if (process.argv.includes('--write')) {
  fs.writeFileSync('data/produce.json', JSON.stringify(P, null, 2) + '\n');
  console.log('WRITTEN to data/produce.json');
} else {
  console.log('dry run. re-run with --write to save.');
}
