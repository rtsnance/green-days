/* Renders _pt-calendar/postcards.html to 48 PNGs at 1311 x 1819 (A6 + 3mm bleed, 300dpi).

   THIS DOES NOT RUN ON THE LAPTOP. It needs headless Chromium and Playwright,
   which live in the Claude cloud container; this machine has neither, and the
   executablePath below is a container path. To rebuild the cards, hand the
   container postcards.json, sprout.txt and the plates, run:

     node _pt-calendar/postcards-data.mjs > _pt-calendar/postcards.json
     node _pt-calendar/postcards.mjs      > _pt-calendar/postcards.html
     node _pt-calendar/postcards-render.mjs        # optionally with a numeral, e.g. XV

   The chromium build number in executablePath moves when the container image
   moves; if launch fails, ls /opt/pw-browsers and take the chromium-NNNN one.

   The font assertion is not decoration. Card XIV once rendered in a system
   fallback and a critique read the fallback as an intentional choice. */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const OUT = `${DIR}out`;
mkdirSync(OUT, { recursive: true });

const DATA = JSON.parse(readFileSync(`${DIR}postcards.json`, 'utf8'));
const only = process.argv[2] || null;   // e.g. "XV" to render one card

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1900 }, deviceScaleFactor: 1 });
await page.goto(`file://${DIR}postcards.html`);

const fonts = await page.evaluate(() => ({
  poppins: document.fonts.check('700 40px Poppins'),
  mono: document.fonts.check('400 20px "DejaVu Sans Mono"'),
}));
if (!fonts.poppins || !fonts.mono) throw new Error(`FONT NOT LOADED: ${JSON.stringify(fonts)}`);

let n = 0;
for (const c of DATA.cards) {
  if (only && c.numeral !== only) continue;
  for (const side of ['f', 'b']) {
    const el = await page.$(`#${side}-${c.numeral}`);
    const name = `${String(c.num).padStart(2, '0')}-${c.numeral}-${c.id}-${side === 'f' ? 'front' : 'back'}.png`;
    await el.screenshot({ path: `${OUT}/${name}` });
    n++;
  }
}
await browser.close();
console.log(`rendered ${n} pages ->`, OUT, '| fonts', JSON.stringify(fonts));
