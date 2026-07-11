/* Green Days — the app. Ported from the Claude Design prototype
   (GreenDaysApp.jsx) and wired to production: produce.json as the single data
   source, the live recipe engine at /greendays/api/recipe, edge country via
   /greendays/api/context, and localStorage persistence. Uses gd-* component
   classes from the design system. */
import React from 'react';
import {
  PRODUCE, byId, decorate, MONTH, ASSET,
  langOf, bandOf, countryLabel, COUNTRIES,
  seasonBannerSrc, matchesQuery, stripDia,
} from './produce.js';

const MONTH_NAME = new Date().toLocaleString('en-GB', { month: 'long' });
const SEASON_RANK = { peak: 0, in: 1, out: 2 };
const MONO = { fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' };
const VITALITY = {
  peak: 'At its peak — as good as it gets right now.',
  in: 'In season and reliable this week.',
  out: 'Out of season here — read the note before you buy.',
};

/* ---- One reusable off-season behavior (card, basket, detail, recipe) ---- */
const OFF_SEASON = {
  thumbBg: '#e6e9ec',
  filter: 'grayscale(0.72) saturate(0.4) opacity(0.9)',
  // linocut pulled with too little ink: patchy coverage that runs dry toward one edge
  dryMask: 'radial-gradient(140% 135% at 24% 18%, #000 30%, rgba(0,0,0,0.5) 68%, rgba(0,0,0,0.15) 100%), repeating-linear-gradient(121deg, #000 0 2px, rgba(0,0,0,0.3) 2px 4.5px)',
};
function inkStyle(p) {
  if (p.seasonality === 'out') return {
    filter: OFF_SEASON.filter,
    maskImage: OFF_SEASON.dryMask, WebkitMaskImage: OFF_SEASON.dryMask,
    maskSize: 'cover', WebkitMaskSize: 'cover',
    maskComposite: 'intersect', WebkitMaskComposite: 'source-in',
  };
  if (p.seasonality === 'peak') return { filter: 'saturate(1.12) contrast(1.03)' };
  return { filter: 'none' };
}
function PaprikaTip({ text, style }) {
  return <p style={{ fontSize: 14, lineHeight: 1.55, fontWeight: 700, color: 'var(--color-paprika)', margin: 0, ...style }}>{text}</p>;
}
function thumbStyle(p) {
  if (p.seasonality === 'out') return { background: OFF_SEASON.thumbBg, filter: OFF_SEASON.filter };
  if (p.seasonality === 'peak') return { filter: 'saturate(1.12) contrast(1.03)' };
  return { filter: 'none' };
}

/* ---- Bilingual name block: local language leads, English beneath ---- */
function ProduceName({ p, lang, size = 16, strike = false }) {
  const local = lang && p.name_local && p.name_local[lang];
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: size, lineHeight: 1.18, color: 'var(--color-text-primary)', overflowWrap: 'break-word', textDecoration: strike ? 'line-through' : 'none' }}>{local || p.name}</div>
      {local && local !== p.name && <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: size * 0.7, lineHeight: 1.2, color: 'var(--color-text-tertiary)', marginTop: 2, overflowWrap: 'break-word', textDecoration: strike ? 'line-through' : 'none' }}>{p.name}</div>}
    </div>
  );
}

// Honest, data-derived note for an out-of-season item.
function outAdvice(p, country) {
  return 'Out of season in ' + countryLabel(country) + ' this month — it travels a long way and tastes flatter now. Look for it in ' + (p.season || 'its own season') + '.';
}

/* ---- Name-forward fallback when an item has no print yet ----
   The Green Days logo sprout, centred on the card's cream ground in Seagrass
   (via currentColor) at a calm placeholder weight, so it reads as a placeholder
   rather than a finished linocut print. */
function Flourish({ style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', ...style }}>
      <svg viewBox="0 0 573 613" height="50%" width="auto" style={{ maxHeight: 104, color: 'var(--color-accent)', opacity: 0.5 }} aria-hidden="true">
        <path d="M84.0997 221.541C97.0394 209.34 127.1 206.541 127.1 206.541C127.1 206.541 139.479 200.18 148.1 199.541C161.647 198.538 169.666 203.206 181.1 210.541C200.89 223.237 209.919 238.245 213.1 261.541C215.779 281.162 210.683 293.196 202.1 311.041C192.259 331.502 167.358 332.572 164.1 355.041C163.231 361.032 164.1 370.541 164.1 370.541L231.6 443.041L234.6 449.541C234.6 449.541 240.803 446.51 245.1 446.041C260.351 444.378 274.1 472.541 274.1 472.541L271.1 415.041L266.1 301.041C266.1 301.041 263.699 249.393 255.6 217.541C251.917 203.057 244.1 181.041 244.1 181.041C244.1 181.041 208.143 176.049 186.1 169.041C152.562 158.379 133.758 149.65 105.6 128.541C91.9891 118.338 84.3984 112.257 73.0997 99.5411C62.5908 87.7145 53.7336 81.8126 49.5997 66.5411C46.4873 55.044 43.2377 46.1108 49.5997 36.0411C54.5753 28.1658 62.0162 28.4512 69.5997 23.0411C76.8493 17.8693 79.8004 13.3395 87.5997 9.04115C104.892 -0.489037 117.869 0.798077 137.6 1.54115C165.617 2.59632 183.953 5.84764 206.1 23.0411C228.532 40.4559 238.558 57.1888 244.1 85.0411C247.224 100.745 242.099 110.155 244.1 126.041C246.271 143.288 255.6 169.041 255.6 169.041C255.6 169.041 263.155 150.169 266.1 137.541C270.464 118.827 265.262 107.001 270.6 88.5411C273.833 77.3586 276.306 71.1374 282.1 61.0411C292.076 43.6567 300.193 34.5554 316.6 23.0411C333.962 10.8559 346.176 6.52314 367.1 3.04115C387.924 -0.42428 401.031 -1.01046 421.1 5.54115C439.792 11.6435 449.782 18.551 463.6 32.5411C471.531 40.5712 478.49 44.5606 481.1 55.5411C483.668 66.3477 479.746 73.0492 476.1 83.5411C466.082 112.364 446.62 122.313 421.1 139.041C391.197 158.642 369.268 160.298 334.6 169.041C309.943 175.26 270.6 181.041 270.6 181.041C270.6 181.041 266.1 188.541 266.1 197.041C266.1 205.541 275.829 248.06 280.1 281.041C288.739 347.757 289.6 453.041 289.6 453.041C289.6 453.041 294.69 451.904 297.6 453.041C302.934 455.125 303.481 460.485 304.062 466.169L304.1 466.541C304.712 472.516 300.143 480.511 298.324 483.422C302.005 477.76 318.962 451.915 332.1 436.041C361.896 400.037 421.1 356.041 421.1 356.041V346.541C421.1 346.541 403.312 330.017 395.1 317.041C386.914 304.107 381.409 296.24 379.6 281.041C377.444 262.933 381.782 251.77 390.1 235.541C395.639 224.733 398.853 217.788 408.6 210.541C420.051 202.027 429.564 197.463 443.6 200.041C450.737 201.352 460.6 207.541 460.6 207.541C460.6 207.541 470.284 207.263 476.1 209.041C489.306 213.079 494.272 221.836 501.6 233.541C508.088 243.906 511.3 250.839 512.1 263.041C512.896 275.194 510.686 282.476 505.6 293.541C497.699 310.729 486.828 316.819 471.6 328.041C458.026 338.044 449.1 340.041 433.6 348.541C418.1 357.041 430.6 356.041 430.6 356.041H436.1L443.1 353.041C443.1 353.041 460.271 339.668 471.6 331.541C481.414 324.501 485.779 318.249 497.1 314.041C508.156 309.932 515.484 308.489 527.1 310.541C542.305 313.228 551.21 319.283 560.6 331.541C573.015 347.749 575.032 363.36 569.6 383.041C563.682 404.48 551.124 415.976 530.6 424.541C509.317 433.423 492.499 431.79 471.6 422.041C452.328 413.052 437.414 403.961 433.6 383.041C432.374 376.318 433.6 365.541 433.6 365.541C433.6 365.541 432.6 364.541 430.6 365.541C428.6 366.541 365.445 404.026 336.1 441.041C317.562 464.424 302.555 477.616 297.6 507.041C296.476 513.714 296.342 517.581 296.109 524.265L296.1 524.541C294.888 559.382 316.1 611.541 316.1 611.541H292.1C292.1 611.541 283.872 548.894 267.6 512.541C254.475 483.221 223.6 443.041 223.6 443.041L156.6 379.041C156.6 379.041 168.81 414.577 159.1 433.541C147.398 456.393 125.713 460.779 100.1 462.541C79.2168 463.978 65.8527 460.631 48.0997 449.541C31.9126 439.429 26.5705 428.659 15.5997 413.041C10.0554 405.149 5.32948 401.292 2.59965 392.041C-2.64108 374.281 2.19985 360.228 14.0997 346.041C19.6851 339.382 29.5997 328.041 29.5997 328.041C29.5997 328.041 41.0556 321.832 49.0997 318.541C66.4129 311.457 95.5997 330.041 95.5997 330.041L130.6 350.541L144.6 364.041L153.1 366.041L148.1 358.041L105.6 335.041C105.6 335.041 88.1396 320.606 80.5997 308.541C70.8461 292.934 65.6253 281.92 66.5997 263.541C67.5403 245.797 71.1716 233.731 84.0997 221.541Z" fill="currentColor" stroke="currentColor" />
      </svg>
    </div>
  );
}

