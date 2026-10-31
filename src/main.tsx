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

/*
 * Every route is a lazy-loaded chunk (see App.tsx). If a chunk reference goes
 * stale — the dev server restarted, or a new build deployed — the resulting
 * dynamic-import failure fires this event instead of throwing. Reloading once
 * picks up the current chunk instead of leaving the user stuck on a dead page.
 */
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
