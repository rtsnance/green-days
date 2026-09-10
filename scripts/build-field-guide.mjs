/* Green Days — field guide + almanac static page generator.
   Runs after `vite build` (see package.json). Reads content/produce/*.md,
   cross-checks each entry's id against data/produce.json (the same
   single-vocabulary discipline the worker enforces for the basket), and
   renders plain HTML files into dist/ — no client JS, so Pinterest/search
   get real markup and OG tags on first fetch, not an empty app shell. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { seasonalityOf } from '../src/season.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content/produce');
const RAW_DIR = path.join(ROOT, 'produce_raw');
const DIST_DIR = path.join(ROOT, 'dist');
const SITE_URL = 'https://greendays.day';

// ---- what /season/ counts as "in season" ----
//
// Phase 3 of the computed-seasons migration. /season/ used to split on a
// hand-set `in_season:` boolean in each entry's frontmatter, which is a
// snapshot of the day the entry was written and rots silently from there —
// measured 2026-08-18, 16 of 23 rows would have been wrong by 16 September.
// It now asks src/season.js the same question the app asks, so the page is
// correct on every build with no file edits.
//
// /season/ is ONE static page with no market context, so it has to pick a
// band. Mediterranean, because every entry is written from Iberian markets
// and its prose says so. A temperate reader gets a page that runs a couple of
// weeks early, which is the right way round for a guide whose promise is
// "noted as it turns up".
const SEASON_BAND = 'mediterranean';

// MM-DD. Overridable so the season split can be checked at any date without
// waiting for the calendar: GD_BUILD_DATE=09-20 node scripts/build-field-guide.mjs
const BUILD_MMDD = process.env.GD_BUILD_DATE || new Date().toISOString().slice(5, 10);

// Pinterest wants a vertical ~2:3 image; general OG unfurls (Slack, iMessage,
// Twitter) want landscape ~1.91:1. Both crops come from the same 1024×1024
// Midjourney source with no upscaling — see produce_raw/ below.
const PIN_SIZE = { width: 683, height: 1024 };
const CARD_SIZE = { width: 1024, height: 538 };
// Square display crop for the entry page itself. The raws are a print
// photographed on a deckle-edged sheet, so this is a plain downscale, not a
// crop — entries that have their own art read as prints, paper and all, while
// entries still on an archetype read as icons. That difference is deliberate.
const SQUARE_SIZE = { width: 640, height: 640 };
const RAW_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

// Pinterest's Auto-publish (Settings → Bulk create Pins → Connect RSS Feed)
// polls dist/produce/feed.xml within 24h and turns each <item> into a Pin on
// one chosen board. It reads <title>, <description>, <link>, and the image
// from <enclosure>/<media:content>. It has NO field for alt text and none for
// the AI-Modified flag — which is why the feed points at a SECRET staging
// board, so pins get labelled by hand before going public. RSS 2.0 only;
// Atom is not supported.
//
// FEED_SINCE is the duplicate guard. Everything first noted on or before this
// date was pinned by hand, and Pinterest will happily pin it again — so only
// entries whose first_noted is strictly AFTER this date enter the feed. Move
// it forward only once you have manually pinned past that point.
const FEED_SINCE = '2026-07-28';

// ⚠️ KILL SWITCH — set 2026-08-06, while Pinterest has greendays.day on its
// spam blocklist and an appeal is pending.
//
// The feed is unattended: Pinterest polls it within 24h of any deploy and pins
// whatever it finds. At the time this was set, six entries (damson, greengage,
// plum, blackberry, cantaloupe-melon, fig) were queued and would have fired the
// moment the next deploy landed — six more pins at a blocklisted destination,
// compounding exactly the velocity signal that is the most plausible cause of
// the block.
//
// Paused rather than fixed by moving FEED_SINCE forward: moving the date would
// mark those six as already hand-pinned and silently drop them from the queue
// for good. This keeps them waiting. Flip to false once Pinterest confirms the
// domain is unblocked — nothing else needs changing.
//
// 2026-08-31: cleared. The domain block lifted on 08-17 and the empty feed sat
// live and harmless for 13 days. Scheduling is now FEED_HOLD's job, below —
// FEED_PAUSED goes back to being an emergency stop, not a calendar.
const FEED_PAUSED = false;

// Batch release control, added 2026-08-31. Ids listed here are held OUT of
// feed.xml regardless of FEED_SINCE. Release a batch by deleting its ids and
// deploying. Unlike moving FEED_SINCE forward this is never lossy: a held entry
// still counts as queued in the build log and is one line away from publishing.
//
// Order is by SEASON, not by age — damson and cantaloupe-melon are the two
// oldest queued entries and both finished on 08-15.
//
// ✅ Batch 1, released 2026-08-31: plum, blackberry, grapes-black, grapes.
const FEED_HOLD = new Set([
  // Held indefinitely.
  'damson',           // out of season until Jul 2027; also the plum enclosure twin
  'greengage',        // already auto-published to staging TWICE — dedupe failed once already
  'cantaloupe-melon', // out of season until May 2027
  // Batch 2 (~15 Sep) — the set-6 pin-title split test, must release together.
  'olives',
  'horseradish',
  'swede',
  'kiwi',
  // Batch 3 (~29 Sep).
  'fig',
  'quince',           // ⚠️ hold until produce_raw/quince.png exists — its illustration is `pear`
]);

function findRawSource(id) {
  for (const ext of RAW_EXTENSIONS) {
    const p = path.join(RAW_DIR, id + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Crops both shapes from the raw source into dist/produce/<id>/, no upscale
// (fit: 'cover' only scales up if the source is smaller than the target,
// which shouldn't happen at 1024px — sharp will still do it rather than
// fail, so a too-small source degrades quietly instead of breaking the build).
async function makeOgCrops(id, outDir) {
  const src = findRawSource(id);
  if (!src) return null;
  const pinFile = 'og-pin.png';
  const cardFile = 'og-card.png';
  const squareFile = 'illustration.png';
  await sharp(src).resize(PIN_SIZE.width, PIN_SIZE.height, { fit: 'cover', position: 'centre' }).png().toFile(path.join(outDir, pinFile));
  await sharp(src).resize(CARD_SIZE.width, CARD_SIZE.height, { fit: 'cover', position: 'centre' }).png().toFile(path.join(outDir, cardFile));
  await sharp(src).resize(SQUARE_SIZE.width, SQUARE_SIZE.height, { fit: 'inside' }).png().toFile(path.join(outDir, squareFile));
  return { pinFile, cardFile, squareFile };
}

const PRODUCE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/produce.json'), 'utf8'));
const BY_ID = new Map(PRODUCE.map((p) => [p.id, p]));

// ---- frontmatter + minimal markdown ----
function parseEntry(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing --- frontmatter block`);
  const [, fmBlock, body] = match;
  const fm = {};
  for (const line of fmBlock.split('\n')) {
    if (!line.trim()) continue;
    const i = line.indexOf(':');
    if (i === -1) throw new Error(`${file}: malformed frontmatter line "${line}"`);
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    fm[key] = value;
  }
  for (const key of ['id', 'first_noted']) {
    if (!(key in fm)) throw new Error(`${file}: missing required frontmatter key "${key}"`);
  }
  // `in_season` used to be required here and used to decide the /season/ split.
  // It is now LEGACY and advisory only — the split is computed below from
  // data/produce.json. Entries no longer carry the key; if one reappears and
  // disagrees with the computed answer, the build says so rather than silently
  // preferring either.
  // Optional: `pin_title` and `pin_description` carry the Pinterest copy into
  // feed.xml. They exist because og:title ("Pomegranate — green days field
  // guide") is far weaker for Pinterest search than a keyword-first line like
  // "How to Pick and Open a Pomegranate — European Market Field Guide".
  // Values may contain colons — only the first colon splits key from value.
  return { ...fm, body: body.trim(), file };
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// *italic* → <em>, everything else escaped. Single-paragraph bodies only.
function renderBody(md) {
  return escapeHtml(md).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function plainText(md) {
  return md.replace(/\*([^*]+)\*/g, '$1');
}

