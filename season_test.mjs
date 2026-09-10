const CUM = [0,31,59,90,120,151,181,212,243,273,304,334]; // non-leap, day-of-year offsets
const doy = (mmdd) => { const [m,d] = mmdd.split('-').map(Number); return CUM[m-1] + d; };
const YEAR = 365;

export function inRanges(ranges, mmdd) {
  const x = doy(mmdd);
  return ranges.some((r) => {
    const a = doy(r.from), b = doy(r.to);
    return a <= b ? x >= a && x <= b : x >= a || x <= b;
  });
}
// middle third, wrap-safe: work in "length from start" space
export function peakRanges(ranges) {
  return ranges.map((r) => {
    if (r.peak_from && r.peak_to) return { from: r.peak_from, to: r.peak_to };
    const a = doy(r.from), b = doy(r.to);
    const len = (b >= a ? b - a : b + YEAR - a) + 1;
    const s = a + Math.floor(len / 3), e = a + Math.ceil((2 * len) / 3) - 1;
    return { _from: ((s - 1) % YEAR) + 1, _to: ((e - 1) % YEAR) + 1 };
  });
}
const inPeak = (ranges, mmdd) => {
  const x = doy(mmdd);
  return peakRanges(ranges).some((p) => {
    const a = p._from ?? doy(p.from), b = p._to ?? doy(p.to);
    return a <= b ? x >= a && x <= b : x >= a || x <= b;
  });
};

// --- tests ---
const t = (name, got, want) => console.log((got === want ? 'PASS ' : 'FAIL ') + name + '  got=' + got + ' want=' + want);
const summer = [{from:'08-01', to:'09-15'}];
t('greengage 08-16 in',  inRanges(summer,'08-16'), true);
t('greengage 09-20 out', inRanges(summer,'09-20'), false);
t('greengage 07-31 out', inRanges(summer,'07-31'), false);
t('greengage peak 08-16', inPeak(summer,'08-16'), true);
t('greengage peak 08-02', inPeak(summer,'08-02'), false);
t('greengage peak 09-14', inPeak(summer,'09-14'), false);

const wrap = [{from:'11-01', to:'02-15'}];
t('wrap 12-20 in',  inRanges(wrap,'12-20'), true);
t('wrap 01-10 in',  inRanges(wrap,'01-10'), true);
t('wrap 06-01 out', inRanges(wrap,'06-01'), false);
t('wrap 10-31 out', inRanges(wrap,'10-31'), false);
t('wrap peak 12-15', inPeak(wrap,'12-15'), true);
t('wrap peak 11-02', inPeak(wrap,'11-02'), false);

const two = [{from:'03-01',to:'04-15'},{from:'09-01',to:'10-15'}];
t('two-window 03-20 in', inRanges(two,'03-20'), true);
t('two-window 09-20 in', inRanges(two,'09-20'), true);
t('two-window 06-20 out', inRanges(two,'06-20'), false);
