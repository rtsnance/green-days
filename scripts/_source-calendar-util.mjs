/* Shared helpers for the source-*-calendar.mjs scripts. Every sourced-market
   loader reads a per-item month-string table, turns it into wrap-safe ranges,
   measures how many half-month readings would change against the incumbent
   scope, and writes new entries onto season_ranges. That shape is here.

   Adding a new market means: paste the table, hand-write the MAP, choose a
   scope + band + writeEntries callback, and print the report. Everything the
   scripts USED to duplicate — END/mm/rangesOf, the TICKS grid, the
   measure-before/apply/measure-after loop, the range renderer — lives here. */
import { rangeSeasonalityOf } from '../src/season.js';

const END = ['31', '28', '31', '30', '31', '30', '31', '31', '30', '31', '30', '31'];
const mm = (m) => String(m + 1).padStart(2, '0');

// A 12-char string of markers (any non-'.' means in-season) → wrap-safe
// whole-month ranges. Empty markers → []. All markers → the year-round
// shortcut. Otherwise: start a new range at any month whose predecessor is
// off, walk forward while months stay on. Handles wrap around the new year.
export function rangesOf(months) {
  const on = [...months].map((c) => c !== '.');
  if (on.every(Boolean)) return [{ from: '01-01', to: '12-31' }];
  if (!on.some(Boolean)) return [];
  const out = [];
  for (let m = 0; m < 12; m++) {
    if (!on[m] || on[(m + 11) % 12]) continue;
    let e = m; while (on[(e + 1) % 12]) e = (e + 1) % 12;
    out.push({ from: `${mm(m)}-01`, to: `${mm(e)}-${END[e]}` });
  }
  return out;
}

// Half-monthly ticks: 24 anchor points per year (1st and 16th of each
// month). The grid every source script reads its "how many readings change"
// number against.
export const TICKS = (() => {
  const out = [];
  for (let m = 1; m <= 12; m++) for (const d of ['01', '16']) out.push(`${String(m).padStart(2, '0')}-${d}`);
  return out;
})();

// Read the seasonality at every tick, run `writeEntries` (which mutates
// `item.season_ranges`), read again, count how many of the 24 anchors
// switched. That is the honesty number the sourcing pass reports and the
// commit message quotes. The "before" collapses null (no ranges at all)
// into the string 'label' so an item that had no pre-image is still
// comparable to its "after" reading.
export function measureWrite(item, band, country, writeEntries) {
  const before = TICKS.map((t) => rangeSeasonalityOf(item, t, band, country) || 'label');
  if (!item.season_ranges) item.season_ranges = {};
  writeEntries(item.season_ranges);
  const after = TICKS.map((t) => rangeSeasonalityOf(item, t, band, country));
  return TICKS.filter((_, i) => before[i] !== after[i]).length;
}

// Compact renderer for a ranges list, or "(none)".
export const fmt = (r) => (r.length ? r.map((x) => `${x.from}..${x.to}`).join(',') : '(none)');
