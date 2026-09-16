/* Great Britain: the first sourced market after Portugal.
   node scripts/source-gb-calendar.mjs          # dry run: GB vs the inferred temperate dates
   node scripts/source-gb-calendar.mjs --write  # writes season_ranges.GB into data/produce.json

   THE METHOD is Portugal's: one published calendar, matched item by item, the
   match recorded per range in `source`. Nothing here is derived from the
   temperate band or from the English labels. Items with no UK entry get no GB
   key and keep falling back to the temperate dates, which the app then labels
   "estimated" — so a missing match is honest, and a wrong match is not.

   TWO SOURCES, both read verbatim in the browser pane on 2026-09-15 (a fetch
   summary has fabricated counts on this project; the tables below are pasted,
   not paraphrased):

   1. BBC Good Food, "Seasonal calendar", bbcgoodfood.com/seasonal-calendar/all,
      published 25 Sep 2024. A per-item table, twelve month cells, each cell one
      of: an image titled "best (1)", an image titled "coming", or empty. Read
      as B, C, "." below. The page carries no legend text; the two images are
      taken as "in season" both, "coming" being the month the window opens.
      NO PEAK is derived from "best": on most rows it covers the whole window,
      and peak in this data is a declared claim, not the bulk of a season.
   2. The Vegetarian Society, "Seasonal UK Grown Produce", vegsoc.org, 1 Jan
      2022. Twelve month lists of UK-grown items. Used only where BBC has no
      row (cucumber, chillies, the cabbages by kind, squashes, French beans,
      wild mushrooms, greengage, blueberry, rocket).

   Deliberately NOT matched, with the reason:
     potato          BBC "Potato" is Mar-Jul, which is the new-crop window; a
                     stored maincrop is on every UK stall in October. Left on
                     the temperate year-round dates rather than assert a season
                     a British shopper can see is wrong.
     carrot          the same case: BBC "Carrot" is May-Sep (the fresh crop),
                     VegSoc has it in every month but May and June, and a
                     stored carrot is on every stall in winter. Left on the
                     temperate year-round dates, heritage carrots with it.
     cultivated mushrooms   VegSoc lists "Mushrooms" in Jan, Feb, Aug, Dec only;
                     cultivated mushrooms are year-round. Left unmatched.
     endive/frisée   BBC "Chicory" is witloof in UK usage, not frisée.
     blood orange    not BBC "Orange"; its own window, no UK source.
   Resolution is 'month' throughout: both sources speak in whole months. */
import fs from 'node:fs';
import { rangesOf, TICKS, measureWrite, fmt } from './_source-calendar-util.mjs';

const FILE = 'data/produce.json';
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const WRITE = process.argv.includes('--write');
const READ_ON = '15 Sep 2026';