/* ---- Linocut print matched by slug; -off file when out of season ---- */
function ProduceImg({ p, style }) {
  if (!p.hasPrint) return <Flourish style={style} />;
  const b = ASSET('assets/produce/' + p.slug);
  const out = p.seasonality === 'out';
  const src = b + (out ? '-off@2x' : '@2x') + '.png';
  const srcSet = out ? undefined : (b + '@2x.png 2x, ' + b + '@3x.png 3x');
  return <img src={src} srcSet={srcSet} alt={p.name} loading="lazy" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', ...style }} />;
}

/* ---- icons ---- */
const I = {
  search: { main: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0', secondary: 'M20 20l-3-3' },
  home: { main: 'M5 9.5V20h14V9.5', secondary: 'M3 10.5 12 3l9 7.5', filled: 'M12 3 20 10.5V20H13V14H11V20H4V10.5Z' },
  plus: 'M12 5v14 M5 12h14',
  check: 'M5 12l5 5L20 6',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 6l6 6-6 6',
  arrow: { main: 'M5 12h14 M13 6l6 6-6 6' },
  pin: { main: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z', secondary: 'M12 10m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0' },
  leaf: { main: 'M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 10-5 13-9 13Z', secondary: 'M4 20c3-4 6-6 10-7' },
  sun: { main: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', secondary: 'M12 4V2 M12 22v-2 M5 5 3.5 3.5 M20.5 20.5 19 19 M4 12H2 M22 12h-2 M5 19l-1.5 1.5 M20.5 3.5 19 5' },
  info: { main: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', secondary: 'M12 12v5 M12 8h.01' },
  chef: { main: 'M6 4 16 14.5 13.4 17.1C9 13.4 6 9.3 6 4Z', secondary: 'M13.7 16.8 15.9 14.5 21.1 19.5a1.7 1.7 0 0 1-.3 2.4l-1 1a1.7 1.7 0 0 1-2.4-.3Z' },
  basket: { main: 'M4 9h16l-1.3 9.7a1.5 1.5 0 0 1-1.5 1.3H6.8a1.5 1.5 0 0 1-1.5-1.3Z M8.5 9a3.5 3.5 0 0 1 7 0', secondary: 'M9.5 12.5l.5 4.5 M14.5 12.5l-.5 4.5 M12 12.5v4.5', filled: 'M4 9h16l-1.3 9.7a1.5 1.5 0 0 1-1.5 1.3H6.8a1.5 1.5 0 0 1-1.5-1.3ZM8.5 9a3.5 3.5 0 0 1 7 0h-2a1.5 1.5 0 0 0-3 0Zm2.4 3.3h1.4v4.6h-1.4Z' },
  clock: { main: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', secondary: 'M12 7v5l3 2' },
  users: { main: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7', secondary: 'M22 20v-2a4 4 0 0 0-3-3.8 M17 3.2a4 4 0 0 1 0 7.6' },
  sparkle: { main: 'M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8Z', secondary: 'M19 3v3 M20.5 4.5h-3' },
  tune: { main: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3', secondary: 'M1 14h6 M9 8h6 M17 16h6' },
  x: 'M6 6l12 12 M18 6L6 18',
  eye: { main: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z', secondary: 'M12 12m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0' },
};
function Icon({ d, size = 22, w = 2, style, filled }) {
  const isObj = typeof d === 'object';
  if (filled && isObj) {
    if (d.filled) return <svg width={size} height={size} viewBox="0 0 24 24" style={style}><path d={d.filled} fill="currentColor" fillRule="evenodd" clipRule="evenodd" /></svg>;
    return <svg width={size} height={size} viewBox="0 0 24 24" style={style}><path d={d.main} fill="currentColor" />{d.secondary && <path d={d.secondary} fill="currentColor" />}</svg>;
  }
  const main = isObj ? d.main : d;
  const secondary = isObj ? d.secondary : null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={main} />
      {secondary && <path d={secondary} opacity={0.34} />}
    </svg>
  );
}

function SeasonFlag({ p }) {
  if (p.seasonality === 'peak') {
    return (
      <span className="gd-badge" style={{ ...MONO, fontSize: 10.5, height: 22, paddingInline: 8, gap: 4, background: 'var(--color-accent)', color: '#fff', boxShadow: 'var(--shadow-low)' }}>
        <Icon d={I.leaf} size={11} w={2.6} /> Peak now
      </span>
    );
  }
  if (p.seasonality === 'in') {
    return <span className="gd-badge gd-badge--green" style={{ ...MONO, fontSize: 10.5, height: 22, paddingInline: 8 }}>In season</span>;
  }
  return (
    <span className="gd-tag" style={{ ...MONO, fontSize: 10.5, height: 'auto', padding: '3px 9px', gap: 5, pointerEvents: 'none', color: 'var(--color-text-tertiary)', background: 'var(--color-background-surface)' }}>
      Out of season
    </span>
  );
}

/* ---- shared ---- */
function ProduceThumb({ p, size = '100%', radius = 0 }) {
  return (
    <div style={{ width: size, aspectRatio: '1/1', background: 'var(--color-background-body)', borderRadius: radius, overflow: 'hidden', flexShrink: 0, ...thumbStyle(p) }}>
      <ProduceImg p={p} style={inkStyle(p)} />
    </div>
  );
}
// Single Add affordance — toggles add → added, gaining a small ×N past the first tap.
function AddControl({ p, qty, onAdd, size, block }) {
  const added = qty > 0;
  const lg = size === 'lg';
  const cls = 'gd-btn ' + (added ? 'gd-btn--primary' : 'gd-btn--outline')
    + (lg ? ' gd-btn--lg' : ' gd-btn--sm') + (block ? ' gd-btn--block' : '');
  return (
    <button className={cls} aria-label={(added ? 'Added ' : 'Add ') + p.name}
      onClick={(e) => { e.stopPropagation(); onAdd(p.id, 1); }}>
      <span className="gd-btn__icon"><Icon d={added ? I.check : I.plus} size={lg ? 18 : 15} w={2.6} /></span>
      <span>{added ? 'Added' : 'Add'}</span>
      {qty > 1 && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: lg ? 14 : 12, opacity: 0.85 }}>×{qty}</span>}
    </button>
  );
}

/* ---- recipe engine client ---- */
async function requestRecipe({ basket, country, prefs, avoid }) {
  const res = await fetch(ASSET('api/recipe'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      basket,
      country,
      month: MONTH + 1,
      prefs: { diet: prefs.diet || 'none', allergies: (prefs.allergies || []).map((a) => a.toLowerCase()) },
      avoid,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'The kitchen is busy. Try again in a moment.');
  return data;
}

/* ================= Home ================= */
function HomeScreen({ basket, lang, country, onSetCountry, weather, query, setQuery, onAdd, onOpen, onCook, onOpenPrefs }) {
  const [cat, setCat] = React.useState('All');
  const term = query.trim();
  const q = stripDia(term);
  const searching = q.length > 0;
  // Search overrides categories: while a term is active the tabs snap to All
  // and the whole catalogue is searched (across every language, via matchesQuery).
  const activeCat = searching ? 'All' : cat;
  const band = bandOf(country); // vivid/faded per the market's climate band
  const list = PRODUCE
    .filter((p) => searching || activeCat === 'All' || p.tab === activeCat || (activeCat === 'Herbs' && p.tab === 'Herb'))
    .filter((p) => matchesQuery(p, q))
    .map((p) => decorate(p, band))
    .sort((a, b) => SEASON_RANK[a.seasonality] - SEASON_RANK[b.seasonality] || a.name.localeCompare(b.name));
  // Clearing the filter returns to All and the full seasonal palette.
  const clearSearch = () => { setQuery(''); setCat('All'); };
  // Picking a category tab takes effect by clearing any active search.
  const pickCat = (c) => { setQuery(''); setCat(c); };
  const basketCount = Object.values(basket).reduce((s, n) => s + n, 0);
  // The cook banner appears once the basket has something in it, fading in
  const [showCook, setShowCook] = React.useState(false);
  React.useEffect(() => {
    if (basketCount === 0) { setShowCook(false); return; }
    const t = setTimeout(() => setShowCook(true), 250);
    return () => clearTimeout(t);
  }, [basketCount === 0]);

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <img src={ASSET('gd/assets/wordmark_green.svg')} alt="green days" style={{ width: 190, height: 'auto', display: 'block', marginLeft: -2 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginRight: -8 }}>
          <button onClick={onOpenPrefs} aria-label="Preferences" style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--color-icon-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon d={I.tune} size={20} w={2} />
          </button>
        </div>
      </div>

      <div className="gd-field" style={{ marginTop: 8 }}>
        <div className="gd-input" style={{ background: 'var(--color-background-surface)' }}>
          <span className="gd-input__affix"><Icon d={I.search} size={18} /></span>
          <input className="gd-input__field" placeholder="Search produce" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {/* Location-and-month line — tappable, correctable; sets the market's language */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)', marginTop: 10, fontSize: 13, fontWeight: 600 }}>
        <Icon d={I.pin} size={14} style={{ color: 'var(--color-accent)' }} />
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ borderBottom: '1px dashed var(--color-border-strong)' }}>{countryLabel(country)}, {MONTH_NAME}</span>
          <select className="gd-locpick" aria-label="Market country" value={country} onChange={(e) => onSetCountry(e.target.value)}>
            {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </span>
        <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
        <Icon d={I.sun} size={14} style={{ color: 'var(--color-gold)' }} />
        <span>{weather}</span>
      </div>

      {/* Empty basket → gentle welcome; replaced by the cook banner once something's in */}
      {basketCount === 0 && (
        <div className="gd-welcome" style={{ marginTop: 16, padding: '22px 20px', borderRadius: 'var(--radius-container)', background: 'var(--color-background-body)', border: '1px solid #d9cfbe', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="gd-welcome-leaf" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0, background: 'var(--color-accent-muted, #e9f0d6)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon d={I.leaf} size={26} w={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, ...MONO, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon d={I.sparkle} size={13} w={2.2} /> What's good right now
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 19, marginTop: 4, color: 'var(--color-text-primary)' }}>Start with what's in season</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--color-text-secondary)', marginTop: 4 }}>Tap the peak-season picks below. Add a few and we'll write tonight's recipe.</div>
          </div>
        </div>
      )}
      {basketCount > 0 && (
        <button onClick={onCook} style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', marginTop: 16, padding: 14,
          borderRadius: 0, background: 'linear-gradient(120deg, var(--color-accent-strong), var(--color-accent))',
          color: '#fff', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-med)', fontFamily: 'var(--font-body)',
          opacity: showCook ? 1 : 0, transform: showCook ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity .4s ease, transform .4s ease' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: '#EAD394', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon d={I.chef} size={26.4} w={2.2} filled style={{ color: '#529D7F', transform: 'translate(-1.6px, -1.5px)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, opacity: .9, ...MONO }}>
              <Icon d={I.sparkle} size={13} w={2.2} /> Tonight, from your basket
            </div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 3 }}>Cook this</div>
          </div>
          <Icon d={I.arrow} size={22} />
        </button>
      )}

      {/* Filter row — left-aligned to the grid edge, scrolls horizontally so the
          active-search pill can sit past Herbs on narrow screens */}
      <div className="gd-filterrow" style={{ margin: '18px 0 14px', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="gd-segmented" style={{ flexShrink: 0 }}>
          {['All', 'Fruit', 'Veg', 'Herbs'].map((c) => (
            <button key={c} className={'gd-segmented__item' + (c === activeCat ? ' gd-segmented__item--active' : '')} onClick={() => pickCat(c)}>{c}</button>
          ))}
        </div>
        {searching && (
          <button onClick={clearSearch} aria-label={'Clear search: ' + term}
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: 170, height: 34,
              padding: '0 6px 0 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: 'var(--color-accent)', color: 'var(--color-on-accent)',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, boxShadow: 'var(--shadow-low)' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{term}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 999, background: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>
              <Icon d={I.x} size={12} w={2.8} />
            </span>
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {list.map((p) => {
          const qty = basket[p.id] || 0;
          return (
            <div key={p.id} onClick={() => onOpen(p.id)}
              style={{ position: 'relative', cursor: 'pointer', background: 'var(--color-background-body)', border: '1px solid #d9cfbe', borderRadius: 0, overflow: 'hidden', boxShadow: '0 1px 2px #1f36610d' }}>
              {/* Print fills the card width; its own cream margin is the padding. Height trimmed so the name block always fits. */}
              <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 0.92', ...thumbStyle(p) }}>
                <ProduceImg p={p} style={inkStyle(p)} />
                {p.seasonality === 'peak' && (
                  <span style={{ position: 'absolute', top: 8, left: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 9.5, letterSpacing: '0.06em', color: '#fff', background: 'var(--color-accent)', borderRadius: 999, padding: '3px 8px', pointerEvents: 'none' }}>PEAK SEASON</span>
                )}
                {p.seasonality === 'out' && (
                  <span style={{ position: 'absolute', top: 8, left: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', background: 'var(--color-background-surface)', borderRadius: 999, padding: '3px 8px', pointerEvents: 'none' }}>OUT OF SEASON</span>
                )}
              </div>
              {/* Bilingual name strip; room at right for the Add button */}
              <div style={{ padding: '10px 52px 12px 12px' }}>
                <ProduceName p={p} lang={lang} />
              </div>
              <button onClick={(e) => { e.stopPropagation(); onAdd(p.id, 1); }} aria-label={(qty ? 'Added ' : 'Add ') + p.name}
                style={{ position: 'absolute', right: 10, bottom: 10, width: 40, height: 40, borderRadius: 999, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: qty ? 'var(--color-accent)' : 'var(--color-background-surface)', color: qty ? '#fff' : 'var(--color-accent)', boxShadow: qty ? 'var(--shadow-low)' : 'inset 0 0 0 2px var(--color-accent), var(--shadow-low)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>
                {qty > 1 ? '×' + qty : <Icon d={qty ? I.check : I.plus} size={20} w={2.6} />}
              </button>
            </div>
          );
        })}
      </div>
      {list.length === 0 && (
        <div className="gd-card gd-card--muted" style={{ textAlign: 'center', padding: 28, marginTop: 4 }}>
          <div style={{ fontSize: 34 }}>🧺</div>
          <div style={{ fontWeight: 800, marginTop: 8 }}>No produce matches “{term}”</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Try another produce name, in any language.</div>
        </div>
      )}
    </div>
  );
}

/* ================= Basket ================= */
function ListScreen({ basket, checked, lang, country, onAdd, onRemove, onToggle, onOpen, onCook }) {
  const band = bandOf(country);
  const items = PRODUCE.filter((p) => basket[p.id] > 0).map((p) => decorate(p, band));
  const doneCount = items.filter((p) => checked[p.id]).length;
  const outItems = items.filter((p) => p.seasonality === 'out');

  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '10px 0 2px' }}>
        <h2 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}>Today's basket</h2>
        {items.length > 0 && <span style={{ color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600 }}>{doneCount}/{items.length} picked</span>}
      </div>
      {items.length > 0 && (
        <div style={{ height: 8, borderRadius: 999, background: 'var(--color-background-muted)', overflow: 'hidden', margin: '10px 0 18px' }}>
          <div style={{ height: '100%', width: (items.length ? (doneCount / items.length) * 100 : 0) + '%', background: 'var(--color-accent)', borderRadius: 999, transition: 'width .3s var(--ease-standard)' }} />
        </div>
      )}

      {items.length === 0 && (
        <div className="gd-card gd-card--muted" style={{ textAlign: 'center', padding: 32, marginTop: 16 }}>
          <div style={{ fontSize: 40 }}>🧺</div>
          <div style={{ fontWeight: 800, marginTop: 8 }}>Your basket is empty</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Start tapping produce from the seasonal palette on Home.</div>
        </div>
      )}

      {outItems.length > 0 && (
        <div className="gd-card" style={{ marginBottom: 16, background: 'var(--color-error-muted)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--color-paprika)', flexShrink: 0, marginTop: 1 }}><Icon d={I.info} size={20} w={2.2} /></span>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>
            <strong>{outItems.length === 1 ? outItems[0].name + ' is' : outItems.length + ' items are'} out of season.</strong> They travel far and taste flatter now — open each for a fresher swap.
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="gd-card" style={{ padding: 6, marginBottom: 16 }}>
          {items.map((p) => {
            const on = !!checked[p.id];
            return (
              // Whole row opens the product detail, like a Home card. The check,
              // Add, and remove controls stop propagation so they act in place.
              <div key={p.id} className="gd-list-item" onClick={() => onOpen(p.id)} style={{ borderRadius: 14, opacity: on ? 0.55 : 1 }}>
                <span className="gd-list-item__media">
                  <label className={'gd-check' + (on ? ' gd-check--checked' : '')} onClick={(e) => { e.stopPropagation(); onToggle(p.id); }}>
                    <span className="gd-check__box"><Icon d={I.check} size={14} w={3.5} /></span>
                  </label>
                </span>
                <span className="gd-list-item__body">
                  <ProduceName p={p} lang={lang} size={15} strike={on} />
                  <span className="gd-list-item__subtitle">{p.season}</span>
                  {p.seasonality !== 'in' && <span style={{ marginTop: 5 }}><SeasonFlag p={p} /></span>}
                </span>
                <span className="gd-list-item__trailing" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AddControl p={p} qty={basket[p.id]} onAdd={onAdd} />
                  <button className="gd-btn gd-btn--ghost gd-btn--icon-only gd-btn--sm" aria-label={'Remove ' + p.name} onClick={(e) => { e.stopPropagation(); onRemove(p.id); }} style={{ color: 'var(--color-text-tertiary)' }}>
                    <span className="gd-btn__icon"><Icon d={I.x} size={16} w={2.4} /></span>
                  </button>
                  {/* Trailing chevron marks the row as tappable (as in Recipes) */}
                  <span style={{ color: 'var(--color-text-tertiary)', display: 'flex', flexShrink: 0, marginLeft: 2, pointerEvents: 'none' }} aria-hidden="true"><Icon d={I.chevron} size={18} /></span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="gd-card" style={{ marginTop: 6 }}>
          <button className="gd-btn gd-btn--primary gd-btn--lg gd-btn--block" onClick={onCook}>
            <span className="gd-btn__icon"><Icon d={I.chef} size={18} w={2.2} /></span><span>Cook this</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ================= Recipe detail (the payoff) ================= */
// Resolve a "grab one more" suggestion (a produce id, or a local/English name)
// to its catalogue item. Returns null when nothing in produce.json matches.
function resolveSuggestion(term) {
  const raw = String(term || '').trim();
  if (!raw) return null;
  const direct = byId(raw);
  if (direct) return direct;
  const t = stripDia(raw);
  if (!t) return null;
  // exact name match, English or any local language, case/diacritic-insensitive
  const exact = PRODUCE.find((p) => stripDia(p.name) === t || Object.values(p.name_local).some((n) => stripDia(n) === t));
  if (exact) return exact;
  // looser contains match as a last resort
  return PRODUCE.find((p) => stripDia(p.name).includes(t) || Object.values(p.name_local).some((n) => stripDia(n).includes(t))) || null;
}

function RecipeDetailScreen({ view, onOpen, onSearchProduce, onClose, onGoHome, onTryAnother }) {
  const { entry, status, error, live } = view;
  // Names, banner, and seasonality follow the market the recipe was cooked in.
  const rc = entry ? entry.country : 'PT';
  const lang = langOf(rc);
  const band = bandOf(rc);
  const banner = seasonBannerSrc(rc, entry ? entry.month0 : MONTH);
  const r = entry && entry.recipe;

  const label = (text, accent) => (
    <div style={{ fontSize: 12, ...MONO, color: accent ? 'var(--color-text-accent)' : 'var(--color-text-tertiary)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>{text}</div>
  );

  const stars = r ? r.stars.map((id) => decorate(byId(id), band)).filter(Boolean) : [];
  const fresh = r ? r.ingredients.filter((i) => !i.pantry) : [];
  const pantry = r ? r.ingredients.filter((i) => i.pantry) : [];
  const grabTerm = r && r.grabOneMore ? String(r.grabOneMore).trim() : '';
  const oneMore = grabTerm ? decorate(resolveSuggestion(grabTerm), band) : null;

  // Match a fresh-ingredient line back to a produce print where possible.
  const freshProduce = (item) => {
    const t = stripDia(item);
    return decorate(stars.find((p) => t.includes(stripDia(p.name))) || PRODUCE.find((p) => t.includes(stripDia(p.name))), band);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--color-background-body)', zIndex: 20, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {/* Hero — seasonal composite linocut for this market's climate band + season */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '960 / 538', background: '#fcf8ee', flexShrink: 0 }}>
        <img src={banner.src} srcSet={banner.srcSet} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
        <button className="gd-btn gd-btn--icon-only" style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(4px)' }} aria-label="Back" onClick={onClose}><span className="gd-btn__icon"><Icon d={I.back} size={20} /></span></button>
      </div>

      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, textAlign: 'center' }}>
          <span className="gd-simmer" style={{ color: 'var(--color-accent)' }}><Icon d={I.chef} size={44} w={1.8} /></span>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 26, color: 'var(--color-accent)' }}>Writing tonight's recipe</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', maxWidth: 260, lineHeight: 1.5 }}>One confident recipe from your basket, the season and the market.</div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, textAlign: 'center' }}>
          <span style={{ color: 'var(--color-paprika)' }}><Icon d={I.info} size={40} w={1.8} /></span>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{error || 'The kitchen is busy.'}</div>
          <button className="gd-btn gd-btn--primary" onClick={onTryAnother}>Try again</button>
        </div>
      )}

      {status === 'ready' && r && (
        <div style={{ padding: '18px 20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* ZONE 1 — Title + seasonal note + try another */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--color-text-accent)', ...MONO }}>
                <Icon d={I.sparkle} size={13} w={2.2} /> From your basket
              </div>
              {live && (
                <button onClick={onTryAnother} className="gd-tag" style={{ gap: 6, height: 'auto', padding: '6px 12px', borderColor: 'var(--color-border-accent)', color: 'var(--color-text-accent)', ...MONO, fontSize: 10.5 }}>
                  <Icon d={I.sparkle} size={13} w={2.2} /> Try another
                </button>
              )}
            </div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 900, margin: '12px 0 8px', lineHeight: 1.12 }}>{r.title}</h1>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15.5, lineHeight: 1.4, color: 'var(--color-text-accent)' }}>{r.note}</div>
            <div style={{ display: 'flex', gap: 18, marginTop: 16, flexWrap: 'wrap' }}>
              {r.time && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}><Icon d={I.clock} size={17} style={{ color: 'var(--color-text-secondary)' }} /> {r.time}</span>}
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}><Icon d={I.users} size={17} style={{ color: 'var(--color-text-secondary)' }} /> Serves 2</span>
            </div>
          </div>

          {/* ZONE 2 — Your stars (fresh, dominant) */}
          {stars.length > 0 && (
            <div>
              {label(<span><Icon d={I.leaf} size={13} w={2.4} /> Your stars · the heart of the dish</span>, true)}
              <div className="gd-card" style={{ background: 'var(--color-background-accent-subtle)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--color-border-accent)' }}>
                {stars.map((p) => (
                  <div key={p.id} onClick={() => onOpen(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: 'var(--color-background-surface)', borderRadius: 14, padding: 10, boxShadow: 'var(--shadow-low)' }}>
                    <ProduceThumb p={p} size={54} radius={14} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <ProduceName p={p} lang={lang} size={17} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-accent)', marginTop: 2 }}>{p.season}</div>
                    </div>
                    <SeasonFlag p={p} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ZONE 3 — Ingredients (produce dominant, pantry secondary) */}
          <div>
            {label('Everything you need')}
            <div className="gd-card" style={{ padding: 6 }}>
              {fresh.map((ing, i) => {
                const p = freshProduce(ing.item);
                return (
                  <div key={i} className="gd-list-item" style={{ borderRadius: 12 }} onClick={p ? () => onOpen(p.id) : undefined}>
                    <span className="gd-list-item__media">
                      {p ? <ProduceThumb p={p} size={36} radius={10} /> : (
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-background-accent-subtle)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={I.leaf} size={18} w={2} /></span>
                      )}
                    </span>
                    <span className="gd-list-item__body">
                      <span className="gd-list-item__title" style={{ fontSize: 15, fontWeight: 700 }}>{ing.item}</span>
                    </span>
                    {p && p.seasonality === 'out' && <span className="gd-list-item__trailing"><SeasonFlag p={p} /></span>}
                  </div>
                );
              })}
              {pantry.length > 0 && (
                <div style={{ borderTop: '1px solid var(--color-border)', margin: '6px 8px 0', padding: '10px 0 4px' }}>
                  <div style={{ fontSize: 10, ...MONO, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>Assumed from your pantry</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {pantry.map((s, i) => (
                      <span key={i} style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-tertiary)', background: 'var(--color-background-muted)', padding: '3px 10px', borderRadius: 999 }}>{s.item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ZONE 4 — Honest advice (off-season basket item) */}
          {r.offSeasonAdvice && (
            <div>
              {label('Honest advice')}
              <div className="gd-card" style={{ background: 'var(--color-error-muted)', padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: 'var(--color-paprika)' }}><Icon d={I.info} size={18} w={2.4} /></span>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-paprika)' }}>Out of season, honestly</span>
                </div>
                <PaprikaTip text={r.offSeasonAdvice} />
              </div>
            </div>
          )}

          {/* ZONE 5 — Grab one more (forward, Seagrass). A resolved suggestion
              opens its product detail; an unmatched one opens Home with the
              term pre-filled in search (never a bare Home fallback). */}
          {grabTerm && (
            <div>
              {label(<span><Icon d={I.pin} size={13} w={2.4} /> Grab one more at the stalls</span>, true)}
              <button onClick={() => (oneMore ? onOpen(oneMore.id) : onSearchProduce(grabTerm))} style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: 12, borderRadius: 'var(--radius-container)', background: 'linear-gradient(120deg, var(--color-accent-strong), var(--color-accent))', color: '#fff', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-med)', fontFamily: 'var(--font-body)' }}>
                <div style={{ background: 'rgba(255,255,255,.9)', borderRadius: 14, flexShrink: 0 }}>
                  {oneMore
                    ? <ProduceThumb p={oneMore} size={48} radius={14} />
                    : <div style={{ width: 48, height: 48 }}><Flourish /></div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{oneMore ? ((lang && oneMore.name_local[lang]) || oneMore.name) : grabTerm}</div>
                  <div style={{ fontSize: 13, opacity: .9 }}>{oneMore ? 'In season now · finishes the dish' : 'Find it at the stalls'}</div>
                </div>
                <Icon d={I.arrow} size={22} />
              </button>
            </div>
          )}

          {/* ZONE 6 — Make it a meal (only when the dish has no protein) */}
          {r.protein && r.protein.length > 0 && (
            <div>
              {label('Make it a meal')}
              <div className="gd-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {r.protein.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>
                    <span style={{ color: 'var(--color-accent)', marginTop: 2, flexShrink: 0 }}><Icon d={I.chef} size={15} w={2.2} /></span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ZONE 7 — Method */}
          <div>
            {label('Method')}
            <div className="gd-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {r.method.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, background: 'var(--color-accent)', color: '#fff', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--color-text-primary)', paddingTop: 3 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Recipes tab (made recipes, most recent first) ================= */
function RecipesListScreen({ history, onOpenEntry, onGoHome }) {
  return (
    <div style={{ padding: '10px 20px 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 900, margin: '4px 0 16px' }}>Recipes</h1>
      {history.length === 0 ? (
        <div className="gd-card gd-card--muted" style={{ textAlign: 'center', padding: 32, marginTop: 8 }}>
          <div style={{ color: 'var(--color-text-tertiary)', display: 'flex', justifyContent: 'center' }}><Icon d={I.chef} size={40} w={1.6} /></div>
          <div style={{ fontWeight: 800, marginTop: 10 }}>No recipes yet</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4, marginBottom: 16 }}>Fill a basket and tap “Cook this” — every recipe lands here.</div>
          <button className="gd-btn gd-btn--primary" onClick={onGoHome}>Browse produce</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((e) => {
            const hero = e.recipe.stars.map(byId).find((p) => p && p.hasPrint) || byId(e.recipe.stars[0]);
            const when = new Date(e.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            return (
              <div key={e.id} onClick={() => onOpenEntry(e.id)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, background: 'var(--color-background-body)', border: '1px solid #d9cfbe', borderRadius: 'var(--radius-container)', overflow: 'hidden', boxShadow: '0 1px 2px #1f36610d' }}>
                <div style={{ width: 84, height: 84, flexShrink: 0, borderRight: '1px solid #d9cfbe' }}>
                  {hero ? <ProduceImg p={hero} /> : <Flourish />}
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: '10px 0' }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 16, lineHeight: 1.25, color: 'var(--color-text-primary)' }}>{e.recipe.title}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-tertiary)', marginTop: 4 }}>{when}{e.recipe.time ? ' · ' + e.recipe.time : ''}</div>
                </div>
                <span style={{ color: 'var(--color-text-tertiary)', paddingRight: 14, flexShrink: 0 }}><Icon d={I.chevron} size={20} /></span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================= Product detail overlay ================= */
function DetailScreen({ id, basket, lang, country, onAdd, onClose, onOpen }) {
  const band = bandOf(country);
  const p = decorate(byId(id), band);
  if (!p) return null;
  const qty = basket[p.id] || 0;
  const out = p.seasonality === 'out';
  const swap = out ? PRODUCE.map((x) => decorate(x, band)).find((x) => x.seasonality !== 'out' && x.tab === p.tab && x.hasPrint && x.id !== p.id) : null;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--color-background-body)', zIndex: 20, display: 'flex', flexDirection: 'column', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <div style={{ position: 'relative', background: 'var(--color-background-body)', paddingTop: 12, borderBottom: '1px solid #d9cfbe' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px' }}>
          <button className="gd-btn gd-btn--icon-only" style={{ background: 'rgba(255,255,255,.7)', backdropFilter: 'blur(4px)' }} aria-label="Back" onClick={onClose}><span className="gd-btn__icon"><Icon d={I.back} size={20} /></span></button>
          {p.seasonality === 'peak' && <SeasonFlag p={p} />}
        </div>
        <div style={{ padding: '4px 0 12px', position: 'relative', ...thumbStyle(p) }}>
          <ProduceImg p={p} style={{ maxWidth: 320, height: 260, margin: '0 auto', ...inkStyle(p) }} />
        </div>
      </div>
      <div style={{ padding: '20px 20px 28px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="gd-badge gd-badge--green">{p.category}</span>
          <span className="gd-badge gd-badge--slate">{p.tab}</span>
        </div>
        <div style={{ margin: '0 0 6px' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 900, margin: 0, lineHeight: 1.15 }}>{(lang && p.name_local[lang]) || p.name}</h1>
          {lang && p.name_local[lang] && p.name_local[lang] !== p.name && (
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{p.name}</div>
          )}
        </div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 14 }}>{p.category} · {p.season}</div>
        {/* clear vitality line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          {p.seasonality !== 'peak' && <SeasonFlag p={p} />}
          <span style={{ fontSize: 13.5, fontWeight: 700, color: out ? 'var(--color-text-secondary)' : 'var(--color-text-accent)' }}>{VITALITY[p.seasonality]}</span>
        </div>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>{out ? ('Best enjoyed in its season: ' + p.season + '.') : ('In season in ' + countryLabel(country) + ' right now — a good week to buy it. Season: ' + p.season + '.')}</p>

        {out && (
          <div className="gd-card" style={{ marginBottom: 20, padding: 16, background: 'var(--color-error-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ color: 'var(--color-paprika)' }}><Icon d={I.info} size={18} w={2.4} /></span>
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-paprika)' }}>Better in {p.season}</span>
            </div>
            <div style={{ marginBottom: swap ? 14 : 0 }}><PaprikaTip text={outAdvice(p, country)} /></div>
            {swap && (
              <button onClick={() => onOpen(swap.id)} style={{ width: '100%', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 'var(--radius-element)', background: 'var(--color-background-surface)', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', fontFamily: 'var(--font-body)', boxShadow: 'var(--shadow-low)' }}>
                <div style={{ flexShrink: 0 }}><ProduceThumb p={swap} size={40} radius={12} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-accent)', ...MONO }}>In season instead</div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{(lang && swap.name_local[lang]) || swap.name}</div>
                </div>
                <span style={{ color: 'var(--color-text-accent)' }}><Icon d={I.arrow} size={20} /></span>
              </button>
            )}
          </div>
        )}

        {p.selection && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, ...MONO, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
              <Icon d={I.eye} size={14} w={2} style={{ color: 'var(--color-text-tertiary)' }} /> How to choose
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.55, color: 'var(--color-text-secondary)', margin: 0 }}>{p.selection}</p>
          </div>
        )}

        <div className="gd-card gd-card--muted" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 22 }}>
          {[['Type', p.category], ['Tab', p.tab], ['Season', out ? 'Out now' : 'In season']].map(([k, v]) => (
            <div key={k}><div style={{ fontWeight: 800, fontSize: 15 }}>{v}</div><div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{k}</div></div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto', position: 'sticky', bottom: 0, background: 'var(--color-background-surface)', borderTop: '1px solid var(--color-border)', padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <AddControl p={p} qty={qty} onAdd={onAdd} size="lg" block />
      </div>
    </div>
  );
}

/* ================= One-time preferences ================= */
const DIETS = [['none', 'No limits'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan']];
const ALLERGIES = ['Nuts', 'Dairy', 'Gluten', 'Eggs', 'Shellfish', 'Soy'];

/* ================= First-run onboarding walkthrough =================
   Shown once, gated by the persisted gd_onboarded flag. Three forward-only
   steps (welcome, market, diet & allergies); "Get started" persists prefs +
   the market and lands on Home. Replaces the first-run role of PrefsScreen. */
function OnboardScreen({ country, onSetCountry, prefs, onDone }) {
  const [step, setStep] = React.useState(0);
  // Pre-fill from existing prefs so a returning user who taps through keeps
  // their saved diet/allergies; new users start at the defaults.
  const [diet, setDiet] = React.useState((prefs && prefs.diet) || 'none');
  const [allergies, setAllergies] = React.useState((prefs && prefs.allergies) || []);
  const toggle = (a) => setAllergies((s) => s.indexOf(a) === -1 ? s.concat(a) : s.filter((x) => x !== a));
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--color-background-body)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '48px 26px 12px', overflow: 'auto' }}>
        {step === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
            <img src={ASSET('gd/assets/wordmark_green.svg')} alt="green days" style={{ width: '78%', maxWidth: 340, height: 'auto', display: 'block', marginLeft: -3, marginBottom: 22 }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.55, color: 'var(--color-text-secondary)', margin: 0, maxWidth: 300 }}>
              A quiet companion for the farmers market. We follow what's actually in season near you, and turn whatever's in your basket into something worth cooking.
            </p>
          </div>
        )}
        {step === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 34, lineHeight: 1.05, color: 'var(--color-accent)', marginBottom: 8 }}>Where's your market?</div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5, color: 'var(--color-text-secondary)', margin: '0 0 26px', maxWidth: 320 }}>
              This sets the local language on produce and what's in season right now. You can change it anytime from Home.
            </p>
            {/* The 14 markets from markets.json; picking one sets the app-wide
                country that drives produce language + climate band (Fix 7). */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {COUNTRIES.map(([code]) => {
                const on = code === country;
                return (
                  <button key={code} onClick={() => onSetCountry(code)} className="gd-list-item" style={{ borderRadius: 0, border: '1px solid ' + (on ? 'var(--color-accent)' : '#d9cfbe'), background: on ? 'var(--color-accent-muted, #e9f0d6)' : 'var(--color-background-body)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>{countryLabel(code)}, {MONTH_NAME}</span>
                    {on && <Icon d={I.check} size={18} w={2.6} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: 34, lineHeight: 1.05, color: 'var(--color-accent)', marginBottom: 8 }}>Diet &amp; allergies</div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5, color: 'var(--color-text-secondary)', margin: '0 0 26px', maxWidth: 320 }}>
              Set these once and every recipe quietly follows. You can change them anytime from Home.
            </p>
            <div style={{ fontSize: 12, ...MONO, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>How you eat</div>
            <div className="gd-segmented" style={{ display: 'flex', width: '100%', marginBottom: 28 }}>
              {DIETS.map(([v, lbl]) => (
                <button key={v} className={'gd-segmented__item' + (v === diet ? ' gd-segmented__item--active' : '')} style={{ flex: 1, padding: '10px 4px', fontSize: 14 }} onClick={() => setDiet(v)}>{lbl}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, ...MONO, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>Anything to avoid</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {ALLERGIES.map((a) => {
                const on = allergies.indexOf(a) !== -1;
                return (
                  <button key={a} className={'gd-tag' + (on ? ' gd-tag--selected' : '')} style={{ height: 44, paddingInline: 18, fontSize: 15 }} onClick={() => toggle(a)}>
                    {on && <span className="gd-tag__icon"><Icon d={I.check} size={15} w={2.8} /></span>}{a}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', flexShrink: 0 }}>
        <button className="gd-btn gd-btn--primary gd-btn--lg gd-btn--block" onClick={() => (step < 2 ? setStep(step + 1) : onDone(diet, allergies))}>
          <span>{step < 2 ? 'Next' : 'Get started'}</span>
        </button>
      </div>
    </div>
  );
}

function PrefsScreen({ prefs, firstRun, country, onSetCountry, onSave, onClose }) {
  const [diet, setDiet] = React.useState(prefs.diet || 'none');
  const [allergies, setAllergies] = React.useState(prefs.allergies || []);
  const [market, setMarket] = React.useState(country || 'PT');
  const toggle = (a) => setAllergies((s) => s.indexOf(a) === -1 ? s.concat(a) : s.filter((x) => x !== a));
  const save = () => { if (market !== country) onSetCountry(market); onSave({ diet, allergies }); };
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--color-background-body)', zIndex: 40, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ flex: 1, padding: '22px 22px 12px' }}>
        {!firstRun && (
          <button onClick={onClose} aria-label="Close" className="gd-btn gd-btn--icon-only" style={{ background: 'var(--color-neutral)', marginBottom: 10 }}><span className="gd-btn__icon"><Icon d={I.x} size={18} /></span></button>
        )}
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: 34, lineHeight: 1.05, color: 'var(--color-accent)' }}>A few quick things</div>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--color-text-secondary)', margin: '8px 0 26px' }}>Set these once and every recipe quietly follows. We won't ask again.</p>

        {/* Market — displays the current location and lets the shopper pick
            another; a real <select> overlays the row (same picker as Home). */}
        <div style={{ fontSize: 12, ...MONO, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>Where you shop</div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 'var(--radius-element)', border: '1px solid var(--color-border)', background: 'var(--color-background-surface)' }}>
            <Icon d={I.pin} size={18} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>{countryLabel(market)}</span>
            <Icon d={I.chevron} size={18} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, transform: 'rotate(90deg)' }} />
          </div>
          <select className="gd-locpick" aria-label="Market country" value={market} onChange={(e) => setMarket(e.target.value)}>
            {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-text-tertiary)', margin: '0 0 28px' }}>Sets your market's produce names and what's in season.</p>

        <div style={{ fontSize: 12, ...MONO, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>How you eat</div>
        <div className="gd-segmented" style={{ display: 'flex', width: '100%', marginBottom: 28 }}>
          {DIETS.map(([v, lbl]) => (
            <button key={v} className={'gd-segmented__item' + (v === diet ? ' gd-segmented__item--active' : '')} style={{ flex: 1, padding: '10px 4px', fontSize: 14 }} onClick={() => setDiet(v)}>{lbl}</button>
          ))}
        </div>

        <div style={{ fontSize: 12, ...MONO, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>Anything to avoid</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {ALLERGIES.map((a) => {
            const on = allergies.indexOf(a) !== -1;
            return (
              <button key={a} className={'gd-tag' + (on ? ' gd-tag--selected' : '')} style={{ height: 44, paddingInline: 18, fontSize: 15 }} onClick={() => toggle(a)}>
                {on && <span className="gd-tag__icon"><Icon d={I.check} size={15} w={2.8} /></span>}{a}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--color-background-surface)', borderTop: '1px solid var(--color-border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="gd-btn gd-btn--primary gd-btn--lg gd-btn--block" onClick={save}>
          <span>{firstRun ? 'Save and start shopping' : 'Save'}</span>
        </button>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>Change these anytime from Home</div>
      </div>
    </div>
  );
}

/* ================= App shell ================= */
const BASKET_KEY = 'gd_basket', HISTORY_KEY = 'gd_recipes', PREFS_KEY = 'gd_prefs', COUNTRY_KEY = 'gd_country', ONBOARD_KEY = 'gd_onboarded';
const HRS36 = 36 * 3600 * 1000;

export default function GreenDaysApp() {
  const [tab, setTab] = React.useState('home');
  const [detail, setDetail] = React.useState(null);
  const [homeQuery, setHomeQuery] = React.useState(''); // Home search, lifted so other screens can pre-fill it
  // recipeView: null | { status: 'loading'|'ready'|'error', entry, error, live }
  const [recipeView, setRecipeView] = React.useState(null);
  const sessionAvoid = React.useRef([]);
  const liveEntryId = React.useRef(null); // the not-yet-committed entry "Try another" may swap

  // Pin the layout to the true visible viewport. iOS Safari's 100dvh can stick
  // at the toolbar-expanded value when nothing scrolls, floating the tab bar
  // above the real bottom; visualViewport.height tracks the toolbar collapse.
  React.useEffect(() => {
    const vv = window.visualViewport;
    const setH = () => {
      const h = (vv && vv.height) || window.innerHeight;
      document.documentElement.style.setProperty('--app-height', h + 'px');
    };
    setH();
    window.addEventListener('resize', setH);
    window.addEventListener('orientationchange', setH);
    if (vv) { vv.addEventListener('resize', setH); vv.addEventListener('scroll', setH); }
    return () => {
      window.removeEventListener('resize', setH);
      window.removeEventListener('orientationchange', setH);
      if (vv) { vv.removeEventListener('resize', setH); vv.removeEventListener('scroll', setH); }
    };
  }, []);

  // Basket persists and auto-clears 36 hours after the first item is added to
  // an empty basket; the timer resets with each new shop.
  const [basketState, setBasketState] = React.useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(BASKET_KEY));
      if (s && s.items) return (s.startedAt && Date.now() - s.startedAt > HRS36) ? { items: {}, startedAt: null } : s;
    } catch (e) { /* fresh start */ }
    return { items: {}, startedAt: null };
  });
  const basket = basketState.items;
  const setBasket = (updater) => setBasketState((st) => {
    const items = typeof updater === 'function' ? updater(st.items) : updater;
    const had = Object.keys(st.items).length > 0, has = Object.keys(items).length > 0;
    let startedAt = st.startedAt;
    if (!had && has) startedAt = Date.now();
    if (!has) startedAt = null;
    const nx = { items, startedAt };
    try { localStorage.setItem(BASKET_KEY, JSON.stringify(nx)); } catch (e) { /* private mode */ }
    return nx;
  });
  // auto-clear once the 36h window elapses (also catches expiry while open)
  React.useEffect(() => {
    if (!basketState.startedAt) return;
    const ms = basketState.startedAt + HRS36 - Date.now();
    if (ms <= 0) { setBasket({}); return; }
    const t = setTimeout(() => setBasket({}), ms);
    return () => clearTimeout(t);
  }, [basketState.startedAt]);

  // Made recipes — the Recipes tab.
  const [history, setHistory] = React.useState(() => {
    try { const s = JSON.parse(localStorage.getItem(HISTORY_KEY)); if (Array.isArray(s)) return s; } catch (e) { /* fresh */ }
    return [];
  });
  const persistHistory = (h) => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50))); } catch (e) { /* full */ } };

  const [checked, setChecked] = React.useState({});
  const [prefs, setPrefs] = React.useState(() => {
    try { const s = JSON.parse(localStorage.getItem(PREFS_KEY)); if (s) return s; } catch (e) { /* fresh */ }
    return { diet: 'none', allergies: [], seen: false };
  });
  // The editable-later prefs modal never auto-opens; the onboarding walkthrough
  // owns first-run. Only the Home settings icon opens PrefsScreen.
  const [showPrefs, setShowPrefs] = React.useState(false);
  const savePrefs = (p) => {
    const np = { diet: p.diet, allergies: p.allergies, seen: true };
    setPrefs(np);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(np)); } catch (e) { /* private mode */ }
    setShowPrefs(false);
  };

  // First-run onboarding gate. Governed solely by the persisted flag: existing
  // users (seen prefs, no flag) see the walkthrough once more, then never again.
  // Their saved diet/allergies pre-fill it, so tapping through preserves them.
  const [onboarded, setOnboarded] = React.useState(() => {
    try { return localStorage.getItem(ONBOARD_KEY) === '1'; } catch (e) { return false; }
  });
  const finishOnboarding = (diet, allergies) => {
    const np = { diet, allergies, seen: true };
    setPrefs(np);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(np)); } catch (e) { /* private mode */ }
    pickCountry(country);            // lock in the confirmed/auto-detected market
    try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) { /* private mode */ }
    setOnboarded(true);
    setTab('home');
  };

  // Market country: edge-detected via the API, correctable from the header.
  const [country, setCountry] = React.useState(() => {
    try { return localStorage.getItem(COUNTRY_KEY) || 'PT'; } catch (e) { return 'PT'; }
  });
  const [countryPicked] = React.useState(() => {
    try { return !!localStorage.getItem(COUNTRY_KEY); } catch (e) { return false; }
  });
  const [weather, setWeather] = React.useState('21°, clear');
  React.useEffect(() => {
    fetch(ASSET('api/context'))
      .then((r) => (r.ok ? r.json() : null))
      .then((ctx) => {
        if (!ctx) return;
        if (ctx.weather) setWeather(ctx.weather);
        // Europe-first: only adopt the edge country when it's a market we
        // carry language/season data for; otherwise stay on the default.
        if (!countryPicked && ctx.country && COUNTRIES.some(([c]) => c === ctx.country)) setCountry(ctx.country);
      })
      .catch(() => { /* offline or vite-only dev: keep defaults */ });
  }, []);
  const pickCountry = (c) => {
    setCountry(c);
    try { localStorage.setItem(COUNTRY_KEY, c); } catch (e) { /* private mode */ }
  };
  const lang = langOf(country);

  const add = (id, n) => setBasket((b) => ({ ...b, [id]: (b[id] || 0) + n }));
  const setQty = (id, n) => setBasket((b) => { const c = { ...b }; if (n <= 0) delete c[id]; else c[id] = n; return c; });
  const toggle = (id) => setChecked((c) => ({ ...c, [id]: !c[id] }));
  const count = Object.values(basket).reduce((s, n) => s + n, 0);

  /* Cook this: generate live, open, and append to Recipes. "Try another"
     swaps the current one before it is committed (i.e. while still open). */
  const cook = async (avoid) => {
    const ids = Object.keys(basket).filter((id) => basket[id] > 0);
    if (ids.length === 0) return;
    setDetail(null);
    setRecipeView((v) => ({ status: 'loading', entry: v?.entry || { country, month0: MONTH }, live: true }));
    try {
      const recipe = await requestRecipe({ basket: ids, country, prefs, avoid });
      const entry = { id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), at: Date.now(), country, month0: MONTH, recipe };
      const swapId = avoid.length ? liveEntryId.current : null;
      setHistory((h) => {
        const nx = [entry, ...(swapId ? h.filter((e) => e.id !== swapId) : h)];
        persistHistory(nx);
        return nx;
      });
      sessionAvoid.current = [...avoid, recipe.title];
      liveEntryId.current = entry.id;
      setRecipeView({ status: 'ready', entry, live: true });
    } catch (err) {
      setRecipeView((v) => ({ ...v, status: 'error', error: err.message, live: true }));
    }
  };
  const cookThis = () => { sessionAvoid.current = []; liveEntryId.current = null; cook([]); };
  const tryAnother = () => cook(sessionAvoid.current);

  const openEntry = (id) => {
    const entry = history.find((e) => e.id === id);
    if (entry) setRecipeView({ status: 'ready', entry, live: false });
  };
  // Leaving the recipe screen commits it: the entry stays in Recipes and a
  // later "Try another" can no longer swap it.
  const closeRecipe = () => { setRecipeView(null); sessionAvoid.current = []; liveEntryId.current = null; };
  // Leave the recipe and land on Home with a term pre-filled in search (used as
  // the fallback for an unmatched "grab one more" suggestion).
  const searchProduce = (term) => { setHomeQuery(term); setDetail(null); closeRecipe(); setTab('home'); };

  const navItems = [
    { id: 'home', d: I.home, label: 'Home' },
    { id: 'list', d: I.basket, label: 'Basket' },
    { id: 'recipes', d: I.chef, label: 'Recipes' },
  ];

  return (
    <div className="gd-stage">
      <div className="gd-phone">
        <div className="gd-statusbar">
          <span>9:41</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="6" width="3" height="5" rx="1"/><rect x="4.5" y="4" width="3" height="7" rx="1"/><rect x="9" y="2" width="3" height="9" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
            <svg width="22" height="11" viewBox="0 0 24 12" fill="none"><rect x="1" y="1" width="19" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.2"/><rect x="2.5" y="2.5" width="14" height="7" rx="1.2" fill="currentColor"/><rect x="21" y="4" width="2" height="4" rx="1" fill="currentColor"/></svg>
          </span>
        </div>

        {/* The wrap is the positioning context for full-screen overlays, so
            they cover the visible screen no matter how far the grid behind
            them is scrolled; only .gd-screen itself scrolls. */}
        <div className="gd-screen-wrap">
          <div className="gd-screen">
            {tab === 'home' && <HomeScreen basket={basket} lang={lang} country={country} onSetCountry={pickCountry} weather={weather} query={homeQuery} setQuery={setHomeQuery} onAdd={add} onOpen={setDetail} onCook={cookThis} onOpenPrefs={() => setShowPrefs(true)} />}
            {tab === 'list' && <ListScreen basket={basket} checked={checked} lang={lang} country={country} onAdd={add} onRemove={(id) => setQty(id, 0)} onToggle={toggle} onOpen={setDetail} onCook={cookThis} />}
            {tab === 'recipes' && <RecipesListScreen history={history} onOpenEntry={openEntry} onGoHome={() => setTab('home')} />}
          </div>
          {recipeView && (
            <RecipeDetailScreen view={recipeView} onOpen={setDetail} onSearchProduce={searchProduce} onClose={closeRecipe}
              onGoHome={() => { closeRecipe(); setTab('home'); }} onTryAnother={tryAnother} />
          )}
          {detail && <DetailScreen id={detail} basket={basket} lang={lang} country={country} onAdd={add} onClose={() => setDetail(null)} onOpen={setDetail} />}
          {showPrefs && <PrefsScreen prefs={prefs} firstRun={!prefs.seen} country={country} onSetCountry={pickCountry} onSave={savePrefs} onClose={() => setShowPrefs(false)} />}
        </div>

        {/* Tab bar is hidden until onboarding completes */}
        {onboarded && (
          <div className="gd-tabbar">
            {navItems.map((n) => {
              const active = (recipeView ? 'recipes' : tab) === n.id;
              return (
                <button key={n.id} className="gd-tab" onClick={() => { setTab(n.id); setDetail(null); closeRecipe(); }} style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>
                  <span style={{ position: 'relative' }}>
                    <Icon d={n.d} size={24} w={2} filled={active} />
                    {n.id === 'list' && count > 0 && <span className="gd-tab__count">{count}</span>}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{n.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* First-run walkthrough — covers the whole phone until "Get started" */}
        {!onboarded && <OnboardScreen country={country} onSetCountry={pickCountry} prefs={prefs} onDone={finishOnboarding} />}
      </div>
    </div>
  );
}
