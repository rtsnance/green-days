# The market year — `/market-year/`

A first-person walk through the European market year, standing on today's date,
with the twenty-four turning days announcing themselves on roadside plates
(Danish *byskilt* structure, Green Days palette). Underneath the walk, and
crawlable, is the twenty-four-day index; under that, twenty-four child pages,
one per turning day.

Ported from the Claude Design build (`Greengage Line.dc.html`) on 7 August 2026
and integrated here on the same day.

---

## Where it lives, and why

```
/market-year/                     the page. static index in the HTML, walk mounted over it
/market-year/?day=14              deep link — opens the walk standing on XIV
/market-year/?index               promotes the index to a normal scrolling page
/market-year/?mode=dusk           night palette
/market-year/st-bartholomew/      one per day: the index entry as its own page,
                                  canonical to itself, linking into the walk and
                                  down into the field guide
```

Not a subdomain — that would strand the link equity somewhere that doesn't help
greendays.day. Not inside the app — the app is the thing people install; this is
the thing that makes them want to. Not embedded in Substack — Substack strips
scripts; link to it from the dispatch instead.

The 24 child pages are the point as much as the walk is. greendays.day had 22
indexed URLs and one page's worth of inbound links; these are 25 more, each a
distinct named entity with a date, and each linking down into the field-guide
entries and back up to the index. The walk makes it worth sharing; the index
makes it worth indexing.

**Trailing slash.** The handoff's INTEGRATION.md wrote `/market-year`; this ships
`/market-year/`, matching `/season/` and `/produce/<id>/`. The bare form 307s to
it. Everything inside the page uses absolute paths, so neither form can break an
asset.

---

## How it is built

Nothing is hand-written into `dist/`. Two halves:

| Path | What | Who owns it |
|---|---|---|
| `data/turning-days.json` | canon — the 24 days | hand-edited, copied from the Green Days project folder |
| `public/market-year/walk.js` | the engine | hand-authored, copied verbatim into `dist/` by Vite |
| `public/market-year/theme.js` | every colour and number in the walk | hand-authored |
| `public/market-year/boot.js` | mounts the walk over the index | hand-authored |
| `public/market-year/plates/*.png` | produce silhouettes, 240px, transparent | generated once by `scripts/make-plates.py`, committed |
| `dist/market-year/turning-days.js` | the walk's data module | **generated** every build |
| `dist/market-year/index.html` | the walk page + the static index | **generated** every build |
| `dist/market-year/<slug>/index.html` | the 24 turning-day pages | **generated** every build |

`scripts/build-market-year.mjs` does the generating, after `vite build` has
copied `public/` into `dist/`. It follows the same pattern as
`scripts/build-field-guide.mjs`: read canon out of `data/`, render plain HTML
into `dist/`, no client JS on the text pages, so crawlers get real markup on
first fetch.

The handoff proposed a second Vite entry plus a Worker route rendering the 24
children at request time. Neither is used: the Worker never sees these URLs (it
only intercepts `/api/*` and the retired `lab.ryantnance.com` host, everything
else falls through to the assets binding), and a Vite entry would have put the
walk through a bundler it doesn't need.

### Why turning-days.js is generated

Because the design build **pasted** the 24 days instead of importing them, and
the paste lowercased the first character of every `working_name` — "bartholomew
wipes the rain", "são João fires", "michaelmas geese", "all souls". Casing now
comes through verbatim from `data/turning-days.json`, and there is no second
copy of the data to drift.

The generator reproduces the hand-ported module field-for-field; it was diffed
against it before the port was deleted. Two rules worth knowing:

