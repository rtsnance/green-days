/* Spain: the second sourced non-Portuguese market.
   node scripts/source-es-calendar.mjs          # dry run: ES vs the temperate/mediterranean inheritance today
   node scripts/source-es-calendar.mjs --write  # writes ES + IT/GR inherit entries into data/produce.json

   THE METHOD is Portugal's and Great Britain's: one published calendar, matched
   item by item, the match recorded per range in `source`. Nothing here is
   derived from any band or from the English labels. Items with no ES entry keep
   falling back to the mediterranean band (which still inherits PT), and the
   app then labels them as Portugal's dates.

   Chosen after BZfE (the "obvious" German source the previous handoff named)
   turned out to be a single watermarked JPEG poster on 2026-09-15 with no DOM
   table — exactly the failure mode Trap 3 warns against. Spain was already the
   documented alternative ("would turn the mediterranean inheritance into a
   source"), and its calendars are published as HTML with per-month cell classes.

   TWO SOURCES, both read verbatim in the browser pane on 2026-09-15 from the
   DOM (.mes-imagen-activo per active month), not from a fetch summary:

   1. Eroski Consumer, "Calendario anual de frutas", frutas.consumer.es/calendario-frutas.
      Three groups (Frutas Frescas, Frutas Tropicales, Frutos Secos), 51 items,
      twelve month cells each, `.mes-imagen-activo` class marking in-season
      months. `title="<name> - <month>"` on every cell. No cell text; every
      reading comes from the class. Frutos Secos are dried and read year-round
      by design; they are not matched.
   2. Eroski Consumer, "Calendario anual de verduras y hortalizas",
      verduras.consumer.es/calendario. One group, 31 items, same shape.

   The Consumer calendar reads Spanish MARKET availability (domestic harvest
   and stored/imported both), not domestic harvest alone. That matches the
   Portuguese sources' scope. Watermelon at May-Aug and pineapple year-round
   are both what the Spanish stall actually looks like.

   Deliberately NOT matched, with the reason:
     potato, new-potato    the source has no potato row; a stored potato is on
                           every Spanish stall year-round. Left on the fallback
                           rather than assert a season a Spanish shopper can see
                           is wrong (same case as GB).
     carrot, heritage-carrots  Consumer "Zanahoria" is Jun-Dec, which is the
                           fresh-crop window; a stored carrot is on every stall
                           in winter. Left on the fallback (same as GB).
     cultivated mushrooms (button, chestnut, oyster, portobello, shiitake)
                           the source's "Setas" row peaks in autumn and reads
                           as wild. Cultivated mushrooms are year-round. Left
                           unmatched (same as GB).
     endive-fris-e, radicchio  "Achicoria" is Belgian/witloof chicory in
                           Spanish usage, not frisée; "Endibias" is also
                           witloof. "Escarola" IS curly endive/frisée and IS
                           matched to endive-fris-e.
     chilli-pepper, padr-n-pepper, tomatillo  "Pimiento" is bell pepper here;
                           chillies and Padrón are separate, shorter windows
                           that the source does not split.
     blood-orange          not a separate row; folded into "Naranja". Same
                           case as GB.
     medlar                Spanish "níspero" is loquat (Eriobotrya japonica),
                           not European medlar (Mespilus germanica). Loquat is
                           matched; European medlar is not in this source.
     damson, greengage, prickly-pear, olives, sweetcorn, baby-corn, rhubarb,
     watercress, samphire, kiwi (redcurrant handled separately), chestnut,
     lemongrass, all herbs, all pulses except green beans
                           not present in either source table.
     endrina               is sloe (Prunus spinosa), not damson (P. insititia).
                           No match in the Green Days roster.
     runner-beans, garden-peas, mangetout, sugar-snap, broad-beans-fava,
     edamame, borlotti-beans  "Judías verdes" covers French/green beans only.
                           Others are not distinguished; left unmatched.
     spring-onion          the source's "Ajo y ajos frescos" is green garlic
                           (a spring product with a specific window), read
                           year-round in Consumer's Spanish market view.
                           Cebolleta (spring onion proper) is not in either
                           table. Removed after the 2026-09-15 review — a
                           wrong sourced claim (spring onion year-round) is
                           worse than the fallback (Trap 8).

   ALSO WRITTEN: IT and GR receive `inherit: "ES"` entries for every ES-matched
   item, so the app says "Dates are Spain's" for Italy and Greece rather than
   Portugal's. Items without an ES key still fall through to the mediterranean
   band (which still inherits PT), so IT/GR see Portugal's dates on the
   unmatched items — which is honest, since Portugal is the closest thing to a
   source we have for those. Resolution is 'month' throughout: the source
   speaks in whole months. */
