/* ---- GET /api/remind ----
   "Tell me when it's back", kept by the person's own calendar.

   The web version promised a notification and never had a sender: no service
   worker, no subscriber store, no monthly job. The 1 September promises passed
   with nothing sent. Until the iOS app exists (where the phone's own clock
   delivers local notifications), the honest web fulfilment is a calendar file:
   one all-day event on the 1st of the month the item's season opens, with a
   morning alert. The calendar does the reminding.

   Stores nothing. Takes a produce id, a 1-12 month and an optional language,
   validates all three, and returns text/calendar. The link back carries
   utm_source=calendar, so a return from a reminder shows up in the source card.

   Query: id (required, a produce.json id), month (required, 1-12),
          lang (optional, a name_local key, e.g. pt). */

const LANG = /^[a-z]{2}$/;

// RFC 5545 text escaping, then fold at 73 octets-ish (chars are fine for the
// short lines we emit; names are the only variable part).
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line) {
  if (line.length <= 73) return line;
  const out = [];
  for (let i = 0; i < line.length; i += 73) out.push((i ? ' ' : '') + line.slice(i, i + 73));
  return out.join('\r\n');
}
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

export function handleRemind(request, byId) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const month = Number(url.searchParams.get('month'));
  const lang = (url.searchParams.get('lang') || '').toLowerCase();
  const p = byId.get(id);
  if (!p || !Number.isInteger(month) || month < 1 || month > 12) {
    return new Response('Not a reminder we can make.', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  // The next 1st-of-month for that month. A season opening in the current
  // month has already opened (the app only offers the button when the item is
  // out of season and the next window starts on a 1st), so it means next year.
  const now = new Date();
  const m0 = month - 1;
  const year = m0 > now.getUTCMonth() ? now.getUTCFullYear() : now.getUTCFullYear() + 1;
  const start = new Date(Date.UTC(year, m0, 1));
  const end = new Date(Date.UTC(year, m0, 2));

  const name = (LANG.test(lang) && p.name_local && p.name_local[lang]) || p.name_en;
  const link = `https://greendays.day/?utm_source=calendar`;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Green Days//Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}-${year}${pad(month)}@greendays.day`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(start)}`,
    `DTEND;VALUE=DATE:${ymd(end)}`,
    `SUMMARY:${esc(`${name} is back`)}`,
    `DESCRIPTION:${esc(`${name} should be back at the market this month. What's in season now: ${link}`)}`,
    `URL:${link}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`${name} is back`)}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(fold);

  return new Response(lines.join('\r\n') + '\r\n', {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="green-days-${id}.ics"`,
      'cache-control': 'no-store',
    },
  });
}
