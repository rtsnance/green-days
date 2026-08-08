/* node scripts/season.test.mjs — wrap and peak arithmetic. No deps, no runner. */
import { inRanges, peakRanges, doy, daysLeftIn } from '../src/season.js';
const within = (a,b,x) => (a<=b ? x>=a&&x<=b : x>=a||x<=b);
const inPeak = (r,t) => peakRanges(r).some(([a,b]) => within(a,b,doy(t)));
let fail = 0;
const t = (n,g,w) => { const ok = g===w; if(!ok) fail++; console.log((ok?'PASS ':'FAIL ')+n+'  got='+g+' want='+w); };

const plain = [{from:'08-01', to:'09-15'}];
t('plain 08-16 in',   inRanges(plain,'08-16'), true);
t('plain 07-31 out',  inRanges(plain,'07-31'), false);
t('plain 09-16 out',  inRanges(plain,'09-16'), false);
// Peak is DECLARED, not derived: a range with no peak_from/peak_to never peaks.
t('undeclared never peaks', inPeak(plain,'08-16'), false);
const declared = [{from:'08-01', to:'09-15', peak_from:'08-17', peak_to:'08-31'}];
t('declared peak inside',  inPeak(declared,'08-24'), true);
t('declared peak edge lo', inPeak(declared,'08-17'), true);
t('declared peak edge hi', inPeak(declared,'08-31'), true);
t('declared peak before',  inPeak(declared,'08-16'), false);
t('declared peak after',   inPeak(declared,'09-01'), false);
t('declared still in season outside peak', inRanges(declared,'09-10'), true);

const wrap = [{from:'11-01', to:'02-15'}];
t('wrap 12-20 in',  inRanges(wrap,'12-20'), true);
t('wrap 01-10 in',  inRanges(wrap,'01-10'), true);
t('wrap 06-01 out', inRanges(wrap,'06-01'), false);
t('wrap 10-31 out', inRanges(wrap,'10-31'), false);
t('wrap undeclared never peaks', inPeak(wrap,'12-15'), false);
const wrapDec = [{from:'11-01', to:'02-15', peak_from:'12-20', peak_to:'01-05'}];
t('wrap declared peak in-year',  inPeak(wrapDec,'12-28'), true);
t('wrap declared peak new-year', inPeak(wrapDec,'01-02'), true);
t('wrap declared peak outside',  inPeak(wrapDec,'11-20'), false);

const two = [{from:'03-01',to:'04-15'},{from:'09-01',to:'10-15'}];
t('two 03-20 in',  inRanges(two,'03-20'), true);
t('two 09-20 in',  inRanges(two,'09-20'), true);
t('two 06-20 out', inRanges(two,'06-20'), false);

const year = [{from:'01-01', to:'12-31'}];
t('year 02-29ish in', inRanges(year,'02-28'), true);
t('year 12-31 in',    inRanges(year,'12-31'), true);

/* ---- daysLeftIn: the home-list sort key ---- */
const banded = (ranges) => ({ season_ranges: { temperate: ranges } });
const dl = (ranges, mmdd) => daysLeftIn(banded(ranges), mmdd, 'temperate');

// 08-16 to 09-15 is 30 days, counting the closing day as 0.
t('days mid-window',   dl(plain,'08-16'), 30);
t('days last day',     dl(plain,'09-15'), 0);
t('days first day',    dl(plain,'08-01'), 45);
t('days before window', dl(plain,'07-31'), null);
t('days after window',  dl(plain,'09-16'), null);

// Wrapping window: 12-20 -> 02-15 is 11 days of December + 31 + 15.
t('days wrap in-year',  dl(wrap,'12-20'), 57);
t('days wrap new-year', dl(wrap,'01-10'), 36);
t('days wrap last day', dl(wrap,'02-15'), 0);
t('days wrap outside',  dl(wrap,'06-01'), null);

// Two windows: answer for the one it is in now, not the nearer edge overall.
t('days two first',  dl(two,'03-20'), 26);
t('days two second', dl(two,'09-20'), 25);
t('days two between', dl(two,'06-20'), null);

// No ranges at all, and an empty band (no local season) — both "no answer".
t('days unranged item', daysLeftIn({ season: 'Summer' }, '08-16', 'temperate'), null);
t('days other band',    daysLeftIn(banded(plain), '08-16', 'mediterranean'), null);
t('days empty band',    daysLeftIn({ season_ranges: { temperate: [] } }, '08-16', 'temperate'), null);

console.log(fail ? `\n${fail} FAILED` : '\nall pass');
process.exit(fail ? 1 : 0);
