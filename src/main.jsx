import React from 'react';
import { createRoot } from 'react-dom/client';
import './gd/styles.css';
import './app.css';
import GreenDaysApp from './GreenDaysApp.jsx';

// iOS app only: hide the web form bar (up / down / done) iOS puts above the
// keyboard in a web view. Native apps do not show it, and its "next field"
// arrow jumped from search into the hidden market <select> and opened it.
// The Keyboard plugin is registered by the native shell; on the web
// window.Capacitor is absent and this does nothing.
if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
  // Scopes the app-only CSS (safe-area top in app.css).
  document.documentElement.classList.add('gd-native');
  // Loaded only inside the app, as its own small chunk; the website never fetches it.
  import('@capacitor/keyboard')
    .then(({ Keyboard }) => Keyboard.setAccessoryBarVisible({ isVisible: false }))
    .catch(() => { /* never block the app on a cosmetic call */ });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GreenDaysApp />
  </React.StrictMode>
);