/* ---- source 1: BBC Good Food, verbatim (kind|name|JanFebMarAprMayJunJulAugSepOctNovDec) ---- */
const BBC_ROWS = `fruit|Apple|BB......BBBB
fruit|Apricot|....BBBBB...
fruit|Banana|BBBBBBBBBBBB
fruit|Blackberry|......CBBB..
fruit|Blackcurrants|....CBB.....
fruit|Bramley apple|BBB.......CB
fruit|Cherry|.....CB.....
fruit|Chestnut|B.......CBBB
fruit|Clementine|BB........BB
fruit|Crab apple|.......B....
fruit|Cranberry|.........BBB
fruit|Damson|.......CB...
fruit|Date|B........CBB
fruit|Elderberries|.......BBB..
fruit|Fig|......CBBB..
fruit|Gooseberry|....CBBBB...
fruit|Grapefruit|BBBBB......B
fruit|Lemon|BBB.........
fruit|Loganberry|.......BB...
fruit|Nectarine|....BBBBB...
fruit|Orange|BBB.........
fruit|Peach|......CBB...
fruit|Pear|B.......BBBB
fruit|Plum|.......CBB..
fruit|Pomegranate|BBBBBBBBBBBB
fruit|Quince|........CBBB
fruit|Raspberry|.....CBBB...
fruit|Redcurrant|.....CBBB...
fruit|Rhubarb|BBBBBB......
fruit|Strawberry|....CBBBB...
fruit|Tayberry|......BB....
fruit|Tomato|....CBBBBB..
fruit|Watermelon|.....CBB....
veg|Asparagus|....CBB.....
veg|Aubergine|....CBBBBB..
veg|Beetroot|B.....BBBBBB
veg|Broad bean|.....CBBB...
veg|Broccoli|......CBBB..
veg|Brussels sprouts|BBB......BBB
veg|Cabbage|BBBBBBBBBBBB
veg|Carrot|....CBBBB...
veg|Cauliflower|BBBB.......C
veg|Cavolo nero|.....CBBBB..
veg|Celeriac|BBBB....BBBB
veg|Celery|BB....CBBBBB
veg|Chicory|BBB.........
veg|Courgette|.....BBBB...
veg|Courgette flower|.....BBB....
veg|Fennel bulb|.....BBBB...
veg|Garlic|.....CBBBB..
veg|Globe artichoke|....CBBBBBB.
veg|Jerusalem artichoke|BBB......CBB
veg|Kale|BB......CBBB
veg|Kohlrabi|......CBBBB.
veg|Lamb's lettuce|....BBBBBBB.
veg|Leek|BBB.....BBBB
veg|Lettuce|...CBBBBBBBB
veg|Mangetout|.....BBB....
veg|Marrow|......CBB...
veg|New potatoes|...BBBB.....
veg|Onion|BBBBBBBBBBBB
veg|Pak choi|BBBBBBBBBBBB
veg|Parsnip|BBB.....BBBB
veg|Peas|...CBBBBBBB.
veg|Pepper|.CBBBBBBBB..
veg|Potato|..CBBBB.....
veg|Pumpkin|........CBBB
veg|Purple sprouting broccoli|CBBB........
veg|Radicchio|BBBBBBBBBBBB
veg|Radish|...CBBBBBB..
veg|Runner bean|.....BBBBBB.
veg|Salsify|B.......CBBB
veg|Samphire|......BB....
veg|Spinach|..CBBBBBB...
veg|Spring greens|..CBBB......
veg|Spring onion|BBBBBBBBBBBB
veg|Swede|BB.......CBB
veg|Sweet potato|BBB......BBB
veg|Sweetcorn|.......CB...
veg|Swiss chard|......BBBBB.
veg|Turnip|BB.......BBB
veg|Watercress|..CBBBBBB...
herb|Basil|.....CBB....
herb|Chervil|....BBBBB...
herb|Mint|....BBBBB...
herb|Sorrel|..CBBBBBB...`;

const BBC = new Map(BBC_ROWS.split('\n').map((l) => { const [, name, months] = l.split('|'); return [name, months]; }));

