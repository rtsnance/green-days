/* Green Days — the market year: /market-year/ and its 24 turning-day pages.

   Runs after `vite build`, alongside scripts/build-field-guide.mjs, and works
   the same way: read canon out of data/, render plain HTML into dist/. No
   client JS on the child pages, so a crawler gets real markup on first fetch.

   What it emits:
     dist/market-year/index.html        the walk, with the 24-day index as the
                                        page underneath it
     dist/market-year/turning-days.js   the walk's data module — GENERATED
     dist/market-year/<slug>/index.html one per turning day, 24 of them
     dist/_sitemap/market-year.json     url fragment for scripts/build-sitemap.mjs

   public/market-year/ carries the parts that are hand-authored and never
   derived — walk.js, theme.js, plates/*.png — and Vite copies them into
   dist/market-year/ before this script runs. So the built directory is half
   copied, half generated, and turning-days.js is always the generated half.

   ⚠ Nothing here may be hand-edited in dist/. The whole reason this file
   exists is that the design build PASTED the 24 days instead of importing
   them, and the paste lowercased the first character of every working_name —
   "bartholomew wipes the rain", "são João fires", "michaelmas geese". Casing
   comes through verbatim below and there is no second copy to drift. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seasonalityOf, seasonNameForMonth, doy, fromDoy } from '../src/season.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT, 'dist');
const OUT_DIR = path.join(DIST_DIR, 'market-year');
const PLATES_DIR = path.join(ROOT, 'public/market-year/plates');
const SITE_URL = 'https://greendays.day';

// Trailing slash, like /season/ and /produce/<id>/. The handoff's INTEGRATION.md
// wrote /market-year bare; the directory form is what the assets binding serves
// natively and what keeps relative URLs inside the page resolving, so the whole
// site stays on one convention.
const BASE = '/market-year/';

// The unfurl card, shared by the index and all 24 turning-day pages. Until this
// existed every one of the 25 pages unfurled with the site-wide /assets/og.png,
// which is a produce still-life and says nothing about a calendar. Built by
// scripts/render-og.mjs; the file is committed at public/og/market-year.png.
// A per-day card is the obvious next step and would slot in here as a function.
const OG = {
  url: '/og/market-year.png',
  width: 1200,
  height: 630,
  alt: 'The market year: twenty-four turning days, their names and the dates they fall on.',
};

const CANON = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/turning-days.json'), 'utf8'));
const PRODUCE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/produce.json'), 'utf8'));
const BY_ID = new Map(PRODUCE.map((p) => [p.id, p]));
// Which produce ids have a written field-guide entry — those get a link out of
// the stall list, the rest are named in plain text rather than linked to a 404.
const GUIDE_IDS = new Set(
  fs.readdirSync(path.join(ROOT, 'content/produce')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3))
);

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Quarters, from the shared module rather than a fourth private copy of the
// table. This is the ONLY thing quarters are still used for here — the "Season"
// line on the child page and the riser hue in the walk, both of which are the
// "visual device" role src/season.js reserves them for. Nothing about what is
// in season goes through this. theme.js keys SEASON_HUE with initial capitals.
const seasonOf = (month1) => {
  const s = seasonNameForMonth(month1 - 1);
  return s[0].toUpperCase() + s.slice(1);
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Slugs become permalinks the moment this deploys, so they are derived by one
// rule and never hand-listed: the day's English name, ASCII-folded, lowercased.
// This deliberately does NOT use canon's `slug_candidate`, which is provisional
// by its own _meta ("provisional until the per-day polyglot slug pass") and
// mixes conventions — `valentine`, `sant-jordi`, `sao-joao` next to `martinmas`.
// The folded-name rule matches the anchor ids already in the walk's index and
// gives every URL the same shape. See MARKET-YEAR.md before changing it.
const slugify = (name) =>
  name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // fold é → e, ã → a
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---- what is on the stall at a given turn ----
   This used to be read out of `plate_candidates` in turning-days.json — 1,163
   rows computed on 30 July 2026, outside this repo, and frozen. It is computed
   here now, so the market year tracks whatever the season model says instead of
   asserting what it said in July. See SEASON-SEAM.md for the measurement that
   motivated the move; the short version is that the frozen data gave the 24
   turns only 8 distinct stall lists, grouped by calendar quarter.

   Three rules, and they are the whole of it:

   1. PERENNIALS ARE NOT ARRIVALS. Anything the label calls year-round, or
      stored out of an earlier harvest, is on the stall at every turn and so
      distinguishes none of them. Onions, mushrooms, hard herbs and stored
      apples are excluded. This is the one editorial filter and it is why a
      turn's list reads as "what turned up" rather than "what you could buy".
      (Deliberately NOT keyed on `availability`, which only some items carry.
      "(Med/imported)" items like avocado and lime DO stay — they are a real
      Mediterranean winter arrival, and canon kept them too.)
   2. AN ITEM IS ON THE STALL IF EITHER BAND HAS IT, and the page marks which.
      Canon's _meta assumes "mediterranean band = superset" and computed on that
      band alone. Measured against the ranges, that is false for 35 items at
      some turn midpoint — the derive convention runs Mediterranean windows 15
      days earlier at BOTH ends, which makes them shifted, not containing. So a
      northern late-season item can be in season temperate and out Med, and the
      superset rule drops it silently. Blackberry is the case that proves it:
      Old Michaelmas is "The devil's blackberries", the folk date after which
      they are not picked, and under the superset rule the page could not show a
      blackberry at all because the Med window closed on 30 September.
      `med_only` marks what a temperate market will not have (no avocados at
      Candlemas); `north_only` marks the converse.
   3. SAMPLED AT THE TURN'S MIDPOINT, which is what canon did. A turn is really
      a 7-to-25-day window and sampling the window is the better question —
      `seasonalityOf` takes a date, so it is a loop, not a redesign — but that
      is a deliberate step 4 in SEASON-HANDOFF.md, after launch.

   `seasonalityOf` prefers each item's `season_ranges` and falls back to the
   prose parser per item, so this improves on its own as ranges are extended.
   Worth knowing: canon's own numbers came from a FINER parser than the one the
   app ships (it honoured "Late spring"; `legacySeasonalityOf` does not). So
   recomputing with the legacy parser alone would be a regression — 4 distinct
   signatures, worse than the frozen 8. It is the ranges that make this a win. */
