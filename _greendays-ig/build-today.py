#!/usr/bin/env python3
"""15 Sep 2026: one feed post (1080x1080) + a three-frame story (1080x1920).

Inherits the three rules from build-posts.py: the 4:5 grid crop, fonts from npm
as data URIs, Greek only ever in a JetBrains Mono run. The story adds a fourth
constraint of its own: Instagram's own chrome covers roughly the top 250px and
the bottom 250px of a 1920-tall frame, so STORY_TOP/STORY_BOT are asserted the
same way SAFE_L/SAFE_R are.
"""
import base64, pathlib, re, asyncio
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
FONTS = HERE / 'node_modules/@fontsource'
PLATES = HERE.parent / 'public/assets/produce'
OUT = HERE / 'out'; OUT.mkdir(exist_ok=True)

SAFE_L, SAFE_R, MARGIN = 108, 972, 140
STORY_TOP, STORY_BOT = 280, 1640          # what IG's chrome leaves usable

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

/* story: centred column inside the band IG's chrome leaves alone */
.t-story{{align-items:center;justify-content:center;padding:{STORY_TOP}px {MARGIN}px
   {1920-STORY_BOT}px;text-align:center}}
.t-story img{{width:540px;height:540px;object-fit:contain;display:block;margin-bottom:40px}}
.t-story .kicker{{font-family:'JBMono',monospace;font-size:30px;letter-spacing:.2em;
   color:{TEAL};margin-bottom:26px}}
.t-story .big{{font-weight:900;font-size:104px;line-height:1.04;letter-spacing:-.025em}}
.t-story .rule{{width:132px;height:3px;background:{SEA};margin:36px 0 30px;border-radius:2px}}
.t-story .foot{{font-family:'JBMono',monospace;font-size:30px;line-height:1.62;color:{SLATE}}}
.t-story.grey .kicker{{color:{SLATE}}}
.t-story.grey .rule{{background:#9FB0B8}}
"""

def name_tile(lead, rest, img):
    rows = ''.join(f'<div>{r}</div>' for r in rest)
    return (f'<div class="t sq t-name"><img src="{plate(img)}" alt="">'
            f'<div class="lead">{guard(lead)}</div><div class="rule"></div>'
            f'<div class="rest">{rows}</div><div class="wm">GREENDAYS.DAY</div></div>')

def story(kicker, big, foot, img, grey=False):
    return (f'<div class="t st t-story{" grey" if grey else ""}">'
            f'<div class="kicker">{kicker}</div>'
            f'<img src="{plate(img)}" alt="">'
            f'<div class="big">{guard(big)}</div><div class="rule"></div>'
            f'<div class="foot">{foot}</div><div class="wm">GREENDAYS.DAY</div></div>')

# --- today ------------------------------------------------------------------
POSTS = [
    # feed. Nine words in the data's own market order, so the arrangement makes
    # no claim about which name descends from which.
    ('10-pomegranate', 1080, lambda: name_tile(
        'Romã',
        ['Grenade · Granatapfel', 'Melagrana · Granaatappel',
         'Granatæble · Granada', 'Ρόδι · Granatäpple'], 'pomegranate')),

    # story, three frames. The grey plate in frame 2 is not a filter: -off@2x is
    # the file the app itself serves for an out-of-season item
    # (GreenDaysApp.jsx:114), so the frame shows tomorrow's app, not a mood.
    ('story-1-last-day', 1920, lambda: story(
        '15 SETEMBRO', 'Last day<br>of the peach',
        'pêssego · nectarina<br>1 jun – 15 set · Portugal', 'stone-fruit')),
    ('story-2-tomorrow', 1920, lambda: story(
        '16 SETEMBRO', 'Tomorrow',
        'The same plate, the way the<br>app will draw it in the morning',
        'stone-fruit-off', grey=True)),
    ('story-3-grapes', 1920, lambda: story(
        '15 – 29 SETEMBRO', 'Uvas,<br>at peak',
        'uvas brancas e pretas · the only thing<br>at peak in any market this week',
        'green-grapes')),
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
    if bad:
        raise SystemExit(f'Greek in a Nunito-set string: {bad}')

    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for slug, h, body in tiles:
            pg = await b.new_page(viewport={'width': 1080, 'height': h})
            await pg.set_content(
                f'<!doctype html><meta charset="utf-8"><style>{FONT_CSS}{CSS}</style>{body}')
            ok = await pg.evaluate("""async () => {
                const specs = ['400 30px JBMono','500 30px JBMono','400 40px Nunito',
                               '700 40px Nunito','800 42px Nunito','900 92px Nunito',
                               '900 104px Nunito'];
                await Promise.all(specs.map(f => document.fonts.load(f)));
                const greek = '\\u03A1\\u03CC\\u03B4\\u03B9';
                await document.fonts.load('400 30px JBMono', greek);
                await document.fonts.ready;
                return { missing: specs.filter(f => !document.fonts.check(f)),
                         greek: document.fonts.check('400 30px JBMono', greek) };
            }""")
            assert not ok['missing'], f"{slug}: faces failed {ok['missing']}"
            assert ok['greek'], f'{slug}: no Greek coverage in JBMono'

            path = OUT / f'greendays-{slug}.png'
            await pg.screenshot(path=str(path)); await pg.close()

            lo, hi, top, bot = ink_bounds(path)
            assert lo >= SAFE_L, f'{slug}: ink starts x={lo}, inside the 4:5 crop'
            assert hi <= SAFE_R, f'{slug}: ink ends x={hi}, past {SAFE_R}'
            if h == 1920:
                assert top >= STORY_TOP - 40, f'{slug}: ink starts y={top}, under IG chrome'
                assert bot <= STORY_BOT + 40, f'{slug}: ink ends y={bot}, under IG chrome'
            print(f'{slug:20} ok  ink x {lo}..{hi}  y {top}..{bot}')
        await b.close()

asyncio.run(main())
