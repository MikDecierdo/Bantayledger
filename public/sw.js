/*
 * BantayLedger website offline helper (registered in src/main.tsx, website
 * only — the Android and Windows apps carry their files inside the app).
 *
 * Lets the website and the iPhone home-screen app open without internet
 * after one visit:
 * - pages: try the network first (always the newest version), and fall back
 *   to the saved app page when offline;
 * - /assets/* (file names change with every build): all scripts and styles
 *   listed in /precache.json are saved on install, others on first use, and
 *   files from older builds are removed;
 * - icons and images: shown from the saved copy, refreshed in the background.
 * Requests to the API server are never touched — the app's own offline layer
 * (src/services/offline) keeps saved data and records waiting to sync.
 */
const CACHE = 'bantayledger-app-v1';
const SHELL = '/index.html';
const CORE = ['/', '/manifest.webmanifest', '/brand-logo.png', '/apple-touch-icon.png'];

/** The current build's files (written by vite.config.ts), or [] if unavailable. */
function buildFiles() {
  return fetch('/precache.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { files: [] }))
    .then((list) => (Array.isArray(list.files) ? list.files : []))
    .catch(() => []);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(CORE).then(() =>
          // Missing build files are skipped one by one instead of failing the install.
          buildFiles().then((files) => Promise.all(files.map((f) => cache.add(f).catch(() => undefined)))),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => Promise.all([caches.open(CACHE), buildFiles()]))
      .then(([cache, files]) => {
        // Drop scripts and styles from older builds (only when the list loaded).
        if (!files.length) return undefined;
        const keep = new Set(files);
        return cache.keys().then((requests) =>
          Promise.all(
            requests
              .filter((r) => {
                const path = new URL(r.url).pathname;
                return /^\/assets\/.*\.(js|css)$/.test(path) && !keep.has(path);
              })
              .map((r) => cache.delete(r)),
          ),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App pages (/login, /dashboard…): network first, saved app page offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(SHELL, copy));
          }
          return response;
        })
        .catch(() => caches.match(SHELL).then((saved) => saved || caches.match('/'))),
    );
    return;
  }

  // Built files never change under the same name: saved copy first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (saved) =>
          saved ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Icons, images, the manifest: saved copy now, refreshed in the background.
  if (/\.(png|jpe?g|svg|webp|webmanifest|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((saved) => {
          const fresh = fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
            .catch(() => saved);
          return saved || fresh;
        }),
      ),
    );
  }
});
