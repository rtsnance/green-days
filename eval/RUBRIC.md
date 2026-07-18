# Green Days — recipe eval rubric

What "good" means for the recipe engine, split into hard gates (never ship a regression on these) and soft dimensions (scored 1–5, watch the trend). Derived from `Recipe_Principles.md`. The grader (`grade.py`) enforces the deterministic gates automatically and asks an LLM judge for the soft dimensions.

## Hard gates — deterministic, pass/fail

A recipe fails the run if any of these trip. These are the silent-but-serious failures that a busy shopper trusting one confident recipe would be hurt by.

1. **Allergen leakage.** For every saved allergy, the recipe must not call for that allergen. The catch is that the assumed pantry already contains butter (dairy), bread/pasta/flour (gluten), and eggs, so an allergy forces the engine off its defaults. Terms the user put in their own basket are not counted against them.
2. **Diet violation.** Vegetarian: no meat or fish anywhere. Vegan: also no dairy, egg, or honey. Checked across every field including the "make it a meal" protein line.
3. **Off-season honesty.** If the basket holds an item that is out of its local season for that market and month, the recipe must include an honest off-season note that names the item. Silence is a failure. (A note when nothing is off-season is a soft warning, not a fail.)
4. **Structural completeness.** Title, seasonal note, stars, ingredients, method, and grab-one-more must all be present and non-empty.
5. **Voice — the absolute rules.** No em dashes. No "simply". No exclamation marks. These are non-negotiable per the principles.

### Calibrated warnings (surface, don't fail)

- **"just"** is flagged with context but not failed, because it is legitimate as a degree adverb ("char until just tender", "stock to just cover") — both appear in the anchor recipes. A human skims these to confirm none is filler ("just toss it together").
- **Time/effort cue** missing (no "about 20 minutes" / "a slow hour" signal).
- **Protein rule**: the basket already contains a pulse but a "make it a meal" protein was still suggested (principles say omit it when the dish has its own protein).

## Soft dimensions — LLM judge, 1–5

Scored by an Opus judge that receives the principles, the basket with per-item season truth, the market, the prefs, and the recipe. Watch the means across a run; a drop of 0.3+ between runs is treated as a regression.

- **Voice** — warm and spare; poetry confined to the seasonal note and the grab-one-more nudge; method stays plain and sensory, never purple.
- **Technique** — confident home cook; real technique when it earns its place (refogado, braise, pan sauce, sear); never fussy or cheffy; the minimalist-vs-improvisational dial set right for peak vs variety.
- **Seasonality** — the in-season basket items are the stars; market-strict (nothing a European market wouldn't have that day); location inflection light and correct, rooted not costumed.
- **Structure** — clean numbered method that scales to two; fresh produce dominant with pantry in a lighter register; grab-one-more points to a genuinely in-season item; protein rule respected.
- **Appetite** — would a real cook want to make this and want to eat it.

Plus an **overall** 1–5 and a one-line rationale. The judge also returns `hard_flags` as a second opinion on the deterministic gates.

## How the two layers divide the work

The deterministic gates own everything objective and unforgivable — they are cheap, run without an API key, and are the actual ship/no-ship signal. The judge owns the subjective quality that no regex can feel, and its job is trend detection, not gatekeeping. Neither replaces the periodic human taste panel, which is the only thing that can tell you a dish is genuinely appetizing or that the Portuguese lean rings true.

## Seasonality model caveat

The in-season truth used by gate 3 is parsed from `produce.json`'s free-text season labels (`parse_season` / `in_season` in `grade.py`), with a one-month Mediterranean widening and late-summer crops allowed to linger into September. It is a reasonable approximation, not the app's own logic. If the harness and the live app ever disagree on whether something is in season, trust the app and update the parser to match.
