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

const TARGETS = [...new Set([...FIELD_GUIDE, ...LORE_NAMED])];

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
    mediterranean: [{ from: '11-16', to: '03-15' }],
    temperate:     [],
    availability: 'local',
    source: 'start pulled to mid-November on the authority of Republican Orange day (14 Nov), named by turning day XX; end carried from the "Winter (Med)" label',
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

const P = JSON.parse(fs.readFileSync('data/produce.json','utf8'));
let n = 0;
for (const it of P) {
  if (!TARGETS.includes(it.id)) continue;
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
  it.season_ranges = ov
    ? { mediterranean: ov.mediterranean, temperate: ov.temperate }
    : { mediterranean, temperate };
  it.availability  = ov?.availability ?? (imported ? 'imported' : stored ? 'stored' : 'local');
  it.provenance    = 'inferred';
  it.source        = ov?.source
    ?? `derived from the "${it.season}" label by scripts/derive-season-ranges.mjs; not checked against a stall`;

  const fmt = (r) => r.length ? `${r[0].from}..${r[0].to}` : '(none)';
  console.log(`${it.id.padEnd(20)} ${String(it.season).padEnd(24)} med ${fmt(it.season_ranges.mediterranean).padEnd(14)} temp ${fmt(it.season_ranges.temperate).padEnd(14)} [${it.availability}]${ov ? '  <-- HAND OVERRIDE' : ''}`);
  n++;
}
console.log(`\n${n} items derived.`);
if (process.argv.includes('--write')) {
  fs.writeFileSync('data/produce.json', JSON.stringify(P, null, 2) + '\n');
  console.log('WRITTEN to data/produce.json');
} else {
  console.log('dry run. re-run with --write to save.');
}
