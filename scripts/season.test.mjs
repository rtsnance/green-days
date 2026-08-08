/* node scripts/season.test.mjs — wrap and peak arithmetic. No deps, no runner. */
import { inRanges, peakRanges, doy } from '../src/season.js';
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

console.log(fail ? `\n${fail} FAILED` : '\nall pass');
process.exit(fail ? 1 : 0);
