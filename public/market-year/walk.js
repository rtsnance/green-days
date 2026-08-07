/* The Greengage Line — a first-person walk through the market year.
 *
 * Ported from the Claude Design build (Greengage Line.dc.html, 7 Aug 2026) to a
 * plain ES module: no React, no DC runtime, no unpkg. Engine behaviour is
 * unchanged except for the seven fixes listed in README.md § "Changed in the port".
 *
 *   import { mount } from './walk.js';
 *   const walk = mount(document.getElementById('gg-root'), { mode: 'daylight' });
 *   walk.goToDay(14);      // XIV St Bartholomew, nearest occurrence
 *   walk.setOptions({ mode: 'dusk' });
 *   walk.destroy();
 *
 * Canvas draws ground only. Plates are DOM — that split is load-bearing: it is
 * what gives correct box collision, real CSS letter-spacing, selectable text,
 * screen-reader content and a crawlable page.
 */

import { DAYS, MISSING_PLATES } from './turning-days.js';
import { THEMES, SEASON_HUE, GEOM, MOTION } from './theme.js';

const DAY = 864e5;
const HAS_PLATE = s => !MISSING_PLATES.includes(s);

/* One predicate for ground, plates and rack alike. Strict `>` so a turning day
   itself reads as underfoot on every surface: TODAY and every mark are pinned to
   12:00, so on the day they are exactly equal. */
export const stateOf = (t0, t1, now) => (t1 <= now ? -1 : (t0 > now ? 1 : 0));

/* "7 Aug 2026". toDateString() is too long for the rack's bays and was being
   ellipsised down to "FRI AUG 07 2…" — a calendar that could not print its year. */
const FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmt = t => FMT.format(new Date(t));

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* ------------------------------------------------------------------ markup */

const HUD_HTML = `
<canvas data-gg="canvas" aria-label="A first-person walk through the 24 turning days of the European market year. The same information is listed in text below." style="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;pointer-events:auto"></canvas>

<div data-gg="layer" aria-hidden="true" style="position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1"></div>

<div data-gg="mast" style="position:absolute;z-index:20;bottom:24px;left:26px;right:26px;border-radius:18px;background:var(--gg-plate);display:flex;align-items:stretch;overflow:hidden;pointer-events:auto">

  <div style="flex:0 1 auto;min-width:0;padding:15px 26px 15px 22px;display:flex;flex-direction:column;gap:5px">
    <div style="display:flex;align-items:baseline;gap:12px;white-space:nowrap">
      <div style="font-family:'JetBrains Mono',monospace;font-weight:600;font-size:10px;letter-spacing:.20em;text-transform:uppercase;color:var(--gg-muted)">Underfoot</div>
      <div data-gg="cardno" style="font-family:'JetBrains Mono',monospace;font-weight:500;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gg-muted)">Card — of XXIV</div>
    </div>
    <div data-gg="herename" style="font-size:26px;font-weight:800;line-height:1.05;letter-spacing:-.015em;color:var(--gg-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">—</div>
    <div data-gg="hereday" style="font-family:'JetBrains Mono',monospace;font-weight:500;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--gg-muted);white-space:nowrap">—</div>
  </div>

  <div data-gg="mid" style="flex:0 1 auto;min-width:0;padding:15px 26px 15px 22px;display:flex;flex-direction:column;gap:5px;border-left:1px solid var(--gg-line)">
    <div style="font-family:'JetBrains Mono',monospace;font-weight:600;font-size:10px;letter-spacing:.20em;text-transform:uppercase;color:var(--gg-muted)">Across the year</div>
    <div data-gg="across" style="font-size:26px;font-weight:700;line-height:1.05;letter-spacing:-.015em;color:var(--gg-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">—</div>
    <div data-gg="acrossin" style="font-family:'JetBrains Mono',monospace;font-weight:500;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--gg-muted);white-space:nowrap">—</div>
  </div>

  <div style="flex:1 1 auto;padding:15px 22px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;gap:10px;border-left:1px solid var(--gg-line)">
    <div style="display:flex;gap:8px">
      <button data-gg="today" type="button" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;background:transparent;color:var(--gg-muted);border:1px solid var(--gg-line);border-radius:999px;padding:8px 14px;cursor:pointer">Back to today</button>
      <button data-gg="walk" type="button" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;background:var(--gg-accent);color:var(--gg-plate);border:1px solid var(--gg-accent);border-radius:999px;padding:8px 18px;cursor:pointer">Walk</button>
    </div>
    <div data-gg="hint" style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:var(--gg-muted)">Drag to look · scroll or ↑↓ to walk · T for today</div>
    <div data-gg="brand" style="display:flex;align-items:baseline;gap:9px">
      <div style="font-size:19px;font-weight:800;letter-spacing:-.01em;color:var(--gg-accent)">green days</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;color:var(--gg-muted)">greendays.day</div>
    </div>
  </div>
</div>

<div data-gg="strip" role="group" aria-label="Jump to a turning day" style="display:none;position:absolute;z-index:20;left:0;right:0;bottom:0;height:56px;background:var(--gg-plate);align-items:center;gap:0;padding:0 8px;touch-action:none;pointer-events:auto;overflow:hidden"></div>
`;

