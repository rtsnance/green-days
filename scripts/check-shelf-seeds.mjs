// node scripts/check-shelf-seeds.mjs   (runs in the predeploy eval gate)
// The shelf seeds must stay disjoint from the produce catalogue. It grows, and a
// seed silently becoming a duplicate of a basket item is the bug nobody notices.
import PRODUCE from '../data/produce.json' with { type: 'json' };
import { SHELF_SEEDS, matchProduce } from '../src/shelf.js';

const seeds = [...new Set(Object.values(SHELF_SEEDS).flat())];
const clash = seeds
  .map((s) => [s, matchProduce(s, PRODUCE)])
  .filter(([, hit]) => hit)
  .map(([s, hit]) => `${s} (${hit.id})`);

if (clash.length) {
  console.error(`Shelf seeds already in produce.json: ${clash.join(', ')}`);
  process.exit(1);
}
console.log(`${seeds.length} shelf seeds, none catalogued.`);
