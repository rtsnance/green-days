/* Builds the 24-card Portuguese postcard set as ONE self-contained HTML file
   holding 48 pages (24 fronts, 24 backs), plates inlined as data URIs.

   Why one file: rendering needs headless Chromium, which lives in the cloud
   container and not on this machine, so the artefact has to cross the bridge in
   a single transfer. Nothing here reaches the network.

   Page geometry: A6 portrait 105 x 148 mm, plus 3 mm bleed on every side, at
   300 dpi.  ->  1311 x 1819 px.  Trim sits 3 mm in; the safe box is 5 mm inside
   trim, so 8 mm from the page edge.

   Language rule (see postcards-data.mjs): prose EN, names PT, furniture PT.

   Run:  node _pt-calendar/postcards-data.mjs > _pt-calendar/postcards.json
         node _pt-calendar/postcards.mjs      > _pt-calendar/postcards.html
*/
import { readFileSync } from 'node:fs';

const DATA = JSON.parse(readFileSync(new URL('./postcards.json', import.meta.url)));
const SPROUT = readFileSync(new URL('./sprout.txt', import.meta.url), 'utf8').trim();

/* Names as they should read on a card, not as the catalogue files them. */
const DISPLAY_EN = { 'grapes-black': 'Black grapes', 'persimmon-kaki': 'Persimmon' };
/* No em dashes anywhere in Ryan's work. Working names carry a few. */
const clean = (s) => s.replace(/\s*[—–]\s*/g, ', ').replace(/,\s*,/g, ',').trim();

const MM = 300 / 25.4;              // px per mm at 300 dpi
const mm = (v) => `${(v * MM).toFixed(2)}px`;
const PAGE_W = 111, PAGE_H = 154;   // with bleed
/* Pin the page to whole pixels. Rounding 111 mm at 300 dpi gives 1311.02, and a
   screenshot rounds the element box up, so an unpinned page ships as 1312 x 1820
   and every spec sheet then carries a number nobody meant. */
const PAGE_PX_W = Math.round(PAGE_W * MM), PAGE_PX_H = Math.round(PAGE_H * MM);
const BLEED = 3, SAFE = 5, EDGE = BLEED + SAFE;

