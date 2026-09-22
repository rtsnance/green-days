#!/usr/bin/env python3
"""@greendays.day day builder: 1080x1080 feed tiles + 1080x1920 story frames.

Supersedes build-today.py. Four constraints, each of which has already gone
wrong once somewhere in this project:

1. THE 4:5 GRID CROP. Instagram centre-crops a 1080 square to 864 wide for the
   profile grid, losing 108px each side. Five of the opening nine shipped with
   their first letter cut off. SAFE_L/SAFE_R are asserted against rendered
   pixels, and every tile type here is CENTRED so it passes by construction.
2. IG STORY CHROME covers roughly the top and bottom 250px of a 1920 frame.
   STORY_TOP/STORY_BOT are asserted the same way.
3. FONTS come from npm as inlined woff2 data URIs (Google Fonts is blocked from
   the render container, and neither machine has these faces). A data-URI face
   only loads when something asks for it, so every weight is loaded then checked.
4. GREEK: fontsource's Nunito has no Greek subset, its JetBrains Mono does.
   Every Greek string must live in a mono run; guard() fails the build otherwise.

Plates: check `illustration` in produce.json before building a tile whose
subject is the item itself. 96 of 151 ids draw an archetype, not themselves.
"""
import base64, pathlib, re, asyncio
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
FONTS = HERE / 'node_modules/@fontsource'
PLATES = HERE.parent / 'public/assets/produce'
OUT = HERE / 'out'; OUT.mkdir(exist_ok=True)

SAFE_L, SAFE_R, MARGIN = 108, 972, 140
STORY_TOP, STORY_BOT = 280, 1640

CREAM, SEA, TEAL, CARBON, SLATE, FROZEN = (
    '#FCF8EE', '#529D7F', '#42917C', '#1A2023', '#4D606B', '#D5ECE6')
GREEK = re.compile(r'[Ͱ-Ͽἀ-῿]')

b64 = lambda p: base64.b64encode(pathlib.Path(p).read_bytes()).decode()

def face(family, pkg, subset, weight):
    f = FONTS / pkg / 'files' / f'{pkg}-{subset}-{weight}-normal.woff2'
    return (f"@font-face{{font-family:'{family}';font-style:normal;font-weight:{weight};"
            f"src:url(data:font/woff2;base64,{b64(f)}) format('woff2')}}")

FONT_CSS = ''.join(
    [face('Nunito','nunito',s,w) for s in ('latin','latin-ext') for w in (400,700,800,900)]
    + [face('JBMono','jetbrains-mono',s,w) for s in ('latin','latin-ext','greek') for w in (400,500)])

def plate(name):
    f = PLATES / f'{name}@2x.png'
    if not f.exists(): raise SystemExit(f'plate missing: {f}')
    return 'data:image/png;base64,' + b64(f)

GREEK_GUARD = []
def guard(s):
    GREEK_GUARD.append(s); return s