/* ---- source 2: The Vegetarian Society, verbatim ---- */
const VS_TEXT = `JANUARY
Apples, Beetroot, Brussels Sprouts, Carrots, Celeriac, Celery, Chicory, Jerusalem Artichokes, Kale, Leeks, Mushrooms, Onions, Parsnips, Pears, Red Cabbage, Salsify, Savoy Cabbage, Spring Greens, Spring Onions, Squash, Swedes, Turnips, White Cabbage.
FEBRUARY
Apples, Beetroot, Brussels Sprouts, Carrots, Celeriac, Chicory, Jerusalem Artichokes, Kale, Leeks, Mushrooms, Onions, Parsnips, Pears, Purple Sprouting Broccoli, Red Cabbage, Salsify, Savoy Cabbage, Spring Greens, Spring Onions, Squash, Swedes, White Cabbage.
MARCH
Artichoke, Beetroot, Carrots, Chicory, Leeks, Parsnip, Purple Sprouting Broccoli, Radishes, Rhubarb, Sorrel, Spring Greens, Spring Onions, Watercress.
APRIL
Artichoke, Beetroot, Carrots, Chicory, New Potatoes, Kale, Morel Mushrooms, Parsnips, Radishes, Rhubarb, Rocket, Sorrel, Spinach, Spring Greens, Spring Onions, Watercress.
MAY
Artichoke, Asparagus, Aubergine, Beetroot, Chicory, Chillies, Elderflowers, Lettuce, Marrow, New Potatoes, Peas, Peppers, Radishes, Rhubarb, Rocket, Samphire, Sorrel, Spinach, Spring Greens, Spring Onions, Strawberries, Sweetheart Cabbage, Watercress.
JUNE
Asparagus, Aubergine, Beetroot, Blackcurrants, Broad Beans, Broccoli, Cauliflower, Cherries, Chicory, Chillies, Courgettes, Cucumber, Elderflowers, Gooseberries, Lettuce, Marrow, New Potatoes, Peas, Peppers, Radishes, Raspberries, Redcurrants, Rhubarb, Rocket, Runner Beans, Samphire, Sorrel, Spring Greens, Spring Onions, Strawberries, Summer Squash, Sweetheart Cabbage, Swiss Chard, Tayberries, Turnips, Watercress.
JULY
Aubergine, Beetroot, Blackberries, Blackcurrants, Blueberries, Broad Beans, Broccoli, Carrots, Cauliflower, Cherries, Chicory, Chillies, Courgettes, Cucumber, Gooseberries, Greengages, Fennel, French Beans, Garlic, Kohlrabi, Loganberries, New Potatoes, Onions, Peas, Potatoes, Radishes, Raspberries, Redcurrants, Rhubarb, Rocket, Runner Beans, Samphire, Sorrel, Spring Greens, Spring Onions, Strawberries, Summer Squash, Sweetheart Cabbage, Swish Chard, Tomatoes, Turnips, Watercress.
AUGUST
Aubergine, Beetroot, Blackberries, Blackcurrants, Broad Beans, Broccoli, Carrots, Cauliflower, Cherries, Chicory, Chillies, Courgettes, Cucumber, Damsons, Fennel, French Beans, Garlic, Greengages, Kohlrabi, Leeks, Lettuce, Loganberries, Mangetout, Marrow, Mushrooms, Parsnips, Peas, Peppers, Potatoes, Plums, Pumpkin, Radishes, Raspberries, Redcurrants, Rhubarb, Rocket, Runner Beans, Samphire, Sorrel, Spring Greens, Spring Onions, Strawberries, Summer Squash, Sweetcorn, Sweetheart Cabbage, Swiss Chard, Tomatoes, Watercress, White Cabbage.
SEPTEMBER
Aubergine, Beetroot, Blackberries, Broccoli, Brussels Sprouts, Butternut Squash, Carrots, Cauliflower, Celery, Courgettes, Chicory, Chillies, Cucumber, Damsons, Garlic, Kale, Kohlrabi, Leeks, Lettuce, Mangetout, Marrow, Onions, Parsnips, Pears, Peas, Peppers, Plums, Potatoes, Pumpkin, Radishes, Raspberries, Red Cabbage, Rhubarb, Rocket, Runner Beans, Samphire, Sorrel, Spinach, Spring Greens, Spring Onions, Strawberries, Summer Squash, Sweetcorn, Sweetheart Cabbage, Swiss Chard, Tomatoes, Turnips, Watercress, Wild Mushrooms, White Cabbage.
OCTOBER
Aubergine, Apples, Beetroot, Blackberries, Broccoli, Brussels Sprouts, Butternut Squash, Carrots, Cauliflower, Celeriac, Celery, Chestnuts, Chicory, Chillies, Courgette, Cucumber, Elderberries, Kale, Leeks, Lettuce, Marrow, Onions, Parsnips, Pears, Peas, Potatoes, Pumpkin, Quince, Radishes, Red Cabbage, Rocket, Runner Beans, Salsify, Savoy Cabbage, Spinach, Spring Greens, Spring Onions, Summer Squash, Swede, Sweetcorn, Sweetheart Cabbage, Swiss Chard, Tomatoes, Turnips, Watercress, Wild Mushrooms, Winter Squash, White Cabbage.
NOVEMBER
Apples, Beetroot, Brussels Sprouts, Butternut Squash, Carrots, Cauliflower, Celeriac, Celery, Chestnuts, Chicory, Cranberries, Elderberries, Jerusalem Artichokes, Kale, Leeks, Onions, Parsnips, Pears, Potatoes, Pumpkin, Quince, Red Cabbage, Salsify, Savoy Cabbage, Swede, Swiss Chard, Turnips, Watercress, Wild Mushrooms, Winter Squash, White Cabbage.
DECEMBER
Apples, Beetroot, Brussels Sprouts, Carrots, Celeriac, Celery, Chestnuts, Chicory, Cranberries, Jerusalem Artichokes, Kale, Leeks, Mushrooms, Onions, Parsnips, Pears, Potatoes, Pumpkin, Quince, Red Cabbage, Salsify, Savoy Cabbage, Swede, Swiss Chard, Turnips, Watercress, Winter Squash, White Cabbage.`;

