/* Where on the map is the phone, in Green Days terms?

   Turns an approximate location into one of the 14 markets (or Ibiza, a
   place within Spain), entirely on the phone: the outlines ship in
   data/borders.json and nothing is sent anywhere. Returns null outside every
   market (Morocco, the open sea), and the caller then does nothing.

   Simplified coastlines can leave a coastal town a few hundred metres
   "offshore", so a point inside no outline goes to the nearest market within
   25 km. */
import BORDERS from '../data/borders.json';

// The Balearics, which Green Days calls Ibiza (the grower's regions include
// Mallorca and Menorca too, as in data/local-partners.json).
const BALEARICS = { south: 38.55, north: 40.15, west: 1.1, east: 4.45 };
const NEAR_KM = 25;

function inside([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Distance in km from a point to a ring's edges (equirectangular, fine at
// these distances).
function kmToRing([x, y], ring) {
  const k = Math.cos((y * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][0] - x) * k, ay = ring[j][1] - y, bx = (ring[i][0] - x) * k, by = ring[i][1] - y;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    const px = ax + t * dx, py = ay + t * dy;
    best = Math.min(best, Math.sqrt(px * px + py * py) * 111.32);
  }
  return best;
}

// { country: 'ES', place: 'ibiza' | null } or null.
export function marketAt(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const p = [lon, lat];
  const b = BALEARICS;
  const balearic = lat > b.south && lat < b.north && lon > b.west && lon < b.east;
  for (const [code, rings] of Object.entries(BORDERS.countries)) {
    if (rings.some((r) => inside(p, r))) return { country: code, place: code === 'ES' && balearic ? 'ibiza' : null };
  }
  let near = null, nearKm = NEAR_KM;
  for (const [code, rings] of Object.entries(BORDERS.countries)) {
    for (const r of rings) { const d = kmToRing(p, r); if (d < nearKm) { nearKm = d; near = code; } }
  }
  return near ? { country: near, place: near === 'ES' && balearic ? 'ibiza' : null } : null;
}
