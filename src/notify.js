/* Green Days: what the phone should tell you, and when.

   The app is a calendar, so it already knows its own future. This module turns
   that knowledge into a list of local notifications; src/localNotify.js hands
   the list to iOS, which delivers each one on its date with no server, no
   subscriber list and no identifier anywhere (decided 2026-09-28: local
   notifications first; remote push only later, for what the calendar could
   not have known).

   Two kinds for now:
     turning  the 24 turning days of the market year (data/turning-days.json),
              at 09:00 on the day, carrying what is arriving in, or leaving,
              the person's market around that date
     back     "Tell me when it's back": 09:00 on the 1st of the month the
              item's season opens, for each produce the person asked about
   Pairings wait for recipe history.

   Pure: no DOM, no Capacitor, so it can be tested anywhere. The plan is
   rebuilt from scratch every time and the scheduler replaces all pending
   notifications with it, so ids only need to be stable within one plan. */
import TURNING from '../data/turning-days.json';
import { PRODUCE, bandOf, langOf, countryLabel, seasonalityOf, byId, MONTH_NAMES } from './produce.js';

export const WATCH_KEY = 'gd_notify';          // produce ids asked about (same key the web flow used)
export const WATCH_LABEL_KEY = 'gd_notify_labels'; // id -> month name promised at tap time
export const MAX_PENDING = 60;                 // iOS keeps at most 64 pending per app
const HOUR = 9;

const pad = (n) => String(n).padStart(2, '0');
const mmdd = (d) => pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, HOUR);
const nameIn = (p, lang) => (lang && lang !== 'en' && p.name_local && p.name_local[lang]) || p.name;

// The next 09:00 on month-day mm-dd strictly after `now`.
export function nextAt(md, now) {
  const [m, d] = md.split('-').map(Number);
  let t = new Date(now.getFullYear(), m - 1, d, HOUR);
  if (t <= now) t = new Date(now.getFullYear() + 1, m - 1, d, HOUR);
  return t;
}

