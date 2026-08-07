/* Render the OG cards.  node scripts/render-og.mjs
   
   No new dependencies: it drives the Chrome already installed on the machine
   and downsamples with sharp, which the repo already uses for the field guide.

   Needs network. The card pulls Nunito, Annie Use Your Telescope and
   JetBrains Mono from Google Fonts, and on this project the type is the brand. */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const CARDS = [{ src: 'og/market-year.og.html', out: 'public/og/market-year.png' }];
const W = 1200, H = 630;

// Chrome, Chromium or Edge, whichever is actually here. macOS first, then Linux.
const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];
const chrome = process.env.CHROME_PATH || CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('No Chrome/Chromium found. Set CHROME_PATH to the binary, e.g.\n' +
    '  CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/render-og.mjs');
  process.exit(1);
}
console.log('using', chrome);

fs.mkdirSync('public/og', { recursive: true });
const tmp = fs.mkdtempSync('/tmp/gd-og-');

for (const { src, out } of CARDS) {
  if (!fs.existsSync(src)) { console.error(`missing ${src}`); process.exit(1); }
  const shot = path.join(tmp, 'shot.png');
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=2',
    `--window-size=${W},${H}`,
    // gives the webfonts time to arrive before the frame is captured
    '--virtual-time-budget=6000',
    `--screenshot=${shot}`,
    'file://' + path.resolve(src),
  ], { stdio: 'inherit' });

  const meta = await sharp(shot).metadata();
  if (meta.width !== W * 2) console.warn(`⚠️  got ${meta.width}x${meta.height}, expected ${W*2}x${H*2}`);
  await sharp(shot).resize(W, H, { fit: 'fill' }).png({ quality: 92 }).toFile(out);
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`${out}  ${W}x${H}  ${kb} KB`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log('\nOpen it before shipping. If the title is not Nunito and the subtitle');
console.log('is not handwritten paprika, the fonts did not load and it is not ours.');