const VS = new Map(); // name -> 12-char month string
{
  const lines = VS_TEXT.split('\n');
  for (let i = 0; i < lines.length; i += 2) {
    const m = i / 2;
    for (const raw of lines[i + 1].replace(/\.$/, '').split(', ')) {
      const name = raw.trim();
      if (!VS.has(name)) VS.set(name, '............');
      const s = VS.get(name); VS.set(name, s.slice(0, m) + 'B' + s.slice(m + 1));
    }
  }
}

/* ---- the match: produce id -> [source, name in that source] ---- */
const MAP = {
  tomato: ['bbc', 'Tomato'], 'cherry-tomato': ['bbc', 'Tomato'], 'beefsteak-tomato': ['bbc', 'Tomato'], 'plum-san-marzano-tomato': ['bbc', 'Tomato'],
  aubergine: ['bbc', 'Aubergine'], courgette: ['bbc', 'Courgette'], marrow: ['bbc', 'Marrow'],
  cucumber: ['vs', 'Cucumber'], 'bell-pepper': ['bbc', 'Pepper'], 'chilli-pepper': ['vs', 'Chillies'],
  onion: ['bbc', 'Onion'], 'red-onion': ['bbc', 'Onion'], 'spring-onion': ['bbc', 'Spring onion'], leek: ['bbc', 'Leek'], garlic: ['bbc', 'Garlic'],
  beetroot: ['bbc', 'Beetroot'], 'golden-beetroot': ['bbc', 'Beetroot'],
  radish: ['bbc', 'Radish'], 'breakfast-radish': ['bbc', 'Radish'], turnip: ['bbc', 'Turnip'], swede: ['bbc', 'Swede'], parsnip: ['bbc', 'Parsnip'], celeriac: ['bbc', 'Celeriac'],
  'new-potato': ['bbc', 'New potatoes'], 'sweet-potato': ['bbc', 'Sweet potato'], 'jerusalem-artichoke': ['bbc', 'Jerusalem artichoke'], kohlrabi: ['bbc', 'Kohlrabi'],
  'green-cabbage': ['bbc', 'Cabbage'], 'savoy-cabbage': ['vs', 'Savoy Cabbage'], 'red-cabbage': ['vs', 'Red Cabbage'], 'pointed-hispi-cabbage': ['vs', 'Sweetheart Cabbage'], 'spring-greens': ['bbc', 'Spring greens'],
  cauliflower: ['bbc', 'Cauliflower'], 'broccoli-calabrese': ['bbc', 'Broccoli'], 'tenderstem-broccoli': ['bbc', 'Broccoli'], 'purple-sprouting-broccoli': ['bbc', 'Purple sprouting broccoli'],
  'brussels-sprouts': ['bbc', 'Brussels sprouts'], kale: ['bbc', 'Kale'], 'cavolo-nero': ['bbc', 'Cavolo nero'], 'pak-choi': ['bbc', 'Pak choi'], chard: ['bbc', 'Swiss chard'], spinach: ['bbc', 'Spinach'],
  'rocket-arugula': ['vs', 'Rocket'], lettuce: ['bbc', 'Lettuce'], 'romaine-cos': ['bbc', 'Lettuce'], 'little-gem': ['bbc', 'Lettuce'], radicchio: ['bbc', 'Radicchio'],
  watercress: ['bbc', 'Watercress'], 'lamb-s-lettuce-m-che': ['bbc', "Lamb's lettuce"], fennel: ['bbc', 'Fennel bulb'], celery: ['bbc', 'Celery'],
  asparagus: ['bbc', 'Asparagus'], rhubarb: ['bbc', 'Rhubarb'], 'globe-artichoke': ['bbc', 'Globe artichoke'], samphire: ['bbc', 'Samphire'],
  pumpkin: ['bbc', 'Pumpkin'], 'butternut-squash': ['vs', 'Butternut Squash'], 'acorn-squash': ['vs', 'Winter Squash'], 'crown-prince-squash': ['vs', 'Winter Squash'], 'spaghetti-squash': ['vs', 'Winter Squash'], kabocha: ['vs', 'Winter Squash'],
  'green-french-beans': ['vs', 'French Beans'], 'runner-beans': ['bbc', 'Runner bean'], 'broad-beans-fava': ['bbc', 'Broad bean'],
  'garden-peas': ['bbc', 'Peas'], mangetout: ['bbc', 'Mangetout'], 'sugar-snap-peas': ['bbc', 'Mangetout'], sweetcorn: ['bbc', 'Sweetcorn'],
  chanterelle: ['vs', 'Wild Mushrooms'], 'porcini-cep': ['vs', 'Wild Mushrooms'],
  basil: ['bbc', 'Basil'], chervil: ['bbc', 'Chervil'], mint: ['bbc', 'Mint'],
  apple: ['bbc', 'Apple'], 'cooking-apple': ['bbc', 'Bramley apple'], pear: ['bbc', 'Pear'], 'conference-pear': ['bbc', 'Pear'], quince: ['bbc', 'Quince'],
  plum: ['bbc', 'Plum'], damson: ['bbc', 'Damson'], greengage: ['vs', 'Greengages'], cherry: ['bbc', 'Cherry'], peach: ['bbc', 'Peach'], nectarine: ['bbc', 'Nectarine'], apricot: ['bbc', 'Apricot'], fig: ['bbc', 'Fig'],
  strawberry: ['bbc', 'Strawberry'], raspberry: ['bbc', 'Raspberry'], blackberry: ['bbc', 'Blackberry'], blueberry: ['vs', 'Blueberries'], redcurrant: ['bbc', 'Redcurrant'], blackcurrant: ['bbc', 'Blackcurrants'], gooseberry: ['bbc', 'Gooseberry'],
  lemon: ['bbc', 'Lemon'], orange: ['bbc', 'Orange'], grapefruit: ['bbc', 'Grapefruit'], 'mandarin-clementine': ['bbc', 'Clementine'],
  watermelon: ['bbc', 'Watermelon'], pomegranate: ['bbc', 'Pomegranate'], date: ['bbc', 'Date'], chestnut: ['bbc', 'Chestnut'],
};