CSS = f"""
*{{box-sizing:border-box;margin:0}}
.t{{background:{CREAM};color:{CARBON};position:relative;display:flex;
   flex-direction:column;overflow:hidden;font-family:'Nunito',sans-serif}}
.sq{{width:1080px;height:1080px}}
.st{{width:1080px;height:1920px}}
.wm{{position:absolute;left:0;right:0;text-align:center;font-family:'JBMono',monospace;
   letter-spacing:.24em;color:#4D606B99}}
.sq .wm{{bottom:44px;font-size:21px}}
.st .wm{{bottom:300px;font-size:24px}}

.t-name{{align-items:center;justify-content:center;padding:70px {MARGIN}px 120px}}
.t-name img{{width:470px;height:470px;object-fit:contain;display:block;margin-bottom:26px}}
.t-name .lead{{font-weight:900;font-size:92px;line-height:1;letter-spacing:-.02em}}
.t-name .rule{{width:132px;height:3px;background:{SEA};margin:30px 0 28px;border-radius:2px}}
.t-name .rest{{font-family:'JBMono',monospace;font-size:31px;line-height:1.72;
   color:{SLATE};text-align:center}}

/* HAND: the item's own `selection` line, verbatim, on its own plate.
   Centred like t-name, so the 4:5 crop cannot reach it. */
.t-hand{{align-items:center;justify-content:center;padding:74px {MARGIN}px 118px;
   text-align:center}}
.t-hand .kicker{{font-family:'JBMono',monospace;font-size:24px;letter-spacing:.2em;
   color:{TEAL};margin-bottom:22px}}
.t-hand img{{width:330px;height:330px;object-fit:contain;display:block;margin-bottom:14px}}
.t-hand .lead{{font-weight:900;font-size:76px;line-height:1;letter-spacing:-.02em}}
.t-hand .rule{{width:132px;height:3px;background:{SEA};margin:26px 0 26px;border-radius:2px}}
.t-hand .sel{{font-family:'JBMono',monospace;font-size:27px;line-height:1.70;
   color:{SLATE};max-width:840px}}
.t-hand .sel div{{white-space:nowrap}}
.t-hand .sel b{{color:{CARBON};font-weight:500}}

.t-story{{align-items:center;justify-content:center;padding:{STORY_TOP}px {MARGIN}px
   {1920-STORY_BOT}px;text-align:center}}
.t-story img{{width:540px;height:540px;object-fit:contain;display:block;margin-bottom:40px}}
.t-story .kicker{{font-family:'JBMono',monospace;font-size:30px;letter-spacing:.2em;
   color:{TEAL};margin-bottom:26px}}
.t-story .big{{font-weight:900;font-size:104px;line-height:1.04;letter-spacing:-.025em}}
.t-story .rule{{width:132px;height:3px;background:{SEA};margin:36px 0 30px;border-radius:2px}}
.t-story .foot{{font-family:'JBMono',monospace;font-size:30px;line-height:1.62;color:{SLATE}}}

/* PAIR: the language split. One plate, one date, two markets, two words.
   Same thing on the same day under two names; nothing about why. */
.t-pair{{align-items:center;justify-content:center;padding:70px {MARGIN}px 120px;
   text-align:center}}
.t-pair .kicker{{font-family:'JBMono',monospace;font-size:24px;letter-spacing:.2em;
   color:{TEAL};margin-bottom:18px}}
.t-pair img{{width:400px;height:400px;object-fit:contain;display:block;margin-bottom:34px}}
.t-pair .row{{display:flex;gap:0;align-items:flex-start;width:840px}}
.t-pair .half{{flex:1;padding:0 26px;display:flex;flex-direction:column;align-items:center}}
.t-pair .half + .half{{border-left:3px solid {SEA}}}
.t-pair .city{{font-family:'JBMono',monospace;font-size:24px;letter-spacing:.2em;
   color:{SLATE};margin-bottom:16px}}
.t-pair .word{{font-weight:900;font-size:68px;line-height:1;letter-spacing:-.02em;
   white-space:nowrap}}
.t-pair .foot{{font-family:'JBMono',monospace;font-size:27px;color:{SLATE};margin-top:40px}}

/* story on the sea ground, for the frame that carries the link sticker */
.t-story.sea{{background:{SEA};color:{CREAM}}}
.t-story.sea .kicker{{color:#FCF8EEB3}}
.t-story.sea .rule{{background:#FCF8EE66}}
.t-story.sea .foot{{color:#FCF8EED9}}
.t-story.sea .wm{{color:#FCF8EE99}}
"""

def name_tile(lead, rest, img):
    rows = ''.join(f'<div>{r}</div>' for r in rest)
    return (f'<div class="t sq t-name"><img src="{plate(img)}" alt="">'
            f'<div class="lead">{guard(lead)}</div><div class="rule"></div>'
            f'<div class="rest">{rows}</div><div class="wm">GREENDAYS.DAY</div></div>')

def hand_tile(kicker, lead, sel_lines, img):
    """sel_lines: the item's `selection` broken by hand into display lines.
    Each renders nowrap, and the build fails below if one overflows its box, so a
    line that is too long cannot quietly reflow into an orphan."""
    rows = ''.join(f'<div>{guard(r)}</div>' for r in sel_lines)
    return (f'<div class="t sq t-hand"><div class="kicker">{kicker}</div>'
            f'<img src="{plate(img)}" alt="">'
            f'<div class="lead">{guard(lead)}</div><div class="rule"></div>'
            f'<div class="sel">{rows}</div><div class="wm">GREENDAYS.DAY</div></div>')

def pair_tile(kicker, left, right, foot, img):
    """left/right: (city, word). The date goes on the tile, not only the caption:
    a dated tile three weeks old is a record, an undated one is just wrong."""
    half = lambda h: (f'<div class="half"><div class="city">{h[0]}</div>'
                      f'<div class="word">{guard(h[1])}</div></div>')
    return (f'<div class="t sq t-pair"><div class="kicker">{kicker}</div>'
            f'<img src="{plate(img)}" alt="">'
            f'<div class="row">{half(left)}{half(right)}</div>'
            f'<div class="foot">{foot}</div><div class="wm">GREENDAYS.DAY</div></div>')

