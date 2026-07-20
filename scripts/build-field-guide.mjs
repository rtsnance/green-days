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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content/produce');
const RAW_DIR = path.join(ROOT, 'produce_raw');
const DIST_DIR = path.join(ROOT, 'dist');
const SITE_URL = 'https://greendays.day';

// Pinterest wants a vertical ~2:3 image; general OG unfurls (Slack, iMessage,
// Twitter) want landscape ~1.91:1. Both crops come from the same 1024×1024
// Midjourney source with no upscaling — see produce_raw/ below.
const PIN_SIZE = { width: 683, height: 1024 };
const CARD_SIZE = { width: 1024, height: 538 };
const RAW_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

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
  await sharp(src).resize(PIN_SIZE.width, PIN_SIZE.height, { fit: 'cover', position: 'centre' }).png().toFile(path.join(outDir, pinFile));
  await sharp(src).resize(CARD_SIZE.width, CARD_SIZE.height, { fit: 'cover', position: 'centre' }).png().toFile(path.join(outDir, cardFile));
  return { pinFile, cardFile };
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
  for (const key of ['id', 'first_noted', 'in_season']) {
    if (!(key in fm)) throw new Error(`${file}: missing required frontmatter key "${key}"`);
  }
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
      <a class="fg-back" href="/">green days</a>
      <article class="fg-entry">
        <img class="fg-illustration" src="/assets/produce/${produce.illustration}@2x.png" alt="${escapeHtml(produce.name_en)}" width="240" height="240" />
        <p class="fg-eyebrow">Field guide &middot; ${escapeHtml(produce.season)}</p>
        <h1>${escapeHtml(produce.name_en)}</h1>
        <p class="fg-body">${renderBody(entry.body)}</p>
        <a class="fg-cta" href="/?add=${encodeURIComponent(produce.id)}&src=field_guide">Add to basket</a>
        <p class="fg-noted">Noted ${escapeHtml(entry.first_noted)}</p>
      </article>
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

function seasonIndexPage(inSeason) {
  const canonical = `${SITE_URL}/season/`;
  const desc = "What's in season right now, noted as it turns up at the market — green days' almanac.";
  const items = inSeason.map((entry) => {
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
  const bodyHtml = `    <main class="fg-page">
      <a class="fg-back" href="/">green days</a>
      <header class="fg-season-header">
        <p class="fg-eyebrow">Almanac</p>
        <h1>What's in season</h1>
      </header>
      <ul class="fg-season-list">
${items}
      </ul>
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

const inSeason = entries.filter((e) => e.in_season === true);
const seasonDir = path.join(DIST_DIR, 'season');
fs.mkdirSync(seasonDir, { recursive: true });
fs.writeFileSync(path.join(seasonDir, 'index.html'), seasonIndexPage(inSeason));

// Published slugs, for the app's "Field notes →" link on DetailScreen — it
// fetches this once at runtime rather than static-importing content/ into src/.
const produceDir = path.join(DIST_DIR, 'produce');
fs.mkdirSync(produceDir, { recursive: true });
fs.writeFileSync(path.join(produceDir, 'manifest.json'), JSON.stringify(entries.map((e) => e.id)));

const fallback = entries.length - cropped;
console.log(
  `field guide: wrote ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} + /season/ (${inSeason.length} in season)` +
  ` — ${cropped} with OG crops from produce_raw/, ${fallback} on the @2x.png fallback`
);