/* PERENNIAL, two tests, and the second one is the one that works.

   The prose test is kept because it is cheap and it catches the honest labels.
   It is NOT sufficient: it reads `season`, a hand-written English string, and
   it misses "Year-round (peak autumn)" (carrot) and every item whose label
   says a season while its RANGES say the whole year.

   That gap opened on 2026-09-01, when the Portuguese national-production
   calendars were imported into `season_ranges`. Those sources report
   AVAILABILITY, not season: "cenoura, todo o ano" is true about a stall and
   false about a season. Eleven items ended up with 365-day windows and the
   mean Mediterranean window went to 166 days, 46% of the year. The stall
   flooded and `peak` fell from 76% of rows to 1%, because peak is the middle
   third of a window and almost nothing lands in the middle third of a year.

   Ryan's call, same day: keep `season_ranges` literal, and let the stall rule
   do the excluding. So the real test is computed from the data and states the
   exact reason MARKET-YEAR.md gives for excluding perennials in the first
   place: they "are on the stall at every turn and so distinguish none of them."

   An item in season at all 24 turn midpoints distinguishes nothing. That is
   not a threshold anyone has to defend. It is the definition, executed. */
const PERENNIAL = /year-round|stores/i;
const midpointOf = (d) => fromDoy(doy(d.opens) + Math.floor((d.days - 1) / 2));

const ALL_MIDPOINTS = CANON.days.map(midpointOf);
const alwaysOn = (item) => ALL_MIDPOINTS.every((t) =>
  seasonalityOf(item, t, 'mediterranean') !== 'out' || seasonalityOf(item, t, 'temperate') !== 'out');
