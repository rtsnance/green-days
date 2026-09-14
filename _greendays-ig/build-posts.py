#!/usr/bin/env python3
"""Render @greendays.day feed posts at 1080x1080.

Run from this directory, with the repo's produce plates alongside:

    npm i @fontsource/nunito @fontsource/jetbrains-mono @fontsource/annie-use-your-telescope
    python3 build-posts.py

Three things here exist because each one has already gone wrong once. Do not
remove them without reading the reason.

1. THE 4:5 GRID CROP. Instagram's profile grid cell is 4:5, not 1:1, so a
   1080 square is centre-cropped to 864 wide for the grid and loses 108px off
   each side. Centred layouts survive; left-aligned ones lose their first
   letter. The opening nine shipped with "Tap your basket" reading as "ap your
   basket" in the grid. SAFE_L/SAFE_R below are asserted against the rendered
   pixels after every shot, so this cannot regress silently.

2. THE FONTS. Google Fonts is blocked from the render container and neither
   machine has Nunito or JetBrains Mono installed, so the faces come from npm
   and are inlined as woff2 data URIs. A data-URI face only loads when
   something on the page requests it, so every weight in use is explicitly
   loaded and then checked. A turning-day card once rendered in a system
   fallback and a critique read the fallback as intentional.

3. GREEK. fontsource's Nunito ships no Greek subset; its JetBrains Mono does.
   Every Greek string therefore has to live in a mono run. GREEK_GUARD fails
   the build if one lands in a Nunito-set string, and the render additionally
   checks Greek coverage by text rather than by family name.
"""
import base64, pathlib, re, asyncio
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent
FONTS = HERE / 'node_modules/@fontsource'
PLATES = REPO / 'public/assets/produce'
OUT = HERE / 'out'
OUT.mkdir(exist_ok=True)

# 1080 square, centre-cropped to 4/5 for the grid cell.
SAFE_L = (1080 - int(1080 * 4 / 5)) // 2          # 108
SAFE_R = 1080 - SAFE_L                            # 972
MARGIN = 140                                      # what we actually design to

CREAM, SEA, TEAL, CARBON, SLATE, FROZEN = (
    '#FCF8EE', '#529D7F', '#42917C', '#1A2023', '#4D606B', '#D5ECE6')

GREEK = re.compile(r'[Ͱ-Ͽἀ-῿]')


def b64(path):
    return base64.b64encode(pathlib.Path(path).read_bytes()).decode()


def face(family, pkg, subset, weight):
    f = FONTS / pkg / 'files' / f'{pkg}-{subset}-{weight}-normal.woff2'
    return (f"@font-face{{font-family:'{family}';font-style:normal;"
            f"font-weight:{weight};src:url(data:font/woff2;base64,{b64(f)}) format('woff2')}}")


FONT_CSS = ''.join(
    [face('Nunito', 'nunito', s, w) for s in ('latin', 'latin-ext') for w in (400, 700, 800, 900)]
    + [face('JBMono', 'jetbrains-mono', s, w)
       for s in ('latin', 'latin-ext', 'greek') for w in (400, 500)]
    + [face('Annie', 'annie-use-your-telescope', 'latin', 400)]
)


def plate(name):
    f = PLATES / f'{name}@2x.png'
    if not f.exists():
        raise SystemExit(f'plate missing: {f}')
    return 'data:image/png;base64,' + b64(f)


