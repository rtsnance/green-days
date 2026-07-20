# Recipe eval — session handoff

Pick-up notes for continuing the recipe-quality eval work in a fresh session.
Last updated 2026-07-12.

For general Green Days context (repo layout, deploy, data model), see
`../HANDOFF.md` first — this doc only covers the eval harness and gate.

---

## What exists

- **`eval/grade.py`** — deterministic + LLM-judge grader over 40 golden
  baskets (`eval/golden_baskets.json`). Reads produce/market data from
  `../data/` (this repo's data dir — the harness originally assumed a
  sibling `assets/` dir from the docs project; that's been repointed to
  `data/`, which has identical contents).
- **`scripts/predeploy-eval.sh`** — builds the app, boots `wrangler dev
  --local` on a throwaway `--persist-to` scratch dir (so stale cached
  recipes from a previous session can never mask a real regression), waits
  for it to answer, runs `grade.py --no-judge` against it, and exits
  non-zero on any hard-gate failure.
- **`npm run predeploy`** runs that script. **`npm run deploy`** now runs
  `predeploy` first, then `wrangler deploy` — so a broken prompt can't ship.
- **`worker/index.js` `mockRecipe()`** is diet/allergy/season-aware (drops
  sardine/egg for vegan/vegetarian/allergy, falls back to starring the
  whole basket when nothing's in season). This matters because the
  zero-cost `MOCK_RECIPES=1` path is what the predeploy gate runs by
  default — a naive static mock would trip 8/40 hard gates every time
  regardless of whether the real prompt is fine.
- The rate limiter (`RECIPE_RL`, 8 req/60s) is skipped when
  `MOCK_RECIPES=1`, since that flag only ever lives in local `.dev.vars`
  (never a prod secret) and the gate needs to fire 40 requests fast.

## Two gate modes

1. **Fast/zero-cost (`--no-judge`, mock engine)** — what `npm run deploy`
   runs automatically. Tests structure/harness wiring, not the real prompt.
   Currently green (0/40 hard-gate failures).
2. **Full judge baseline (real engine + Opus judge)** — manual, costs
   money, needs `ANTHROPIC_API_KEY`. Run against a **local** `wrangler dev`
   (never prod — hitting the live endpoint adds synthetic
   `recipe_generated` events that skew production metrics):

   ```sh
   cd ~/Design/greendays
   # .dev.vars: ANTHROPIC_API_KEY=<real key>, MOCK_RECIPES unset/removed
   npm run build
   npx wrangler dev --port 8787 --local --persist-to "$(mktemp -d)" &
   # wait for http://localhost:8787/ to answer, then:
   GREENDAYS_RECIPE_URL="http://localhost:8787/api/recipe" \
     ANTHROPIC_API_KEY=<real key> \
     python3 eval/grade.py --out eval/runs/judge-baseline-DATE.json --sleep 1
   # kill the wrangler dev process + rm -rf the persist dir when done
   ```

   `grade.py` exits non-zero whenever hard gates fail — that's expected
   even on a "successful" run if the prompt has real issues (see below).
   Don't treat a non-zero exit here as a tooling failure without reading
   the output first.

## Baseline result — 2026-07-12

Report: `eval/runs/judge-baseline-2026-07-12.json`. Real recipe engine
(Sonnet 5) + Opus judge, all local, 40/40 baskets graded.

**Judge means:** voice 4.38 · technique 4.17 · seasonality 4.58 ·
structure 4.2 · appetite 4.5 · **overall 4.12**

**Hard-gate failures: 4/40** — real prompt issues, not harness artifacts:

| Basket | Failure |
|---|---|
| `vegan-borlotti-chard` | vegan diet violated — recipe calls for cream |
| `vegan-pumpkin-sage` | vegan diet violated — recipe calls for butter |
| `nuts-green-beans` | nut allergy violated — recipe calls for nuts |
| `offseason-imported-avocado` | banned word "simply" used |

## Update — 2026-07-12 (later): fix staged, not yet re-validated

The four failures above have been addressed in code (staged in the repo, NOT
yet re-run against a real judge baseline — that needs a fresh ANTHROPIC_API_KEY
since the old one was deleted after the plaintext exposure):

- **`worker/prompt.js`** hardened: a new "Hard constraints (never violate)"
  section states that diet/allergy override the assumed pantry (butter→olive
  oil, no eggs, gluten→no bread/pasta, etc.), that vegan applies to the protein
  field, and that the worked examples' sardines/eggs/cheese are not licenses.
  `buildUserMessage` now expands the active diet + allergies into explicit
  banned-ingredient lines per request, with a closing self-check instruction.
- **`worker/index.js`** deterministic guard added: after generation the recipe
  is audited (`auditRecipe`) against the active diet/allergy term families
  (mirroring `eval/grade.py`) plus banned words. On a hit it sends ONE
  correction turn to the model; residual banned words are stripped
  deterministically (`sanitizeBannedWords`); if a diet/allergen violation
  survives the repair it fails safe (502, `trackErr('unsafe_prefs')`) rather
  than serve an allergen. Word-boundary matching + scrubs keep compounds safe
  (butternut≠butter, eggplant≠egg, oyster mushroom, coconut milk, "creamy").
  Both files pass `node --check`; the guard passes 11/11 inline unit tests
  (4 repro cases caught, 7 false-positive traps clear).
- `grade.py` already supports `--baseline`, so the diff step below works now.

## Update — 2026-07-13: the 2 remaining failures were EVAL false positives

The 2026-07-13 judge run showed 2/40 hard-gate failures (`vegan-borlotti-chard`
"cream", `nuts-green-beans` "nut"). On inspection these were **not** real leaks
— they were the eval lint (`grade.py`) over-matching: its left-boundary-only
regex flagged "cream" inside "creamy" and "nut" inside "nutty"/"nutmeg", both
canonical Green Days phrasings ("the beans are creamy", "smells nutty"). The
worker guard was correct to ship those recipes (it uses word boundaries, so
"creamy" != cream). Tell: if a real allergen had appeared, the worker guard
would have 502'd it and the eval would show an *error*, not a graded recipe.

Fixed in `grade.py` so the eval agrees with the worker guard:
- Whole-word matching (`\bterms?\b`) instead of left-boundary-only.
- Variant-aware term lists + a plant-cream/milk scrub (coconut cream, oat milk)
  and the oyster-mushroom scrub, mirroring `worker/index.js` auditRecipe.
- Removed the bare "nut"/" nut " term that matched nutmeg/nutty.
- Reports now store the full `recipe` per basket, so any future failure is
  inspectable without a re-run.
Verified: creamy/nutty/nutmeg/coconut-cream clear; real double-cream, almonds,
sardines, buttered still fail; the 3 anchors still lint clean.
(Same fix applied to the docs-project copy under "Business ideas/Green Days/eval".)

## Status — 2026-07-13: SHIPPED

Re-validated at 0/40 hard-gate failures (`eval/runs/judge-2026-07-13b.json`),
judge quality up on every dimension (overall 4.12 → 4.53), no regressions.
**Deployed to production (version 537d7552).** The hardened prompt + audit
guard are live.

Open follow-ups (minor):
- `.dev.vars`: clear the `ANTHROPIC_API_KEY` value so the predeploy gate returns
  to the free mock engine; rotate that key in the console (it passed through
  tool output during setup).
- `package.json`: `deploy` runs the predeploy gate twice (npm lifecycle hook +
  explicit `npm run predeploy &&`). Drop the explicit chain to run it once.
- The fast predeploy gate uses the mock engine, so it validates structure, not
  the real prompt. Consider running the real-engine judge pass on any PR that
  touches `worker/prompt.js` (weekly, or manually) as the deeper check.
2. Once the prompt reliably clears all 40 hard gates on a judge run,
   consider whether the fast mock-mode gate (which only tests structure)
   is sufficient for `npm run deploy`, or whether the real-engine judge
   pass should run periodically (e.g. weekly, or on any diff touching
   `worker/prompt.js`) rather than only on request.
3. **Security:** the `ANTHROPIC_API_KEY` used for the 2026-07-12 baseline
   was briefly pasted in plaintext into a chat session while setting up
   `.dev.vars` (a `zsh` comment-parsing mistake caused an `echo` command
   with the raw key to be echoed back). It should be rotated in the
   Anthropic console if that hasn't happened yet. Prefer editing
   `.dev.vars` directly (editor, or `printf` into the file) over `echo`
   commands that might get echoed/logged.

## Gotchas learned this session

- **Miniflare persists the Cache API to disk** (`.wrangler/state` by
  default) across `wrangler dev` restarts. Without a scratch
  `--persist-to` dir, a stale cached recipe response can mask a real code
  change — this caused a confusing "fix didn't work" moment before the
  cause was found. Always use a throwaway persist dir for eval runs.
- `grade.py`'s default `RECIPE_URL` is the **production** endpoint
  (`https://greendays.day/api/recipe`). Always set
  `GREENDAYS_RECIPE_URL` to point at local `wrangler dev` unless you
  deliberately want to hit prod.
- zsh (interactive) does not treat trailing `# comment` on a command line
  as a comment by default — words after `#` get passed as arguments. Keep
  copy-paste commands comment-free.