const UBIQUITOUS = new Set(PRODUCE.filter(alwaysOn).map((i) => i.id));

function stallAt(mmdd) {
  const out = [];
  for (const item of PRODUCE) {
    if (PERENNIAL.test(item.season || '')) continue;
    if (UBIQUITOUS.has(item.id)) continue;   // present at all 24 turns: distinguishes nothing
    const med = seasonalityOf(item, mmdd, 'mediterranean');
    const temp = seasonalityOf(item, mmdd, 'temperate');
    if (med === 'out' && temp === 'out') continue;
    out.push({
      id: item.id,
      // The shared silhouette asset. Several ids map to one plate (damson→plum,
      // marrow→courgette, four tomatoes). Verified identical to canon's `plate`
      // on all 1,163 frozen rows before those rows were dropped.
      plate: item.illustration,
      peak: med === 'peak' || temp === 'peak',
      med_only: temp === 'out',
      north_only: med === 'out',
    });
  }
  return out;
}

/* ---- derive the 24 days from canon ----
   Canon keeps two clauses joined by " / " in both `name` and `working_name`:
     name          "St George / Sant Jordi"    → name + altName
     working_name  "Sant Jordi / blackthorn winter" → lore + produce
   The second clause of working_name is what the plate alternates to. Canon
   carries one on 11 of 24 days; where it is absent the plate holds the lore in
   both states rather than alternating to nothing (`alternates: false`). */
const days = CANON.days.map((d) => {
  const [name, altName = null] = d.name.split(' / ');
  const [lore, produce = null] = d.working_name.split(' / ');
  const [m, dd] = d.opens.split('-').map(Number);
  const midpoint = midpointOf(d);
  const candidates = stallAt(midpoint);

  // The day's own plates, in catalogue order, deduped.
  const silPool = [];
  for (const c of candidates) if (!silPool.includes(c.plate)) silPool.push(c.plate);
  // Three per sign, rotated by day number within the day's OWN pool, so
  // neighbouring signs differ and no sign ever shows something out of season.
  // (scripts/make-plates.py mirrors this rule to decide what to generate; if
  // the two drift, the warning at the bottom of this file fires.)
  const sil = [0, 1, 2].map((k) => silPool[(d.num + k) % silPool.length]);

  return {
    num: d.num, numeral: d.numeral, name, altName, slug: slugify(name),
    great: d.great_turn === true, m, d: dd, days: d.days,
    lore, produce, alternates: produce != null,
    season: seasonOf(m), sil, silPool,
    midpoint, candidates,
  };
});

if (days.length !== 24) throw new Error(`turning-days.json holds ${days.length} days, expected 24`);
const dupes = days.map((d) => d.slug).filter((s, i, a) => a.indexOf(s) !== i);
if (dupes.length) throw new Error(`slug collision: ${dupes.join(', ')} — permalinks must be unique`);

const opensShort = (d) => `${d.d} ${MONTHS_SHORT[d.m - 1]}`;
const opensLong = (d) => `${d.d} ${MONTHS_LONG[d.m - 1]}`;

/* ---- the generated data module ----
   walk.js imports DAYS and MISSING_PLATES from here. MISSING_PLATES is read off
   the filesystem rather than hand-listed: a plate with no PNG renders as no
   band at all — never a substitute — and the list empties itself as art lands. */
const havePlates = new Set(
  fs.existsSync(PLATES_DIR) ? fs.readdirSync(PLATES_DIR).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)) : []
);
const missingPlates = [...new Set(days.flatMap((d) => d.sil))].filter((p) => !havePlates.has(p)).sort();

