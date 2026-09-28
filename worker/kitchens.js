/* Recipe distance: Here · Nearby · Anywhere (data/kitchens.json).

   distanceBrief() turns a market and a distance into the prompt block the
   recipe engine reads, and the list it checks the answer against:
     here      the market's own kitchen plus what arrived and stayed
     nearby    its hand-drawn neighbours plus its vetted family
     anywhere  any kitchen outside those two sets
   Each recipe names its `kitchen`; kitchenFits() says whether that name is
   allowed for the distance asked, so the choice can be counted and graded.
   The legends list rides along on every request: popular food stories that
   historians reject, which the note must never state as fact. */
import KITCHENS from '../data/kitchens.json';

export const DISTANCES = new Set(['here', 'nearby', 'anywhere']);

// "Spanish (Galician above all)" -> "Spanish". The parenthesis is a hint for
// the model; the label before it is the name the recipe must use.
const label = (k) => String(k).replace(/\s*\(.*\)\s*$/, '').trim();
// "Spanish (Galician above all)" -> ["Galician"]; "Croatian (Istrian, Dalmatian)"
// -> ["Istrian", "Dalmatian"]. The more specific names a recipe may use instead.
const aliases = (k) => {
  const m = String(k).match(/\(([^)]*)\)/);
  return m ? m[1].replace(/above all/gi, '').split(/,|\band\b/).map((s) => s.trim()).filter(Boolean) : [];
};
const names = (list) => list.flatMap((x) => [label(x), ...aliases(x)]);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, ' ').trim();

function setsFor(country) {
  const m = KITCHENS.markets[country] || KITCHENS.markets.PT;
  const here = [m.here.kitchen, ...m.here.naturalised.map((n) => n.kitchen)];
  const nearby = [...m.neighbours, ...m.family.map((f) => f.kitchen)];
  return { m, here, nearby };
}

export function distanceBrief(country, distance) {
  const d = DISTANCES.has(distance) ? distance : 'here';
  const { m, here, nearby } = setsFor(country);
  const lines = [];
  if (d === 'here') {
    lines.push(`Distance: HERE. Cook it the way this market's own kitchen cooks it: ${label(m.here.kitchen)}.`);
    if (m.here.naturalised.length) {
      lines.push('What has arrived and stayed is part of that kitchen now, and is equally Here:');
      for (const n of m.here.naturalised) lines.push(`- ${label(n.kitchen)} (${n.dish}): ${n.proof}`);
    }
    lines.push(`Set kitchen to one of: ${here.map(label).join(', ')}, or the more specific name in parentheses.`);
  } else if (d === 'nearby') {
    lines.push("Distance: NEARBY. Cook it the way one of this market's neighbouring or family kitchens would cook this produce, not the market's own kitchen.");
    lines.push(`Neighbours: ${m.neighbours.join('; ')}.`);
    if (m.family.length) {
      lines.push('Family, joined by real history. If the note mentions the tie, use only the fact given here:');
      for (const f of m.family) lines.push(`- ${label(f.kitchen)}: ${f.proof}`);
    }
    lines.push(`Set kitchen to one of these names, or to the more specific name in its parentheses: ${nearby.map(label).join(', ')}.`);
  } else {
    lines.push("Distance: ANYWHERE. Cook it the way a kitchen far from this market would: any tradition in the world except this market's own and its neighbours and family.");
    lines.push(`Not these: ${[...here, ...nearby].map(label).join(', ')}.`);
    lines.push("Pick a kitchen that genuinely cooks this kind of produce in this kind of season, and cook it the way that kitchen does. Not fusion, not a garnish. Set kitchen to its plain name, for example 'Korean' or 'Georgian'.");
  }
  lines.push('This sets the kitchen for technique and flavour and replaces the default Mediterranean-European lean. The Green Days voice, structure, seasonality and every hard constraint are unchanged, and the basket still leads.');
  lines.push(`Never state these popular food legends as fact: ${KITCHENS.legends.join(' | ')}`);
  return { distance: d, lines };
}

// Does the kitchen the model named fit the distance asked for?
export function kitchenFits(country, distance, kitchen) {
  const k = norm(kitchen);
  if (!k) return false;
  const { here, nearby } = setsFor(country);
  const hit = (list) => names(list).some((x) => { const n = norm(x); return n && (k === n || k.startsWith(n + ' ') || n.startsWith(k + ' ')); });
  if (distance === 'here') return hit(here);
  if (distance === 'nearby') return hit(nearby);
  return !hit(here) && !hit(nearby);
}