function excerpt(md, max = 155) {
  const text = plainText(md).replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : text.slice(0, max - 1).trim() + '…';
}

// ---- entries ----
if (!fs.existsSync(CONTENT_DIR)) throw new Error(`missing ${CONTENT_DIR}`);
const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
if (files.length === 0) throw new Error(`no entries found in ${CONTENT_DIR}`);

const entries = files.map((f) => parseEntry(path.join(CONTENT_DIR, f))).map((entry) => {
  const produce = BY_ID.get(entry.id);
  if (!produce) {
    throw new Error(
      `content/produce/${path.basename(entry.file)}: id "${entry.id}" not found in data/produce.json — ` +
      `field-guide entries must use an exact, existing produce id.`
    );
  }
  return { ...entry, produce };
});

entries.sort((a, b) => (a.first_noted < b.first_noted ? 1 : a.first_noted > b.first_noted ? -1 : 0));

// ---- templates ----
// Wordmark home link, shared by the entry pages and the almanac. public/
// logo-green.svg is the identity asset with its viewBox trimmed to the
// artwork's bounds, so the intrinsic ratio (592×172) is the drawn ratio and
// the header spacing below it is CSS, not baked-in whitespace.
const BACK_LINK = `      <a class="fg-back" href="/" aria-label="green days — home">
        <img src="/logo-green.svg" alt="green days" width="132" height="38" />
      </a>`;