import fs from 'node:fs';
import { rangeSeasonalityOf } from '../src/season.js';

const FILE = 'data/produce.json';
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const WRITE = process.argv.includes('--write');
const READ_ON = '15 Sep 2026';

/* ---- source 1: Eroski Consumer, frutas.consumer.es, verbatim ----
   Format: group|name|JanFebMarAprMayJunJulAugSepOctNovDec (B = .mes-imagen-activo, . = .mes-imagen) */
const FRUTAS_ROWS = `fresca|Albaricoque|....BBBBB...
fresca|Arándano|.....BBBBBBB
fresca|Piña|BBBBBBBBBBBB
fresca|Grosella|.......BB...
fresca|Ciruela|...BBBBB....
fresca|Pomelo|BBB......BBB
fresca|Endrina|........BB..
fresca|Breva|.....BB.....
fresca|Plátano|BBBBBBBBBBBB
fresca|Cereza|...BBBBB....
fresca|Membrillo|BB......BBBB
fresca|Higo|.......BB...
fresca|Frambuesa|......BBBB..
fresca|Fresa|..BBBBB.....
fresca|Granada|B.......BBBB
fresca|Naranja|BBBBBBBBBBBB
fresca|Lima|BBBBBBBBBBBB
fresca|Limón|BBBBBBBBBBBB
fresca|Uva|........BBBB
fresca|Mandarina|BBB.....BBBB
fresca|Manzana|BBBBBB..BBBB
fresca|Mora|.......BB...
fresca|Melón|......BBB...
fresca|Melocotón|....BBBBB...
fresca|Níspero|...BBB......
fresca|Pera|BBBBBBBBBBBB
fresca|Sandía|.....BBBB...
tropical|Aguacate|BBBBBBBBBBBB
tropical|Alquejenje|.......BBBB.
tropical|Caqui|BB.......BBB
tropical|Carambola|BBBBBBBBBBBB
tropical|Chirimoya|BB.........B
tropical|Coco|BBBBBBBBBBBB
tropical|Kumquat|BB........BB
tropical|Guayaba|.....BBBBBBB
tropical|Kiwano|BBBBBBBBBBBB
tropical|Kiwi|BBBBBBBBBBBB
tropical|Litchi|BB..........
tropical|Mango|BBBBBBBBBBBB
tropical|Mangostan|BBBBBBBBBBBB
tropical|Maracuyá|BBBB.....BBB
tropical|Papaya|BBBBBBBBBBBB
tropical|Pitahaya|BBB..BBBB...
tropical|Rambután|BBBBBBBBBBBB
tropical|Tamarillo|BBBBBBBBBBBB`;

const FRUTAS = new Map(FRUTAS_ROWS.split('\n').map((l) => { const [, name, months] = l.split('|'); return [name, months]; }));

/* ---- source 2: Eroski Consumer, verduras.consumer.es, verbatim ---- */
const HORTALIZAS_ROWS = `Acelga|BBB.......BB
Achicoria|BBBBB......B
Ajo y ajos frescos|BBBBBBBBBBBB
Berenjena|.......BBBBB
Alcachofa|BBBBB....BBB
Puerro|BBB.....BBBB
Apio|BBBBBB.....B
Nabo|........BBBB
Berza o repollo|BBB........B
Coliflor|B.......BBBB
Zanahoria|.....BBBBBBB
Setas|....B...BBB.
Borraja|BBB.......BB
Brécol|BBBBBB.....B
Coles de Bruselas|.........BBB
Calabaza|.....BBBB...
Calabacín|.....BBBB...
Cardo|BBBB......BB
Cebolla|BBBBBBBBBBBB
Pepino|.....BBBB...
Lechuga|BBBBBB.....B
Endibias|BBBBBB..BBBB
Rábano|....BBB.....
Remolacha|BBBBBBBBBBBB
Escarola|BBB........B
Espárragos|...BB.......
Espinacas|BBBBBB..BBBB
Judías verdes|...BBBBBB...
Hinojo|BBBBB.....BB
Pimiento|.....BBBBBB.
Tomate|.....BBBB...`;

const HORTALIZAS = new Map(HORTALIZAS_ROWS.split('\n').map((l) => { const [name, months] = l.split('|'); return [name, months]; }));

