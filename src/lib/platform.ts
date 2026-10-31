import { Capacitor } from '@capacitor/core';

/**
 * True inside the installed apps — the Android app (Capacitor) or the
 * Windows app (Electron, which exposes `window.bantayledgerDesktop` from its
 * preload script). They open straight to sign-in; only the website shows the
 * public home page with the download buttons.
 */
export function isInstalledApp(): boolean {
  return Capacitor.isNativePlatform() || typeof (window as { bantayledgerDesktop?: unknown }).bantayledgerDesktop !== 'undefined';
}