/* ------------------------------------------------------------------- plate */

function plateHTML(m, st, P, showYear, platePath) {
  const spent = st < 0, here = st === 0;
  const bg    = spent ? P.spentBg    : P.bg;
  const frame = spent ? P.spentFrame : P.frame;
  const inner = spent ? P.spentFrame : P.inner;
  const ink   = spent ? P.spentInk   : (here ? P.here : P.name);
  const meta  = spent ? P.spentInk   : P.meta;
  const epiC  = spent ? P.spentEpi   : P.epi;
  const rule  = spent ? P.spentFrame : P.rule;

  /* Silhouettes come from the day's OWN plate_candidates. Anything without an
     asset yet renders as nothing — never a substitute. A pumpkin on a January
     sign is a factual error on a produce calendar, not a placeholder. */
  const sil = (m.sil || []).filter(HAS_PLATE).map(s =>
    `<img src="${platePath}${s}.png" alt="" loading="lazy" style="height:34px;width:auto;display:block;${spent ? 'opacity:.45;filter:grayscale(1)' : ''}">`
  ).join('');

  const strike = spent
    ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%"><line x1="3" y1="97" x2="97" y2="3" stroke="${P.strike}" stroke-width="2.5" vector-effect="non-scaling-stroke"></line></svg>`
    : '';

  const yr = showYear
    ? `<span style="color:${P.gold};font-weight:700">${m.year}</span>`
    : `<span>${esc(m.season)}</span>`;

  /* Saint-lore ahead, the produce clause underfoot and behind. Canon carries a
     second clause on only 11 of 24 days; where it doesn't, `produce` is null and
     the lore stands in both states rather than the alternation silently failing. */
  const epithet = (st > 0 || !m.produce) ? m.lore : m.produce;

  return `<div style="position:relative;background:${bg};border:${m.great ? 3.5 : 3}px solid ${frame};border-radius:15px;padding:9px;box-shadow:0 8px 22px rgba(31,54,97,.18)">
  <div style="border:1px solid ${inner};border-radius:9px;padding:11px 22px 12px;text-align:center;min-width:190px">
    <div style="font-family:'JetBrains Mono',monospace;font-weight:600;font-size:12px;letter-spacing:.34em;color:${meta};margin-bottom:3px">${esc(m.numeral)}</div>
    <div style="font-weight:${m.great ? 800 : 700};font-size:${m.great ? 34 : 31}px;line-height:1.02;letter-spacing:-.018em;color:${ink};white-space:nowrap">${esc(m.name)}</div>
    ${sil ? `<div style="display:flex;gap:11px;justify-content:center;align-items:flex-end;margin:11px 0 2px">${sil}</div>` : ''}
    <div style="font-family:'Annie Use Your Telescope',cursive;font-size:22px;line-height:1.05;color:${epiC};margin-top:6px;max-width:300px">${esc(epithet)}</div>
    <div style="display:flex;justify-content:space-between;gap:24px;border-top:1px solid ${rule};margin-top:10px;padding-top:7px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:${meta};white-space:nowrap">
      ${yr}<span>${m.days} days <span style="font-family:'Hiragino Sans','Noto Sans CJK JP',serif;letter-spacing:0;font-size:12px">${m.days >= 16 ? '大' : '小'}</span></span>
    </div>
  </div>${strike}
</div>
<div style="width:4px;height:44px;margin:0 auto;background:linear-gradient(180deg,${spent ? P.spentFrame : P.post},${P.post});border-radius:0 0 2px 2px"></div>
<div style="width:34px;height:9px;margin:-3px auto 0;border-radius:50%;background:radial-gradient(ellipse at center,rgba(31,54,97,.22),rgba(31,54,97,0) 70%)"></div>`;
}

