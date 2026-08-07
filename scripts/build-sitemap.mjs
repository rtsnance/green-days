/* Green Days — sitemap.xml, merged from whatever the page generators emitted.

   Runs last in `npm run build`. Each generator drops a fragment into
   dist/_sitemap/<name>.json — an array of { loc, lastmod? } — and this script
   merges them, sorts, writes dist/sitemap.xml and removes the fragment
   directory so it never ships.

   It works this way because the sitemap used to be written inside
   build-field-guide.mjs, which meant it could only ever list the field guide.
   The moment a second generator existed (the market year), one of them would
   have overwritten the other's sitemap. Fragments keep each generator owning
   its own URLs without either knowing about the other.

   `/` is emitted here rather than by any generator, and deliberately carries
   no lastmod: the app shell changes on every deploy, and a lastmod that always
   says "today" is exactly the signal crawlers learn to discount. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT, 'dist');
const FRAG_DIR = path.join(DIST_DIR, '_sitemap');
const SITE_URL = 'https://greendays.day';

const fragments = fs.existsSync(FRAG_DIR)
  ? fs.readdirSync(FRAG_DIR).filter((f) => f.endsWith('.json')).sort()
  : [];

if (!fragments.length) {
  // A sitemap with only the homepage in it is worse than the previous deploy's
  // — robots.txt points crawlers straight at it, so shipping a truncated one
  // actively un-indexes the site. Fail the build instead.
  console.error('sitemap: no fragments in dist/_sitemap/ — did the page generators run? Refusing to write a homepage-only sitemap.');
  process.exit(1);
}

const urls = [{ loc: `${SITE_URL}/` }];
const seen = new Set([`${SITE_URL}/`]);
for (const file of fragments) {
  for (const entry of JSON.parse(fs.readFileSync(path.join(FRAG_DIR, file), 'utf8'))) {
    if (seen.has(entry.loc)) continue;
    seen.add(entry.loc);
    urls.push(entry);
  }
}

const body = urls
  .map(({ loc, lastmod }) => `  <url>
    <loc>${loc}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ''}
  </url>`)
  .join('\n');

// Lives at the root so the Sitemap: line in public/robots.txt and the Search
// Console submission both point at the same canonical location.
fs.writeFileSync(
  path.join(DIST_DIR, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`
);
fs.rmSync(FRAG_DIR, { recursive: true, force: true });

console.log(`sitemap.xml: ${urls.length} urls from ${fragments.length} generator${fragments.length === 1 ? '' : 's'} (${fragments.map((f) => f.replace('.json', '')).join(', ')})`);
