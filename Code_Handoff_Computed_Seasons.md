# Code handoff: computed seasons

Paste into an app-repo session. Companion to `Spec_Computed_Seasons.md`, which holds the reasoning. This is the build order.

**The whole design goal is that this ships incrementally.** No big-bang cutover, no branch that sits for three weeks, nothing that has to be finished before it can be deployed. Every phase below is safe to stop after.

---

## The move that makes it incremental

`seasonalityOf` reads ranges **when the item has them** and falls back to the existing parser when it does not.

```js
const ranges = item.season_ranges?.[band];
if (!ranges) return legacySeasonalityOf(item.season, month, band);
```

That single line removes the all-or-nothing risk. Migrate six items or a hundred and forty-nine, deploy at any point, and every un-migrated item behaves exactly as it does today. The parser stays until the last item has ranges, then deletes itself.

---

## Phase 0. Ships nothing, risks nothing, do it first

Nothing here changes runtime behaviour. No deploy needed.

### 0a. Add the fields to the 20 field-guide items

Additive JSON. No code reads `season_ranges` yet, so this cannot break anything.

```json
{
  "id": "greengage",
  "season": "Summer",
  "season_ranges": {
    "mediterranean": [{ "from": "07-16", "to": "09-15" }],
    "temperate":     [{ "from": "08-01", "to": "09-15" }]
  },
  "availability": "local",
  "provenance": "inferred",
  "source": "carried from the 'Summer' label and narrowed by hand; not checked against a stall"
}
```

Boundaries snap to the 1st or the 16th. `provenance: "inferred"` for the whole first pass, and mean it.

### 0b. Write `scripts/season-diff.mjs`

**This is the most valuable artifact in the whole project and it should exist before anything changes.** It prints, for every migrated item and every half-month of the year, what the parser says against what the ranges say.

```js
// node scripts/season-diff.mjs
import PRODUCE from '../data/produce.json' with { type: 'json' };
import { legacySeasonalityOf, rangeSeasonalityOf } from '../src/season.js';

const BANDS = ['mediterranean', 'temperate'];
const TICKS = []; // 24 half-months
for (let m = 1; m <= 12; m++) for (const d of ['01', '16'])
  TICKS.push(`${String(m).padStart(2, '0')}-${d}`);

let changed = 0;
for (const it of PRODUCE) {
  if (!it.season_ranges) continue;
  for (const band of BANDS) {
    const diffs = TICKS
      .map((t) => [t, legacySeasonalityOf(it.season, Number(t.slice(0, 2)) - 1, band),
                      rangeSeasonalityOf(it, t, band)])
      .filter(([, a, b]) => a !== b);
    if (diffs.length) {
      changed++;
      console.log(`\n${it.id} (${band})  "${it.season}"`);
      for (const [t, a, b] of diffs) console.log(`   ${t}   ${a.padEnd(4)} -> ${b}`);
    }
  }
}
console.log(`\n${changed} item/band pairs move.`);
```

Run it after every batch of data. It is the thing that tells you what will move **before** it moves, and it is what you read instead of trusting that the ranges are right.

---

## Phase 1. Unify the two parsers. No behaviour change.

There are two hand-written copies today: `src/produce.js` and `worker/index.js` line 42. Extract one shared module.

