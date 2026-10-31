/**
 * Tells the web app it is running as the installed Windows app, so it skips
 * the website's home page and opens on sign-in (see src/lib/platform.ts).
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('bantayledgerDesktop', { platform: 'windows' });