// Quiet footer link to The Greengage Line (the Substack). The field-guide
// pages are the Pinterest-discovered surface, so every permanent page feeds
// the list. Plain outbound link — nothing tracked on our side; utm_source
// only tells Substack's own dashboard where a subscriber came from.
const LINE_LINK = `      <p class="fg-line">The Greengage Line: dispatches from the market year, on every turning day.
        <a href="https://thegreengageline.substack.com/?utm_source=greendays.day" rel="noopener">Subscribe</a></p>`;

// Every entry links up to the almanac. This is the internal link that was
// missing: before it, /season/ had no inbound href anywhere in the build, so a
// crawler landing on one entry could not discover the rest of the guide, and
// nothing at all linked to /season/. The link graph — not the sitemap — is what
// keeps the tree reachable if a sitemap fetch is ever missed.
// The market-year link is the second half of that fix: /market-year/ and its 24
// turning-day pages are generated by scripts/build-market-year.mjs, and the
// stall list on each of those pages links back down into these entries. The two
// trees only form one graph if the link runs both ways.
const ALMANAC_LINK = `      <nav class="fg-nav"><a href="/season/">What&rsquo;s in season now &rarr;</a><br />
        <a href="/market-year/">The market year &mdash; 24 turning days &rarr;</a></nav>`;