Create `src/season.js` holding `SEASON_MONTHS`, `SEASON_CYCLE`, `seasonNameForMonth`, `legacySeasonalityOf` (today's logic, renamed) and the new `rangeSeasonalityOf`.

```js
// src/season.js

// Quarters SURVIVE, but only as a visual device: seasonBannerSrc() needs
// seasonNameForMonth to pick one of 16 banner assets. They stop being a data model.
export const SEASON_MONTHS = { spring: [2, 3, 4], summer: [5, 6, 7], autumn: [8, 9, 10], winter: [11, 0, 1] };
export const SEASON_CYCLE = ['spring', 'summer', 'autumn', 'winter'];
export const seasonNameForMonth = (m) =>
  SEASON_CYCLE.find((s) => SEASON_MONTHS[s].includes(m)) || 'summer';

// Day-of-year, non-leap. Needed rather than a naive MM*100+DD key because the
// peak calculation does arithmetic on range length, and month-packed integers
// are not linear (there is no 08-32).
const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const YEAR = 365;
const doy = (mmdd) => { const [m, d] = mmdd.split('-').map(Number); return CUM[m - 1] + d; };

// Ranges wrap the new year when `to` sorts before `from` (e.g. 11-01 to 02-15).
const within = (a, b, x) => (a <= b ? x >= a && x <= b : x >= a || x <= b);

export function inRanges(ranges, mmdd) {
  const x = doy(mmdd);
  return ranges.some((r) => within(doy(r.from), doy(r.to), x));
}

// Default peak is the middle third of each window, unless the item declares
// peak_from / peak_to. Wrap-safe: length is measured forward from the start.
export function peakRanges(ranges) {
  return ranges.map((r) => {
    if (r.peak_from && r.peak_to) return [doy(r.peak_from), doy(r.peak_to)];
    const a = doy(r.from), b = doy(r.to);
    const len = (b >= a ? b - a : b + YEAR - a) + 1;
    const s = a + Math.floor(len / 3);
    const e = a + Math.ceil((2 * len) / 3) - 1;
    return [((s - 1) % YEAR) + 1, ((e - 1) % YEAR) + 1];
  });
}

export function rangeSeasonalityOf(item, mmdd, band) {
  const ranges = item.season_ranges?.[band];
  if (!ranges) return null;          // caller falls back to the parser
  if (!ranges.length) return 'out';  // no local season in this band
  if (!inRanges(ranges, mmdd)) return 'out';
  if (item.availability === 'imported') return 'in';   // imported is never "peak"
  const x = doy(mmdd);
  return peakRanges(ranges).some(([a, b]) => within(a, b, x)) ? 'peak' : 'in';
}
```

The wrap and peak logic above was run against fifteen cases before this doc was written: a normal window, a window crossing the new year, and a two-window item, each checked at boundaries and at the peak edges. All fifteen pass. Keep them as the module's first test file rather than trusting the read.

Then import it in both places. **Check the worker bundles it.** `worker/index.js` currently duplicates rather than imports, and that may have been deliberate rather than lazy. If wrangler will not pull from `src/`, move the module to a top-level `shared/` and import from both. Verify with a real recipe request, not a build success.

**Deploy this on its own.** It should change nothing. If the diff script says nothing moves and a live recipe still comes back sane, the refactor is clean.

---

## Phase 2. Two signature changes worth doing carefully

### `seasonalityOf` takes the item, not the string

Today: `seasonalityOf(it.season, MONTH, band)`. It needs `season_ranges` and `availability` now, so it takes the whole item. Call sites: `src/produce.js` (`PRODUCE` map, `seasonalityFor`), `worker/index.js` lines 221 and 226.

### It takes a date, not a month

`src/produce.js` has `export const MONTH = new Date().getMonth()`, evaluated **once at module import**. Two problems, and the second one is new:

- A session left open across midnight on the 31st keeps last month's answer. True today, minor.
- With half-month ranges it goes wrong twice as often, and on the 16th rather than only on the 1st.

Pass an `MM-DD` string in. Keep `MONTH` exported for the banner, which genuinely only needs the month.

---

## Phase 3. The field guide stops guessing

`scripts/build-field-guide.mjs` reads a hand-set `in_season: true` boolean from each entry's frontmatter. That is the third source of truth, and it is the one behind `/season/`.

Replace the hand-set flag with a computed one at build time, using `src/season.js` and today's date. This was recommended on 2026-07-20 and never done.

Two things to keep:

- The eyebrow still prints `produce.season`, the prose string. It is good writing and it is what a reader wants to see.
- The build should **fail loudly** if an entry's frontmatter still carries `in_season` after the cutover, so the manual flag cannot quietly come back.

⚠️ Per `greendays_field_guide_entries`: the next deploy fires six pins at once. Unrelated to this work, but it will happen on whichever deploy goes first.

---

## Phase 4. The recipe prompt, which is an upgrade rather than a fix

`worker/prompt.js` line 215 currently emits `at its peak` / `in season` / `OUT OF SEASON, its season is X`.

With ranges you can give the model position within the window:

```
- damson (Damson) — in season, near the end of its run
- fig (Fig) — just arrived, at its peak
- pineapple (Pineapple) — available, imported, not local to this market
```

That is what makes the recipes argue what the newsletter argues. Do it last: it changes model output, so it needs its own eval pass against `predeploy-eval.sh`, and it should not be tangled up with a data migration.

---

## Deploy discipline for this work

**Ship Phase 1 alone.** It should move nothing.

**Then ship the data in batches**, reading `season-diff.mjs` before each.

**Do not ship the data batch in the same week as anything else.** `GreenDaysApp.jsx` line 215 sorts the home list by seasonality rank, so this reshuffles the first screen after onboarding, the one carrying the 48 percent abandon. Bundle it with another change and the metrics become unreadable.

And the standing one: pushing does not deploy. `npm run deploy` is the only thing that ships.

---

## Order of operations, plainly

1. `season-diff.mjs` exists and runs. *(no deploy)*
2. Ranges on the 20 field-guide items. *(no deploy)*
3. Extract `src/season.js`, import in both, verify the worker bundles it. **Deploy alone.**
4. Flip the readers to prefer ranges, parser as fallback. **Deploy alone.**
5. Field-guide build computes `in_season`. **Deploy alone.**
6. Remaining 129 items in batches, diff before each.
7. Delete `legacySeasonalityOf` once nothing falls back to it.
8. Prompt upgrade, with its own eval pass.

Steps 1 and 2 are safe today. Everything from 3 onward waits until after the 24th.
