# Computed seasons, two bands

Decision taken 2026-08-07: replace the quarter parser with real date ranges per item, per climate band.
**Not before 24 August.** Dispatch one, the Notes run, the market visit and the Part C sender all come first. This is the spec so it is ready, not a work order.

---

## What is actually wrong today

`src/produce.js`:

```js
export const SEASON_MONTHS = { spring:[2,3,4], summer:[5,6,7], autumn:[8,9,10], winter:[11,0,1] };
```

`seasonMonths()` scans a prose string for the four season words and unions their month sets. Nothing else in it reads the string.

**The consequence is worse than coarseness. The editorial judgment is already in the data and the parser throws it away.**

| Someone wrote | Parser hears | Months it returns |
|---|---|---|
| `Late summer` | summer | Jun, Jul, Aug |
| `Summer` | summer | Jun, Jul, Aug |
| `Summer–early autumn` | summer to autumn | Jun through Nov |
| `Late spring–summer` | spring to summer | Mar through Aug |

Damson is filed `Late summer` and the app believes it is at peak on 1 June. Somebody already did the thinking. The code discards it.

**So this migration is mostly recovery, not invention.** The 30 prose labels are a first draft of the ranges. That makes the job far smaller than 149 items from nothing, and far more honest, because the judgments were made before anyone needed them to come out a particular way.

---

## Schema

Per item in `data/produce.json`:

```json
"season_ranges": {
  "mediterranean": [{ "from": "08-01", "to": "09-15" }],
  "temperate":     [{ "from": "08-16", "to": "09-30" }]
},
"availability": "local",
"provenance": "inferred",
"source": "carried from the existing 'Late summer' label, not yet checked"
```

**Arrays, not single ranges.** Some items have two windows a year. A single range cannot hold a spring and an autumn crop, and forcing it is how you get `Spring–autumn`, which currently means seven months of nothing useful.

**`from` / `to` as `MM-DD`, no year.** Wraps across the new year by allowing `to` < `from`.

**An empty array is meaningful.** `"temperate": []` says the item has no local season there. That replaces the `(Med)` suffix hack, which currently means "in season in the south, out everywhere all year" and is carried by 13 items.

**Keep the prose string.** `season` stays exactly as it is and remains the display caption. It is good writing and the field guide badge prints it. The ranges do the computing, the string does the talking. That also means the six caption fixes stop being urgent the moment ranges exist for those items.

---

## Resolution: half-months, and this is deliberate

Snap every boundary to the 1st or the 16th. Twenty-four buckets a year.

Day precision on 149 items across two bands is 596 hand-set dates presented as measurement. Nobody knows greengages start on the 12th. Half-months are still six times finer than the quarters and they are a resolution you can actually defend when someone asks how you know.

It also lands at the same granularity as the turning days without being derived from them, which matters for the next section.

---

## ⚠️ Do not express ranges in turning-day numbers

The tempting version is `"mediterranean": [{ "from": 13, "to": 15 }]`, in turning days, because it is on brand.

It would make the whole thing circular. If item seasons are defined against the turning-day grid, then "what is in season during XIV" is true by construction, and "the densest slot of the year" stops being a finding and becomes an artifact of the definition. That is the same shape as the four great cliffs being a hardcoded constant, and as the fallback metric measuring the illustration queue.

Ranges are dates. The grid is dates. Slot membership is then a real computation, and the two are free to disagree. **The disagreements are the evidence the thing is not circular, and they are also where the dispatches find their material.**

---

## Provenance is the load-bearing field, not decoration

Three findings on this project so far have been the same error: a number that read as measured and turned out to be inferred. Fallback produce. The `in_season` booleans. The cliffs.

596 hand-set dates shipped as computed output is that error at scale, and it would be the last one you would ever catch, because by then the whole product would be resting on it.

So every range carries `provenance`:

- **`observed`**. You saw it on a stall and wrote down the date.
- **`sourced`**. A named reference, recorded in `source`.
- **`inferred`**. Carried over from the prose label or reasoned out. Honest, and the default for the whole first pass.

The app can then say so. "That is our judgment, not a measurement" already appears in your prose. The data layer should be able to make the same distinction without you having to write it each time.

---

## The third axis nobody has named yet

`availability` is not season and not band, and thirteen labels already gesture at it: `Year-round (imported)`, `Autumn (imported)`, `Summer (imported)`, `Autumn (stores to winter)`, `Summer harvest, stores`.

- **`local`**. Grown in that band and at the market because it is ripe.
- **`stored`**. Grown locally, out of the ground months ago, still good. Apples, roots, squash.
- **`imported`**. On the stall, from elsewhere, all year.