- **Two clauses, one separator.** Canon joins alternatives with `" / "` in both
  `name` (`"St George / Sant Jordi"` → name + altName) and `working_name`
  (`"Sant Jordi / blackthorn winter"` → the plate's two states). Canon carries
  the second clause on 11 of 24 days; where it is absent the plate holds the
  lore in both states rather than alternating to nothing.
- **Silhouettes rotate within each day's own pool.** Three per sign, offset by
  the day's number, so neighbours differ and no sign ever shows something out of
  season. `scripts/make-plates.py` mirrors this rule to decide what to generate;
  if the two ever drift, the build warns with the exact names it wanted.

### Plates

```bash
python3 scripts/make-plates.py
```

Thresholds `public/assets/produce/<name>@2x.png` to solid `#1a2023`, trims to
the ink, scales to 240px on transparency. All 25 silhouettes the walk currently
renders exist; `MISSING_PLATES` is empty and is computed from the filesystem, so
it empties itself as art lands rather than being hand-maintained. A plate with
no PNG renders as **no band at all** — never a substitute.

(The handoff's tool pointed at a `marketing/produce` folder that doesn't exist
in this repo. The `@2x` naming it expects is exactly what `public/assets/produce/`
already uses, which is where it now reads from.)

### Sitemap

`scripts/build-sitemap.mjs` runs last and merges fragments that each generator
drops in `dist/_sitemap/`, then deletes the directory. It used to be written
inside `build-field-guide.mjs`, which only worked while there was one generator
— the second would have clobbered the first's sitemap. It hard-fails rather than
writing a homepage-only sitemap, because `robots.txt` points crawlers straight
at it and a truncated one actively un-indexes the site.

47 URLs now, up from 22.

---

## Decisions taken here, and how to reverse them

**Slugs are the English name, ASCII-folded.** `candlemas`, `st-valentine`,
`st-medard`, `st-bartholomew`. This is *not* canon's `slug_candidate`, which is
provisional by its own `_meta` ("provisional until the per-day polyglot slug
pass") and mixes conventions — `valentine`, `sant-jordi`, `sao-joao` next to
`martinmas`. One derivation rule, one URL shape, and it matches the anchor ids
already in the index.

**These become permalinks the moment this deploys.** Changing them afterwards
costs 24 redirects. If the polyglot slug pass is going to happen, it should
happen before the first deploy, not after — change `slugify()` in
`scripts/build-market-year.mjs` and everything else follows.

**No lore on the child pages.** Canon's `lore_leads` are research topics with an
explicit instruction not to print them as-is ("verbatim from a named checkable
collection or nothing"). So the pages carry only what is checkable: the numeral,
the opening date, the length, the great-turn flag, canon's own `working_name`,
and the stall list computed from `data/produce.json`. When a day's dispatch is
written and its lore is verified, that is what turns these from useful into
good.

**`Med` marks Mediterranean-only produce.** Canon computes the stall over the
Mediterranean band, which is a superset. Without the mark a temperate reader is
being told avocados are on the stall at Candlemas.

**The epithet is Nunito, not Annie.** Annie Use Your Telescope is the Line's
display face and it is on the plates in the walk itself, but a fourth webfont
for one line of 20px text on the child pages isn't worth the request, and Annie
reads poorly at body sizes. The colour carries it: `--fg-paprika` is Text
Paprika `#b23c1a`, the brand sheet's reading-strength token (5.57:1 on cream).
The index page on `/market-year/` uses the same token, replacing the `#c9410f`
the design build had synthesized.

**The bootstrap is an external module.** `worker/headers.js` sends `script-src
'self'` with no `'unsafe-inline'`, so the handoff's inline `<script type=module>`
was silently blocked — the page rendered, the walk never started, and the only
evidence was a console entry. Keep JS out of the generated HTML.

---

## Analytics worth wiring

The walk answers a question the current metrics can't: **which turning days
people care about.** Twenty-four discrete destinations, each reachable by tap,
scrub or deep link. Nothing is instrumented yet — the events would go through
the same `track()` path as the rest (`worker/index.js`, aggregate-only, no IDs):

- `day_viewed` with the numeral — where attention actually sits in the year
- `walk_started` / duration — novelty, or a thing people use
- `index_opened` — whether the text page has an audience of its own
- referrer on `?day=N` — which dispatch links convert

Given the funnel reads 94.6% direct, a page with linkable sub-URLs and a reason
to share is worth instrumenting from day one rather than retrofitting.

---

## The stall lists are computed, not stored

`data/turning-days.json` used to carry 1,163 rows of frozen derived data —
`plate_candidates` and its flags, computed on 30 July 2026 outside this repo.
Across the 24 turns that gave only **8 distinct stall lists**, grouped by
calendar quarter: St Swithin and Santiago, ten days apart, carried byte-identical
rows, as did Lammas and St Bartholomew.

Since 7 August those fields are computed by `scripts/build-market-year.mjs` at
build time, through `seasonalityOf()` in `src/season.js`, which prefers each
item's `season_ranges` and falls back to the prose parser per item. Canon holds
editorial fields only. **21 of 24 turns now publish a distinguishable stall
list**, and the build prints the number every time:

```
stall: 1190 rows over 131 distinct items, 909 at peak (76%) — 21/24 distinct stall lists
```

It warns below 12. If that number drops, something in the season model got
coarser.

The rules the generator applies — perennials excluded, either band counts,
sampled at the turn's midpoint — are commented at `stallAt()` in the generator.
The reasoning, the measurements, and what the two workstreams still owe each
other are in **[SEASON-SEAM.md](SEASON-SEAM.md)**; the pick-up note for the
season work is **[SEASON-HANDOFF.md](SEASON-HANDOFF.md)**.

## Still outstanding

Ordered by how much they cost to leave.

1. **`/og/market-year.png` does not exist.** All 25 pages currently unfurl with
   the site-wide `/assets/og.png`, which is honest but generic. The market-year
   index card is the obvious candidate. A per-day card would be better still,
   and is the same generator loop.
2. **Verify on a real handset.** Nobody has walked it on one. The narrow layout
   below 560px is a *different* layout — one rack bay plus Walk, and the strip
   becomes a 24-tick year index rather than Roman numerals — and it has only
   been seen in a resized desktop window.
3. **Link it from the Substack dispatch**, and from card XIV specifically, which
   is what earns it traffic that isn't 94.6% direct.
4. **greendays.day is not registered in Search Console at all.** Until it is,
   there is no way to know whether any of this got picked up.
5. **The silhouette band should be one profile, not a row of items.** At sign
   distance three separate shapes read as three dark blobs; the Danish sign
   works because it is a single wide silhouette spanning the plate.
6. **Long turns are sparse.** On the 20–25 day turns (Martinmas, St David, Cold
   Sophia) there is a long walk between signs. A distance marker
   (`Martinmas · 12 days`) stays inside the plate family, so it doesn't spend
   the second sign species the fingerpost needs.
7. **Plates only appear once you move.** The render loop parks when idle
   (deliberately — the design build spun `requestAnimationFrame` forever), but
   that means a first load standing still shows road and no signs until the
   first scroll or drag. A single draw pass on mount would fix it.
8. **The Swiss fingerpost** for the across-the-year sightline, and whether the
   spent plates (grey, struck through in red — the German *Ortsausgangstafel*,
   which is what carries rule 6) actually appear when looking back. The design
   build's own rear-view screenshot has none in frame.

---

## ⚠ Pushing does not deploy

There is no CI and `dist/` is gitignored. `npm run deploy` is the only thing
that ships. A green push means nothing is live. This has bitten this project
before.
