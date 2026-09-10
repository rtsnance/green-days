/* O ano de mercado português — generator.
   Nothing is hand-written into the output. Reads:
     data/produce.json         (season ranges, PT names, illustration ids)
     data/turning-days.json    (the 24 days, canon)
     _pt-calendar/pt-days.json (Portuguese editorial layer: names, epithets, lore)
   and recomputes every roster with the shipped seasonalityOf, mediterranean band.

   Two outputs from one source: a page for greendays.day, and a print stylesheet
   that breaks one turning day per page for the PDF.

   node scripts/build-pt-calendar.mjs [--embed] [--out DIR]
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { seasonalityOf } from '../src/season.js';

const R = (p) => new URL(p, import.meta.url);
const produce = JSON.parse(readFileSync(R('../data/produce.json')));
const canon   = JSON.parse(readFileSync(R('../data/turning-days.json'))).days;
const ptDays  = JSON.parse(readFileSync(R('../_pt-calendar/pt-days.json'))).days;
const EMBED   = process.argv.includes('--embed');
const OUT     = (process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out')+1] : '_pt-calendar/dist');

const BAND = 'mediterranean';
const byId = Object.fromEntries(produce.map(p => [p.id, p]));
const pt   = (id) => byId[id]?.name_local?.pt || byId[id]?.name_en || id;
const ill  = (id) => byId[id]?.illustration || null;

const state = (mmdd) => {
  const inn = [], peak = [];
  for (const p of produce) {
    const s = seasonalityOf(p, mmdd, BAND);
    if (s === 'in' || s === 'peak') inn.push(p.id);
    if (s === 'peak') peak.push(p.id);
  }
  return { inn: new Set(inn), peak };
};

const MES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const dataPT = (mmdd) => { const [m,d] = mmdd.split('-').map(Number); return `${d} de ${MES[m-1]}`; };

const img = (illId) => {
  if (!illId) return '';
  const rel = `img/${illId}.png`;
  if (!EMBED) return `<img class="gd-ill" src="${rel}" alt="">`;
  const f = R(`../_pt-calendar/img/${illId}.png`);
  if (!existsSync(f)) return '';
  return `<img class="gd-ill" src="data:image/png;base64,${readFileSync(f).toString('base64')}" alt="">`;
};

/* A featured item whose print has not been cut yet gets a named empty frame. The
   absence is visible and labelled instead of silent. */
const plate = (id) => {
  const i = ill(id);
  if (i) return img(i);
  return `<span class="gd-ill gd-pending" title="gravura por cortar">${pt(id)}</span>`;
};

const rows = [];
for (let i = 0; i < canon.length; i++) {
  const d = canon[i], prev = canon[(i - 1 + canon.length) % canon.length];
  const now = state(d.opens), before = state(prev.opens);
  rows.push({
    d, ed: ptDays[String(d.num)] || {},
    total: now.inn.size, peak: now.peak, inSeason: now.inn,
    entra: [...now.inn].filter(x => !before.inn.has(x)),
    sai:   [...before.inn].filter(x => !now.inn.has(x)),
  });
}
const maxTotal = Math.max(...rows.map(r => r.total));

/* The canon name may already carry the Portuguese half ("Martinmas / São Martinho").
   Show only the part the Portuguese title does not already say. */
const altOf = (d, ed) => {
  if (!ed.pt_name) return '';
  const parts = d.name.split(' / ').map(x => x.trim()).filter(x => x !== ed.pt_name);
  const alt = parts.join(' / ');
  return alt && alt !== ed.pt_name ? alt : '';
};

const CAP = 12;

/* THE GUARD. Added 2026-09-01 after the panel table showed that eight turnings
   had nothing entering or leaving, and that all eight sat in windows containing
   no 1st of a month. The emptiness was an artifact of source grain, not a fact
   about Portugal.

   Most Portuguese ranges come from calendars that speak in whole months, so
   they can only ever place a change on the 1st. A 24-day grid reading a
   12-bucket model produces a dated claim the data cannot support. An item whose
   boundary is month-grain is marked, and the page says which day it can and
   cannot vouch for. Nothing is hidden: the reader is told the resolution.        */
const resOf = (id) => byId[id]?.resolution || 'quarter';
const isSoft = (id) => resOf(id) !== 'half-month';

