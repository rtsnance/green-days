# Pinterest handoff — 14 Sep 2026

Repo: `~/w/code/green-days` · branch `docs/handoff-remote-and-deploy` · HEAD `e12be49`

## The governing rule

Pinterest is a forward-planning surface. Its own 2026 brand-moments guidance is
"if the moment peaks in June, launch in April", about an eight-week lead.
Stack that on our own accumulation rule (a pin needs roughly three weeks of
public life before it can be read at all) and one rule falls out:

> **A produce pin goes public about seven weeks BEFORE its season opens, not during it.**

Two consequences that keep getting missed:

1. **Grapes 2026 was lost in August, not in September.** Rushing the release to
   "catch the peak" optimises a window that already closed.
2. **A pin is a perennial, not a post.** It does not expire, it re-peaks
   annually. So there are 24-ish slots, each filled once, and a weak pin in a
   slot is weak every year. That argues for few pins made carefully, not
   batches made cheaply. It also means **a three-week read on any pin test is
   the wrong clock** — a perennial's first season carries no accumulated signal,
   so the title split test as designed cannot be read until its second peak.

## State, verified today

| | |
|---|---|
| Operator exclusion (`gd_operator`) | ✅ shipped in `97521fd`, live. Set it with five taps on the wordmark inside the installed app. |
| RSS feed links carry `?utm_source=pinterest` | ✅ live. Verified on greendays.day/produce/feed.xml, 4 items. |
| `<guid>` holds the bare URL | ✅ live. The 9 staging pins will not duplicate. |
| Field-guide CTA carries `utm_source=field_guide` | ✅ live. |
| Inbound source carried across the CTA hop | ⚠️ **written today, UNCOMMITTED** |
| Beacon on the static field-guide pages | 🔴 still absent |

### The uncommitted work

- `scripts/build-field-guide.mjs` (modified). `pageShell()` now emits a small
  inline script that rewrites the CTA's `utm_source` to
  `<inbound>.field_guide`. Without it every field-guide conversion files as
  `utm:field_guide` whatever channel delivered the reader, because the CTA is
  same-origin and `document.referrer` is null on the other side. No storage, no
  network, no identifier.
- `scripts/pin-calendar.mjs` (new, untracked). See below.

Both verified by building and reading the emitted HTML. **Not yet deployed.**

### Still open

🔴 **The static pages fire nothing.** A reader who lands on `/produce/nespera/`
and leaves is unmeasurable, not merely uncounted. Only conversions are legible.
Fixing it means putting a beacon in `pageShell()`, which is a bigger change than
today's and touches the consent-free posture. Not started.

## The calendar

`node scripts/pin-calendar.mjs` prints season-open minus 49 days for every
field-guide entry. `GD_BAND=temperate` and `GD_TODAY=2026-11-01` shift band and
date.

It reads **`season_ranges` starts, never peak or density**: peaks are
declared-only and XV moved 73 to 89 in five weeks, so a peak-based calendar
would be unstable. A range start is not.

It **rolls forward on the season open, not on the publish date**. An entry whose
ideal publish date slipped by a day is late by a day, not by a year. The first
version rolled on the publish date and silently pushed turnip and olives to
November 2027 for being one day late. That bug is the difference between
"nothing to do until November" and the five live items below.

### Run of 14 Sep 2026, mediterranean band

```
PUBLISH BY   SEASON OPENS   ENTRY                 LATE BY
2026-08-13   2026-10-01     Kiwi                  32d
2026-08-13   2026-10-01     Persimmon / kaki      32d
2026-08-28   2026-10-16     Medlar                17d
2026-09-13   2026-11-01     Olives                 1d
2026-09-13   2026-11-01     Turnip                 1d
2026-11-13   2027-01-01     Pineapple
2026-12-29   2027-02-16     Rhubarb, Wild garlic
2027-03-28   2027-05-16     Samphire
```

Then nothing until late March. 25 of 27 entries placed; **horseradish and swede
have no `season_ranges` at all** and cannot be scheduled.

## 🔴 The immediate conflict

**`FEED_HOLD` is holding kiwi and olives during their own publish window.**
Both were written in set 6, deployed 31 Aug, and then held. Their windows opened
32 and 1 days ago respectively.

Persimmon, medlar and turnip sit outside `FEED_SINCE`, so they never enter the
feed at all and need hand-pinning if they are not already public.

Related, still true from 7 Sep: **batch 1 never went public.** The staging board
reads 9 Pins, not the expected 7, so check for duplicates before moving anything.
The two extra are most likely auto-published duplicates from the three-item feed
that stayed live between 4 and 18 Aug.

⚠️ A deploy that ADDS a feed item auto-publishes a pin. Releasing anything from
`FEED_HOLD` is therefore a publish, not a staging step.

## Gotchas

- **`sharp` will not run in the desktop Linux VM** (macOS arm64 binary). A
  stubbed build works for checking emitted HTML but writes zero-byte crop PNGs
  into `dist/` (gitignored). **Always rebuild on the Mac before deploying.**
  There are 51 such files in `dist/` right now.
- **Build from the repo, not the vault.** `cd ~/w/code/green-days` first.
- **Four of this session's six connected folders are dead**: `~/Design/greendays`,
  `~/Claude/Projects/Business ideas/Green Days`, and two under `Design iCloud`.
  The code is not reachable through any of them. Request
  `~/w/code/green-days` explicitly.
- **`data/turning-days.json:30`** says a file in `~/Claude/Projects/...` "still
  carries them", present tense, pointing at a dead folder. Reword to past tense.
- The guide is served at `/produce/`, not `/field-guide/` (that path 404s).
- Verify liveness with a WebFetch that asks for **verbatim lines**, never a
  summary. Summaries of this site's feed and sitemap have been fabricated before.

## Hypothesis worth testing, not yet run

The `pin_description` fields were written keyword-first and contain the entire
decoder fact plus the buying test, so a reader has no remaining reason to visit.
Search shows the same shape: 178 impressions, zero clicks. Cheap test: on one
batch, truncate the description to the hook and the local names and withhold the
payoff. This is cleaner than the queued title test and the two would confound
each other.

## Also

Pinterest's milestone emails ("your pin hit 500 impressions") name the pin by
image and are the only working pin-id to entry channel: the board grid does not
render under browser automation. Keep them.
