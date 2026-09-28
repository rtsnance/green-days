// Assemble dist-app/, the web layer the iOS app ships (capacitor.config.json
// webDir), from the site build in dist/.
//
// The app carries only what it runs on: the page, the hashed JS and CSS (which
// hold the whole produce calendar), the fonts, the favicon. Everything else in
// dist/ (about 150 MB of illustrations, season banners, field-guide and
// market-year pages) stays on greendays.day: the app loads images from there
// (src/produce.js ASSET) and opens web pages in Safari (SITE).
//
// Run after `npm run build`; `npm run ios` does both and syncs Xcode.
import { cpSync, mkdirSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'dist', OUT = 'dist-app';
if (!existsSync(join(SRC, 'index.html'))) {
  console.error('build-app: dist/index.html missing. Run `npm run build` first.');
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets'), { recursive: true });

cpSync(join(SRC, 'index.html'), join(OUT, 'index.html'));
for (const f of ['favicon.svg', 'manifest.webmanifest']) {
  if (existsSync(join(SRC, f))) cpSync(join(SRC, f), join(OUT, f));
}
cpSync(join(SRC, 'fonts'), join(OUT, 'fonts'), { recursive: true });
// The hashed bundle only (index-*.js / index-*.css), never the image folders.
for (const f of readdirSync(join(SRC, 'assets'))) {
  if (/^index-.*\.(js|css)$/.test(f)) cpSync(join(SRC, 'assets', f), join(OUT, 'assets', f));
}

const size = (d) => readdirSync(d, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? size(join(d, e.name)) : statSync(join(d, e.name)).size), 0);
console.log(`build-app: dist-app/ ready, ${(size(OUT) / 1e6).toFixed(1)} MB`);
