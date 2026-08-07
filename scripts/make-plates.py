#!/usr/bin/env python3
"""
Generate the market-year plate silhouettes from the green days linocuts.

    python3 scripts/make-plates.py            # every plate the walk renders
    python3 scripts/make-plates.py --all      # all 65 plates in canon
    python3 scripts/make-plates.py fig plum   # just these

Sources are public/assets/produce/<plate>@2x.png — the same illustrations the
app and the field guide use. (The handoff's docstring pointed at a
`marketing/produce` folder that does not exist in this repo; the @2x naming it
expects is exactly what public/assets/produce/ already uses.)

What to generate is read from data/market-year-plates.json, which
scripts/build-market-year.mjs writes on every build. This tool used to
re-derive it from turning-days.json, which meant the stall rule and the plate
rotation existed twice, in two languages, free to drift. Now the build states
what art it needs and this only makes it. **Run a build first** if the manifest
is missing or stale.

Output is public/market-year/plates/<plate>.png, thresholded to solid #1a2023,
trimmed to the ink bbox and scaled to 240px tall on transparency — the Danish
town-profile treatment. These are committed, not built: they are derived from
art, not from data, and regenerating them on every deploy would burn Pillow
into the build for files that change once a year.

Requires Pillow (pip install Pillow).
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'data/market-year-plates.json')
SRC_DIR = os.path.join(ROOT, 'public/assets/produce')
OUT_DIR = os.path.join(ROOT, 'public/market-year/plates')

INK = (26, 32, 35, 255)   # near-black, matches the eight shipped by hand
ALPHA_CUT = 70            # ignore anything more transparent than this
VALUE_CUT = 232           # ignore paper-white; keep the printed ink
HEIGHT = 240


def manifest():
    if not os.path.exists(MANIFEST):
        sys.exit(
            'No data/market-year-plates.json. Run `npm run build` first — '
            'scripts/build-market-year.mjs writes it.'
        )
    return json.load(open(MANIFEST, encoding='utf-8'))


def rendered_plates():
    """The plates the walk actually shows: three per turn."""
    return sorted(manifest()['rendered'])


def all_plates():
    """Every plate that could appear if the rotation or the stall data moves."""
    return sorted(manifest()['pool'])


def make(name):
    src = os.path.join(SRC_DIR, name + '@2x.png')
    if not os.path.exists(src):
        print('  MISSING SOURCE', src)
        return False
    im = Image.open(src).convert('RGBA')
    px = im.load()
    w, h = im.size
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    o = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > ALPHA_CUT and (r + g + b) / 3 < VALUE_CUT:
                o[x, y] = INK
    bb = out.getbbox()
    if not bb:
        print('  EMPTY after threshold:', name)
        return False
    out = out.crop(bb)
    s = HEIGHT / out.height
    out = out.resize((max(1, round(out.width * s)), HEIGHT), Image.LANCZOS)
    dst = os.path.join(OUT_DIR, name + '.png')
    out.save(dst, optimize=True)
    print(f'  {name:18s} {out.size[0]:>3}x{out.size[1]}  {os.path.getsize(dst) // 1024} KB')
    return True


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    names = args or (all_plates() if '--all' in sys.argv else rendered_plates())
    os.makedirs(OUT_DIR, exist_ok=True)
    ok = sum(make(n) for n in names)
    print(f'\n{ok}/{len(names)} written to {os.path.relpath(OUT_DIR, ROOT)}')
