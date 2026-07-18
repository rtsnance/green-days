# Green Days — recipe-engine eval

Offline harness to test, gate, and track the recipe engine. Run it before and after any change to the recipe system prompt (or the model) and compare. It is the regression backbone: clean recipes pass, unforgivable failures are caught deterministically, and soft quality is trended by an LLM judge.

## Files

- `RUBRIC.md` — what "good" means: the hard gates and the 1–5 judge dimensions.
- `golden_baskets.json` — 40 fixed baskets spanning peak/shoulder/off-season, Mediterranean and temperate markets, diet and allergy combos, and edge cases (single herb, ten items, all-off-season, pulse-in-basket, market-strict temptations). Every produce id is validated against `produce.json`; `expect.off_season_items` is auto-derived.
- `grade.py` — the harness: calls the engine per basket, runs the deterministic lint, optionally runs the LLM judge, writes a scored report, and diffs against a baseline.
- `anchors_as_recipes.json` — the three canonical anchor recipes in the output shape, used to prove the lint passes real Green Days recipes.
- `runs/` — timestamped report JSON.

## Run it

Lint only (no API key, no cost — the ship/no-ship gate):

```bash
python3 grade.py --no-judge --out runs/$(date +%F)-lint.json
```

Full run with the judge (needs an Anthropic key):

```bash
ANTHROPIC_API_KEY=sk-... python3 grade.py --out runs/$(date +%F).json --sleep 1
```

Regression check against a previous run (exits non-zero on a new hard failure or a judge-mean drop of 0.3+):

```bash
python3 grade.py --out runs/new.json --baseline runs/2026-07-12.json
```

Grade pre-generated recipes instead of hitting the endpoint (how the anchors are verified):

```bash
python3 grade.py --from-file anchors_as_recipes.json --no-judge --out runs/anchor-lint.json
```

## Env

- `GREENDAYS_RECIPE_URL` — default `https://lab.ryantnance.com/greendays/api/recipe`
- `ANTHROPIC_API_KEY` — required unless `--no-judge`. The harness reads it from the environment; it is never stored.
- `JUDGE_MODEL` — default `claude-opus-4-8` (offline, so favor the stronger judge).

## Reading the output

- **Hard-gate failures** is the number that matters. Any non-zero means do not ship the change. Each failing basket prints its gate breach.
- **Judge means** (voice / technique / seasonality / structure / appetite / overall) are the trend line. Compare to the last run; a 0.3+ drop on any dimension is flagged as a regression.
- Warnings (`just` usage, missing time cue, protein-rule nudges) are for a human skim, not gates.

## Workflow for evolving the prompt

1. Establish a baseline: run the full harness on the current prompt, keep the report in `runs/`.
2. Change one thing in the recipe system prompt (prefer adding or adjusting an anchor recipe over adding a rule).
3. Re-run against the baseline. If hard failures appear or a judge mean drops, the change regressed something — fix or revert.
4. When a real try-another rejection or tester complaint reveals a new failure mode, add it as a new golden basket so it is caught forever after.

## Caveats

- Seasonality truth is an approximation of the app's logic (see the bottom of `RUBRIC.md`). Reconcile if they diverge.
- Calling the live endpoint 40× generates real recipe API cost; use `--sleep` to be gentle and `--no-judge` while iterating on the lint.
- The harness tests correctness and consistency, not deliciousness. Keep the human taste panel in the loop.
