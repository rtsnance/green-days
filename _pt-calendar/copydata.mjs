import { readFileSync } from 'node:fs';
import { seasonalityOf } from '../src/season.js';
const P = JSON.parse(readFileSync(new URL('../data/produce.json', import.meta.url)));
const D = JSON.parse(readFileSync(new URL('../data/turning-days.json', import.meta.url))).days;
const ED = JSON.parse(readFileSync(new URL('./pt-days.json', import.meta.url))).days;
const byId = Object.fromEntries(P.map(p => [p.id, p]));
const ROSTER = {I:'asparagus',II:'beetroot',III:'leek',IV:'cucumber',V:'loquat-nespera',VI:'rhubarb',
 VII:'tomato',VIII:'avocado',IX:'aubergine',X:'cherry',XI:'plum',XII:'greengage',XIII:'apricot',
 XIV:'apple',XV:'grapes-black',XVI:'pumpkin',XVII:'persimmon-kaki',XVIII:'medlar',XIX:'chestnut',
 XX:'orange',XXI:'golden-beetroot',XXII:'turnip',XXIII:'chard',XXIV:'kiwi'};
const MES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const EN=['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt=(m,d,arr)=>`${d} ${arr===MES?'de ':''}${arr[m-1]}`;
const add=(mmdd,n)=>{const[m,d]=mmdd.split('-').map(Number);const t=new Date(Date.UTC(2026,m-1,d));t.setUTCDate(t.getUTCDate()+n-1);return[t.getUTCMonth()+1,t.getUTCDate()];};
for (const day of D) {
  const id = ROSTER[day.numeral]; const p = byId[id]; const ed = ED[String(day.num)]||{};
  const s = seasonalityOf(p, day.opens, 'mediterranean');
  const [om,od]=day.opens.split('-').map(Number); const [cm,cd]=add(day.opens, day.days);
  const pk=(p.season_ranges?.mediterranean||[]).find(r=>r.peak_from);
  console.log(JSON.stringify({
    n: day.numeral, num: day.num,
    day_pt: ed.pt_name || null, day_en: day.name, epi_pt: ed.epithet_pt, epi_en: day.working_name,
    opens_pt: fmt(om,od,MES), opens_en: fmt(om,od,EN), closes_pt: fmt(cm,cd,MES), closes_en: fmt(cm,cd,EN),
    days: day.days, great: !!day.great_turn,
    id, pt: p.name_local.pt, en: p.name_en, state: s,
    peak: pk ? `${pk.peak_from} to ${pk.peak_to}` : null,
    selection: p.selection,
    selection_pt: p.selection_local?.pt || null
  }));
}
