# The seam: the market year and produce timing

Two workstreams are live in this repo at once and they meet at one file.

- **The market year** — `/market-year/` and its 24 turning-day pages, shipped
  7 August 2026. Build docs in [MARKET-YEAR.md](MARKET-YEAR.md).
- **Computed seasons** — `src/season.js`, `scripts/derive-season-ranges.mjs`,
  `scripts/season-diff.mjs`. Phase 1 of `Code_Handoff_Computed_Seasons.md`:
  replacing the prose `season` string with per-band `season_ranges` at
  half-month resolution. 20 of 149 items carry ranges; the module is inert
  until `src/produce.js` and `worker/index.js` switch over.

This document is for whoever is holding either end. It is the decision record
for the market year, and then the honest account of where the two collide.

**The short version:** the market year rendered 24 pages from a data model that
could only tell 8 of them apart. The produce-timing work is not a nice-to-have
for it — it is the thing that makes 24 pages actually be 24 pages.

---

## ✅ Update, 7 August 2026 — the recompute is done

Part 4 step 2 has landed. `data/turning-days.json` no longer carries
`plate_candidates` or `in_season_at_midpoint`; `scripts/build-market-year.mjs`
computes them at build time via `seasonalityOf()`. Canon is 93 KB → 13 KB and
holds editorial fields only.

```
distinct stall lists across the 24 turns
  frozen in turning-days.json (before)          8
  recomputed, legacy parser only                4   ← a regression
  recomputed, seasonalityOf + 48 ranges        19
  ... + both bands instead of Med-as-superset  21   ← shipping
```

Two things the doing of it turned up, both written up below:

- **Canon was computed with a finer parser than the app ships.** It honoured
  "Late spring"; `legacySeasonalityOf` does not. Recomputing with the live
  parser alone would have been *worse* than the frozen data. It is the ranges
  that make this a win — see "Why the recompute needed the ranges".
- **"Mediterranean band = superset" is false**, measurably, for 35 items. See
  "The superset assumption doesn't hold".

Three turns still publish a stall list identical to a neighbour. That is now a
precise work-list for the ranges rather than a structural problem — see
"What is left, and exactly where".

Everything below this line is the original analysis, revised where it went
stale.

---

## Part 1 — What the market year decided, and why

Condensed from [MARKET-YEAR.md](MARKET-YEAR.md); the reasoning is here, the
mechanics are there.

### It lives at `/market-year/`, as real pages, not an experiment

greendays.day had 22 indexed URLs and a homepage that, until 6 August, had no
`<a>` in it at all. The site's problem was never traffic quality — it was that
there was nothing to crawl. Twenty-four named days with dates are 25 crawlable
URLs of genuinely-useful reference, each one a distinct entity, each linking
down into the field guide and back up to the index.