CSS = f"""
*{{box-sizing:border-box;margin:0}}
html,body{{width:1080px;height:1080px;overflow:hidden}}
.t{{width:1080px;height:1080px;background:{CREAM};color:{CARBON};position:relative;
   display:flex;flex-direction:column;overflow:hidden;font-family:'Nunito',sans-serif}}
.wm{{position:absolute;left:0;right:0;bottom:44px;text-align:center;
   font-family:'JBMono',monospace;font-size:21px;letter-spacing:.24em;color:#4D606B99}}

/* name tiles are centred, so the grid crop never touches them */
.t-name{{align-items:center;justify-content:center;padding:70px {MARGIN}px 120px}}
.t-name img{{width:470px;height:470px;object-fit:contain;display:block;margin-bottom:26px}}
.t-name .lead{{font-weight:900;font-size:92px;line-height:1;letter-spacing:-.02em}}
.t-name .rule{{width:132px;height:3px;background:{SEA};margin:30px 0 28px;border-radius:2px}}
.t-name .rest{{font-family:'JBMono',monospace;font-size:31px;line-height:1.72;
   color:{SLATE};text-align:center}}
.t-name .rest b{{color:{CARBON};font-weight:500}}

/* week tiles are left-aligned, so {MARGIN}px is load-bearing, not taste */
.t-week{{justify-content:space-between;padding:74px {MARGIN}px 120px}}
.t-week .kicker{{font-family:'JBMono',monospace;font-size:26px;letter-spacing:.2em;color:{TEAL}}}
.t-week .big{{font-weight:900;font-size:92px;line-height:1.02;letter-spacing:-.025em;
   max-width:560px;position:relative;z-index:2}}
.t-week .foot{{font-family:'JBMono',monospace;font-size:24px;color:{SLATE};max-width:470px;
   line-height:1.5;position:relative;z-index:2}}
.t-week .wm{{text-align:left;left:{MARGIN}px;right:auto;z-index:3}}
/* behind the type, and small enough never to reach it */
.t-week img{{position:absolute;right:-34px;bottom:-46px;width:450px;height:450px;
   object-fit:contain;z-index:1}}

.t-split{{padding:0}}
.t-split .top{{font-family:'JBMono',monospace;font-size:26px;letter-spacing:.2em;color:{TEAL};
   text-align:center;padding:66px 0 10px}}
.t-split .row{{flex:1;display:flex}}
.t-split .half{{flex:1;display:flex;flex-direction:column;align-items:center;
   justify-content:center;gap:16px;padding:0 40px 120px}}
.t-split .half+.half{{border-left:3px solid {FROZEN}}}
.t-split img{{width:300px;height:300px;object-fit:contain}}
.t-split .city{{font-family:'JBMono',monospace;font-size:27px;letter-spacing:.16em;color:{TEAL}}}
.t-split .list{{font-weight:800;font-size:42px;line-height:1.36;text-align:center;color:{CARBON}}}
.t-split .season{{font-family:'JBMono',monospace;font-size:24px;color:{SLATE};margin-top:4px}}

.t-app{{align-items:flex-start;justify-content:center;padding:96px {MARGIN}px 130px;gap:28px;
   background:{SEA};color:{CREAM}}}
.t-app.alt{{background:{FROZEN};color:{CARBON}}}
.t-app .big{{font-weight:900;font-size:96px;line-height:1.02;letter-spacing:-.025em}}
.t-app .sub{{font-size:37px;line-height:1.38;font-weight:700;opacity:.9;max-width:690px}}
.t-app .chip{{font-family:'JBMono',monospace;font-size:23px;letter-spacing:.18em;
   border:2px solid currentColor;border-radius:999px;padding:12px 26px;opacity:.85}}
.t-app .wm{{color:currentColor;opacity:.6}}
"""

GREEK_GUARD = []


def guard(s):
    """Mark a string as Nunito-set. Greek in here fails the build."""
    GREEK_GUARD.append(s)
    return s


def name_tile(lead, rest, img):
    rows = ''.join(f'<div>{r}</div>' for r in rest)
    return (f'<div class="t t-name"><img src="{plate(img)}" alt="">'
            f'<div class="lead">{guard(lead)}</div><div class="rule"></div>'
            f'<div class="rest">{rows}</div><div class="wm">GREENDAYS.DAY</div></div>')


def week_tile(kicker, big, foot, img):
    return (f'<div class="t t-week"><img src="{plate(img)}" alt="">'
            f'<div class="kicker">{kicker}</div><div class="big">{guard(big)}</div>'
            f'<div class="foot">{foot}</div><div class="wm">GREENDAYS.DAY</div></div>')


def split_tile(top, left, right):
    def half(h):
        return (f'<div class="half"><img src="{plate(h["img"])}" alt="">'
                f'<div class="city">{h["city"]}</div>'
                f'<div class="list">{guard(h["list"])}</div>'
                f'<div class="season">{h["season"]}</div></div>')
    return (f'<div class="t t-split"><div class="top">{top}</div>'
            f'<div class="row">{half(left)}{half(right)}</div>'
            f'<div class="wm">GREENDAYS.DAY</div></div>')


def app_tile(big, sub, chip, alt=False):
    return (f'<div class="t t-app{" alt" if alt else ""}"><div class="chip">{chip}</div>'
            f'<div class="big">{guard(big)}</div><div class="sub">{guard(sub)}</div>'
            f'<div class="wm">GREENDAYS.DAY</div></div>')


def ink_bounds(path):
    """Leftmost and rightmost non-background column, for the grid-crop check."""
    im = Image.open(path).convert('RGB')
    w, h = im.size
    bg = im.getpixel((2, 2))
    px = im.load()
    lo, hi = w, 0
    for y in range(0, h, 3):
        for x in range(w):
            if sum(abs(a - b) for a, b in zip(px[x, y], bg)) > 40:
                lo = min(lo, x)
                break
        for x in range(w - 1, -1, -1):
            if sum(abs(a - b) for a, b in zip(px[x, y], bg)) > 40:
                hi = max(hi, x)
                break
    return lo, hi


