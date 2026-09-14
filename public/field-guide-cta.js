/* Carries the inbound traffic source across the field-guide CTA hop.

   The CTA from a /produce/ page into the app is same-origin, so on the other
   side document.referrer is null and SOURCE in src/analytics.js falls through
   to the CTA's own hardcoded utm_source. Every field-guide conversion then
   files as utm:field_guide whatever channel delivered the reader — Pinterest,
   search and a bookmark all collapse into one row, which is the row we most
   need to split now that the RSS feed carries ?utm_source=pinterest.

   This reads the inbound utm_source off the landing URL and rewrites the CTA
   to "<inbound>.field_guide". No storage, no network, no identifier: the same
   consent-free posture as the app's own beacon.

   This is a separate file rather than an inline <script> because the Worker
   sends `script-src 'self'` with no 'unsafe-inline' (worker/headers.js). The
   first version of this was inline, shipped to production on 14 Sep 2026, and
   was blocked by CSP on every page — the emitted HTML was correct, so building
   and reading it proved only that the script was THERE, never that it RAN.
   Same failure shape as public/market-year/boot.js. Verify in a browser. */
(function () {
  try {
    var inbound = new URLSearchParams(location.search).get('utm_source');
    if (!inbound) return;
    // Strip to a safe charset and length. Dropping '.' also means a value that
    // already carries one cannot chain a second hop onto itself.
    inbound = inbound.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
    if (!inbound) return;
    var cta = document.querySelector('a.fg-cta');
    if (!cta) return;
    var url = new URL(cta.getAttribute('href'), location.origin);
    url.searchParams.set('utm_source', inbound + '.field_guide');
    cta.setAttribute('href', url.pathname + url.search);
  } catch (e) { /* attribution must never break the page */ }
})();
