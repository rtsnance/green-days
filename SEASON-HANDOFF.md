# Start here: seasons + market year, state as of 7 August 2026

Pick-up note for a code session. **Read this first, then
[SEASON-SEAM.md](SEASON-SEAM.md) for the reasoning.** Nothing below is deployed.

---

## What is true right now

**48 of 149 items in `data/produce.json` carry `season_ranges`.** Added tonight,
purely additive: 149 items before and after, same order, zero existing fields
modified. Both readers (`src/produce.js`, `worker/index.js`) pick named fields,
so unknown keys are inert. **The app behaves exactly as it did yesterday.**

Five new files, none of them imported by anything:

| File | What it is |
|---|---|
| `src/season.js` | shared module. `legacySeasonalityOf` (today's parser, renamed), `rangeSeasonalityOf`, `peakRanges`, and `seasonalityOf(item, "MM-DD", band)` which prefers ranges and falls back to the parser per item |
| `scripts/derive-season-ranges.mjs` | generates ranges from the prose labels by one stated convention, plus `OVERRIDES`. `--write` to save |
| `scripts/season-diff.mjs` | parser vs ranges, 24 half-month ticks, every item and band |
| `scripts/season-lore-check.mjs` | ranges vs the turning days' own editorial claims |
| `scripts/season.test.mjs` | 17 unit cases: year-wrap, two-window, peak edges |

```
node scripts/season.test.mjs        17 pass
node scripts/season-lore-check.mjs  13 pass, 7 near, 0 fail
node scripts/season-diff.mjs        535 of 2304 readings move
```

## Three rules for anyone touching this

1. **Corrections go in `OVERRIDES` inside `derive-season-ranges.mjs`, never
   hand-edited into the JSON.** The script is re-runnable; a hand edit gets
   silently overwritten the next time someone runs it. Each override states the
   turning day or source it came from.
2. **`seasonNameForMonth` and `SEASON_MONTHS` must survive** any cleanup.
   `seasonBannerSrc()` needs them for the 16 banner assets. Quarters stay as a
   visual device and die as a data model.
3. **Run `season-lore-check.mjs` after every batch of ranges.** `season-diff.mjs`
   tells you what moved; only the lore check tells you whether it moved
   correctly, because it tests against claims written for a different reason.
   It has already caught two real errors that the diff could not see.

---

## ✅ Correction: the deploy is NOT blocked by Pinterest

Earlier notes in the project folder say the next deploy fires six queued pins at
a blocklisted domain. **That was fixed on 6 August and I had not seen it.**
`scripts/build-field-guide.mjs` carries `FEED_PAUSED = true`, a deliberate kill
switch that writes an empty but valid `feed.xml`, chosen over moving
`FEED_SINCE` so the six queued entries keep their place rather than being
silently marked as already pinned.

So a deploy is safe on that axis today. Flip `FEED_PAUSED` to false once
Pinterest confirms the domain is unblocked, and nothing else needs changing.

---

## The market year: recommended order before launching

**Launch it. But do step 2 first, because it is thirty lines and it changes the
pages materially.**

### 1. Freeze the slugs

`slugify()` in `scripts/build-market-year.mjs`. Reversible now; 24 redirects
after the first deploy. If the polyglot slug pass is happening, it happens now.

### 2. ✅ DONE — computed fields moved out of `data/turning-days.json`

*Landed 7 August 2026, after this note was written. Result: **21/24**, not the
19 predicted below — taking items from **either** band rather than treating
Mediterranean as a superset broke two more ties. Two findings worth your
attention before you extend ranges:*

- ***"mediterranean band = superset" is false*** *for 35 items. Med windows run
  15 days earlier at both ends, so they are shifted, not containing. Your own
  lore check found the case: Old Michaelmas is "The devil's blackberries" and
  the blackberry Med window closes 30 September, so under the superset rule the
  page could not show a blackberry at all. Fixed; Michaelmas now reads
  `Blackberry North` and Old Michaelmas does not list it.*
- ***Canon was computed with a finer parser than the app ships*** *— it honoured
  "Late spring", `legacySeasonalityOf` does not. A legacy-only recompute scores
  4 signatures, worse than the frozen 8. The ranges are what make it a win.*

*Three collisions remain, each a window where no ranged item changes state:
**22 Jan–2 Feb** (Candlemas = St Vincent), **14–23 Apr** (Cuckoo Day = St
George), **15–25 Jul** (St Swithin = Santiago). The July one is the useful
target — that page's epithet is "The cherries give way to the plums".*

*Also: `scripts/make-plates.py` no longer re-derives the stall rule in Python —
the build writes `data/market-year-plates.json` and the tool reads it. And
`SEASON_MONTHS` is gone from `build-market-year.mjs`; it imports
`seasonNameForMonth` from `src/season.js`, per your rule 2. Full write-up in
[SEASON-SEAM.md](SEASON-SEAM.md).*

<details><summary>Original instruction, kept for the reasoning</summary>

Canon keeps the editorial fields (`num`, `name`, `opens`, `days`, `great_turn`,
`working_name`, `lore_leads`). The generator computes `plate_candidates`, `peak`
and `med_only` from `data/produce.json` at build time via
`seasonalityOf()`, which gives it the per-item range/parser fallback for free.

**This is measured, not asserted.** Distinct stall signatures across the 24
turns:

```
frozen turning-days.json, as it would ship today:   8
recomputed from produce.json with tonight's ranges: 19
```

Sixteen of the 24 pages currently publish body content identical to the page
before them. Recomputing today takes that to five. **The duplicate-content
problem is most of the reason not to launch, and it is already mostly solved by
data that is sitting in the repo unused.**

Do it before the child pages are indexed. After that, changing what they say is
a re-crawl instead of a rebuild.

</details>

### 3. Then deploy

### 4. After launch, not before

Switch `src/produce.js` and `worker/index.js` to the shared `seasonalityOf`.
Sample the turn window rather than its midpoint. Extend ranges past 48.

---

## Two things the recompute settles

**"The densest slot of the year" survives.** XIV St Bartholomew still tops the
year under the range model at 95 items in season at midpoint, the highest of the
24. I had doubted that figure because it was parser-derived. It holds.

**The peak count does not.** XIV goes from 62 of 69 candidates flagged `peak` to
49 of 95. The turning-day pages split the stall into "At peak" and "Also about"
straight off that flag, so **the "At peak" list will shrink visibly on every
page.** That is almost certainly more correct, and it should be looked at once
before it ships rather than noticed after.

---

## Still genuinely blocking, and it is not Pinterest

**`greengage` is filed `Summer` and `/season/` prints that label on the index
page**, one click from the Long Lunches bridge post and the exact fruit the
24 August dispatch is named for and links to. The range is already corrected in
`OVERRIDES`; the prose `season` string is not, and the string is what renders
until `build-field-guide.mjs` computes `in_season` from the ranges.

Either change the string, or land step 2 and the field-guide rewire together.
Before 24 August, either way.
