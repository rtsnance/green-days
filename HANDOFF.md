# Green Days — session handoff

Pick-up notes for continuing work on the Green Days app in a fresh session.
Last updated 2026-07-12.

Green Days is a farmers-market mobile web app: the season sets a vivid palette of
in-season produce, you tap a basket, and a recipe engine returns one produce-first
recipe. Europe-first, one-handed, glanceable. **Live in production.**

---

## TL;DR

- **Repo:** `~/Design/greendays` (git, **no remote** — deploy ships to prod, there's nothing to push).
- **Live app:** https://lab.ryantnance.com/greendays/
- **Deploy:** `cd ~/Design/greendays && npm run deploy` (runs `vite build` then `wrangler deploy`). Wrangler is authed as rtsnance@gmail.com.
- **Stack:** Vite + React front-end (base path `/greendays/`) + a single Cloudflare Worker that serves the built static assets AND the small API, on the route `lab.ryantnance.com/greendays*`. Coexists with the existing Lab worker.
- **Data source of truth:** `data/produce.json` (149 items) and `data/markets.json` (14 countries). Both are imported by the front-end *and* the Worker — one source, no drift, no separate `produceData.js`.
- **Node:** installed user-space at `~/.local/opt/node-v22.17.0`, symlinked into `~/.local/bin` (`node`/`npm`/`npx`). This machine had no JS runtime before.

There's also an auto-loaded memory file at
`~/.claude/projects/-Users-ryannance-Design/memory/green-days.md` — this doc is the fuller version.

---

## Local dev

```sh
cd ~/Design/greendays
npm install          # if node_modules is missing
npm run dev          # build + `wrangler dev` on http://localhost:8787  (serves /greendays/…)
npm run build        # front-end only → dist/greendays
npm run deploy       # build + deploy to production
```

- **`.dev.vars`** (gitignored) holds local secrets. Currently: `MOCK_RECIPES=1` (canned recipe, no Anthropic key/cost), `METRICS_TOKEN=devtoken123`, `CF_ACCOUNT_ID=…`, and a **fake** `AE_API_TOKEN` (so the metrics page renders with graceful "query error" cards locally rather than hitting real Analytics Engine).
- The in-app preview browser tool serves the same `wrangler dev` on :8787. Config changes (`wrangler.jsonc`, `.dev.vars`) may need a dev-server restart to take effect.

---

## Repo map

```
data/produce.json      149-item catalogue (id, name_en, name_local×9, category, tab,
                       season, illustration, illustration_status, selection…) — SOURCE OF TRUTH
data/markets.json      14 ISO countries → { country, lang, band }
src/main.jsx           React entry
src/GreenDaysApp.jsx   the whole app (Home, Basket, Recipe, Recipes list, Detail,
                       Onboarding, Preferences, shell/tab bar)
src/produce.js         data layer: seasonality (band-aware), langOf/bandOf/COUNTRIES
                       from markets.json, decorate(p, band), search matcher
src/analytics.js       client beacon: ev()/evOnce()/SID → POST /greendays/api/event
src/app.css            phone-shell CSS (incl. --app-height iOS viewport fix)
src/gd/…               design-system tokens + components.css (Astryx "gd-*" classes)
public/assets/produce/ produce prints ({slug}@2x/@3x/-off@2x) — 141 png
public/assets/seasons/ 8 recipe-banner composites ({band}-{season}@2x/@3x)
public/gd/assets/…     wordmark_green.svg
public/favicon.svg, public/apple-touch-icon.png, public/assets/og.png
worker/index.js        Worker: /api/context, /api/recipe, /api/event, /metrics, asset fallback
worker/prompt.js       recipe system prompt (from Recipe_Principles.md) + JSON schema + user msg
worker/metrics.js      the private metrics dashboard
wrangler.jsonc         name, route, assets binding, bindings, vars
index.html             head: OG tags, favicon, Cloudflare Web Analytics beacon
```

Original handoff docs (design specs, decisions, KPIs) live at
`~/Claude/Projects/Business ideas/Green Days/`.

---

## Cloudflare config (`wrangler.jsonc`)

- **Worker name:** `greendays`; **route:** `lab.ryantnance.com/greendays*` (zone `ryantnance.com`). Worker-route precedence leaves the rest of Lab untouched.
- **Assets:** `directory: ./dist`, `binding: ASSETS`, `not_found_handling: single-page-application`. `run_worker_first: ["/greendays/api/*", "/greendays/metrics"]` — only those hit the Worker first; everything else is served straight from static assets.
- **Bindings:** `GD_EVENTS` (Analytics Engine dataset **`Green_Days_Early_Days`**), `RECIPE_RL` (per-IP rate limit, 8/min), var `RECIPE_MODEL="claude-sonnet-5"`.
- **Secrets** (set via `wrangler secret put …`, never in code):
  - `ANTHROPIC_API_KEY` — recipe engine
  - `AE_API_TOKEN` — account-scoped API token, Account Analytics · Read (for the metrics SQL API)
  - `CF_ACCOUNT_ID` — `ca865799b50c1c223eb6c0408df5bebe`
  - `METRICS_TOKEN` — gate for the metrics page

---

## Data model & rules

- **Names:** display `name_local[lang]` (bold) over `name_en` (muted). `lang` comes from `markets.json`; **`en` (UK/IE) or a missing key → single-line `name_en`**. Languages present: pt, es, fr, de, it, nl, da, el, sv.
- **Climate band** (`markets.json`): `mediterranean` = PT, ES, IT, GR (**France is temperate**); temperate otherwise. Drives the recipe banner and vivid/faded.
- **Seasonality** is computed per active market's band, at render, via `decorate(p, band)` — NOT precomputed statically. A season tagged `(Med)` reads *out/faded* in temperate markets. Same logic mirrored in the Worker for the recipe engine.
- **Prints:** 129 items `mapped` to a print, 20 `fallback` (name + sprout glyph, no broken image). `grapes` and `grapes-black` are distinct ids sharing the `grapes`/black print (an earlier duplicate-id bug fix — keep them distinct).

---

## Features shipped

- **Multi-market** (Fix 7): 14-country picker, per-market language + band + seasonality.
- **First-run onboarding** (3 screens: welcome → market → diet/allergies), gated by the `gd_onboarded` localStorage flag; hides the tab bar until "Get started". Existing users see it once more, pre-filled from saved prefs. `PrefsScreen` no longer auto-opens on first run (it's the editable-later version reached from Home's settings icon; includes a "Where you shop" location picker).
- **Home:** seasonal grid, All/Fruit/Veg/Herb tabs, cross-language search with an active-filter clear pill, tap card → product detail.
- **Basket:** tappable rows → detail (chevron affordance), check/remove/Add as separate targets, "Cook this". Empty state uses the muted **leaf glyph** (no emoji anywhere).
- **Recipe:** live-generated from the basket via the API; stars / ingredients / off-season advice / grab-one-more (links to that produce's detail, or Home search fallback) / make-it-a-meal / method; "Try another".
- **Prints:** 25 base + 5 recolour variants + 10 phase-2 archetypes + 7 phase-3 demand-driven prints (prioritised from the metrics' top-fallback list).
- **Branding:** OG image (`assets/og.png`), sprout favicon + apple-touch-icon.

---

## Analytics & metrics

Two layers, both privacy-first (cookieless, no consent banner, no PII, no query text):

1. **Cloudflare Web Analytics** — traffic + web vitals. Beacon token wired into `index.html` (`data-cf-beacon`). Dashboard: Cloudflare → Analytics → Web Analytics.
2. **Workers Analytics Engine** — product events, dataset **`Green_Days_Early_Days`**.
   - Client: `src/analytics.js` `ev()`/`evOnce()`, `SID` = per-page-load `crypto.randomUUID` (in memory only). Fires the catalog (app_open, onboarding_step, market_selected, prefs_set, search [outcome only], tab_view, product_view, produce_added, offseason_added, fallback_shown, basket_cook, recipe_try_another, grab_one_more_tap, error).
   - Server: `worker/index.js` `track()` + `POST /greendays/api/event` (allowlisted, adds country/band from `request.cf.country`) + `recipe_generated` (latency/ok/tokens) from the recipe endpoint.

### Metrics dashboard — `/greendays/metrics`

Private, gated by `METRICS_TOKEN` (via `?key=` or HTTP Basic; 401 otherwise). Renders the 8 KPIs from `KPIs_and_Dashboard.md` (activation, onboarding drop-off, recipes/session, try-another, search no-results, top fallback produce, market distribution, engine health). `?days=N` sets the window; `?format=json` returns raw numbers.

- **Access:** https://lab.ryantnance.com/greendays/metrics?key=pBnvjiJlcQ04jgOyVHxhX0GDpgAUri1Y
  (this is the current `METRICS_TOKEN` — rotate with `wrangler secret put METRICS_TOKEN`; **keep this file off any public remote**).
- Uses dataset name `Green_Days_Early_Days` and `quantileWeighted` (the AE-supported percentile fn).

---

## Deploy checklist / gotchas

- Deploy = `npm run deploy`. It now runs `npm run predeploy` first (boots a local `wrangler dev`, runs the 40-basket eval gate via `eval/grade.py --no-judge`, aborts the deploy on any hard-gate failure) and then `wrangler deploy`. See `eval/HANDOFF.md` for the eval harness, the two gate modes (fast mock vs. full judge baseline), and open prompt-quality issues found in the 2026-07-12 judge baseline (vegan/nut-allergy leaks, a banned word) that still need fixing in `worker/prompt.js`.
- After deploy, browsers cache the built JS/CSS by content hash; hard-refresh if verifying UI. Favicon/OG are cached hard by clients and platforms.
- Adding a **new binding** (e.g. Analytics Engine) requires that feature enabled on the account first, else `wrangler deploy` errors before uploading (safe — nothing partial).
- Data changes: replace `data/produce.json` from the source-of-truth copy in the handoff folder; **re-verify no duplicate ids and every `mapped` slug has all three image files** before deploying (there was a duplicate-`grapes` bug once).
- iOS Safari `100dvh` bug is handled via a JS-synced `--app-height` custom property (`src/app.css` + effect in the shell) — don't revert to raw `100dvh` on the phone container.

---

## Backlog / ideas (not started)

- **Recipe model cost A/B:** currently Sonnet 5 (`RECIPE_MODEL` var). Haiku 4.5 is the intended cost fallback — A/B the voice before switching.
- **Phase-4 prints:** ~20 items still on the fallback card; prioritise from the metrics' top-fallback list (that's the loop the dashboard was built for).
- **Weather line** is a static placeholder — wire a real provider later.
- **Ink colour-correction** on prints (Midjourney approximations) — deferred.
- Optional: add a GitHub remote for off-machine backup (currently local-only).
- Preferences allergy chips already include all six (Nuts, Dairy, Gluten, Eggs, Shellfish, Soy).
