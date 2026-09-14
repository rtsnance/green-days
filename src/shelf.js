/* The "also in your kitchen" shelf: seeds, limits, and the produce guard.
   Plain ESM with no import.meta, so scripts/check-shelf-seeds.mjs can load it
   under node. The shelf modifies a cook; it never constitutes one. Produce is
   the only thing the basket takes, and nothing here may also be produce. */

export const SHELF_SEEDS = {
  none:       ['Chicken', 'Eggs', 'Fish'],
  vegetarian: ['Eggs', 'Cheese', 'Chickpeas'],
  vegan:      ['Chickpeas', 'Lentils', 'Tofu'],
};
export const MAX_WITH = 3;
export const MAX_WITH_LEN = 80;

// A saved allergy retires the seed that would break it. The model is told the
// same thing, but the shelf should not offer it in the first place.
const SEED_ALLERGEN = { Eggs: 'eggs', Cheese: 'dairy', Tofu: 'soy' };

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

// A spent seed leaves the rail, and so does one the shopper already typed in
// their own words ("chicken thighs" retires Chicken).
export function seedsFor(prefs, declared = []) {
  const allergies = new Set((prefs.allergies || []).map((a) => String(a).toLowerCase()));
  const words = declared.map((d) => ` ${fold(d)} `);
  return (SHELF_SEEDS[prefs.diet] || SHELF_SEEDS.none)
    .filter((s) => !(SEED_ALLERGEN[s] && allergies.has(SEED_ALLERGEN[s])))
    .filter((s) => { const f = fold(s).replace(/s$/, ''); return !words.some((w) => new RegExp(` ${f}s? `).test(w)); });
}

// Exact match against id, English name, and every local name, case and
// diacritic blind, plus the common plurals ("lemons", "limões" for limão).
// Deliberately not the substring fallback resolveSuggestion() uses for
// grab-one-more: "egg" would resolve to eggplant, and the shelf would refuse eggs.
export function matchProduce(term, produce) {
  const t = fold(term);
  if (!t) return null;
  const forms = new Set([t, t.replace(/es$/, ''), t.replace(/s$/, ''), t.replace(/(oe|ae)s$/, 'ao')]);
  return produce.find((p) =>
    forms.has(fold(p.id)) || forms.has(fold(p.name_en)) ||
    Object.values(p.name_local || {}).some((n) => forms.has(fold(n)))) || null;
}