Without this, a computed model will cheerfully report that pineapple is in season in Lisbon in February. Technically the shop has it. That is exactly the claim the newsletter exists to argue against, and `strawberries in January` is already the villain of the bridge post.

---

## Bands, and what they cost

`data/markets.json` already carries the field. Four mediterranean: **PT, ES, IT, GR**. Ten temperate: **FR, DE, AT, CH, NL, BE, DK, GB, IE, SE**.

Two known simplifications, worth stating once rather than discovering later:

**France is temperate.** Provence is not. Bands are assigned per country, so Marseille and Lille get the same answer. Defensible for v1 if most French use is northern, and the fix, if it ever matters, is banding by market rather than by country.

**Copenhagen and London are the same band**, as are Lisbon and Athens. Two bands is a v1 simplification and should be described as one, never as climate science.

---

## Migration order

1. **The 20 field-guide entries.** They are the only ones with public pages. Forty ranges, one evening, and it retires the six caption fixes.
2. **The 13 `(Med)` items**, which is where the current hack lives and where the two-band model actually earns its keep.
3. **The 28 filed bare `Summer` and the 17 filed bare `Autumn`.** The worst offenders and the ones that make the catalogue agree with the thing the newsletter is written against.
4. The remainder.

Nothing links to anything past step 1, so steps 2 to 4 can run at whatever pace the writing runs at.

---

## Blast radius, traced in the code 2026-08-07

### There are three seasonality systems, not one

1. **`src/produce.js`**. The client.
2. **`worker/index.js` line 42**. A second, independently hand-written copy of the same parser (`seasonMonthSet` / `seasonalityOf`). Logically identical today. Nothing keeps them that way.
3. **`scripts/build-field-guide.mjs`**. Computes nothing. It reads a hand-set `in_season: true` boolean out of each entry's markdown frontmatter, and prints `produce.season` raw as the eyebrow badge.

So "is this in season" already has three answers. **Unify before migrating**, or you are hand-editing two parsers in lockstep and a third system that does not listen to either. (Whether the worker can literally import the shared module depends on its bundling, which I have not checked.)

### ⚠️ The recipe engine is producing wrong output today

`worker/prompt.js` line 215 sends the model, per basket item:

```
- damson (Damson) — at its peak
- lemon (Lemon) — OUT OF SEASON, its season is Winter (Med)
```

`peak` means "the season string contains the current month's season word." Damson is filed `Late summer`. June is summer. **So in June the recipe engine tells the model damsons are at their peak, and the model writes a recipe celebrating peak June damsons.**

This is not a badge problem. It is the product's primary output, silently wrong, for every item on a bare or qualified quarter label. Strawberry is equally "at its peak" on 1 June and 31 August.

`worker/index.js` line 489 also picks the recipe's lead ingredient by seasonality, so the classification decides what the recipe is built around, not just how it is described.

### What visibly moves in the app

- **Home list order.** `GreenDaysApp.jsx` line 215 sorts everything by `SEASON_RANK[seasonality]`. Ranges reshuffle the first screen after onboarding, the one already carrying a 48% abandon. Do not ship it the same week as anything else or the metrics become unreadable.
- **Vivid vs faded.** Lines 32 to 46: `out` items get a desaturating filter and a different thumb background. Items the quarters call in-season and ranges call out will visibly go faded. Mostly a correction.
- **`nextSeasonLabel`** (line 63, "Look for it in August") gets better for free: half-months give "from mid-August."

### ✅ Correction: `seasonNameForMonth` must SURVIVE

An earlier draft of this spec said the whole quarter apparatus goes. It cannot. `seasonBannerSrc()` builds `assets/seasons/{band}-{season}`, and there are 16 files on disk: 2 bands × 4 seasons × 2 densities.

The banner is a mood image, and four seasons is the correct resolution for a mood. **So the quarters survive as a visual device and die as a data model**, which is more or less the argument the whole product is making.

### `peak` needs redefining

Today it means "the string contains the current month's season name." With ranges, the honest options are the middle third of the window, or a separate optional `peak` range for the items where you actually know.

The upgrade worth taking afterwards: give the prompt the item's *position* in its window. "In season, near the end of its run" instead of a flat "in season" is what would make the recipes argue the same thing the newsletter argues. That is an improvement, not a fix, and it can wait.

### Order that follows

1. Unify the two parsers into one shared implementation. No data changes yet.
2. Rewire `build-field-guide.mjs` to compute `in_season` from the shared implementation instead of the hand-set boolean. This was recommended on 2026-07-20 and never done, and it is what makes `/season/` honest.
3. Then the data migration, in the order above.
4. Then the recipe-prompt upgrade.

Reminder, since it has bitten before: pushing does not deploy. `npm run deploy` is the only thing that ships.
