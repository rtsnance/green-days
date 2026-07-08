# Green Days

A farmers-market mobile web app. The season sets a vivid palette of in-season
produce, you tap your basket, and a recipe engine hands back one confident,
produce-first recipe. Europe-first, one-handed, glanceable.

Live at **lab.ryantnance.com/greendays** — its own Cloudflare Worker (static
assets + API) on the `lab.ryantnance.com/greendays*` route, coexisting with the
Lab worker.

## Layout

- `data/produce.json` — the 149-item produce catalogue, the single source of
  truth (names in 7 languages, tab, season, illustration mapping, the
  "how to choose" selection line). Both the front-end and the Worker import it.
- `public/assets/produce/` — linocut prints, `{slug}@2x/@3x.png` and the faded
  `{slug}-off@2x.png`. Items without a print use the name-forward fallback card.
- `public/assets/seasons/` — the eight recipe banners, `{band}-{season}@2x/@3x`.
- `src/` — the React app (ported from the Claude Design prototype) and the
  `gd/` design system (tokens + components.css).
- `worker/` — the Worker: `GET /greendays/api/context` (edge country → language
  + climate band + static weather line) and `POST /greendays/api/recipe`
  (the Anthropic-powered recipe engine; system prompt in `worker/prompt.js`,
  built from Recipe_Principles.md with the three anchor recipes as examples).

## Develop

```sh
npm install
cp .dev.vars.example .dev.vars   # MOCK_RECIPES=1 → canned recipes, no key
npm run dev                       # builds + wrangler dev on :8787
open http://localhost:8787/greendays/
```

Set `ANTHROPIC_API_KEY` in `.dev.vars` (and remove `MOCK_RECIPES`) to exercise
the real engine locally.

## Deploy

```sh
npx wrangler login                          # once
npx wrangler secret put ANTHROPIC_API_KEY   # once
npm run deploy
```

The route (`lab.ryantnance.com/greendays*`, zone `ryantnance.com`) is declared
in `wrangler.jsonc`; Worker routes take precedence over the Lab worker for that
path only.

**Analytics:** Cloudflare Web Analytics (cookieless, no consent banner, no
GA4). Easiest: dashboard → Analytics & Logs → Web Analytics → add
`lab.ryantnance.com` with automatic setup. Manual alternative: paste the site
token into the commented beacon snippet in `index.html`.

## Recipe engine

`POST /greendays/api/recipe` with
`{ basket: [produce ids], country, month, prefs: { diet, allergies }, avoid: [titles] }`
returns strict JSON (`title, time, note, stars, ingredients, offSeasonAdvice,
grabOneMore, protein, method`). Model: `claude-sonnet-5` (the `RECIPE_MODEL`
var; `claude-haiku-4-5` is the cost fallback candidate — A/B the voice before
switching). Identical baskets are cached at the edge for 12h; the endpoint is
rate-limited per IP; "Try another" resends with previous titles in `avoid`.