function turningDaysModule() {
  const rows = days.map(({ num, numeral, name, altName, great, m, d, days: len, lore, produce, alternates, season, sil, silPool }) =>
    JSON.stringify({ num, numeral, name, altName, great, m, d, days: len, lore, produce, alternates, season, sil, silPool }));
  return `/* GENERATED by scripts/build-market-year.mjs from data/turning-days.json.
   Do not edit — edit the JSON. Casing is verbatim from canon's \`working_name\`;
   lowercasing the first character mangles Bartholomew, Michaelmas, Santiago,
   São João, Médard, Nicholas, Vincent and Candlemas. */
export const DAYS = [
${rows.map((r) => '  ' + r).join(',\n')}
];

/* No silhouette asset yet — render an empty band, never a substitute.
   Generate with: python3 scripts/make-plates.py */
export const MISSING_PLATES = ${JSON.stringify(missingPlates)};
`;
}

/* ---- the walk page ----
   The index is the page; the walk is the layer on top of it. The index is
   visually hidden but present in the markup (not display:none, which screen
   readers skip, and not injected by JS, which crawlers would not see).
   `?index` or no-JS promotes it to a normal scrolling page.

   Every row links to that day's own page. The click handler intercepts it to
   drive the walk instead — so the same href is a deep link for a crawler, a
   working navigation for a reader with no JS, and a jump-to-day for everyone
   else. It replaces the handoff's `#slug` anchors, which pointed nowhere. */
function indexRow(d) {
  return `      <li id="${d.slug}" class="my-row">
        <span class="my-num">${d.numeral}</span>
        <span>
          <a class="my-name${d.great ? ' my-name--great' : ''}" href="${BASE}${d.slug}/" data-day="${d.num}">${escapeHtml(d.name)}</a>
          <span class="my-epi">${escapeHtml(d.lore)}</span>
        </span>
        <span class="my-when">${opensShort(d)} &middot; ${d.days} days</span>
      </li>`;
}

