import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/*
 * Stylesheet order matters and is load-bearing.
 *
 * ES imports are evaluated in source order, and each module's CSS is injected
 * when it is evaluated. The design system must therefore be imported BEFORE
 * `./App`, so that component stylesheets (which legitimately override base
 * primitives, e.g. the hero stat card overriding `.bl-card`) land after it.
 */
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

import 'sweetalert2/dist/sweetalert2.min.css';

import './theme/tokens.css';
import './theme/base.css';
import './theme/components.css';
import './theme/mobile.css';
// Themes SweetAlert2 with the tokens above, so it must follow both it and the
// library's own stylesheet.
import './theme/swal.css';

import './i18n';
import App from './App';
import { preventZoom } from './lib/noZoom';
import { isInstalledApp } from './lib/platform';

/*
 * Every route is a lazy-loaded chunk (see App.tsx). If a chunk reference goes
 * stale — the dev server restarted, or a new build deployed — the resulting
 * dynamic-import failure fires this event instead of throwing. Reloading once
 * picks up the current chunk instead of leaving the user stuck on a dead page.
 */
// Fixed size like a native app — no pinch or double-tap zoom on phones.
preventZoom();

window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

/*
 * Website only: the offline helper (public/sw.js) lets the website and the
 * iPhone home-screen app open without internet after one visit. The Android
 * and Windows apps already carry their files, so they skip it.
 */
if (import.meta.env.PROD && !isInstalledApp() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?build=${__BUILD_ID__}`).catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
