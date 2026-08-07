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
t('plain peak mid',   inPeak(plain,'08-16'),   true);
t('plain peak not-start', inPeak(plain,'08-02'), false);
t('plain peak not-end',   inPeak(plain,'09-14'), false);

const wrap = [{from:'11-01', to:'02-15'}];
t('wrap 12-20 in',  inRanges(wrap,'12-20'), true);
t('wrap 01-10 in',  inRanges(wrap,'01-10'), true);
t('wrap 06-01 out', inRanges(wrap,'06-01'), false);
t('wrap 10-31 out', inRanges(wrap,'10-31'), false);
t('wrap peak mid',  inPeak(wrap,'12-15'),   true);
t('wrap peak not-start', inPeak(wrap,'11-02'), false);

const two = [{from:'03-01',to:'04-15'},{from:'09-01',to:'10-15'}];
t('two 03-20 in',  inRanges(two,'03-20'), true);
t('two 09-20 in',  inRanges(two,'09-20'), true);
t('two 06-20 out', inRanges(two,'06-20'), false);

const year = [{from:'01-01', to:'12-31'}];
t('year 02-29ish in', inRanges(year,'02-28'), true);
t('year 12-31 in',    inRanges(year,'12-31'), true);

console.log(fail ? `\n${fail} FAILED` : '\nall pass');
process.exit(fail ? 1 : 0);