const plateURI = (name) => {
  const buf = readFileSync(new URL(`../public/assets/produce/${name}@3x.png`, import.meta.url));
  return `data:image/png;base64,${buf.toString('base64')}`;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const wordmark = `
<span class="wm">
  <span class="wm-t">green</span>
  <svg class="wm-s" viewBox="0 0 573 613" aria-hidden="true"><path d="${SPROUT}" fill="#529d7f"/></svg>
  <span class="wm-t">days</span>
</span>`;

const front = (c) => `
<section class="page front" id="f-${c.numeral}">
  <div class="safe">
    <header class="f-head">
      <div class="mono place">PORTUGAL &middot; ${esc(c.opens_pt.toUpperCase())}</div>
      <div class="spec">
        <span class="spec-dot"></span>
        <span class="spec-txt">
          <span class="mono spec-label">ESP&Eacute;CIME</span>
          <span class="mono spec-num">N.&ordm; ${c.specimen}</span>
        </span>
      </div>
    </header>

    <div class="f-plate">
      <img src="${plateURI(c.plate)}" alt="">
    </div>

    <div class="f-name">
      <div class="name-pt">${esc(c.name_pt)}</div>
      <div class="name-en">${esc(DISPLAY_EN[c.id] || c.name_en)}</div>
      <div class="pill mono">${esc(c.pill_pt)}</div>
    </div>

    <footer class="f-foot">
      <div class="rule"></div>
      <div class="f-foot-row">
        <div class="day-name">${esc(c.day_name)}</div>
        <div class="numeral">${c.numeral}</div>
      </div>
      <div class="epithet">${esc(clean(c.epithet_en))}</div>
    </footer>
  </div>
</section>`;

const back = (c) => `
<section class="page back" id="b-${c.numeral}">
  <div class="safe">
    <div class="mono b-head">${c.numeral} &middot; ${esc(c.opens_pt.toUpperCase())} A ${esc(c.closes_pt.toUpperCase())} &middot; ${c.days} DIAS</div>
    <h1 class="b-title">${esc(c.name_pt)}</h1>
    ${c.peak_pt ? `<div class="b-peak">${esc(c.peak_pt)}</div>` : `<div class="b-peak b-peak-empty">&nbsp;</div>`}

    <div class="b-body">
      <div class="b-left">
        <div class="mono b-label">COMO ESCOLHER</div>
        <div class="hair"></div>
        <p class="sel-en">${esc(c.selection_en)}</p>
        <p class="sel-pt">${esc(c.selection_pt)}</p>
      </div>
      <div class="b-split"></div>
      <div class="b-right">
        <div class="stamp"><span class="mono">SELO</span></div>
        <div class="addr-wrap"><div class="addr"><i></i><i></i><i></i><i></i><i></i></div></div>
      </div>
    </div>

    <footer class="b-foot">
      <div class="mono attrib">
        &Eacute;poca verificada contra a produ&ccedil;&atilde;o nacional portuguesa.<br>
        APN, Calend&aacute;rios de Produ&ccedil;&atilde;o Nacional<br>
        DECO PROteste
      </div>
      <div class="brand">
        ${wordmark}
        <div class="mono url">greendays.day</div>
      </div>
    </footer>
  </div>
</section>`;

const css = `
:root{
  --ink:#1f3661; --seagrass:#529d7f; --green:#35735b; --muted:#4d606b;
  --ground:#fcf8ee; --gold:#a88024; --paprika:#b23c1a; --line:#d5ece6;
  --divider:#ddd3bb; --pill:#e4efe6; --hair:#c9d6dd; --writeline:#a9b8c1;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#8a8a8a}
.page{
  width:${PAGE_PX_W}px; height:${PAGE_PX_H}px;
  background:var(--ground); position:relative; overflow:hidden;
  font-family:'Poppins',sans-serif; color:var(--ink);
  page-break-after:always;
}
.safe{position:absolute; left:${mm(EDGE)}; top:${mm(EDGE)};
      width:${mm(PAGE_W - 2 * EDGE)}; height:${mm(PAGE_H - 2 * EDGE)};
      display:flex; flex-direction:column}
.mono{font-family:'DejaVu Sans Mono',monospace}

/* ---------- front ---------- */
.f-head{display:flex; justify-content:space-between; align-items:flex-start}
.place{font-size:${mm(2.15)}; font-weight:700; letter-spacing:.16em; color:var(--muted); padding-top:${mm(1.6)}}
.spec{border:2px solid var(--ink); display:flex; align-items:stretch; height:${mm(10.4)}}
.spec-dot{width:${mm(5.5)}; display:flex; align-items:center; justify-content:center; border-right:2px solid var(--ink)}
.spec-dot::after{content:''; width:${mm(1.3)}; height:${mm(1.3)}; border:2px solid var(--ink); border-radius:50%}
.spec-txt{display:flex; flex-direction:column; justify-content:center; padding:0 ${mm(2.6)}}
.spec-label{font-size:${mm(1.7)}; letter-spacing:.18em; color:var(--muted)}
.spec-num{font-size:${mm(3.4)}; font-weight:700; letter-spacing:.06em; color:var(--ink); margin-top:${mm(.5)}}

.f-plate{flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding-bottom:${mm(2)}}
.f-plate img{width:${mm(64)}; height:${mm(64)}; object-fit:contain; display:block}

.f-name{text-align:center; padding-bottom:${mm(6)}}
.name-pt{font-size:${mm(8.6)}; font-weight:700; line-height:1.06; letter-spacing:-.01em}
.name-en{font-size:${mm(3.5)}; font-weight:700; color:var(--muted); margin-top:${mm(1.4)}}
.pill{display:inline-block; margin-top:${mm(2.2)}; background:var(--pill); color:var(--green);
  font-size:${mm(2.2)}; font-weight:700; letter-spacing:.2em; padding:${mm(1.3)} ${mm(3.4)} ${mm(1.1)};
  border-radius:999px}

.f-foot .rule{height:2px; background:var(--ink); margin-bottom:${mm(2.6)}}
.f-foot-row{display:flex; justify-content:space-between; align-items:baseline}
.day-name{font-size:${mm(4.3)}; font-weight:700; line-height:1.12; max-width:${mm(74)}}
.numeral{font-size:${mm(4)}; font-weight:700; color:var(--seagrass); letter-spacing:.04em}
.epithet{font-size:${mm(3.1)}; font-weight:700; font-style:italic; color:var(--paprika); margin-top:${mm(1.2)}}

/* ---------- back ---------- */
.b-head{font-size:${mm(2.15)}; font-weight:700; letter-spacing:.16em; color:var(--muted)}
.b-title{font-size:${mm(7.2)}; font-weight:700; line-height:1.08; margin-top:${mm(2.2)}}
.b-peak{font-size:${mm(3.1)}; font-weight:700; font-style:italic; color:var(--paprika); margin-top:${mm(1.4)}}
.b-peak-empty{visibility:hidden}

.b-body{flex:1; display:flex; margin-top:${mm(9)}}
.b-left{width:${mm(45)}}
.b-label{font-size:${mm(2)}; font-weight:700; letter-spacing:.18em; color:var(--muted)}
.hair{height:1px; background:var(--hair); margin:${mm(1.6)} 0 ${mm(3.4)}}
.sel-en{font-size:${mm(3.9)}; font-weight:700; line-height:1.34}
.sel-pt{font-size:${mm(2.7)}; font-weight:600; font-style:italic; line-height:1.42; color:var(--muted); margin-top:${mm(3.2)}}
.b-split{width:1px; background:var(--hair); margin:0 ${mm(5)}}
.b-right{flex:1; display:flex; flex-direction:column}
.addr-wrap{margin-top:auto; padding-bottom:${mm(4)}}
.stamp{align-self:flex-end; width:${mm(18)}; height:${mm(22)}; border:1px dashed var(--hair);
  display:flex; align-items:center; justify-content:center}
.stamp .mono{font-size:${mm(2)}; letter-spacing:.2em; color:#bcc7ce}
.addr{}
.addr i{display:block; height:1px; background:var(--writeline); margin-bottom:${mm(7.5)}}

.b-foot{display:flex; justify-content:space-between; align-items:flex-end; gap:${mm(4)}}
.attrib{font-size:${mm(2.05)}; line-height:1.7; color:var(--muted); max-width:${mm(58)}}
.brand{text-align:right}
.wm{display:flex; align-items:center; gap:${mm(1.6)}; justify-content:flex-end}
.wm-t{font-size:${mm(6)}; font-weight:700; color:var(--green); letter-spacing:-.01em}
.wm-s{width:${mm(5.4)}; height:${mm(5.8)}}
.url{font-size:${mm(2.6)}; color:var(--muted); margin-top:${mm(1)}}
`;

const pages = DATA.cards.map((c) => front(c) + back(c)).join('\n');

process.stdout.write(`<!doctype html>
<html lang="pt"><head><meta charset="utf-8">
<title>Green Days &middot; 24 postais</title>
<style>${css}</style>
</head><body>
${pages}
</body></html>
`);
