/* Security headers, applied to every response the Worker returns — the API
   routes, the metrics page, and the static assets from the ASSETS binding.

   Content-Security-Policy notes, since a wrong one silently breaks the app:
     script-src   'self' plus static.cloudflareinsights.com, because Real User
                  Monitoring is enabled zone-wide and Cloudflare's edge injects
                  the beacon <script> into HTML *after* this Worker runs (see
                  the comment in index.html). No 'unsafe-inline': the built app
                  loads one external module script and nothing else.
     style-src    'unsafe-inline' is required — the /metrics page is a single
                  server-rendered document with a <style> block and inline
                  width: rules on the bar charts.
     connect-src  'self' covers /api/*; cloudflareinsights.com receives the RUM
                  beacon's own POST.
     img-src      blob: and data: cover the canvas-generated field-note share
                  image and inline SVG data URIs.
   frame-ancestors 'none' is the modern half of X-Frame-Options: DENY; both are
   sent because some older browsers only honour the header. */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://cloudflareinsights.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

const HEADERS = {
  // One year, subdomains included. No `preload` — that is a one-way door onto
  // the browser preload list and should be a deliberate, separate decision.
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'content-security-policy': CSP,
};

/* Returns a copy of `response` carrying the security headers. Responses from
   the ASSETS binding have immutable headers, so this always rebuilds. Existing
   headers win: a route that deliberately sets its own (metrics sends
   x-robots-tag, the API sends cache-control) keeps what it chose. */
export function withSecurityHeaders(response) {
  const out = new Response(response.body, response);
  for (const [k, v] of Object.entries(HEADERS)) {
    if (!out.headers.has(k)) out.headers.set(k, v);
  }
  return out;
}