// One per family: "Tomato", "Cherry tomato", "Beefsteak tomato" read as
// clutter in a two-line notification, so keep the first of each. English names
// put the kind last ("Plum/San Marzano tomato"), so the family is the last word.
const family = (p) => p.name.toLowerCase().replace(/\(.*?\)/g, '').trim().split(/[\s\-/]+/).pop();
// Local names group the other way ("Calabacín", "Calabacín grande" are
// courgette and marrow in English), so a second key, the local name's first
// word, catches what the English one misses.
const localFamily = (p, lang) => String((lang && p.name_local && p.name_local[lang]) || '').toLowerCase().split(/[\s\-]+/)[0];
const distinct = (xs, lang) => {
  const seen = new Set();
  return xs.filter((p) => {
    const keys = ['en:' + family(p)], lf = localFamily(p, lang);
    if (lf) keys.push('local:' + lf);
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
};

const list = (names) => (names.length <= 3
  ? names.join(names.length === 2 ? ' and ' : ', ').replace(/, ([^,]*)$/, ' and $1')
  : names.slice(0, 3).join(', ') + ' and more');

// What a turning day on `date` says in `country`: what arrived since the
// previous turning day, what will be gone by the next, or failing both, what is
// at peak. Measuring between neighbouring turning days (not a fixed fortnight)
// keeps two close days, like All Hallows and Martinmas, from repeating.
export function turningBody(country, date, prevDate = addDays(date, -14), nextDate = addDays(date, 14)) {
  const band = bandOf(country), lang = langOf(country);
  const now = mmdd(date), before = mmdd(prevDate), after = mmdd(nextDate);
  const local = PRODUCE.filter((p) => p.availability !== 'imported');
  const s = (p, md) => seasonalityOf(p, md, band, country);
  const arriving = local.filter((p) => s(p, before) === 'out' && s(p, now) !== 'out');
  const leaving = local.filter((p) => s(p, now) !== 'out' && s(p, after) === 'out');
  const names = (xs) => list(distinct(xs, lang).map((p) => nameIn(p, lang)));
  const parts = [];
  if (arriving.length) parts.push('In now: ' + names(arriving) + '.');
  if (leaving.length) parts.push('Last weeks for ' + names(leaving) + '.');
  if (!parts.length) {
    const peak = local.filter((p) => s(p, now) === 'peak');
    parts.push(peak.length ? 'At their peak in ' + countryLabel(country) + ': ' + names(peak) + '.' : 'A turning day in the market year.');
  }
  return parts.join(' ');
}

export function turningPlan(country, now) {
  const dated = TURNING.days.map((day) => ({ day, at: nextAt(day.opens, now) })).sort((a, b) => a.at - b.at);
  return dated.map(({ day, at }, i) => {
    // Neighbours in time; the first and last borrow from a year either side.
    const prev = i > 0 ? dated[i - 1].at : new Date(dated[dated.length - 1].at.getFullYear() - 1, dated[dated.length - 1].at.getMonth(), dated[dated.length - 1].at.getDate(), HOUR);
    const next = i < dated.length - 1 ? dated[i + 1].at : new Date(dated[0].at.getFullYear() + 1, dated[0].at.getMonth(), dated[0].at.getDate(), HOUR);
    return {
      id: 1000 + day.num,
      kind: 'turning',
      at,
      title: `${day.numeral} · ${day.name}`,
      body: turningBody(country, at, prev, next),
      extra: { kind: 'turning', num: day.num },
    };
  });
}

// Watches saved on the device: [{ id, label }], label = month name promised.
export function readWatches() {
  try {
    const ids = JSON.parse(localStorage.getItem(WATCH_KEY) || '[]');
    const labels = JSON.parse(localStorage.getItem(WATCH_LABEL_KEY) || '{}');
    return ids.map((id) => ({ id, label: labels[id] || null }));
  } catch (_) { return []; }
}

export function addWatch(id, label) {
  try {
    const ids = JSON.parse(localStorage.getItem(WATCH_KEY) || '[]');
    if (ids.indexOf(id) === -1) { ids.push(id); localStorage.setItem(WATCH_KEY, JSON.stringify(ids)); }
    const labels = JSON.parse(localStorage.getItem(WATCH_LABEL_KEY) || '{}');
    if (label) { labels[id] = label; localStorage.setItem(WATCH_LABEL_KEY, JSON.stringify(labels)); }
  } catch (_) { /* private mode: nothing to schedule from */ }
}

// A watch is kept until its item is back in season, then dropped: the
// notification it asked for has fired (or the person is looking at the item
// in season already).
export function pruneWatches(country, now) {
  try {
    const band = bandOf(country), md = mmdd(now);
    const keep = readWatches().filter((w) => { const p = byId(w.id); return p && seasonalityOf(p, md, band, country) === 'out'; });
    localStorage.setItem(WATCH_KEY, JSON.stringify(keep.map((w) => w.id)));
  } catch (_) { /* leave as is */ }
}

export function backPlan(country, now, watches = readWatches()) {
  const lang = langOf(country);
  return watches.map((w) => {
    const p = byId(w.id);
    const m = w.label ? MONTH_NAMES.indexOf(w.label) : -1;
    if (!p || m < 0) return null;
    const at = nextAt(pad(m + 1) + '-01', now);
    const name = nameIn(p, lang);
    return {
      id: 2000 + PRODUCE.indexOf(p),
      kind: 'back',
      at,
      title: `${name} is back`,
      body: `You asked to know. ${p.name !== name ? p.name + ' is' : 'It is'} back in season in ${countryLabel(country)} this month.`,
      extra: { kind: 'back', produceId: p.id },
    };
  }).filter(Boolean);
}

// The whole plan, soonest first, inside iOS's pending limit.
// notify = { turning: bool, back: bool } from prefs (both default on).
export function planNotifications({ country, notify = {}, now = new Date() }) {
  const plan = [
    ...(notify.turning === false ? [] : turningPlan(country, now)),
    ...(notify.back === false ? [] : backPlan(country, now)),
  ];
  return plan.sort((a, b) => a.at - b.at).slice(0, MAX_PENDING);
}

// The next turning-day notification, for the onboarding preview.
export const nextTurning = (country, now = new Date()) => turningPlan(country, now).sort((a, b) => a.at - b.at)[0];