# A tile may deliberately bleed a decorative plate off an edge; name it here so
# the crop check only guards the side that carries meaning.
BLEEDS_RIGHT = {'02-last-peach', '05-grapes-peak'}


POSTS = [
    ('01-prickly-pear', lambda: name_tile(
        'Figo-da-índia',
        ['Higo chumbo · Fico d’India', 'Φραγκόσυκο · Figue de Barbarie',
         'Kaktusfeige · Cactusvijg', 'Kaktusfigen · Kaktusfikon'], 'prickly-pear')),
    ('02-last-peach', lambda: week_tile(
        '15 SETEMBRO', 'The last day<br>of the peach',
        'pêssego · 1 jun – 15 set · Portugal', 'stone-fruit')),
    ('03-field-note', lambda: app_tile(
        'Every recipe<br>comes back<br>as a card',
        'Yours to keep, and to hand to someone at the stall.', 'FIELD NOTE', alt=True)),
    ('04-aubergine', lambda: name_tile(
        'Beringela',
        ['Berenjena · Melanzana', 'Μελιτζάνα',
         'Aubergine · Aubergine · Aubergine', 'Aubergine · Aubergine'], 'aubergine')),
    ('05-grapes-peak', lambda: week_tile(
        '15 – 29 SETEMBRO', 'Grapes,<br>at peak',
        'uvas brancas · the only produce at peak in any market this week', 'grapes')),
    ('06-in-your-kitchen', lambda: app_tile(
        'In your<br>kitchen',
        'A second shelf, for what you already have at home. Tonight only.', 'NEW')),
    ('07-tomato', lambda: name_tile(
        'Tomate',
        ['Tomate · Tomate · Tomaat', 'Tomat · Tomat · Ντομάτα',
         'and Italy, alone:', '<b>Pomodoro</b>'], 'tomato')),
    ('08-two-markets', lambda: split_tile(
        'SAME TUESDAY',
        {'img': 'melon', 'city': 'LISBOA',
         'list': 'melancia<br>pêssego<br>melão', 'season': 'still summer'},
        {'img': 'chard', 'city': 'KØBENHAVN',
         'list': 'grønkål<br>sortkål<br>kastanjer', 'season': 'already autumn'})),
    ('09-basket-recipe', lambda: app_tile(
        'Tap your<br>basket',
        'One confident recipe comes back. Free, no signup.', 'GREENDAYS.DAY')),
]


async def main():
    from playwright.async_api import async_playwright
    tiles = [(slug, fn()) for slug, fn in POSTS]

    bad = [s for s in GREEK_GUARD if GREEK.search(s)]
    if bad:
        raise SystemExit(f'Greek in a Nunito-set string (Nunito has no Greek subset): {bad}')

    async with async_playwright() as p:
        b = await p.chromium.launch()
        for slug, body in tiles:
            pg = await b.new_page(viewport={'width': 1080, 'height': 1080})
            await pg.set_content(
                f'<!doctype html><meta charset="utf-8"><style>{FONT_CSS}{CSS}</style>{body}')
            ok = await pg.evaluate("""async () => {
                const specs = ['400 31px JBMono','500 31px JBMono','400 40px Nunito',
                               '700 40px Nunito','800 42px Nunito','900 92px Nunito'];
                await Promise.all(specs.map(f => document.fonts.load(f)));
                const greek = '\\u03A6\\u03C1\\u03B1\\u03B3\\u03BA\\u03CC\\u03C3\\u03C5\\u03BA\\u03BF';
                await document.fonts.load('400 31px JBMono', greek);
                await document.fonts.ready;
                return { missing: specs.filter(f => !document.fonts.check(f)),
                         greek: document.fonts.check('400 31px JBMono', greek) };
            }""")
            assert not ok['missing'], f"{slug}: faces failed to load {ok['missing']}"
            assert ok['greek'], f'{slug}: JetBrains Mono has no Greek coverage'

            path = OUT / f'greendays-{slug}.png'
            await pg.screenshot(path=str(path))
            await pg.close()

            lo, hi = ink_bounds(path)
            assert lo >= SAFE_L, (
                f'{slug}: ink starts at x={lo}, inside the {SAFE_L}px the 4:5 grid crop '
                f'removes. Widen the side padding.')
            if slug not in BLEEDS_RIGHT:
                assert hi <= SAFE_R, (
                    f'{slug}: ink ends at x={hi}, past x={SAFE_R}. Either pull it in or add '
                    f'the slug to BLEEDS_RIGHT if the overhang is a deliberate bleed.')
            print(f'{slug:22} ok   ink {lo}..{hi}')

        await b.close()

asyncio.run(main())