/* ---- the match: produce id -> [source, name in that source] ---- */
const MAP = {
  // fruits, fresh
  apricot: ['f', 'Albaricoque'],
  blueberry: ['f', 'Arándano'],
  pineapple: ['f', 'Piña'],
  redcurrant: ['f', 'Grosella'],
  plum: ['f', 'Ciruela'],
  grapefruit: ['f', 'Pomelo'],
  cherry: ['f', 'Cereza'],
  quince: ['f', 'Membrillo'],
  fig: ['f', 'Higo'],
  raspberry: ['f', 'Frambuesa'],
  strawberry: ['f', 'Fresa'],
  pomegranate: ['f', 'Granada'],
  orange: ['f', 'Naranja'],
  lime: ['f', 'Lima'],
  lemon: ['f', 'Limón'],
  grapes: ['f', 'Uva'], 'grapes-black': ['f', 'Uva'],
  'mandarin-clementine': ['f', 'Mandarina'],
  apple: ['f', 'Manzana'], 'cooking-apple': ['f', 'Manzana'],
  blackberry: ['f', 'Mora'],
  'cantaloupe-melon': ['f', 'Melón'], 'honeydew-melon': ['f', 'Melón'],
  peach: ['f', 'Melocotón'], nectarine: ['f', 'Melocotón'],
  'loquat-nespera': ['f', 'Níspero'],
  pear: ['f', 'Pera'], 'conference-pear': ['f', 'Pera'],
  watermelon: ['f', 'Sandía'],
  // fruits, tropical
  avocado: ['f', 'Aguacate'],
  physalis: ['f', 'Alquejenje'],
  'persimmon-kaki': ['f', 'Caqui'],
  kiwi: ['f', 'Kiwi'],
  // vegetables and hortalizas
  chard: ['h', 'Acelga'],
  garlic: ['h', 'Ajo y ajos frescos'],
  aubergine: ['h', 'Berenjena'],
  'globe-artichoke': ['h', 'Alcachofa'],
  leek: ['h', 'Puerro'],
  celery: ['h', 'Apio'],
  turnip: ['h', 'Nabo'],
  'green-cabbage': ['h', 'Berza o repollo'],
  cauliflower: ['h', 'Coliflor'],
  chanterelle: ['h', 'Setas'], 'porcini-cep': ['h', 'Setas'],
  'broccoli-calabrese': ['h', 'Brécol'], 'tenderstem-broccoli': ['h', 'Brécol'],
  'brussels-sprouts': ['h', 'Coles de Bruselas'],
  pumpkin: ['h', 'Calabaza'], 'butternut-squash': ['h', 'Calabaza'], 'acorn-squash': ['h', 'Calabaza'],
  'crown-prince-squash': ['h', 'Calabaza'], 'spaghetti-squash': ['h', 'Calabaza'], kabocha: ['h', 'Calabaza'],
  courgette: ['h', 'Calabacín'],
  cardoon: ['h', 'Cardo'],
  onion: ['h', 'Cebolla'], 'red-onion': ['h', 'Cebolla'],
  cucumber: ['h', 'Pepino'],
  lettuce: ['h', 'Lechuga'], 'romaine-cos': ['h', 'Lechuga'], 'little-gem': ['h', 'Lechuga'],
  radish: ['h', 'Rábano'], 'breakfast-radish': ['h', 'Rábano'],
  beetroot: ['h', 'Remolacha'], 'golden-beetroot': ['h', 'Remolacha'],
  'endive-fris-e': ['h', 'Escarola'],
  asparagus: ['h', 'Espárragos'],
  spinach: ['h', 'Espinacas'],
  'green-french-beans': ['h', 'Judías verdes'],
  fennel: ['h', 'Hinojo'],
  'bell-pepper': ['h', 'Pimiento'],
  tomato: ['h', 'Tomate'], 'cherry-tomato': ['h', 'Tomate'],
  'beefsteak-tomato': ['h', 'Tomate'], 'plum-san-marzano-tomato': ['h', 'Tomate'],
};

const SOURCE = {
  f: (name) => `Spanish seasonality, Eroski Consumer "Calendario anual de frutas" (frutas.consumer.es/calendario-frutas, read ${READ_ON}); matched on "${name}"; months read from .mes-imagen-activo cells`,
  h: (name) => `Spanish seasonality, Eroski Consumer "Calendario anual de verduras y hortalizas" (verduras.consumer.es/calendario, read ${READ_ON}); matched on "${name}"; months read from .mes-imagen-activo cells`,
};

