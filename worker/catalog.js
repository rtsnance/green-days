/* API catalog for automated discovery (RFC 9727).

   GET|HEAD /.well-known/api-catalog → a linkset (RFC 9264) naming each API
   GET      /openapi.json            → the OpenAPI 3.1 description (service-desc)
   GET      /docs/api                → the human docs page (service-doc)
   GET      /api/health              → a trivial liveness answer (status)
   and a Link header naming the first three on every page (withDiscoveryLinks).

   What is catalogued, and what is deliberately not:
     /api/context  yes. Free, read-only, cheap.
     /api/local    yes. Free, read-only, cached upstream for an hour.
     /api/recipe   NO. Every uncached call is a paid Anthropic request, the
                   rate limit is per IP only, and each call writes
                   recipe_generated, the money metric. Advertising it to
                   agents would spend money and pollute activation numbers at
                   the same time. It stays public and working; it is just not
                   announced. Adding it is one more entry in PATHS below.
     /api/event    NO. The analytics beacon. Agent posts would be noise.
     /metrics      NO. Private.

   Everything here is built at module load from data the worker already
   bundles, so there is no build step and nothing in public/ to keep in sync. */
import MARKETS from '../data/markets.json';
import PLACES from '../data/local-partners.json';

const ORIGIN = 'https://greendays.day';
const CATALOG_PATH = '/.well-known/api-catalog';
const LINKSET_TYPE = 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';

const MARKET_CODES = Object.keys(MARKETS).filter((k) => !k.startsWith('_')).sort();
const PLACE_KEYS = Object.keys(PLACES).filter((k) => !k.startsWith('_'));

const LINKSET = {
  linkset: [
    {
      anchor: `${ORIGIN}/api`,
      'service-desc': [{ href: `${ORIGIN}/openapi.json`, type: 'application/vnd.oai.openapi+json;version=3.1' }],
      'service-doc': [{ href: `${ORIGIN}/docs/api`, type: 'text/html' }],
      status: [{ href: `${ORIGIN}/api/health`, type: 'application/json' }],
    },
  ],
};

const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'Green Days API',
    version: '1.0.0',
    summary: 'What is in season at the market, and where a visitor is.',
    description:
      'The small read-only API behind greendays.day, a seasonal produce guide. ' +
      'No authentication. Responses are JSON. Please keep request rates modest.',
    contact: { url: ORIGIN },
  },
  servers: [{ url: ORIGIN }],
  paths: {
    '/api/context': {
      get: {
        operationId: 'getContext',
        summary: 'Market context for the caller',
        description:
          'Reads the caller\'s country from the Cloudflare edge and returns the ' +
          'climate band and season word Green Days uses for it. Defaults to PT ' +
          'when the edge country is unknown. Never cached.',
        responses: {
          200: {
            description: 'The caller\'s market context.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Context' } } },
          },
        },
      },
    },
    '/api/local': {
      get: {
        operationId: 'getLocalWeek',
        summary: 'A local grower\'s list this week, read against the calendar',
        description:
          'Fetches one partner grower\'s public weekly list and scores it against ' +
          'Green Days\' seasonality: how many of their items are tracked, and which ' +
          'ones the calendar had as out of season. If the grower\'s list is ' +
          'unreachable it still answers 200 with ok:false and the partner block.',
        parameters: [
          {
            name: 'place',
            in: 'query',
            required: true,
            description: 'Which place. Only places with a partner grower exist.',
            schema: { type: 'string', enum: PLACE_KEYS },
          },
        ],
        responses: {
          200: {
            description: 'The week, scored (ok:true), or the partner alone (ok:false).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LocalWeek' } } },
          },
          404: {
            description: 'Unknown place.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Liveness',
        responses: {
          200: {
            description: 'The worker is up.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Context: {
        type: 'object',
        required: ['country', 'band', 'season', 'month'],
        properties: {
          country: { type: 'string', description: 'ISO 3166-1 alpha-2 edge country.', examples: ['PT'] },
          local: { type: 'string', description: 'A place key with a partner grower, or empty.', examples: ['', 'ibiza'] },
          band: { type: 'string', enum: ['mediterranean', 'temperate'], description: 'Climate band. Unlisted countries read as temperate.' },
          season: { type: 'string', enum: ['spring', 'summer', 'autumn', 'winter'], description: 'Meteorological quarter, a label only.' },
          month: { type: 'integer', minimum: 1, maximum: 12 },
        },
      },
      LocalWeek: {
        type: 'object',
        required: ['ok', 'place', 'label', 'partner'],
        properties: {
          ok: { type: 'boolean' },
          place: { type: 'string' },
          label: { type: 'string' },
          partner: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              order_url: { type: 'string', format: 'uri' },
              method: { type: 'string', examples: ['collection'] },
              next_pickup: { type: 'string', description: 'YYYY-MM-DD, or empty.' },
              whatsapp: { type: 'string', description: 'Digits only, or empty.' },
            },
          },
          orders_open: { type: 'boolean' },
          have: { type: 'array', items: { type: 'string' }, description: 'Green Days produce ids on the grower\'s list.' },
          names: { type: 'object', additionalProperties: { type: 'string' }, description: 'Produce id to the grower\'s own product name.' },
          score: {
            type: 'object',
            properties: {
              listed: { type: 'integer' },
              tracked: { type: 'integer' },
              called: { type: 'integer' },
              missed: { type: 'array', items: { type: 'string' } },
            },
          },
          unmapped: { type: 'array', items: { type: 'string' } },
          fetched_at: { type: 'string', format: 'date-time' },
          error: { type: 'string' },
        },
      },
      Health: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', const: 'ok' }, time: { type: 'string', format: 'date-time' } },
      },
      Error: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, error: { type: 'string' } },
      },
    },
  },
  'x-markets': MARKET_CODES,
};