const SOURCE = {
  bbc: (name) => `UK seasonality, BBC Good Food "Seasonal calendar" (bbcgoodfood.com/seasonal-calendar/all, published 25 Sep 2024, read ${READ_ON}); matched on "${name}"; months marked best or coming`,
  vs: (name) => `UK-grown produce by month, The Vegetarian Society "Seasonal UK Grown Produce" (vegsoc.org, 1 Jan 2022, read ${READ_ON}); matched on "${name}"`,
};

/* ---- apply, and measure against the temperate dates ---- */
let written = 0, unmatched = [], movedItems = 0, movedTicks = 0, totalTicks = 0;
const report = [];
for (const it of P) {
  const m = MAP[it.id];
  if (!m) { unmatched.push(it.id); continue; }
  const [src, name] = m;
  const months = (src === 'bbc' ? BBC : VS).get(name);
  if (!months) { console.error(`NO SOURCE ROW for ${it.id}: ${src} "${name}"`); process.exit(1); }
  const ranges = rangesOf(months);
  const diff = measureWrite(it, 'temperate', 'GB', (sr) => {
    sr.GB = { ranges, provenance: 'sourced', resolution: 'month', source: SOURCE[src](name) };
  });
  totalTicks += TICKS.length; movedTicks += diff; if (diff) movedItems++;
  const tempEntry = it.season_ranges.temperate;
  const tempRanges = tempEntry ? (Array.isArray(tempEntry) ? tempEntry : tempEntry.ranges) : null;
  report.push(`${it.id.padEnd(26)} ${months}  GB ${fmt(ranges).padEnd(28)} temperate ${(tempRanges ? fmt(tempRanges) : '(label only)').padEnd(28)} ${diff ? diff + ' ticks move' : ''}`);
  written++;
}

console.log(report.join('\n'));
console.log(`\n${'='.repeat(60)}`);
console.log(`${written} items matched to a UK source (${Object.values(MAP).filter(([s]) => s === 'bbc').length} BBC Good Food, ${Object.values(MAP).filter(([s]) => s === 'vs').length} Vegetarian Society); ${unmatched.length} unmatched and left on the temperate fallback.`);
console.log(`Against the inferred temperate dates: ${movedItems} of ${written} items read differently somewhere; ${movedTicks} of ${totalTicks} half-month readings change for a GB session.`);
console.log(`unmatched: ${unmatched.join(', ')}`);
if (WRITE) {
  fs.writeFileSync(FILE, JSON.stringify(P, null, 2) + '\n');
  console.log(`wrote ${FILE}`);
}
