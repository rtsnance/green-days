/* Mounts the walk over the turning-day index on /market-year/.

   This is a separate file rather than an inline <script> because the Worker
   sends `script-src 'self'` with no 'unsafe-inline' (worker/headers.js). An
   inline module is silently blocked by CSP: the page still renders, because
   the index is real markup underneath, so the failure looks like "the walk
   just doesn't start" with nothing but a console entry to say why.

   Paths are absolute for the same reason the page canonicalises to
   /market-year/ with a trailing slash — relative ones break the moment the URL
   is requested without it. */
import { mount } from '/market-year/walk.js';

const params = new URLSearchParams(location.search);

if (params.has('index')) {
  // Promote the index to a normal scrolling page and never start the walk.
  document.documentElement.classList.add('gg-index-open');
} else {
  const day = params.get('day');
  const walk = mount(document.getElementById('gg-root'), {
    mode: params.get('mode') === 'dusk' ? 'dusk' : 'daylight',
    day: day ? Number(day) : null,
    platePath: '/market-year/plates/',
  });

  /* The index doubles as deep links into the walk: each row's href is that
     day's own page, so it works for a crawler and with no JS, and here it is
     intercepted to walk there instead. Modified clicks and the middle button
     fall through, so "open in new tab" still opens the page. */
  document.getElementById('gg-index').addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const a = e.target.closest('[data-day]');
    if (a) {
      e.preventDefault();
      walk.goToDay(Number(a.dataset.day));
    }
  });

  window.greengageLine = walk;
}
