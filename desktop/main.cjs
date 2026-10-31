/**
 * BantayLedger AI for Windows (Electron).
 *
 * Wraps the same web app the website and the Android app use. The built app
 * (the `dist` folder, copied to ./app by copy-app.cjs) is served from a
 * private `app://bantayledger/` address instead of file://, so the app's
 * normal URLs (/dashboard, /sales…) work and offline storage (IndexedDB) is
 * kept between launches. Data comes from the online server set in
 * VITE_API_URL when the web app was built.
 *
 * Updates: electron-updater checks the public GitHub releases
 * (MikDecierdo/bantayledger-downloads, see "publish" in package.json) on
 * launch and every few hours, downloads a newer installer in the background,
 * and the page then offers "Restart to update" (it also installs on quit).
 */
const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
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

/** Automatic updates; only in the installed app (not `npm start`). */
function setUpUpdates(win) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info) => {
    const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes.replace(/<[^>]+>/g, ' ').trim() : '';
    win.webContents.send('bl-update', { state: 'ready', version: info.version, notes });
  });
  autoUpdater.on('error', (err) => console.warn('Update check failed:', err && err.message));

  ipcMain.handle('bl-install-update', () => autoUpdater.quitAndInstall(false, true));
  ipcMain.handle('bl-check-update', async () => {
    if (!app.isPackaged) return null;
    try {
      const result = await autoUpdater.checkForUpdates();
      return result && result.isUpdateAvailable ? result.updateInfo.version : null;
    } catch {
      return null;
    }
  });

  if (!app.isPackaged || process.env.BL_SMOKE) return;
  const check = () => autoUpdater.checkForUpdates().catch(() => undefined);
  win.webContents.once('did-finish-load', () => setTimeout(check, 5000));
  setInterval(check, 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', serveApp);
  const win = createWindow();
  setUpUpdates(win);

  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });
});

app.on('window-all-closed', () => app.quit());