const list = (ids, cls) => ids.length
  ? `<ul class="gd-list ${cls}">`
      + ids.slice(0, CAP).map(id => `<li${isSoft(id) ? ' class="is-soft"' : ''}>${pt(id)}</li>`).join('')
      + (ids.length > CAP ? `<li class="gd-more">e mais ${ids.length - CAP}</li>` : '')
      + `</ul>`
  : `<p class="gd-none">nada</p>`;

const section = (r) => {
  const { d, ed } = r;
  /* Featured ids come from the editorial layer and are ASSERTED to be in season on
     the day: naming something the data says is absent would be the exact failure this
     calendar exists to avoid. A featured item with no linocut yet renders as a named
     empty frame rather than disappearing, which is how chestnut vanished from the
     magusto in the first draft. */
  const featured = (ed.featured || []).filter(id => {
    if (!r.inSeason.has(id)) { console.warn(`  ! ${d.numeral}: featured "${id}" is NOT in season on ${d.opens} — dropped`); return false; }
    return true;
  });
  const rest = [...r.peak, ...r.entra].filter(id => !featured.includes(id));
  const seen = new Set();
  const uniq = [...featured, ...rest].filter(id => { const k = ill(id) || id; return !seen.has(k) && seen.add(k); }).slice(0, 6);
  const lore = ed.lore_pt || ed.lore_en
    ? `<blockquote class="gd-lore${ed.lore_lang === 'en' ? ' is-en' : ''}">
         ${ed.lore_pt ? `<p class="gd-lore-pt">${ed.lore_pt}</p>` : ''}
         ${ed.lore_en ? `<p class="gd-lore-en">${ed.lore_en}</p>` : ''}
         <cite>${ed.lore_src || ''}</cite>
       </blockquote>` : '';
  return `
<section class="gd-day${d.great_turn ? ' is-great' : ''}" id="dia-${d.num}">
  <header class="gd-head">
    <span class="gd-num">${d.numeral}</span>
    <div class="gd-titles">
      <h2>${ed.pt_name || d.name}${altOf(d, ed) ? `<span class="gd-alt">${altOf(d, ed)}</span>` : ''}</h2>
      <p class="gd-epi">${ed.epithet_pt}</p>
    </div>
    <div class="gd-when">
      <span class="gd-date">${dataPT(d.opens)}</span>
      <span class="gd-span">${d.days} dias</span>
      ${d.great_turn ? '<span class="gd-great">viragem maior</span>' : ''}
    </div>
  </header>
  ${ed.note_pt ? `<p class="gd-note">${ed.note_pt}</p>` : ''}
  ${uniq.length ? `<div class="gd-plates">${uniq.map(plate).join('')}</div>` : ''}
  ${lore}
  ${(!r.peak.length && !r.entra.length && !r.sai.length)
    ? `<p class="gd-still">Nada entra e nada sai <em>que as nossas fontes consigam ver</em>. Os calendários portugueses falam em meses inteiros, e esta viragem não atravessa o dia 1.</p>`
    : `<div class="gd-cols">
    <div><h3>No seu auge</h3>${list(r.peak, 'is-peak')}</div>
    <div><h3>Entra</h3>${list(r.entra, 'is-in')}</div>
    <div><h3>Sai</h3>${list(r.sai, 'is-out')}</div>
  </div>
  ${[...r.entra, ...r.sai].length && [...r.entra, ...r.sai].every(isSoft)
    ? `<p class="gd-soft">Nenhuma destas datas é mais fina do que o mês. A mudança dá-se algures nesta viragem, não neste dia.</p>` : ''}`}
  <p class="gd-count"><b>${r.total}</b> coisas na banca<span class="gd-bar" style="--w:${Math.round(r.total / maxTotal * 100)}%"></span></p>
</section>`;
};