function walkPage() {
  const title = 'The market year — 24 turning days | green days';
  const desc = 'Walk the European market year. Twenty-four turning days from Candlemas to St Vincent, each with the date it opens, how long it holds, and what is on the stall.';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#fcf8ee" />
    <meta name="description" content="${escapeHtml(desc)}" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${SITE_URL}${BASE}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="green days" />
    <meta property="og:title" content="The market year — 24 turning days" />
    <meta property="og:description" content="A first-person walk through the European market year. Twenty-four named days, Candlemas to St Vincent." />
    <meta property="og:url" content="${SITE_URL}${BASE}" />
    <meta property="og:image" content="${SITE_URL}${OG.url}" />
    <meta property="og:image:width" content="${OG.width}" />
    <meta property="og:image:height" content="${OG.height}" />
    <meta property="og:image:alt" content="${escapeHtml(OG.alt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="The market year — 24 turning days" />
    <meta name="twitter:description" content="A first-person walk through the European market year. Twenty-four named days, Candlemas to St Vincent." />
    <meta name="twitter:image" content="${SITE_URL}${OG.url}" />
    <meta name="twitter:image:alt" content="${escapeHtml(OG.alt)}" />

    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Annie+Use+Your+Telescope&family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

    <style>
      /* Inline rather than in field-guide.css: this page is a full-bleed canvas
         and its styles are used nowhere else, so a second render-blocking
         request would buy nothing. The child pages do use field-guide.css. */
      html, body { margin: 0; height: 100%; background: #fcf8ee; color: #1a2023;
        font-family: 'Nunito', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
      body { overflow: hidden }
      #gg-root { position: fixed; inset: 0 }

      #gg-index { position: absolute; width: 1px; height: 1px; overflow: hidden;
        clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap }
      html.gg-index-open { overflow: auto }
      html.gg-index-open body { overflow: auto }
      html.gg-index-open #gg-root { display: none }
      html.gg-index-open #gg-index { position: static; width: auto; height: auto;
        overflow: visible; clip: auto; clip-path: none; white-space: normal;
        max-width: 760px; margin: 0 auto; padding: 60px 24px 80px }

      #gg-index h1 { font-size: 38px; font-weight: 800; letter-spacing: -.018em; color: #1f3661; margin: 0 0 4px }
      .my-kicker { font-family: 'Annie Use Your Telescope', cursive; font-size: 26px; color: #b23c1a; margin: 0 0 20px }
      .my-lede { font-size: 16px; line-height: 1.62; max-width: 62ch; margin: 0 0 28px }
      #gg-index ol { list-style: none; padding: 0; margin: 0 }
      .my-row { border-top: 1px solid #e5e5ea; padding: 14px 0; display: grid;
        grid-template-columns: 56px 1fr auto; gap: 16px; align-items: baseline }
      .my-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
        letter-spacing: .2em; color: #4d606b }
      .my-name { font-size: 19px; font-weight: 700; color: #1f3661; text-decoration: none }
      .my-name--great { font-weight: 800 }
      .my-name:hover { text-decoration: underline }
      .my-epi { font-family: 'Annie Use Your Telescope', cursive; font-size: 18px; color: #b23c1a; margin-left: 10px }
      .my-when { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: .1em;
        text-transform: uppercase; color: #4d606b; white-space: nowrap }
      .my-foot { font-size: 14px; color: #4d606b; border-top: 1px solid #e5e5ea;
        padding-top: 16px; margin-top: 24px }
      .my-foot a { color: #35735b; font-weight: 700; text-decoration: none }
      .my-foot a:hover { text-decoration: underline }
    </style>
    <noscript><style>
      html, body { overflow: auto } #gg-root { display: none }
      #gg-index { position: static; width: auto; height: auto; overflow: visible; clip: auto;
        clip-path: none; white-space: normal; max-width: 760px; margin: 0 auto; padding: 60px 24px 80px }
    </style></noscript>
  </head>
  <body>
    <div id="gg-root"></div>

    <main id="gg-index">
      <h1>The market year</h1>
      <p class="my-kicker">twenty-four turning days</p>
      <p class="my-lede">
        The European produce year does not turn on the solstices. It turns on named days —
        Candlemas, Lady Day, Lammas, Michaelmas — the working calendar that markets, rents and
        plantings actually ran on. These are the twenty-four, with the date each opens and how
        long it holds. Eight are great turns; the other sixteen fill between them.
      </p>
      <ol>
${days.map(indexRow).join('\n')}
      </ol>
      <p class="my-foot">
        <a href="/">green days</a> &middot;
        <a href="/season/">What&rsquo;s in season now</a> &middot;
        <a href="https://thegreengageline.substack.com/?utm_source=greendays.day" rel="noopener">The Greengage Line</a>
      </p>
    </main>

    <!-- External, not inline: the Worker sends script-src 'self' with no
         'unsafe-inline' (worker/headers.js), so an inline module is blocked and
         the walk silently never starts. See public/market-year/boot.js. -->
    <script type="module" src="${BASE}boot.js"></script>
  </body>
</html>
`;
}

/* ---- one page per turning day ----
   The internal-linking fix, and the only place the produce actually gets
   named. Canon's `lore_leads` are explicitly research topics, not facts —
   _meta says "never copy to print as-is" — so nothing from that field appears
   here. What does appear is checkable: the numeral, the opening date, the
   length, the great-turn flag, canon's own working_name, and the stall list
   computed from produce.json. */
function stallList(d) {
  const items = d.candidates.map((c) => ({ ...c, produce: BY_ID.get(c.id) })).filter((c) => c.produce);
  const render = (c) => {
    const name = escapeHtml(c.produce.name_en);
    const label = GUIDE_IDS.has(c.id) ? `<a href="/produce/${c.id}/">${name}</a>` : name;
    // A band mark is the difference between a reference page and a
    // plausible-looking list: an item on the stall in Lisbon and nowhere near
    // one in Copenhagen has to say which, in whichever direction.
    const band = c.med_only ? ' <span class="my-med">Med</span>'
      : c.north_only ? ' <span class="my-med my-north">North</span>' : '';
    return `          <li class="my-stall-item">${label}${band}</li>`;
  };
  const peak = items.filter((c) => c.peak);
  const rest = items.filter((c) => !c.peak);
  return { peak, rest, html: { peak: peak.map(render).join('\n'), rest: rest.map(render).join('\n') } };
}

function dayPage(d, prev, next) {
  const canonical = `${SITE_URL}${BASE}${d.slug}/`;
  const stall = stallList(d);
  const desc = `${d.name} opens the market year's ${d.numeral} turn on ${opensLong(d)} and holds ${d.days} days — ${d.lore}. What is on the stall, and where it sits in the year.`;
  const epithet = d.alternates ? `${d.lore} &middot; ${escapeHtml(d.produce)}` : escapeHtml(d.lore);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#fcf8ee" />
    <meta name="description" content="${escapeHtml(desc)}" />
    <title>${escapeHtml(d.name)} — ${opensLong(d)} | the market year</title>
    <link rel="canonical" href="${canonical}" />
    <link rel="up" href="${SITE_URL}${BASE}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="green days" />
    <meta property="og:title" content="${escapeHtml(d.name)} — ${escapeHtml(d.lore)}" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SITE_URL}${OG.url}" />
    <meta property="og:image:width" content="${OG.width}" />
    <meta property="og:image:height" content="${OG.height}" />
    <meta property="og:image:alt" content="${escapeHtml(OG.alt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(d.name)} — ${escapeHtml(d.lore)}" />
    <meta name="twitter:description" content="${escapeHtml(desc)}" />
    <meta name="twitter:image" content="${SITE_URL}${OG.url}" />
    <meta name="twitter:image:alt" content="${escapeHtml(OG.alt)}" />

    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="/field-guide.css" />
  </head>
  <body>
    <main class="fg-page">
      <a class="fg-back" href="/" aria-label="green days — home">
        <img src="/logo-green.svg" alt="green days" width="132" height="38" />
      </a>
      <article class="fg-entry">
        <p class="fg-eyebrow">The market year &middot; ${d.numeral} of XXIV${d.great ? ' &middot; a great turn' : ''}</p>
        <h1>${escapeHtml(d.name)}</h1>
        ${d.altName ? `<p class="my-alt">also ${escapeHtml(d.altName)}</p>` : ''}
        <p class="my-epithet">${epithet}</p>
        <dl class="my-facts">
          <dt>Opens</dt><dd>${opensLong(d)}</dd>
          <dt>Holds</dt><dd>${d.days} days</dd>
          <dt>Season</dt><dd>${d.season}</dd>
        </dl>
        <p class="fg-body">
          ${escapeHtml(d.name)} is turn ${d.numeral} of the twenty-four the European market year
          runs on${d.great ? ', and one of the eight great turns' : ''}. It opens on ${opensLong(d)}
          and holds ${d.days} days, until ${escapeHtml(next.name)} takes over on ${opensLong(next)}.
        </p>
        <a class="fg-cta" href="${BASE}?day=${d.num}">Walk to ${escapeHtml(d.name)}</a>

        <h2 class="my-h2">On the stall</h2>
        <p class="my-note">
          What is in season at the middle of this turn, computed from the green days catalogue.
          <span class="my-med">Med</span> marks what only shows up in Mediterranean markets,
          <span class="my-med my-north">North</span> what only shows up north of them.
        </p>
        ${stall.peak.length ? `<p class="my-eyebrow-sm">At peak</p>
        <ul class="my-stall">
${stall.html.peak}
        </ul>` : ''}
        ${stall.rest.length ? `<p class="my-eyebrow-sm">Also about</p>
        <ul class="my-stall">
${stall.html.rest}
        </ul>` : ''}
      </article>
      <nav class="fg-nav my-prevnext">
        <a href="${BASE}${prev.slug}/">&larr; ${escapeHtml(prev.numeral)} ${escapeHtml(prev.name)}</a>
        <a href="${BASE}${next.slug}/">${escapeHtml(next.numeral)} ${escapeHtml(next.name)} &rarr;</a>
      </nav>
      <nav class="fg-nav">
        <a href="${BASE}">All twenty-four turning days &rarr;</a><br />
        <a href="/season/">What&rsquo;s in season now &rarr;</a>
      </nav>
      <p class="fg-line">The Greengage Line: dispatches from the market year, on every turning day.
        <a href="https://thegreengageline.substack.com/?utm_source=greendays.day" rel="noopener">Subscribe</a></p>
    </main>
  </body>
</html>
`;
}

/* ---- write ---- */
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'turning-days.js'), turningDaysModule());
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), walkPage());

for (let i = 0; i < days.length; i++) {
  const d = days[i];
  const prev = days[(i + days.length - 1) % days.length];
  const next = days[(i + 1) % days.length];
  const dir = path.join(OUT_DIR, d.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), dayPage(d, prev, next));
}

// Sitemap fragment. No lastmod: canon is a skeleton that will be revised day by
// day as the dispatches are written, and a lastmod that moves on every deploy
// is exactly the signal crawlers learn to discount. Add real dates here once
// the days carry their own revision dates.
fs.mkdirSync(path.join(DIST_DIR, '_sitemap'), { recursive: true });
fs.writeFileSync(
  path.join(DIST_DIR, '_sitemap', 'market-year.json'),
  JSON.stringify([{ loc: `${SITE_URL}${BASE}` }, ...days.map((d) => ({ loc: `${SITE_URL}${BASE}${d.slug}/` }))])
);

// What art the walk needs, for scripts/make-plates.py to read. Written here so
// the Python tool does not have to re-implement the stall rule or the rotation
// to know what to generate — the build says what it needs, the tool makes it,
// the PNGs are committed. Not shipped: data/ is not copied into dist/.
fs.writeFileSync(
  path.join(ROOT, 'data/market-year-plates.json'),
  JSON.stringify({
    _generated_by: 'scripts/build-market-year.mjs — do not hand-edit, it is overwritten every build',
    _what: 'Plate silhouettes the walk renders (3 per turn, rotated within each turn\'s own pool).',
    rendered: [...new Set(days.flatMap((d) => d.sil))].sort(),
    pool: [...new Set(days.flatMap((d) => d.silPool))].sort(),
  }, null, 2) + '\n'
);

const linked = new Set(days.flatMap((d) => d.candidates.map((c) => c.id).filter((id) => GUIDE_IDS.has(id))));
// The number that matters: how many of the 24 turns publish a stall list
// distinguishable from every other. It was 8 when this data was frozen in
// turning-days.json. If it drops, something in the season model got coarser.
const signatures = new Set(days.map((d) => JSON.stringify(d.candidates.map((c) => [c.id, c.peak]))));
const ranged = new Set(days.flatMap((d) => d.candidates.map((c) => c.id))).size;
const peakShare = days.reduce((n, d) => n + d.candidates.filter((c) => c.peak).length, 0);
const rows = days.reduce((n, d) => n + d.candidates.length, 0);

console.log(
  `market year: wrote ${BASE} + ${days.length} turning-day pages ` +
  `(${days.filter((d) => d.great).length} great turns), linking to ${linked.size} field-guide entries`
);
console.log(
  `  stall: ${rows} rows over ${ranged} distinct items, ${peakShare} at peak ` +
  `(${Math.round((peakShare / rows) * 100)}%) — ${signatures.size}/24 distinct stall lists`
);
if (signatures.size < 12) {
  console.warn(
    `  ⚠ only ${signatures.size} of 24 turns have a distinguishable stall list. Consecutive pages will ` +
    `publish near-identical content. Extend season_ranges (scripts/derive-season-ranges.mjs) — see SEASON-SEAM.md.`
  );
}
if (missingPlates.length) {
  console.warn(
    `  ⚠ ${missingPlates.length} plate silhouette${missingPlates.length === 1 ? '' : 's'} missing — ` +
    `${missingPlates.join(', ')}. Those signs render with no band at all. Fix: python3 scripts/make-plates.py`
  );
}