/* ------------------------------------------------------------------- mount */

export function mount(root, options = {}) {
  const opts = Object.assign(
    { mode: 'daylight', riserTint: true, showAxis: true, platePath: './plates/', day: null },
    options
  );

  root.innerHTML = HUD_HTML;
  /* The host owns the box. We never touch `position` unless it is static —
     clobbering a `position:fixed;inset:0` root collapses it to zero height and
     the whole walk renders blank. Give the root a size before calling mount(). */
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  root.style.cssText +=
    ";font-family:'Nunito',sans-serif;--gg-ink:#1f3661;--gg-muted:#4d606b;" +
    "--gg-accent:#35735b;--gg-paprika:#c9410f;--gg-gold:#a88024;--gg-plate:#fcf8eeee;" +
    "--gg-line:#d5ece6;pointer-events:none";
  if (!root.clientHeight) console.warn('[greengage-line] root has zero height — give it a size (e.g. position:fixed;inset:0).');

  const q = k => root.querySelector(`[data-gg="${k}"]`);
  const c = q('canvas'), ctx = c.getContext('2d');
  const layer = q('layer'), strip = q('strip');

  const { R, WIDTH, PITCH, TAPER, EYE, F, NEAR } = GEOM;
  const M = MOTION;
  const TODAY = new Date(); TODAY.setHours(12, 0, 0, 0);
  const Y0 = TODAY.getFullYear();

  const marks = [];
  for (let y = Y0 - 3; y <= Y0 + 3; y++)
    for (const d of DAYS) marks.push(Object.assign({}, d, { year: y, t: new Date(y, d.m - 1, d.d, 12).getTime() }));
  marks.sort((a, b) => a.t - b.t);
  marks.forEach((m, i) => { m.tEnd = marks[i + 1] ? marks[i + 1].t : m.t + m.days * DAY; });

  const yearBounds = y => [new Date(y, 0, 1).getTime(), new Date(y + 1, 0, 1).getTime()];
  function geom(t) {
    const y = new Date(t).getFullYear(), [a, b] = yearBounds(y), f = (t - a) / (b - a);
    return { th: -2 * Math.PI * f, h: -PITCH * ((y - Y0) + f) };
  }
  function pt(t, radial) {
    const g = geom(t), r = R - TAPER * (-g.h / PITCH) + radial;
    return { x: Math.cos(g.th) * r, y: g.h, z: Math.sin(g.th) * r };
  }
  const nextYear = d => { const x = new Date(d); return new Date(x.getFullYear() + 1, x.getMonth(), x.getDate(), 12).getTime(); };

  let offset = 0, lookYaw = 0, tilt = M.restTilt, walking = false;
  let W = 0, H = 0, DPR = 1, lastMode = null, raf = 0, queued = false, narrow = false, dead = false;

  /* The loop parks. It is scheduled by mark(), and while walking it reschedules
     itself; otherwise nothing ticks. (The design build called rAF
     unconditionally and only skipped draw() — cheap, but not idle.) */
  function mark() {
    if (dead || queued) return;
    queued = true;
    raf = requestAnimationFrame(frame);
  }
  function frame() {
    queued = false;
    if (dead) return;
    if (walking) { offset += M.walkSpeed; mark(); }   // schedule before drawing:
    try { draw(); } catch (e) { console.error('[greengage-line]', e); }  // a throw must not kill the walk
  }

  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = root.clientWidth || innerWidth; H = root.clientHeight || innerHeight;
    c.width = W * DPR; c.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const n = W <= 560; if (n !== narrow) { narrow = n; applyLayout(); }
    mark();
  }
  /* Narrow is not "the same rack, smaller". Three bays, two buttons, a hint line
     and a wordmark do not fit in 390px — they collide. The rack drops to one bay
     plus Walk; the strip becomes a 24-tick year index with only the current
     numeral labelled, because 24 Roman numerals across 390px is a grey smear. */
  function applyLayout() {
    q('mid').style.display   = narrow ? 'none' : 'flex';
    q('hint').style.display  = narrow ? 'none' : 'block';
    q('brand').style.display = narrow ? 'none' : 'flex';
    q('today').style.display = narrow ? 'none' : 'inline-block';
    strip.style.display      = narrow ? 'flex' : 'none';
    const ctrl = q('walk').parentElement.parentElement;
    ctrl.style.flexDirection = narrow ? 'row' : 'column';
    ctrl.style.alignItems    = narrow ? 'center' : 'flex-end';
    ctrl.style.padding       = narrow ? '12px 16px' : '15px 22px';
    const m = q('mast');
    m.style.bottom = narrow ? '68px' : '24px';
    m.style.left   = narrow ? '14px' : '26px';
    m.style.right  = narrow ? '14px' : '26px';
  }

  const sub   = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const dot   = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const norm  = a => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l }; };

  function camera() {
    const t = TODAY.getTime() + offset * DAY, p = pt(t, 0), ahead = pt(t + DAY, 0);
    let f = norm(sub(ahead, p));
    const cy = Math.cos(lookYaw), sy = Math.sin(lookYaw);
    f = { x: f.x * cy + f.z * sy, y: f.y, z: -f.x * sy + f.z * cy };
    const right = norm(cross(f, { x: 0, y: 1, z: 0 })), tu = cross(right, f);
    const cp = Math.cos(tilt), sp = Math.sin(tilt);
    const f2 = { x: f.x * cp + tu.x * sp, y: f.y * cp + tu.y * sp, z: f.z * cp + tu.z * sp };
    return { eye: { x: p.x, y: p.y + EYE, z: p.z }, f: f2, r: right, u: cross(right, f2), t };
  }
  const toCam = (P, cam) => { const v = sub(P, cam.eye); return { x: dot(v, cam.r), y: dot(v, cam.u), z: dot(v, cam.f) }; };
  const scr = qq => ({ x: W / 2 + F * qq.x / qq.z, y: H / 2 - F * qq.y / qq.z });
  function clipNear(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], ain = a.z >= NEAR, bin = b.z >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) { const s = (NEAR - a.z) / (b.z - a.z); out.push({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, z: NEAR }); }
    }
    return out;
  }

  /* ------------------------------------------------- plates: DOM, billboarded */
  const pool = new Map();

  function placePlates(cam, TH) {
    const P = TH.plate, camYear = new Date(cam.t).getFullYear();
    const cands = [];
    for (const m of marks) {
      if (Math.abs(m.t - cam.t) > DAY * GEOM.HORIZON_DAYS) continue;
      /* The plate stands at the OPENING of the turn, not its middle. Walk into
         the turn and its sign is behind you — rule 2 as a fact about position. */
      const a = toCam(pt(m.t, WIDTH / 2 + 2.4), cam);
      if (a.z <= 4) continue;
      const s = scr(a);
      if (s.x < -500 || s.x > W + 500) continue;
      cands.push({ m, z: a.z, x: s.x, y: s.y, st: stateOf(m.t, m.tEnd, cam.t) });
    }
    cands.sort((a, b) => a.z - b.z);

    /* The rack and the strip are signs too: seed the occupancy map with them so
       no roadside plate is ever half-hidden behind one. */
    const placed = [], live = new Set();
    for (const k of ['mast', 'strip']) {
      const h = q(k); if (!h || h.style.display === 'none') continue;
      const r = h.getBoundingClientRect(); if (!r.width) continue;
      placed.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, hud: true });
    }

    for (const cd of cands) {
      const key = cd.m.year + '-' + cd.m.num;
      let e = pool.get(key);
      if (!e) {
        e = document.createElement('div');
        e.style.cssText = 'position:absolute;left:0;top:0;transform-origin:50% 100%;will-change:transform';
        layer.appendChild(e); pool.set(key, e); e._sig = '';
      }
      const showYear = cd.m.year !== camYear;
      const sig = cd.st + '|' + lastMode + '|' + showYear;
      if (e._sig !== sig) { e.innerHTML = plateHTML(cd.m, cd.st, P, showYear, opts.platePath); e._sig = sig; e._w = 0; }
      if (!e._w) {
        e.style.display = 'block'; e.style.transform = 'none';
        const r = e.getBoundingClientRect(); e._w = r.width || 220; e._h = r.height || 150;
      }
      const lanePx = F * WIDTH / cd.z;
      const s = Math.max(.42, Math.min(1, lanePx / 300 * .9));
      const w = e._w * s, h = e._h * s;
      const box = { l: cd.x - w / 2 - 4, r: cd.x + w / 2 + 4, t: cd.y - h - 4, b: cd.y + 4 };

      /* Shown whole or not at all: a plate clipped by the top edge is dropped,
         never a half-sign hanging off the frame. A hidden plate must NOT claim
         road space — it would suppress the visible plate behind it. */
      const offLeft = Math.max(0, -box.l), offRight = Math.max(0, box.r - W);
      if (box.r < 0 || box.l > W || box.b < 0 || box.t > H || box.t < 0
          || (offLeft + offRight) > w * .25) { e.style.display = 'none'; continue; }
      const clash = placed.find(p => !(box.r < p.l || box.l > p.r || box.b < p.t || box.t > p.b));
      if (clash) {
        /* Behind a HUD panel a plate is demoted, not deleted: it stays on its
           post, dimmed, so the road keeps its rhythm. */
        if (!clash.hud) { e.style.display = 'none'; continue; }
        cd.dim = .3;
      }
      placed.push(box); live.add(key);
      e.style.display = 'block';
      e.style.left = cd.x + 'px'; e.style.top = cd.y + 'px';
      e.style.transform = `translate(-50%,-100%) scale(${s.toFixed(3)})`;
      e.style.opacity = String(Math.max(.25, Math.min(1, 1.35 - cd.z / 300)) * (cd.dim || 1));
      e.style.zIndex = String(2000 - Math.round(cd.z));
    }
    for (const [k, e] of pool) if (!live.has(k) && e.style.display !== 'none') e.style.display = 'none';
  }

  /* ------------------------------------------------------------------ ground */
  function draw() {
    const TH = THEMES[opts.mode === 'dusk' ? 'dusk' : 'daylight'];
    const cam = camera();

    if (lastMode !== opts.mode) {
      lastMode = opts.mode;
      for (const k in TH.hud) root.style.setProperty(k, TH.hud[k]);
      for (const [, e] of pool) e._sig = '';
    }

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, TH.skyTop); g.addColorStop(1, TH.skyBottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const tint = opts.riserTint !== false;
    const quads = [];
    for (const m of marks) {
      const t0 = m.t, t1 = m.tEnd;
      if (Math.abs(t0 - cam.t) > DAY * GEOM.HORIZON_DAYS) continue;
      const SUB = Math.max(2, Math.round(m.days / 4));   // slot length is the density variable
      const hue = SEASON_HUE[m.season] ?? 205;
      for (let s = 0; s < SUB; s++) {
        const ta = t0 + (t1 - t0) * s / SUB, tb = t0 + (t1 - t0) * (s + 1) / SUB;
        const Pq = [pt(ta, -WIDTH / 2), pt(tb, -WIDTH / 2), pt(tb, WIDTH / 2), pt(ta, WIDTH / 2)].map(p => toCam(p, cam));
        const st = stateOf(ta, tb, cam.t);
        if (!Pq.every(p => p.z < NEAR)) {
          const tr = st < 0 ? TH.treadPast : TH.tread;
          const col = st === 0 ? TH.treadNow : `hsl(${hue} ${tr.sat}% ${s % 2 ? tr.lightA : tr.lightB}%)`;
          quads.push({ P: Pq, cz: Pq.reduce((a, p) => a + p.z, 0) / 4, col });
        }
        const Rq = [pt(ta, -WIDTH / 2), pt(tb, -WIDTH / 2), pt(nextYear(tb), WIDTH / 2), pt(nextYear(ta), WIDTH / 2)].map(p => toCam(p, cam));
        if (!Rq.every(p => p.z < NEAR)) {
          const r = TH.riser;
          /* The riser carries the season, not the tread — it is the face seen
             across the crater, and it can hold real chroma. */
          const col = st < 0 ? `hsl(${hue} ${r.pastSat}% ${r.pastLight}%)`
                             : `hsl(${hue} ${tint ? r.sat : 4}% ${r.light}%)`;
          quads.push({ P: Rq, cz: Rq.reduce((a, p) => a + p.z, 0) / 4, col });
        }
      }
    }
    quads.sort((a, b) => b.cz - a.cz);
    for (const qd of quads) {
      const poly = clipNear(qd.P); if (poly.length < 3) continue;
      const S = poly.map(scr);
      ctx.beginPath(); ctx.moveTo(S[0].x, S[0].y);
      for (let i = 1; i < S.length; i++) ctx.lineTo(S[i].x, S[i].y);
      ctx.closePath();
      const fog = Math.max(0, Math.min(1, 1 - qd.cz / TH.fogEnd));
      const a = TH.fogFloor + (1 - TH.fogFloor) * fog;
      ctx.globalAlpha = a; ctx.fillStyle = qd.col; ctx.fill();
      ctx.globalAlpha = a * .6; ctx.strokeStyle = TH.edge; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (opts.showAxis !== false) drawAxis(cam, TH);
    placePlates(cam, TH);
    updateHUD(cam);
  }

  function drawAxis(cam, TH) {
    const A = TH.axis;
    const seg = (P1, P2, style, w) => {
      let a = toCam(P1, cam), b = toCam(P2, cam);
      if (a.z < NEAR && b.z < NEAR) return;
      if (a.z < NEAR) { const s = (NEAR - a.z) / (b.z - a.z); a = { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, z: NEAR }; }
      if (b.z < NEAR) { const s = (NEAR - b.z) / (a.z - b.z); b = { x: b.x + (a.x - b.x) * s, y: b.y + (a.y - b.y) * s, z: NEAR }; }
      const p = scr(a), qq = scr(b);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(qq.x, qq.y);
      ctx.strokeStyle = style; ctx.lineWidth = w; ctx.stroke();
    };
    const ring = (P, rad, style, w) => {
      const pts = [];
      for (let i = 0; i <= 16; i++) { const a = i / 16 * 2 * Math.PI; pts.push({ x: P.x + Math.cos(a) * rad, y: P.y, z: P.z + Math.sin(a) * rad }); }
      for (let i = 0; i < 16; i++) seg(pts[i], pts[i + 1], style, w);
    };
    const dd = new Date(cam.t), anni = [];
    for (let k = -2; k <= 2; k++) {
      const dt = new Date(dd.getFullYear() + k, dd.getMonth(), dd.getDate(), 12).getTime();
      if (Math.abs(dt - cam.t) > DAY * GEOM.HORIZON_DAYS && k !== 0) continue;
      anni.push({ k, P: pt(dt, 0) });
    }
    for (let i = 0; i < anni.length - 1; i++) seg(anni[i].P, anni[i + 1].P, A.thread, 1);
    for (const a of anni) {
      if (a.k === 0) continue;            // you are standing on it — never drawn
      const past = a.k < 0, style = past ? A.behind : A.ahead;
      ring(a.P, 3.5, style, 1);
      const cp = toCam({ x: a.P.x, y: a.P.y + 1.5, z: a.P.z }, cam);
      if (cp.z > NEAR) {
        const p = scr(cp);
        ctx.font = A.face; ctx.textAlign = 'center'; ctx.letterSpacing = '.12em'; ctx.fillStyle = style;
        ctx.fillText(`${Math.abs(a.k)} YEAR${Math.abs(a.k) > 1 ? 'S' : ''} ${past ? 'BEHIND' : 'AHEAD'}`, p.x, p.y);
        ctx.letterSpacing = '0em';
      }
    }
  }

  /* --------------------------------------------------------------------- HUD */
  const findAt = t => { let r = null; for (const m of marks) if (m.t <= t && (!r || m.t > r.t)) r = m; return r; };
  let stripCells = null;

  function updateHUD(cam) {
    const now = cam.t, here = findAt(now);
    const opp = now + 182.6 * DAY, across = findAt(opp);
    const set = (k, v) => { const e = q(k); if (e && e.textContent !== v) e.textContent = v; };
    set('cardno',  here ? `Card ${here.numeral} of XXIV` : 'Card — of XXIV');
    set('herename', here ? here.name : '—');
    set('hereday', (here ? `Day ${Math.floor((now - here.t) / DAY) + 1} of ${here.days} · ` : '') + fmt(now));
    set('across',  across ? across.name : '—');
    /* Name and date are the same fact — the name is not the date's label. */
    set('acrossin', across ? `Day ${Math.floor((opp - across.t) / DAY) + 1} of ${across.days} · ${fmt(opp)}` : '—');
    if (stripCells) {
      const idx = here ? here.num : 0;
      for (const cell of stripCells) {
        const on = +cell.dataset.num === idx;
        cell._label.style.opacity = on ? '1' : '0';
        cell._tick.style.background = on ? 'var(--gg-accent)' : 'var(--gg-muted)';
        cell._tick.style.opacity = on ? '1' : '.5';
        cell._tick.style.height = (on ? 20 : cell._h) + 'px';
        cell.setAttribute('aria-current', on ? 'true' : 'false');
      }
    }
  }

  /* ------------------------------------------------------------------- input */
  let drag = false, lx = 0, ly = 0;
  const onDown = e => { setWalk(false); drag = true; lx = e.clientX; ly = e.clientY; try { c.setPointerCapture(e.pointerId); } catch (_) {} };
  const onMove = e => {
    if (!drag) return;
    lookYaw += (e.clientX - lx) * M.lookGain;
    tilt = Math.max(-1.2, Math.min(.5, tilt + (e.clientY - ly) * M.tiltGain));
    lx = e.clientX; ly = e.clientY; mark();
  };
  const onUp = () => { drag = false; };
  const onWheel = e => { e.preventDefault(); setWalk(false); offset += e.deltaY * M.wheelGain; mark(); };
  const onKey = e => {
    if (e.key === 'ArrowUp')   { setWalk(false); offset += 1; mark(); }
    if (e.key === 'ArrowDown') { setWalk(false); offset -= 1; mark(); }
    if (e.key.toLowerCase() === 't') { setWalk(false); offset = 0; lookYaw = 0; tilt = M.restTilt; mark(); }
  };
  c.addEventListener('pointerdown', onDown);
  c.addEventListener('pointermove', onMove);
  c.addEventListener('pointerup', onUp);
  c.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKey);
  addEventListener('resize', resize);

  /* The numeral strip: the touch way to walk, and the year index — the 24-tick
     device from the 1908 Osaka sheet. Ticks, not 24 Roman numerals: at 390px
     each cell is 16px wide and "XVIII" next to "XXIII" is a grey smear. Only the
     day underfoot is labelled; great turns get a taller tick. */
  (function buildStrip() {
    strip.innerHTML = '';
    stripCells = DAYS.map(d => {
      const s = document.createElement('div');
      s.dataset.num = d.num;
      s.setAttribute('role', 'button');
      s.setAttribute('aria-label', `${d.name}, ${d.d}/${d.m}`);
      s.style.cssText = 'flex:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px;padding-bottom:14px;user-select:none';
      const label = document.createElement('span');
      label.textContent = d.numeral;
      label.style.cssText = "font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--gg-accent);opacity:0;transition:opacity .12s";
      const tick = document.createElement('span');
      tick.style.cssText = `display:block;width:${d.great ? 2 : 1}px;height:${d.great ? 16 : 10}px;background:var(--gg-muted);opacity:.5`;
      s.append(label, tick);
      s._label = label; s._tick = tick; s._h = d.great ? 16 : 10;
      strip.appendChild(s); return s;
    });
  })();

  /* Nearest occurrence, not "this calendar year". Standing in August and tapping
     XXIII Epiphany used to walk you ~11 months BACKWARDS into the January you
     had already passed, while the strip reads left-to-right I → XXIV. */
  function goToDay(num) {
    const d = DAYS.find(x => x.num === num); if (!d) return;
    const nowT = TODAY.getTime() + offset * DAY;
    const y = new Date(nowT).getFullYear();
    let best = null;
    for (const yy of [y - 1, y, y + 1]) {
      const t = new Date(yy, d.m - 1, d.d, 12).getTime();
      if (!best || Math.abs(t - nowT) < Math.abs(best - nowT)) best = t;
    }
    offset = (best - TODAY.getTime()) / DAY; mark();
  }
  function scrubTo(clientX) {
    const r = strip.getBoundingClientRect();
    const f = Math.max(0, Math.min(.9999, (clientX - r.left) / r.width));
    goToDay(DAYS[Math.floor(f * DAYS.length)].num);
  }
  let scrub = false;
  const onStripDown = e => { setWalk(false); scrub = true; try { strip.setPointerCapture(e.pointerId); } catch (_) {} scrubTo(e.clientX); };
  const onStripMove = e => { if (scrub) scrubTo(e.clientX); };
  const onStripUp = () => { scrub = false; };
  strip.addEventListener('pointerdown', onStripDown);
  strip.addEventListener('pointermove', onStripMove);
  strip.addEventListener('pointerup', onStripUp);

  /* The walk is a state you can interrupt: any look or step takes the wheel back. */
  function setWalk(v) {
    if (walking === v) return;
    walking = v;
    const b = q('walk');
    if (b) {
      b.textContent = v ? 'Walking' : 'Walk';
      b.style.background = v ? 'transparent' : 'var(--gg-accent)';
      b.style.color = v ? 'var(--gg-accent)' : 'var(--gg-plate)';
      b.style.fontWeight = v ? '500' : '600';
      b.setAttribute('aria-pressed', String(v));
    }
    mark();
  }
  q('today').addEventListener('click', () => { setWalk(false); offset = 0; lookYaw = 0; tilt = M.restTilt; mark(); });
  q('walk').addEventListener('click', () => setWalk(!walking));

  resize();
  if (opts.day) goToDay(opts.day);

  return {
    goToDay,
    goToday: () => { setWalk(false); offset = 0; lookYaw = 0; tilt = M.restTilt; mark(); },
    setOptions(next) { Object.assign(opts, next); mark(); },
    get state() { const now = TODAY.getTime() + offset * DAY; return { offset, date: new Date(now), here: findAt(now) }; },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('keydown', onKey);
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('wheel', onWheel);
      strip.removeEventListener('pointerdown', onStripDown);
      strip.removeEventListener('pointermove', onStripMove);
      strip.removeEventListener('pointerup', onStripUp);
      pool.clear();
      root.innerHTML = '';
    }
  };
}