const CSS = `
:root{
  --ink:#1f3661; --muted:#4d606b; --accent:#35735b; --paprika:#c9410f;
  --gold:#a88024; --line:#d5ece6; --paper:#fcf8ee; --rule:#cdd6dd;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font:16px/1.55 Nunito,-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.gd-wrap{max-width:52rem;margin:0 auto;padding:3rem 1.5rem 5rem}
.gd-cover{border-bottom:2px solid var(--ink);padding-bottom:2.5rem;margin-bottom:3rem}
.gd-cover h1{font-size:2.6rem;line-height:1.1;margin:0 0 .4rem;letter-spacing:-.01em}
.gd-cover .gd-sub{font-size:1.1rem;color:var(--muted);margin:0 0 1.6rem}
.gd-vantage{font:600 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.14em;
  text-transform:uppercase;color:var(--accent)}
.gd-intro{font-size:1rem;color:var(--muted);max-width:38rem}
.gd-intro strong{color:var(--ink)}

.gd-day{padding:2.2rem 0;border-bottom:1px solid var(--rule)}
.gd-day.is-great{border-bottom-width:2px;border-bottom-color:var(--ink)}
.gd-head{display:grid;grid-template-columns:3.2rem 1fr auto;gap:1rem;align-items:baseline}
.gd-num{font:700 1.5rem/1 "JetBrains Mono",ui-monospace,monospace;color:var(--accent)}
.gd-titles h2{font-size:1.45rem;margin:0;line-height:1.15}
.gd-alt{display:block;font-size:.8rem;font-weight:400;color:var(--muted);letter-spacing:.02em;margin-top:.15rem}
.gd-epi{margin:.35rem 0 0;color:var(--paprika);font-style:italic}
.gd-when{text-align:right;font:600 11px/1.5 "JetBrains Mono",ui-monospace,monospace;
  letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.gd-when span{display:block}
.gd-great{color:var(--gold)}
.gd-note{margin:.9rem 0 0 4.2rem;font-size:.9rem;color:var(--muted)}

.gd-plates{display:flex;gap:.6rem;flex-wrap:wrap;margin:1.4rem 0 0 4.2rem}
.gd-ill{width:88px;height:88px;object-fit:contain}

.gd-lore{margin:1.4rem 0 0 4.2rem;padding:.1rem 0 .1rem 1rem;border-left:3px solid var(--line)}
.gd-lore p{margin:0}
.gd-lore-pt{font-size:1.05rem}
.gd-lore-en{color:var(--muted);font-style:italic;font-size:.95rem;margin-top:.2rem!important}
.gd-lore.is-en .gd-lore-en{font-style:normal;color:var(--ink);font-size:1.05rem}
.gd-lore cite{display:block;margin-top:.5rem;font:400 11px/1.45 "JetBrains Mono",ui-monospace,monospace;
  color:var(--muted);font-style:normal}

.gd-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:1.4rem;margin:1.5rem 0 0 4.2rem}
.gd-cols h3{font:600 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;
  text-transform:uppercase;color:var(--muted);margin:0 0 .5rem;padding-bottom:.4rem;
  border-bottom:1px solid var(--rule)}
.gd-list{list-style:none;margin:0;padding:0;font-size:.92rem}
.gd-list li{padding:.12rem 0}
.gd-list.is-peak li{color:var(--gold);font-weight:600}
.gd-list.is-out li{color:var(--muted)}
.gd-none{margin:0;color:var(--muted);font-size:.92rem;font-style:italic}

.gd-more{color:var(--muted);font-style:italic}
.gd-still{margin:1.4rem 0 0 4.2rem;color:var(--muted);font-style:italic}
.gd-soft{margin:.8rem 0 0 4.2rem;font-size:.8rem;color:var(--muted)}
.gd-list li.is-soft::after{content:"~";color:var(--muted);font-size:.75em;vertical-align:super;margin-left:.15em}
.gd-pending{display:inline-flex;align-items:center;justify-content:center;text-align:center;
  border:1px dashed var(--rule);color:var(--muted);font-size:.62rem;line-height:1.2;
  padding:.3rem;font-style:italic}
.gd-count{margin:1.3rem 0 0 4.2rem;font-size:.85rem;color:var(--muted);
  display:flex;align-items:center;gap:.7rem}
.gd-count b{color:var(--ink);font-size:1.05rem}
.gd-bar{flex:1;height:3px;background:var(--line);position:relative;max-width:14rem}
.gd-bar::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);background:var(--accent)}

.gd-colophon{margin-top:3.5rem;padding-top:2rem;border-top:2px solid var(--ink);
  font-size:.88rem;color:var(--muted)}
.gd-colophon h2{font-size:1.1rem;color:var(--ink);margin:0 0 .8rem}
.gd-colophon h3{font-size:.88rem;color:var(--ink);margin:1.4rem 0 .4rem}
.gd-colophon ul{margin:.3rem 0;padding-left:1.1rem}
.gd-colophon a{color:var(--accent)}

@media print{
  @page{size:A4;margin:16mm}
  body{background:#fff;font-size:10.5pt}
  .gd-wrap{max-width:none;padding:0}
  .gd-day{break-inside:avoid;page-break-inside:avoid;padding:0 0 1.4rem}
  .gd-cover{break-after:page}
  .gd-colophon{break-before:page}
  .gd-ill{width:64px;height:64px}
  .gd-bar{display:none}
}
@media (max-width:640px){
  .gd-head{grid-template-columns:2.4rem 1fr}
  .gd-when{grid-column:2;text-align:left;margin-top:.4rem}
  .gd-cols{grid-template-columns:1fr;margin-left:0}
  .gd-plates,.gd-lore,.gd-note,.gd-count{margin-left:0}
}
`;