/* ---- months -> ranges (wrap-safe, whole months) ---- */
const END = ['31', '28', '31', '30', '31', '30', '31', '31', '30', '31', '30', '31'];
const mm = (m) => String(m + 1).padStart(2, '0');
function rangesOf(months) {
  const on = [...months].map((c) => c !== '.');
  if (on.every(Boolean)) return [{ from: '01-01', to: '12-31' }];
  if (!on.some(Boolean)) return [];
  const out = [];
  for (let m = 0; m < 12; m++) {
    if (!on[m] || on[(m + 11) % 12]) continue;
    let e = m; while (on[(e + 1) % 12]) e = (e + 1) % 12;
    out.push({ from: `${mm(m)}-01`, to: `${mm(e)}-${END[e]}` });
  }
  return out;
}

/* ---- apply, and measure against what a mediterranean-band session sees today ----
   The "before" baseline is what an ES session sees NOW: sr.mediterranean → inherit
   PT → Portugal's ranges. So the movement number is what a Spanish shopper's stall
   description actually changes by, not just what the calendar entry says. */
const TICKS = [];
for (let m = 1; m <= 12; m++) for (const d of ['01', '16']) TICKS.push(`${String(m).padStart(2, '0')}-${d}`);
let written = 0, unmatched = [], movedItems = 0, movedTicks = 0, totalTicks = 0;
const report = [];
const INHERIT_SOURCE = (country) => `Spain's calendar, applied to ${country}; no ${country === 'Italy' ? 'Italian' : 'Greek'} source recorded yet`;
for (const it of P) {
  const m = MAP[it.id];
  if (!m) { unmatched.push(it.id); continue; }
  const [src, name] = m;
  const months = (src === 'f' ? FRUTAS : HORTALIZAS).get(name);
  if (!months) { console.error(`NO SOURCE ROW for ${it.id}: ${src} "${name}"`); process.exit(1); }
  const ranges = rangesOf(months);
  const before = TICKS.map((t) => rangeSeasonalityOf(it, t, 'mediterranean', 'ES') || 'label');
  if (!it.season_ranges) it.season_ranges = {};
  it.season_ranges.ES = { ranges, provenance: 'sourced', resolution: 'month', source: SOURCE[src](name) };
  it.season_ranges.IT = { inherit: 'ES', provenance: 'inferred', source: INHERIT_SOURCE('Italy') };
  it.season_ranges.GR = { inherit: 'ES', provenance: 'inferred', source: INHERIT_SOURCE('Greece') };
  const after = TICKS.map((t) => rangeSeasonalityOf(it, t, 'mediterranean', 'ES'));
  const diff = TICKS.filter((_, i) => before[i] !== after[i]).length;
  totalTicks += TICKS.length; movedTicks += diff; if (diff) movedItems++;
  const fmt = (r) => (r.length ? r.map((x) => `${x.from}..${x.to}`).join(',') : '(none)');
  const ptEntry = it.season_ranges.PT;
  const ptRanges = ptEntry ? (Array.isArray(ptEntry) ? ptEntry : ptEntry.ranges) : null;
  report.push(`${it.id.padEnd(26)} ${months}  ES ${fmt(ranges).padEnd(28)} PT ${(ptRanges ? fmt(ptRanges) : '(no PT)').padEnd(28)} ${diff ? diff + ' ticks move' : ''}`);
  written++;
}

console.log(report.join('\n'));
console.log(`\n${'='.repeat(60)}`);
const nFruta = Object.values(MAP).filter(([s]) => s === 'f').length;
const nHort = Object.values(MAP).filter(([s]) => s === 'h').length;
console.log(`${written} items matched to a Spanish source (${nFruta} frutas.consumer.es, ${nHort} verduras.consumer.es); ${unmatched.length} unmatched and left on the mediterranean-band fallback.`);
console.log(`Against Portugal's dates (which the mediterranean band inherits today): ${movedItems} of ${written} items read differently somewhere; ${movedTicks} of ${totalTicks} half-month readings change for an ES session.`);
console.log(`Also written: ${written} IT and ${written} GR "inherit: ES" entries, so Italian and Greek sessions read Spain's dates for these items instead of Portugal's.`);
console.log(`unmatched: ${unmatched.join(', ')}`);
if (WRITE) {
  fs.writeFileSync(FILE, JSON.stringify(P, null, 2) + '\n');
  console.log(`wrote ${FILE}`);
}
