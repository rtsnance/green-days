/* Data feed for the 24-card Portuguese postcard set.
   Emits one JSON object holding everything the renderer needs, so the renderer
   never reaches into produce.json itself and the roster lives in exactly one place.

   Language rule, decided 2026-09-08 and confirmed 2026-09-09:
     PROSE is English.            -> selection line, front epithet
     NAMES are Portuguese.        -> produce name, day name
     FURNITURE is Portuguese.     -> labels, dates, season pill, stamp box, attribution
   Ryan's words: "Switch the prose. Keep the name."   Furniture: "Keep furniture Portuguese."

   Run:  node _pt-calendar/postcards-data.mjs > _pt-calendar/postcards.json
*/
import { readFileSync } from 'node:fs';
import { seasonalityOf } from '../src/season.js';

const P = JSON.parse(readFileSync(new URL('../data/produce.json', import.meta.url)));
const D = JSON.parse(readFileSync(new URL('../data/turning-days.json', import.meta.url))).days;
const ED = JSON.parse(readFileSync(new URL('./pt-days.json', import.meta.url))).days;
const byId = Object.fromEntries(P.map((p) => [p.id, p]));

/* The roster. Every entry verified `in` or `peak` on its own date, mediterranean
   band. No repeated produce, no repeated plate. Changing a line here changes the
   card, the copy deck's roster table and nothing else. */
export const ROSTER = {
  I: 'asparagus', II: 'beetroot', III: 'leek', IV: 'cucumber', V: 'loquat-nespera',
  VI: 'rhubarb', VII: 'tomato', VIII: 'avocado', IX: 'aubergine', X: 'cherry',
  XI: 'plum', XII: 'greengage', XIII: 'apricot', XIV: 'apple', XV: 'grapes-black',
  XVI: 'pumpkin', XVII: 'persimmon-kaki', XVIII: 'medlar', XIX: 'chestnut', XX: 'orange',
  XXI: 'golden-beetroot', XXII: 'turnip', XXIII: 'chard', XXIV: 'kiwi',
};

const MES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const ptDate = (mmdd) => { const [m, d] = mmdd.split('-').map(Number); return `${d} de ${MES[m - 1]}`; };
/* "No auge de 15 a 29 de setembro", not "de 15 de setembro a 29 de setembro".
   Only spell the first month when the window crosses one. */
const peakLine = (from, to) => {
  const [mf, df] = from.split('-').map(Number);
  const [mt, dt] = to.split('-').map(Number);
  return mf === mt
    ? `No auge de ${df} a ${dt} de ${MES[mt - 1]}`
    : `No auge de ${df} de ${MES[mf - 1]} a ${dt} de ${MES[mt - 1]}`;
};

const addDays = (mmdd, n) => {
  const [m, d] = mmdd.split('-').map(Number);
  const t = new Date(Date.UTC(2026, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n - 1);
  return `${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

const cards = D.map((day) => {
  const id = ROSTER[day.numeral];
  const p = byId[id];
  if (!p) throw new Error(`roster id not in catalogue: ${id}`);
  const ed = ED[String(day.num)] || {};
  const state = seasonalityOf(p, day.opens, 'mediterranean');
  if (state === 'out') throw new Error(`${day.numeral} ${id} is OUT on ${day.opens}`);

  const pk = (p.season_ranges?.mediterranean || []).find((r) => r.peak_from && r.peak_to);

  return {
    numeral: day.numeral,
    num: day.num,
    specimen: String(day.num).padStart(3, '0'),
    great: !!day.great_turn,

    // NAMES stay Portuguese
    day_name: ed.pt_name || day.name,
    day_name_is_pt: !!ed.pt_name,
    name_pt: p.name_local.pt,
    name_en: p.name_en,

    // PROSE switches to English
    epithet_en: (day.working_name || '').replace(' / ', ', '),
    selection_en: p.selection || '',
    selection_pt: p.selection_local?.pt || '',

    // FURNITURE stays Portuguese
    opens_pt: ptDate(day.opens),
    closes_pt: ptDate(addDays(day.opens, day.days)),
    days: day.days,
    pill_pt: state === 'peak' ? 'NO AUGE' : 'NA BANCA',
    peak_pt: pk ? peakLine(pk.peak_from, pk.peak_to) : null,

    // assets + provenance
    id,
    plate: p.illustration,
    state,
    provenance: p.provenance || 'none',
    resolution: p.resolution || 'quarter',
  };
});

const missingPt = cards.filter((c) => !c.selection_pt).map((c) => c.numeral);
const missingEn = cards.filter((c) => !c.selection_en).map((c) => c.numeral);

process.stdout.write(JSON.stringify({
  built: new Date().toISOString().slice(0, 10),
  language_rule: 'prose EN, names PT, furniture PT',
  warnings: { missing_selection_pt: missingPt, missing_selection_en: missingEn },
  cards,
}, null, 2) + '\n');
