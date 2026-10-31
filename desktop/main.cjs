/**
 * BantayLedger AI for Windows (Electron).
 *
 * Wraps the same web app the website and the Android app use. The built app
 * (the `dist` folder, copied to ./app by copy-app.cjs) is served from a
 * private `app://bantayledger/` address instead of file://, so the app's
 * normal URLs (/dashboard, /sales…) work and offline storage (IndexedDB) is
 * kept between launches. Data comes from the online server set in
 * VITE_API_URL when the web app was built.
 */
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_DIR = path.join(__dirname, 'app');
const START_URL = 'app://bantayledger/';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// One window only: opening the app again brings the existing one forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

/** Serves files from ./app; any app route (no file) gets index.html. */
function serveApp(request) {
  const { pathname } = new URL(request.url);
  let file = path.normalize(path.join(APP_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(APP_DIR)) return new Response('Not found', { status: 404 });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(APP_DIR, 'index.html');
  return net.fetch(pathToFileURL(file).toString());
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'BantayLedger AI',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#F6F8F7',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  // Links to other websites open in the normal browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://')) {
      event.preventDefault();
      if (/^https?:/i.test(url)) void shell.openExternal(url);
    }
  });

  // Smoke test for builds: `BL_SMOKE=1` loads the app, prints what opened, quits.
  if (process.env.BL_SMOKE) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const info = await win.webContents.executeJavaScript(
          'JSON.stringify({ path: location.pathname, title: document.title, desktop: typeof window.bantayledgerDesktop, login: !!document.querySelector("input[type=email]") })',
        );
        console.log('BL_SMOKE', info);
        // A packaged Windows app has no console: BL_SMOKE=<file path> writes the result there.
        if (process.env.BL_SMOKE !== '1') fs.writeFileSync(process.env.BL_SMOKE, info);
        app.quit();
      }, 4000);
    });
  }

  void win.loadURL(START_URL);
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', serveApp);
  const win = createWindow();

  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });
});

app.on('window-all-closed', () => app.quit());
