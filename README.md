# Green Days

A farmers-market mobile web app. The season sets a vivid palette of in-season
produce, you tap your basket, and a recipe engine hands back one confident,
produce-first recipe. Europe-first, one-handed, glanceable.

Live at **greendays.day** — its own Cloudflare Worker (static assets + API),
bound to greendays.day as a Custom Domain. The old `lab.ryantnance.com/greendays*`
route is kept only so the Worker can 301-redirect existing links there to
greendays.day.

## Layout

- `data/produce.json` — the 149-item produce catalogue, the single source of
  truth (names in 7 languages, tab, season, illustration mapping, the
  "how to choose" selection line). Both the front-end and the Worker import it.
- `public/assets/produce/` — linocut prints, `{slug}@2x/@3x.png` and the faded
  `{slug}-off@2x.png`. Items without a print use the name-forward fallback card.
- `public/assets/seasons/` — the eight recipe banners, `{band}-{season}@2x/@3x`.
- `src/` — the React app (ported from the Claude Design prototype) and the
  `gd/` design system (tokens + components.css).
- `worker/` — the Worker: `GET /api/context` (edge country → language
  + climate band + static weather line) and `POST /api/recipe`
  (the Anthropic-powered recipe engine; system prompt in `worker/prompt.js`,
  built from Recipe_Principles.md with the three anchor recipes as examples).

## Develop

```sh
npm install
cp .dev.vars.example .dev.vars   # MOCK_RECIPES=1 → canned recipes, no key
npm run dev                       # builds + wrangler dev on :8787
open http://localhost:8787/
```

Set `ANTHROPIC_API_KEY` in `.dev.vars` (and remove `MOCK_RECIPES`) to exercise
the real engine locally.

## Deploy

```sh
npx wrangler login                          # once
npx wrangler secret put ANTHROPIC_API_KEY   # once
npm run deploy
```

The routes are declared in `wrangler.jsonc`: `greendays.day` as a Custom Domain
(Cloudflare provisions the DNS record + TLS cert automatically on deploy — the
zone had no DNS records before this migration), plus the retired
`lab.ryantnance.com/greendays*`, zone `ryantnance.com`, kept for the redirect.

**Analytics:** Cloudflare Web Analytics (cookieless, no consent banner, no
GA4), via zone-level Real User Monitoring — enabled 2026-07-19 in the
dashboard (Speed → Real user monitoring → Enable Globally) for the
`greendays.day` zone. No script tag or token in the code: Cloudflare's edge
auto-injects the beacon into every HTML response for the zone. (The old
`<script data-cf-beacon>` tag tied to the retired `lab.ryantnance.com` site
token was removed from `index.html` for this reason — keeping it would have
double-counted/mis-attributed traffic.)

## Recipe engine

`POST /api/recipe` with
`{ basket: [produce ids], country, month, prefs: { diet, allergies }, avoid: [titles] }`
returns strict JSON (`title, time, note, stars, ingredients, offSeasonAdvice,
grabOneMore, protein, method`). Model: `claude-sonnet-5` (the `RECIPE_MODEL`
var; `claude-haiku-4-5` is the cost fallback candidate — A/B the voice before
switching). Identical baskets are cached at the edge for 12h; the endpoint is
rate-limited per IP; "Try another" resends with previous titles in `avoid`.