const DOCS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Green Days API</title>
<link rel="api-catalog" href="${CATALOG_PATH}">
<link rel="service-desc" href="/openapi.json">
<style>
  body { font: 17px/1.55 Georgia, serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; color: #1d2b1f; background: #f7f4ec; }
  code, pre { font: 14px/1.5 ui-monospace, Menlo, monospace; }
  pre { background: #ece7da; padding: .8rem 1rem; overflow-x: auto; }
  h1 { font-weight: normal; }
  a { color: #2f5d34; }
</style>
</head>
<body>
<h1>Green Days API</h1>
<p>The small read-only API behind <a href="/">greendays.day</a>. No key, JSON out, please keep the rate modest.</p>
<p>Machine-readable: the <a href="/openapi.json">OpenAPI description</a> and the <a href="${CATALOG_PATH}">API catalog</a> (RFC 9727).</p>

<h2><code>GET /api/context</code></h2>
<p>The caller's market, from the edge: country, climate band, season word, month. Defaults to Portugal when the country is unknown.</p>
<pre>{ "country": "PT", "local": "", "band": "mediterranean", "season": "autumn", "month": 9 }</pre>

<h2><code>GET /api/local?place=${PLACE_KEYS[0] || 'ibiza'}</code></h2>
<p>A partner grower's list this week, read against the Green Days calendar: which of their items we track, and which ones the calendar had as out of season. Places: ${PLACE_KEYS.map((k) => `<code>${k}</code>`).join(', ')}.</p>

<h2><code>GET /api/health</code></h2>
<p>Answers <code>{"status":"ok"}</code> when the worker is up.</p>
</body>
</html>
`;

const CORS = { 'access-control-allow-origin': '*' };
const LINK = `<${CATALOG_PATH}>; rel="api-catalog"`;

/* RFC 8288 Link headers on every page, for agent discovery (RFC 9727 s3).
   A page an agent lands on, the homepage first, points at the catalog, the
   OpenAPI description and the docs, so nothing has to guess /.well-known.
   Pages only (HTML, and the markdown rendering of the same page): an image
   or a stylesheet has no use for them. Relative targets resolve against the
   page, and every page is on greendays.day. */
const PAGE_LINKS = [
  LINK,
  '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '</docs/api>; rel="service-doc"; type="text/html"',
].join(', ');

export function withDiscoveryLinks(response) {
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !/text\/(html|markdown)/.test(type)) return response;
  const out = new Response(response.body, response);
  out.headers.append('link', PAGE_LINKS);
  return out;
}

// Returns a Response for the catalog routes, or null when the path is not one.
export function handleCatalog(request, url) {
  const p = url.pathname;
  const head = request.method === 'HEAD';

  if (p === CATALOG_PATH || p === `${CATALOG_PATH}/`) {
    if (request.method !== 'GET' && !head) return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
    return new Response(head ? null : JSON.stringify(LINKSET, null, 2), {
      status: 200,
      headers: { 'content-type': LINKSET_TYPE, link: LINK, 'cache-control': 'public, max-age=3600', ...CORS },
    });
  }
  if (p === '/openapi.json') {
    return new Response(head ? null : JSON.stringify(OPENAPI, null, 2), {
      status: 200,
      headers: { 'content-type': 'application/vnd.oai.openapi+json;version=3.1', link: LINK, 'cache-control': 'public, max-age=3600', ...CORS },
    });
  }
  if (p === '/docs/api' || p === '/docs/api/') {
    return new Response(head ? null : DOCS_HTML, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', link: LINK, 'cache-control': 'public, max-age=3600' },
    });
  }
  if (p === '/api/health') {
    return new Response(head ? null : JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
    });
  }
  return null;
}
