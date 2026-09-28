/* The iOS side of travel detection (level 1, decided 2026-09-28).

   Approximate location, only while the app is open, turned into a market on
   the phone by src/geo.js. Never in the background, never sent anywhere. Why
   it needs the phone at all: on EU roaming a phone's data usually exits
   through the home network, so the server's country is the home country
   exactly when someone travels.

   Capacitor's Geolocation plugin, loaded only inside the app. As in
   localNotify.js, the plugin proxy is kept in a variable and never returned
   from an async function (awaiting it probes .then and throws). */
import { IS_NATIVE } from './produce.js';
import { marketAt } from './geo.js';

let plugin = null;
async function load() {
  if (!IS_NATIVE) return false;
  if (!plugin) {
    try { const m = await import('@capacitor/geolocation'); plugin = m.Geolocation; }
    catch (_) { return false; }
  }
  return true;
}

// 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unsupported'
export async function locationPermission() {
  if (!(await load())) return 'unsupported';
  try { return (await plugin.checkPermissions()).location; } catch (_) { return 'unsupported'; }
}

export async function askLocation() {
  if (!(await load())) return 'unsupported';
  try { return (await plugin.requestPermissions({ permissions: ['location'] })).location; } catch (_) { return 'denied'; }
}

// The market the phone is in: { country, place } | null. Approximate is
// plenty for a country; a ten-minute-old fix is fine.
export async function whereAmI() {
  if (!(await load())) return null;
  try {
    const pos = await plugin.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
    return marketAt(pos.coords.latitude, pos.coords.longitude);
  } catch (_) { return null; }
}
