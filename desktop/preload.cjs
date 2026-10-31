/**
 * Bridge between the Windows app and the web app inside it:
 * - tells the web app it is the installed Windows app, so it skips the
 *   website's home page and opens on sign-in (see src/lib/platform.ts);
 * - passes on automatic updates (main.cjs): "update ready" events, and the
 *   "Restart to update" / "Check for updates" actions.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bantayledgerDesktop', {
  platform: 'windows',
  /** Calls back with { state: 'ready', version, notes } when an update has downloaded. */
  onUpdate: (callback) => {
    const listener = (_event, info) => callback(info);
    ipcRenderer.on('bl-update', listener);
    return () => ipcRenderer.removeListener('bl-update', listener);
  },
  /** Closes the app, installs the downloaded update and opens it again. */
  installUpdate: () => ipcRenderer.invoke('bl-install-update'),
  /** Looks for an update now; resolves with the newer version or null. */
  checkForUpdates: () => ipcRenderer.invoke('bl-check-update'),
});