// `images`: ordered list of { url, width, height, alt } — repeated og:image
// property groups, first one is the default most crawlers show.
// `twitterImage`: the single image twitter:image points at (landscape reads
// best for summary_large_image).
function pageShell({ title, description, canonical, images, twitterImage, bodyHtml }) {
  const ogImageTags = images.map((img) => `    <meta property="og:image" content="${img.url}" />
${img.width ? `    <meta property="og:image:width" content="${img.width}" />\n` : ''}${img.height ? `    <meta property="og:image:height" content="${img.height}" />\n` : ''}    <meta property="og:image:alt" content="${escapeHtml(img.alt)}" />`).join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#fcf8ee" />
    <meta name="description" content="${escapeHtml(description)}" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${canonical}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="green days" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
${ogImageTags}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${twitterImage.url}" />
    <meta name="twitter:image:alt" content="${escapeHtml(twitterImage.alt)}" />

    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="/field-guide.css" />
  </head>
  <body>
${bodyHtml}
  </body>
</html>
`;
}

async function entryPage(entry) {
  const { produce } = entry;
  const canonical = `${SITE_URL}/produce/${produce.id}/`;
  const desc = excerpt(entry.body);
  const alt = `${produce.name_en} — a linocut-style illustration from green days`;

  const outDir = path.join(DIST_DIR, 'produce', entry.id);
  fs.mkdirSync(outDir, { recursive: true });
  const crops = await makeOgCrops(produce.id, outDir);

  // Prefer the vertical Pinterest crop as the default og:image (that's who
  // this content is for), the horizontal card crop as a second og:image for
  // generic unfurls, and the card crop again for twitter:image. No raw
  // source yet → fall back to the existing app illustration; a soft-quality
  // OG image beats no page.
  const images = crops
    ? [
        { url: `${SITE_URL}/produce/${produce.id}/${crops.pinFile}`, width: PIN_SIZE.width, height: PIN_SIZE.height, alt },
        { url: `${SITE_URL}/produce/${produce.id}/${crops.cardFile}`, width: CARD_SIZE.width, height: CARD_SIZE.height, alt },
      ]
    : [{ url: `${SITE_URL}/assets/produce/${produce.illustration}@2x.png`, alt }];
  const twitterImage = crops
    ? { url: `${SITE_URL}/produce/${produce.id}/${crops.cardFile}`, alt }
    : images[0];

  const bodyHtml = `    <main class="fg-page">
${BACK_LINK}
      <article class="fg-entry">
        ${crops
          ? `<img class="fg-illustration fg-illustration--print" src="/produce/${produce.id}/${crops.squareFile}" alt="${escapeHtml(produce.name_en)}" width="${SQUARE_SIZE.width}" height="${SQUARE_SIZE.height}" />`
          : `<img class="fg-illustration" src="/assets/produce/${produce.illustration}@2x.png" alt="${escapeHtml(produce.name_en)}" width="240" height="240" />`}
        <p class="fg-eyebrow">Field guide &middot; ${escapeHtml(produce.season)}</p>
        <h1>${escapeHtml(produce.name_en)}</h1>
        <p class="fg-body">${renderBody(entry.body)}</p>
        <a class="fg-cta" href="/?add=${encodeURIComponent(produce.id)}&src=field_guide">Add to basket</a>
        <p class="fg-noted">Noted ${escapeHtml(entry.first_noted)}</p>
      </article>
${ALMANAC_LINK}
${LINE_LINK}
    </main>`;
  return pageShell({
    title: `${produce.name_en} — green days field guide`,
    description: desc,
    canonical,
    images,
    twitterImage,
    bodyHtml,
  });
}

function seasonList(list) {
  return list.map((entry) => {
    const { produce } = entry;
    return `        <li class="fg-season-item">
          <a href="/produce/${produce.id}/">
            <img src="/assets/produce/${produce.illustration}@2x.png" alt="" width="64" height="64" />
            <span>
              <strong>${escapeHtml(produce.name_en)}</strong>
              <em>${escapeHtml(produce.season)}</em>
            </span>
          </a>
        </li>`;
  }).join('\n');
}

// Takes BOTH lists. The page still leads with what's in season — that's the
// honest headline and the reason to come back — but it now also lists the
// entries that are out of season, under their own heading. Without that second
// list an entry is unreachable for most of the year: /season/ is the only
// index, so anything filtered out of it has no inbound link at all until its
// season comes round. The heading keeps the distinction explicit rather than
// implying everything below is available now.
function seasonIndexPage(inSeason, offSeason) {
  const canonical = `${SITE_URL}/season/`;
  const desc = "What's in season right now, noted as it turns up at the market — green days' almanac.";
  const offSection = offSeason.length
    ? `      <header class="fg-season-header fg-season-header--rest">
        <h2 class="fg-eyebrow">Also in the guide, out of season now</h2>
      </header>
      <ul class="fg-season-list">
${seasonList(offSeason)}
      </ul>`
    : '';
  const bodyHtml = `    <main class="fg-page">
${BACK_LINK}
      <header class="fg-season-header">
        <p class="fg-eyebrow">Almanac</p>
        <h1>What's in season</h1>
      </header>
      <ul class="fg-season-list">
${seasonList(inSeason)}
      </ul>
${offSection}
      <nav class="fg-nav"><a href="/market-year/">The market year &mdash; 24 turning days &rarr;</a></nav>
${LINE_LINK}
    </main>`;
  const ogImage = { url: `${SITE_URL}/assets/og.png`, alt: 'green days — a linocut still-life of market produce' };
  return pageShell({
    title: "What's in season — green days",
    description: desc,
    canonical,
    images: [ogImage],
    twitterImage: ogImage,
    bodyHtml,
  });
}

// ---- RSS feed (Pinterest auto-publish) ----
// RFC 822 date, which RSS 2.0 requires. first_noted is a plain YYYY-MM-DD, so
// anchor it at midday UTC — that way no timezone shifts it onto the day before.
function rfc822(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`bad first_noted "${dateStr}" — expected YYYY-MM-DD`);
  return d.toUTCString();
}

// The vertical Pinterest crop when there's a raw source, otherwise the app's
// square illustration. `length` is a byte count RSS wants on <enclosure>; the
// crops are written before this runs, so statting them is safe.
function feedImage(entry) {
  const { produce } = entry;
  const pin = path.join(DIST_DIR, 'produce', entry.id, 'og-pin.png');
  if (fs.existsSync(pin)) {
    return { url: `${SITE_URL}/produce/${produce.id}/og-pin.png`, length: fs.statSync(pin).size };
  }
  const fallback = path.join(DIST_DIR, 'assets/produce', `${produce.illustration}@2x.png`);
  return {
    url: `${SITE_URL}/assets/produce/${produce.illustration}@2x.png`,
    length: fs.existsSync(fallback) ? fs.statSync(fallback).size : 0,
  };
}

function rssFeed(feedEntries) {
  const items = feedEntries.map((entry) => {
    const { produce } = entry;
    const link = `${SITE_URL}/produce/${produce.id}/`;
    const title = entry.pin_title || `${produce.name_en} — green days field guide`;
    // Pinterest shows a long description, so don't clip to the 155-char
    // og:description length — give it the whole note where there's no
    // hand-written pin_description.
    const description = entry.pin_description || excerpt(entry.body, 480);
    const img = feedImage(entry);
    return `    <item>
      <title>${escapeHtml(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${rfc822(entry.first_noted)}</pubDate>
      <description>${escapeHtml(description)}</description>
      <enclosure url="${img.url}" type="image/png" length="${img.length}" />
      <media:content url="${img.url}" medium="image" type="image/png" />
    </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>green days — seasonal produce field guide</title>
    <link>${SITE_URL}/season/</link>
    <description>Field notes on what turns up at European markets — local names, what to look for, and the simplest thing to do with it.</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/produce/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

// ---- sitemap fragment ----
// The internal links added above are what make the tree reachable by crawling,
// but a crawler only follows them once it re-fetches the shell. The sitemap is
// the direct route and the only one that works for a page with no inbound link
// anywhere on the open web — which, with Pinterest blocklisting the domain, is
// every page in this guide.
//
// This used to write dist/sitemap.xml outright. It now writes only its own
// URLs, because the market year generates pages too and whichever script ran
// last would have clobbered the other's sitemap. scripts/build-sitemap.mjs
// merges every fragment and emits the file. `/` is that script's job.
//
// lastmod uses first_noted, the entry's real publish date.
function sitemapFragment(allEntries) {
  const newest = allEntries.reduce((max, e) => (e.first_noted > max ? e.first_noted : max), '');
  return [
    { loc: `${SITE_URL}/season/`, lastmod: newest || null },
    ...allEntries.map((e) => ({ loc: `${SITE_URL}/produce/${e.produce.id}/`, lastmod: e.first_noted })),
  ];
}

// ---- write ----
fs.mkdirSync(DIST_DIR, { recursive: true });
let cropped = 0;
for (const entry of entries) {
  const dir = path.join(DIST_DIR, 'produce', entry.id);
  fs.mkdirSync(dir, { recursive: true });
  const html = await entryPage(entry);
  if (findRawSource(entry.produce.id)) cropped++;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

// Computed, not declared. seasonalityOf falls back to the legacy prose-label
// parser for the catalogue items that have no season_ranges yet, so this is
// never worse than the old behaviour and improves as ranges are added.
// 'peak' counts as in season — a declared peak is always on the stall.
for (const e of entries) e.seasonality = seasonalityOf(e.produce, BUILD_MMDD, SEASON_BAND);
const inSeason = entries.filter((e) => e.seasonality !== 'out');
const offSeason = entries.filter((e) => e.seasonality === 'out');

const drifted = entries.filter((e) => 'in_season' in e && e.in_season !== (e.seasonality !== 'out'));
const seasonDir = path.join(DIST_DIR, 'season');
fs.mkdirSync(seasonDir, { recursive: true });
fs.writeFileSync(path.join(seasonDir, 'index.html'), seasonIndexPage(inSeason, offSeason));

// Sitemap URLs, for scripts/build-sitemap.mjs to merge. The fragment directory
// is deleted once the sitemap is written, so nothing here reaches the edge.
fs.mkdirSync(path.join(DIST_DIR, '_sitemap'), { recursive: true });
fs.writeFileSync(path.join(DIST_DIR, '_sitemap', 'field-guide.json'), JSON.stringify(sitemapFragment(entries)));

// Published slugs, for the app's "Field notes →" link on DetailScreen — it
// fetches this once at runtime rather than static-importing content/ into src/.
const produceDir = path.join(DIST_DIR, 'produce');
fs.mkdirSync(produceDir, { recursive: true });
fs.writeFileSync(path.join(produceDir, 'manifest.json'), JSON.stringify(entries.map((e) => e.id)));

// Oldest first: Pinterest publishes the oldest item in the feed first, so
// emitting in that order keeps the queue's behaviour legible when reading the
// raw XML.
const queuedEntries = entries
  .filter((e) => e.first_noted > FEED_SINCE)
  .sort((a, b) => (a.first_noted < b.first_noted ? -1 : a.first_noted > b.first_noted ? 1 : 0));
// Still writes feed.xml when paused, just with no <item>s — an empty channel is
// valid RSS and Pinterest simply finds nothing to publish. Removing the file
// instead would leave the last deployed copy live at the edge.
// queuedEntries stays UNFILTERED so the log below keeps reporting the true
// backlog — a held entry must never quietly disappear from the count.
const releasable = queuedEntries.filter((e) => !FEED_HOLD.has(e.id));
const feedEntries = FEED_PAUSED ? [] : releasable;
fs.writeFileSync(path.join(produceDir, 'feed.xml'), rssFeed(feedEntries));

const fallback = entries.length - cropped;
console.log(
  `field guide: wrote ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} + /season/ ` +
  `(${inSeason.length} in season, ${offSeason.length} listed out of season)` +
  ` — ${cropped} with OG crops from produce_raw/, ${fallback} on the @2x.png fallback`
);
console.log(
  `  /season/ computed for ${BUILD_MMDD} in the ${SEASON_BAND} band` +
  ` — ${entries.filter((e) => e.seasonality === 'peak').length} at peak`
);
if (drifted.length) {
  console.warn(
    `  ⚠ stale in_season frontmatter on ${drifted.length} entr${drifted.length === 1 ? 'y' : 'ies'}` +
    ` (advisory only, the computed answer is what shipped): ` +
    drifted.map((e) => `${e.id} says ${e.in_season}, computed ${e.seasonality}`).join('; ')
  );
}
console.log(`sitemap fragment: ${entries.length + 1} urls (/season/, ${entries.length} entries)`);
if (FEED_PAUSED) {
  console.warn(
    `feed.xml: ⚠ PAUSED (FEED_PAUSED = true) — wrote 0 items. ${queuedEntries.length} held back` +
    (queuedEntries.length ? `: ${queuedEntries.map((e) => e.id).join(', ')}` : '') +
    `. Pinterest auto-publish stays dark until the domain block is lifted and the flag is cleared.`
  );
} else {
  console.log(
    `feed.xml: ${feedEntries.length} item${feedEntries.length === 1 ? '' : 's'} (first_noted after ${FEED_SINCE})` +
    (feedEntries.length ? ` — ${feedEntries.map((e) => e.id).join(', ')}` : ' — nothing new to auto-publish')
  );
  const held = queuedEntries.filter((e) => FEED_HOLD.has(e.id));
  if (held.length) {
    console.log(`  ${held.length} held by FEED_HOLD: ${held.map((e) => e.id).join(', ')}`);
  }
  const unknownHold = [...FEED_HOLD].filter((id) => !entries.some((e) => e.id === id));
  if (unknownHold.length) {
    console.warn(
      `  ⚠ FEED_HOLD names ${unknownHold.join(', ')}, which match no entry — a typo here ` +
      `silently PUBLISHES what you meant to hold.`
    );
  }
}
const noPinCopy = feedEntries.filter((e) => !e.pin_title);
if (noPinCopy.length) {
  console.warn(
    `  ⚠ no pin_title on ${noPinCopy.map((e) => e.id).join(', ')} — these will pin with the weak ` +
    `"<name> — green days field guide" title. Add pin_title/pin_description to the entry frontmatter.`
  );
}
