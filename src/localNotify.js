/* The iOS side of src/notify.js: hands the plan to the phone.

   Capacitor's LocalNotifications plugin, loaded by dynamic import only inside
   the app, so the website never fetches it. Every call is safe on the web
   (returns 'unsupported' / does nothing). */
import { IS_NATIVE } from './produce.js';

// Kept in a variable and never returned from an async function: a Capacitor
// plugin is a proxy that answers every property, so awaiting it probes .then
// and throws ("LocalNotifications.then() is not implemented"), caught in a
// browser test 2026-09-28. load() resolves to a boolean instead.
let plugin = null;
async function load() {
  if (!IS_NATIVE) return false;
  if (!plugin) {
    try { const m = await import('@capacitor/local-notifications'); plugin = m.LocalNotifications; }
    catch (_) { return false; }
  }
  return true;
}

// 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unsupported'
export async function permission() {
  if (!(await load())) return 'unsupported';
  const L = plugin;
  try { return (await L.checkPermissions()).display; } catch (_) { return 'unsupported'; }
}

// Shows iOS's one-time prompt if it has not been answered; otherwise returns
// the standing answer (iOS never asks twice; after a no, only Settings can
// change it).
export async function askPermission() {
  if (!(await load())) return 'unsupported';
  const L = plugin;
  try { return (await L.requestPermissions()).display; } catch (_) { return 'unsupported'; }
}

// Replace everything pending with `plan`. Green Days is the only thing that
// schedules local notifications in this app, so clearing all pending is safe.
export async function reschedule(plan) {
  if (!(await load())) return 0;
  const L = plugin;
  if ((await permission()) !== 'granted') return 0;
  try {
    const pending = (await L.getPending()).notifications || [];
    if (pending.length) await L.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
    if (!plan.length) return 0;
    await L.schedule({
      notifications: plan.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        schedule: { at: n.at, allowWhileIdle: true },
        extra: n.extra || {},
      })),
    });
    return plan.length;
  } catch (_) { return 0; }
}

// Operator-only check (settings, behind the five-tap switch): delivers `n`
// ten seconds from now without touching the real schedule.
export async function sendTest(n) {
  if (!(await load())) return false;
  const L = plugin;
  try {
    await L.schedule({ notifications: [{ id: 999, title: n.title, body: n.body, schedule: { at: new Date(Date.now() + 10000) }, extra: n.extra || {} }] });
    return true;
  } catch (_) { return false; }
}

// Tapping a notification opens the app; cb receives its `extra`.
export async function onNotificationTap(cb) {
  if (!(await load())) return;
  const L = plugin;
  try { await L.addListener('localNotificationActionPerformed', (e) => cb((e && e.notification && e.notification.extra) || {})); }
  catch (_) { /* no listener, no deep link */ }
}
