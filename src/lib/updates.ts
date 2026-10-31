import { isInstalledApp } from './platform';

/**
 * "A new version is available" for the installed Android app.
 *
 * Versions are published as GitHub Releases in the public repo
 * MikDecierdo/bantayledger-downloads (tag `v1.0.2`). The app compares the
 * latest release with its own version (__APP_VERSION__, from package.json).
 * The Windows app updates itself instead (electron-updater in desktop/main.cjs),
 * and the website is always the newest version, so neither uses this check.
 */
const LATEST_API = 'https://api.github.com/repos/MikDecierdo/bantayledger-downloads/releases/latest';
const DOWNLOAD = 'https://github.com/MikDecierdo/bantayledger-downloads/releases/latest/download';
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const KEY_CHECKED = 'bl.update.checkedAt';
const KEY_LATEST = 'bl.update.latest';
const KEY_SNOOZE = 'bl.update.snooze';

export interface UpdateInfo {
  version: string;
  notes: string;
  downloadUrl: string;
}

export const APP_VERSION = __APP_VERSION__;

/** True on the Windows app, which updates itself. */
export function isDesktopApp(): boolean {
  return typeof (window as { bantayledgerDesktop?: unknown }).bantayledgerDesktop !== 'undefined';
}

/** -1, 0 or 1, comparing "1.0.10" with "1.0.9" correctly. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the check simply runs again next time.
  }
}

/** Release notes come as Markdown; keep them as short plain text. */
function plainNotes(body: string | null | undefined): string {
  return (body ?? '').replace(/[#*_`>]/g, '').replace(/\r/g, '').trim().slice(0, 600);
}

/**
 * The newer version, or null when up to date, offline or not applicable.
 * Asks GitHub at most every 6 hours unless `force` (Settings → Check for updates).
 */
export async function checkForUpdate(force = false): Promise<UpdateInfo | null> {
  if (!isInstalledApp() || isDesktopApp()) return null;

  const checkedAt = read<number>(KEY_CHECKED) ?? 0;
  let latest = read<UpdateInfo>(KEY_LATEST);

  if (force || Date.now() - checkedAt > CHECK_EVERY_MS || !latest) {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal });
      window.clearTimeout(timer);
      if (res.ok) {
        const release = (await res.json()) as { tag_name?: string; body?: string };
        const version = (release.tag_name ?? '').replace(/^v/i, '');
        if (/^\d+\.\d+\.\d+$/.test(version)) {
          latest = { version, notes: plainNotes(release.body), downloadUrl: `${DOWNLOAD}/BantayLedger.apk` };
          write(KEY_LATEST, latest);
          write(KEY_CHECKED, Date.now());
        }
      }
    } catch {
      // Offline or GitHub unreachable: use the last answer, if any.
    }
  }

  return latest && compareVersions(latest.version, APP_VERSION) > 0 ? latest : null;
}

/** "Later": don't ask about this version again for a day. */
export function snoozeUpdate(version: string) {
  write(KEY_SNOOZE, { version, until: Date.now() + SNOOZE_MS });
}

export function isSnoozed(version: string): boolean {
  const s = read<{ version: string; until: number }>(KEY_SNOOZE);
  return !!s && s.version === version && s.until > Date.now();
}