const COVER = `
<header class="gd-cover">
  <p class="gd-vantage">Nomeado a partir de Lisboa</p>
  <h1>O ano de mercado português</h1>
  <p class="gd-sub">Vinte e quatro viragens, e o que está na banca em cada uma</p>
  <div class="gd-intro">
    <p>Este calendário não conta meses. Conta <strong>viragens</strong>: os vinte e quatro dias
    do ano europeu em que alguma coisa muda na banca. Alguns são portugueses e guardam-se cá: São João, Santiago, São Martinho, São Vicente. Outros são galeses, ingleses, alemães
    ou catalães, e ficam com o nome que têm, porque não seria honesto dar-lhes um nome português
    que ninguém usa.</p>
    <p>Para cada viragem: o que está no seu auge, o que entra, o que sai, e quantas coisas
    estão na banca nesse dia. As datas são as da <strong>produção nacional portuguesa</strong>,
    não as da disponibilidade nas lojas.</p>
  </div>
</header>`;

const COLOPHON = `
<footer class="gd-colophon">
  <h2>De onde vêm estas datas</h2>
  <p>As épocas foram verificadas em 1 de setembro de 2026 contra fontes portuguesas publicadas.
  Antes disso eram deduzidas de etiquetas em inglês, e estavam erradas em vinte e cinco casos.</p>
  <h3>Fontes</h3>
  <ul>
    <li><b>Aliança contra a Fome e a Má-nutrição / APN</b>, <i>Calendários de Produção Nacional</i>, 2021. Produção nacional. É a espinha deste calendário.</li>
    <li><b>DECO PROteste</b>, <i>Fruta e legumes da época: calendário anual</i>, atualizado a 24-09-2024.</li>
    <li><b>Continente</b>, <i>Fruta e legumes da época</i>, atualizado a 25-01-2024. Lista de retalho: as importações foram retiradas à mão.</li>
  </ul>
  <h3>O que ainda não sabemos</h3>
  <ul>
    <li>A <b>rainha-cláudia</b>: os calendários publicados põem-na dentro da ameixa, de junho a setembro. A banca de Lisboa já não a tinha a 18 de agosto de 2026. Não sabemos quem tem razão.</li>
    <li>A <b>azeitona</b>: a apanha dá-se entre novembro e janeiro, mas a azeitona verde de mesa colhe-se antes, e essa janela não está verificada.</li>
    <li>Onde <b>duas</b> fontes nacionais discordam em exatamente um mês, a data ficou entre as duas, a meio do mês, e está marcada com <span class="gd-tilde">~</span>. Onde discordam em mais do que isso, ficou a produção nacional e a discordância manteve-se.</li>
    <li>Um <span class="gd-tilde">~</span> quer dizer: a fonte fala em meses inteiros, por isso sabemos o mês e não o dia.</li>
  </ul>
  <p><b>Se alguma destas datas estiver errada, quem sabe são os produtores.</b>
  Diga-nos e corrigimos: <a href="https://greendays.day">greendays.day</a></p>
</footer>`;

const html = `<!doctype html>
<html lang="pt-PT"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>O ano de mercado português · Green Days</title>
<meta name="description" content="Vinte e quatro viragens do ano de mercado português, com o que entra e o que sai em cada uma. Datas da produção nacional.">
<style>${CSS}</style>
</head><body><div class="gd-wrap">
${COVER}
${rows.map(section).join('\n')}
${COLOPHON}
</div></body></html>`;

mkdirSync(new URL('../' + OUT + '/', import.meta.url), { recursive: true });
writeFileSync(new URL('../' + OUT + '/index.html', import.meta.url), html);
console.log(`${rows.length} turning days rendered`);
console.log(`PT names: ${rows.filter(r => r.ed.pt_name).length}/24   lore: ${rows.filter(r => r.ed.lore_pt || r.ed.lore_en).length}/24`);
console.log(`densest: ${rows.reduce((a,b)=>b.total>a.total?b:a).d.numeral} at ${maxTotal}`);
console.log(`wrote ${OUT}/index.html  (${(html.length/1024).toFixed(0)} KB, embed=${EMBED})`);