Rejected: a subdomain (strands the link equity), inside the app (the app is what
people install; this is what makes them want to), embedded in Substack
(Substack strips scripts — link to it from the dispatch instead, which is also
how it earns traffic that isn't 94.6% direct).

### It is generated, never pasted

The design build pasted the 24 days instead of importing them, and the paste
lowercased the first character of every `working_name` — "bartholomew wipes the
rain", "são João fires", "michaelmas geese". Everything under `/market-year/`
now derives from `data/turning-days.json` at build time. There is no second copy
of the data to drift.

This is the principle that matters for the seam: **derived data belongs in the
build, not in a file.** The market year now follows it. `turning-days.json`
itself does not — see Part 2.

### It prints only what is checkable

Canon's `lore_leads` are research topics carrying an explicit instruction not to
print them as-is ("verbatim from a named checkable collection or nothing"). So
the child pages carry the numeral, the opening date, the length, the great-turn
flag, canon's own `working_name`, and the stall list computed from
`data/produce.json`. Nothing else.

That makes **the stall list the entire factual payload of each page.** Which is
why its resolution is not a detail.

### Slugs are ASCII-folded English names

`candlemas`, `st-valentine`, `st-medard`, `st-bartholomew`. Not canon's
`slug_candidate`, which is provisional by its own `_meta` and mixes conventions
(`valentine`, `sant-jordi`, `sao-joao` next to `martinmas`). One derivation
rule, one URL shape.

**Reversible until the first deploy, and only then.** After that it costs 24
redirects.

### `Med` marks Mediterranean-only produce

Canon computes the stall over the Mediterranean band, which is a superset.
Without the mark, a temperate reader is being told avocados are on the stall at
Candlemas. This is a derived flag — see Part 2, it is one of the things the
range model replaces outright.

---

## Part 2 — Where the two workstreams collide

### The collision is `data/turning-days.json`

Its own `_meta` splits its fields honestly:

> Computed fields come from data/produce.json (in-season at slot midpoint,
> fine-parse of season strings, mediterranean band = superset; med_only items
> read 'out' in temperate markets). Hand fields are editorial.

The **hand** fields — `num`, `name`, `opens`, `days`, `great_turn`,
`working_name`, `lore_leads` — are canon and should stay in the file.

The **computed** fields — `plate_candidates` (with its `peak` and `med_only`
flags) and `in_season_at_midpoint` — are 1,163 rows of frozen derived data,
computed on 30 July 2026, outside this repo, by the legacy prose parser. They
feed two visible things: the "On the stall" list on all 24 child pages, and the
silhouettes on the plates in the walk.

**Nothing will notice when they go stale.** The moment `season_ranges` change
what `data/produce.json` means, `turning-days.json` will keep asserting the old
answer with no warning, no diff, and no test.

### The 8-signature problem

This is the finding that makes the granularity work urgent rather than tidy.
Across the 24 turns there are only **8 distinct stall lists**, and they group
exactly by calendar quarter:

```
I    II   XXIV                identical
III  IV                       identical
V    VI   VII  VIII           identical
IX   X                        identical
XI   XII  XIII XIV            identical
XV   XVI  XVII                identical
XVIII XIX XX                  identical
XXI  XXII XXIII               identical
```

St Swithin (15 Jul, 10 days) and Santiago (25 Jul, 7 days) carry the **same 69
candidates, the same 62 at peak, the same 0 med-only** — byte-identical rows.
So do Lammas and St Bartholomew. Sixteen of the 24 turns are indistinguishable
from the turn that follows them.

Three consequences, in ascending order of how much they cost:

1. **Editorially it contradicts the canon it sits next to.** St Swithin's
   `working_name` is *"The cherries give way to the plums"*. The stall list
   underneath it shows cherries and plums in exactly the same state as
   Santiago's, ten days later, and Lammas's, seventeen days after that. The page
   asserts a transition and then prints data that cannot see one.
2. **Four consecutive pages with near-identical body content is a duplicate-content
   problem**, and duplicate content is precisely the failure mode a
   24-page internal-linking fix was built to avoid.
3. **The walk shows it too.** Silhouettes rotate within each day's own candidate
   pool — but if four consecutive days share a pool, the rotation is doing
   cosmetic work over identical data.

A 7-day turn and a 25-day turn get one sample each, from a model whose finest
distinction is three months wide. **Half-month ranges give 24 turns up to 24
distinct signatures.** That is the whole argument.

### Why the recompute needed the ranges

Reproducing canon's frozen numbers from `produce.json` took some archaeology,
and it settled a question worth recording. Canon's filter is:

- exclude anything the label calls **year-round** or **stored** — perennials are
  on the stall at every turn and so distinguish none of them;
- keep `(Med/imported)` items, which *are* a real Mediterranean winter arrival
  (avocado, lime at Candlemas);
- `plate` is just `illustration` — **verified identical on all 1,163 frozen
  rows** before they were dropped;
- `peak` = 'peak' in the band, `med_only` = 'out' in temperate.

With that filter and today's `legacySeasonalityOf`, the reproduction misses
canon in one direction only: canon excludes new potatoes, broad beans and
garden peas from St David in mid-March, and the legacy parser includes them,
because canon **honoured "Late spring–summer" and the parser does not.**

So `turning-days.json` and `produce.json` were already disagreeing before any
range work — the frozen data was *finer* than the live parser. Which is why the
legacy-only recompute scores 4 signatures, worse than the frozen 8. The
migration is only an improvement because `seasonalityOf` prefers ranges. **Do
not recompute anything from the prose parser alone and call it a modernisation.**

### The superset assumption doesn't hold

Canon's `_meta` says "mediterranean band = superset" and computed the stall on
that band alone. Measured against the ranges, that is false for **35 items** at
some turn midpoint. The derive convention runs Mediterranean windows 15 days
earlier at *both* ends, which makes them **shifted, not containing** — so a
northern late-season item reads in-season temperate and out Mediterranean, and
the superset rule drops it silently.

The case that proves it is the one the lore already named. **XVII Old Michaelmas
is "The devil's blackberries"** — the folk date after which they are not picked.
Blackberry's temperate window closes 10 October; its Mediterranean window closed
30 September. Under the superset rule the blackberry was *already gone* at
Michaelmas eleven days earlier, so the page whose entire epithet is about
blackberries could not show one, and the two pages were byte-identical.

The generator now takes an item if **either** band has it, marks `Med` for
Mediterranean-only and `North` for the converse. That change alone took 19
distinct stall lists to 21, and Michaelmas now shows `Blackberry North` while
Old Michaelmas does not show it at all.

This is the clearest case so far of the two workstreams checking each other: a
claim written for a dispatch caught a false assumption in the data model.

### What the range model changes, quantified

`node scripts/season-diff.mjs`, on the 20 items that already carry ranges:

```
40 item/band pairs carry ranges. 35 of them move.
211 of 960 half-month readings change.
net: out->in 13   peak->out 48   peak->in 150
```

**150 peak→in demotions.** The turning-day pages split the stall into "At peak"
and "Also about" straight off the `peak` flag. Under the range model, peak
defaults to the *middle third of each window* unless an item declares
`peak_from`/`peak_to` — which is much stricter than the prose parser's "the
label mentions this quarter". Expect the "At peak" list to shrink hard and the
"Also about" list to grow.

That is a visible, user-facing consequence of a data-model decision. It is
almost certainly *more correct* — 62 of 69 items "at peak" simultaneously was
never true — but it should be a decision someone makes on purpose, not a
side effect noticed after deploy.

### Coverage: how far apart the two are right now

- 133 distinct produce ids appear in `plate_candidates` across the 24 turns.
- **19 of those 133 carry `season_ranges` today.**
- The 20 ranged items are the field-guide entries — which are also exactly the
  items the child pages link out to.

So the market year exercises roughly seven times more of the catalogue than the
range migration currently covers. `seasonalityOf()`'s null-fallback means a
mixed state is safe to ship; it also means a stall list would be *half* computed
from ranges and half from prose, with no visible marker of which is which.

### Four smaller seams

**`med_only` is replaced outright.** `season_ranges.temperate = []` means "no
local season in this band" — a first-class statement, strictly better than the
`/\(med/` regex on a prose string. When ranges land, the `Med` chips should read
from the ranges, not from the frozen flag.

**Midpoint sampling assumes a turn is a point.** A turn is a window of 7–25
days. With day-resolution ranges the honest questions become *in season for any
part of this turn* versus *for all of it* — and the difference between those two
is exactly what a transition day like St Swithin or St Luke ("the last
tomatoes") is about. `seasonalityOf(item, mmdd, band)` already takes a date, so
sampling a window is a loop, not a redesign.

**There is a fourth copy of the quarter table.** `SEASON_MONTHS` in
`scripts/build-market-year.mjs` joins the ones in `worker/index.js`,
`src/produce.js` and `src/season.js`. Mine is used only for the "Season" line on
the child page and the riser hue in the walk — which is precisely the "quarters
survive as a VISUAL device only" role `src/season.js` describes. It should
import `seasonNameForMonth` when Phase 1 lands, and it is the *easiest* of the
four to switch because nothing downstream depends on it.

**Same origin, same day.** `turning-days.json` was generated 30 July 2026, the
same day as `Microseasons_Excavation_Pass` and `Microseasons_Pegged_Roster` in
the Green Days project folder. The turning days and the microseasons work came
out of one pass. They should not diverge now.

---

## Part 3 — What the market year gives back

This is not one-directional. The turning days are the best validation harness
the range work has.

**Twenty-four dated editorial claims.** `working_name` and `lore_leads` are
assertions about *when things happen*, made independently of `produce.json`:

- XI St Swithin, 15 Jul — "The cherries give way to the plums"
- XVIII St Luke, 18 Oct — "the last tomatoes"
- XXI St Nicholas, 6 Dec — "Nicholas and the citrus turn"
- XVII Old Michaelmas, 10 Oct — "The devil's blackberries" (the folk date after
  which blackberries are not to be picked)

If the ranges are right, the stall lists on those four pages should show exactly
those transitions. If they don't, either the ranges or the lore is wrong, and
both are worth knowing. `season-diff.mjs` tells you *what* moved; the turning
days tell you whether it moved *correctly*. That second question is not
answerable from `produce.json` alone.

**Boundary anchors.** A range boundary landing on a turn opening is a
corroboration; one landing mid-turn is a question. Twenty-four named dates the
European working calendar actually ran on are better prior information than
"summer starts 1 June".

**A rendered surface to inspect.** The 24 pages are the fastest way to *see*
what a range change did across the whole year — one build, 24 pages, each a list
of names. Cheaper to read than a diff of 960 readings.

---

## What is left, and exactly where

Three turns still publish a stall list identical to a neighbour. Each one is a
date window in which **no ranged item changes state**, which makes this a
targeted work-list rather than "extend ranges past 48":

| Collision | Window with no state change |
|---|---|
| I Candlemas = XXIV St Vincent | 22 Jan – 2 Feb |
| V Cuckoo Day = VI St George | 14 – 23 Apr |
| XI St Swithin = XII Santiago | 15 – 25 Jul |

The July one is the loudest, because St Swithin's own epithet is **"The cherries
give way to the plums"** — a transition the page asserts and cannot currently
show. Cherry and plum ranges tight enough to move inside those ten days would
break the tie and make the page mean what it says.

**The peak share is the other open number.** 76% of stall rows are flagged
`peak`, because the ~100 items still on the prose fallback get peak from "the
label mentions this quarter", which is generous. As ranges extend, peak becomes
the middle third of a real window and that number should fall hard. The
turning-day pages split "At peak" / "Also about" straight off the flag, so this
is visible on every page — worth a look before launch, not after.

## Part 4 — Recommended sequence

Ordered so that nothing has to be undone.

1. **Decide the slugs.** Before the first deploy of `/market-year/`, because
   after it they are permalinks. Independent of everything else here — if the
   polyglot slug pass is happening, change `slugify()` in
   `scripts/build-market-year.mjs` now.

2. ~~**Move the computed fields out of `turning-days.json` and into
   `build-market-year.mjs`.**~~ **Done 7 August 2026.** The generator computes
   `plate_candidates`, `peak`, `med_only` and `north_only` at build time; canon
   keeps editorial fields only. It also writes `data/market-year-plates.json`,
   so `scripts/make-plates.py` no longer re-implements the stall rule and the
   plate rotation in Python — the build says what art it needs, the tool makes
   it. `SEASON_MONTHS` is gone from the generator too; it imports
   `seasonNameForMonth` from `src/season.js`, so the fourth private copy of the
   quarter table is retired.

   The build now prints its own health line, and warns below 12:

   ```
   stall: 1190 rows over 131 distinct items, 909 at peak (76%) — 21/24 distinct stall lists
   ```

3. **Switch `src/produce.js` and `worker/index.js` to `seasonalityOf()`** —
   Phase 1 as written. `build-market-year.mjs` becomes the third caller and gets
   the null-fallback for free.

4. **Sample the window, not the midpoint.** Once the generator computes its own
   candidates, decide what a turn's stall means: any-day-in-window or
   every-day-in-window. My recommendation is *any*, with items in season for
   the whole turn sorted first — it makes transition days finally read as
   transitions.

5. **Re-check "At peak".** After the peak-as-middle-third model lands, look at
   the 24 pages before deploying. 62-of-69 at peak was never true; whatever
   replaces it should be looked at, not just shipped.

6. **Extend ranges beyond the field guide's 20.** The market year is the demand
   signal: 133 ids, 19 covered. The turns with the most editorial weight — the
   eight great turns — are the place to start.

---

## Open questions that need one answer, not two

Both workstreams will otherwise answer these separately and differently.

- **Does a turn's stall mean any-day or every-day in the window?** (Affects the
  market year's pages directly; affects whether ranges need to be tight or
  generous.)
- **Is `peak` the middle third, or declared per item?** `peakRanges()` supports
  both. The turning days are where the answer becomes visible, so they should
  probably drive it.
- **Does the band split stay two-valued?** `mediterranean` / `temperate` is what
  `season_ranges` encodes and what `Med` renders. `data/markets.json` carries a
  `band` per country — if that ever becomes three bands, both workstreams break
  in the same place.
- **Where does canon live?** `data/turning-days.json` is now in the repo, but
  it was copied from `~/Claude/Projects/Business ideas/Green Days/`. Two copies
  exist. The repo one is the one the build reads; the project-folder one should
  either become a pointer or be treated as an archived original.

---

*Written 7 August 2026, after integrating the Greengage Line handoff. The market
year is built and verified locally; nothing is deployed. See
[MARKET-YEAR.md](MARKET-YEAR.md) for how it builds and what is still outstanding
on its own terms.*

---

## Part 5. Answered from the other end, 7 August 2026

Written by the session that built `src/season.js` and the ranges, after reading
Parts 1 to 4. Three confirmations, one failure the harness caught, and one
disagreement.

### The 8-signature finding holds, and it is worse grouped than by quarter

Verified independently against `data/turning-days.json`:

```
[1] I Candlemas · II St Valentine · XXIV St Vincent
[2] III St David · IV Lady Day
[3] V Cuckoo Day · VI St George · VII May Day · VIII Cold Sophia
[4] IX St Médard · X Midsummer
[5] XI St Swithin · XII Santiago · XIII Lammas · XIV St Bartholomew
[6] XV Marymas · XVI Michaelmas · XVII Old Michaelmas
[7] XVIII St Luke · XIX All Hallows · XX Martinmas
[8] XXI St Nicholas · XXII Christmas · XXIII Epiphany
```

Group 5 collapses **15 July to 7 September** into one row: cherries-to-plums,
Santiago, Lammas and Bartholomew all assert the same stall. Group 3 collapses
**14 April to 7 June**. These are the two richest transitions of the year.

### ✅ Part 3's harness works, and it failed on its first run

Ran the four dated claims against the 20 ranged items.

**XVII Old Michaelmas, 10 Oct, "the devil's blackberries"**. The folk date after
which blackberries are not to be picked. The ranges say blackberry is **`peak` in
temperate on that exact day**, running to 30 November.

Blackberries in northern Europe in late November are not real. **The lore is
right and the derived range is wrong**, too generous at the tail because
`derive-season-ranges.mjs` maps `Late summer–autumn` mechanically to the end of
autumn. Caught within an hour of the range being written, by a check that
`season-diff.mjs` cannot perform, because a diff only knows what moved and not
whether it moved correctly.

That is the argument for Part 3, demonstrated rather than asserted. **The lore is
not decoration on top of the data. It is the only independent test the data has.**

**XI St Swithin, "the cherries give way to the plums"** could not be tested: the
ids are `cherry` (`Early summer`) and `cherry-tomato`, and neither carries ranges.

### ⚠️ Amendment to step 6: not the great turns first, the *named* items first

Step 6 proposes extending ranges starting with the eight great turns, on
editorial weight. Weight is not the same as testability. Start instead with every
produce id named in a `working_name` or a `lore_leads` entry: `cherry`, `plum`,
`tomato`, `lemon`, `orange`, `mandarin-clementine`, and the rest of that set.

Those are the only items in the catalogue with an **independent dated claim**
attached. Everything else can only be checked against the label it was derived
from, which is circular. Roughly ten items buys a real test suite; the great
turns buy coverage of pages that still have nothing to check them against.

### ⚠️ Disagreement on step 4: "any-day in window" reintroduces the same artifact

Turn lengths run **7 to 25 days**. A 25-day turn samples 3.6x more days than a
7-day one, so "in season for any part of the window" makes Martinmas look richer
than Santiago by duration alone. That trades a quarter-boundary artifact for a
window-length artifact and the stall count still is not measuring the market.

Better: compute, per item, **the fraction of the turn it is in season for**, and
let the fraction drive both inclusion and order. Items covering the whole turn
lead; partial items are the transition, and the fraction is precisely what a
transition day means. Swithin becomes cherry 0.4 falling, plum 0.7 rising, which
is the page finally saying what its own `working_name` says. And the headline
count stops scaling with window length.

### A cross-dependency neither document has

Step 1 says slugs are reversible only until the first deploy. Step 2 says move
the computed fields before the child pages are indexed. Both are
urgent-*before*-deploy.

But **the next deploy fires six queued field-guide pins at a domain Pinterest
blocklisted as spam on 5 August**. So the market year cannot ship until the
Pinterest question is resolved, which makes that a launch blocker rather than a
channel problem. It also blocks the one-word `greengage` season fix, which the
24 August dispatch needs, since the dispatch links to `/produce/greengage/` and
`/season/` prints "Summer" beside it today.

Three things now queue behind one unresolved deploy. Worth settling in the week
of the 18th, alongside the market visit.

### Part 5 addendum: the harness is built and run

`scripts/season-lore-check.mjs`. Twenty assertions, each one a claim taken from
a turning day's `working_name` or `lore_leads`. Ranges extended from 20 items to
**48**, chosen by the amended step 6: the field guide plus every produce id the
lore names.

```
13 pass, 7 near (within one half-month tick), 0 fail
```

`NEAR` exists because the ranges are half-month resolution on purpose. A two-day
miss is inside the grain of the model and is corroboration, not disagreement.
Only `FAIL` means the lore and the data actually contradict.

**Two real errors found, both by the lore, neither visible to `season-diff.mjs`:**

- `blackberry` ran to 30 November and read **peak on Old Michaelmas**, the folk
  date after which blackberries are not to be picked. Tail pulled to 10 Oct.
- `leek` derived to 28 February, which put leeks **out of season on St David's
  Day**. Leeks are the Welsh emblem because they are on the stall on 1 March.
  Tail extended to 31 March.

Both are now `OVERRIDES` entries carrying the turning day as their source.

**And the corroboration worth keeping.** Turning day XI is named *"The cherries
give way to the plums"*, 15 July. Derived independently from prose labels
written in a different pass:

```
cherry      Early summer         06-01 .. 07-15
gooseberry  Early summer         06-01 .. 07-15
plum        Late summer-autumn   07-16 .. 11-30
damson      Late summer          07-16 .. 08-31
```

Cherries end on 15 July. Plums begin on 16 July. **The handover lands on St
Swithin's Day exactly**, from two sources that never consulted each other. That
is the strongest evidence so far that the label vocabulary was carrying real
information all along and only the parser was losing it.

Same shape at Epiphany: the lore says PSB arrives mid-January and the derived
range opens **16 January**.

Coverage is now 48 of 149 items and 96 item/band pairs; 535 of 2304 half-month
readings move, still dominated by peak demotions (356 `peak`->`in`, 140
`peak`->`out`). Nothing is wired in and nothing is deployed.