def story(kicker, big, foot, img=None, sea=False):
    im = f'<img src="{plate(img)}" alt="">' if img else ''
    return (f'<div class="t st t-story{" sea" if sea else ""}">'
            f'<div class="kicker">{kicker}</div>{im}'
            f'<div class="big">{guard(big)}</div><div class="rule"></div>'
            f'<div class="foot">{foot}</div><div class="wm">GREENDAYS.DAY</div></div>')

# --- 21 September 2026 --------------------------------------------------------
# The Sun 20 PLURALITY slot, posted a day late. A LANGUAGE split, not a
# seasonality split: name_local is authored, season data is not comparable across
# most calendars. Lisboa v Madrid because PT and ES are the two calendars built the
# same way (national production), and beetroot is in season in both, both sourced
# (PT apn 08-01..04-30, ES eroski year-round). Own plate. No etymology.
POSTS = [
    ('13-beetroot-pair', 1080, lambda: pair_tile(
        'SEGUNDA 21 SET',
        ('LISBOA', 'Beterraba'), ('MADRID', 'Remolacha'),
        'in season in both, today', 'beetroot')),
]

def ink_bounds(path):
    im = Image.open(path).convert('RGB'); w, h = im.size
    bg = im.getpixel((2, 2)); px = im.load()
    lo, hi, top, bot = w, 0, h, 0
    for y in range(0, h, 3):
        row = False
        for x in range(w):
            if sum(abs(a-b) for a, b in zip(px[x, y], bg)) > 40:
                lo = min(lo, x); row = True; break
        for x in range(w-1, -1, -1):
            if sum(abs(a-b) for a, b in zip(px[x, y], bg)) > 40:
                hi = max(hi, x); break
        if row:
            top = min(top, y); bot = max(bot, y)
    return lo, hi, top, bot

async def main():
    tiles = [(s, h, fn()) for s, h, fn in POSTS]
    bad = [s for s in GREEK_GUARD if GREEK.search(s)]
    if bad: raise SystemExit(f'Greek in a Nunito-set string: {bad}')

    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for slug, h, body in tiles:
            pg = await b.new_page(viewport={'width': 1080, 'height': h})
            await pg.set_content(
                f'<!doctype html><meta charset="utf-8"><style>{FONT_CSS}{CSS}</style>{body}')
            ok = await pg.evaluate("""async () => {
                const specs = ['400 29px JBMono','500 29px JBMono','400 30px JBMono',
                               '400 40px Nunito','700 40px Nunito','800 42px Nunito',
                               '900 68px Nunito','900 76px Nunito','900 92px Nunito','900 104px Nunito'];
                await Promise.all(specs.map(f => document.fonts.load(f)));
                const greek = '\\u039C\\u03AE\\u03BB\\u03BF';
                await document.fonts.load('400 31px JBMono', greek);
                await document.fonts.ready;
                const over = [...document.querySelectorAll('.t-hand .sel div')]
                    .filter(el => el.scrollWidth > el.parentElement.clientWidth + 1)
                    .map(el => el.textContent);
                return { missing: specs.filter(f => !document.fonts.check(f)),
                         greek: document.fonts.check('400 31px JBMono', greek),
                         over };
            }""")
            assert not ok['missing'], f"{slug}: faces failed {ok['missing']}"
            assert ok['greek'], f'{slug}: no Greek coverage in JBMono'
            assert not ok['over'], f"{slug}: selection line overflows its box, rebreak it: {ok['over']}"

            path = OUT / f'greendays-{slug}.png'
            await pg.screenshot(path=str(path)); await pg.close()

            lo, hi, top, bot = ink_bounds(path)
            assert lo >= SAFE_L, f'{slug}: ink starts x={lo}, inside the 4:5 crop'
            assert hi <= SAFE_R, f'{slug}: ink ends x={hi}, past {SAFE_R}'
            if h == 1920:
                assert top >= STORY_TOP - 40, f'{slug}: ink starts y={top}, under IG chrome'
                assert bot <= STORY_BOT + 40, f'{slug}: ink ends y={bot}, under IG chrome'
            print(f'{slug:30} ok  ink x {lo}..{hi}  y {top}..{bot}')
        await b.close()

asyncio.run(main())
