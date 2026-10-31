/**
 * The installable apps offered on the public home page.
 *
 * The files are published as a GitHub Release in the public repository
 * MikDecierdo/bantayledger-downloads (installers only — the source code repo
 * stays private). `releases/latest/download/<file>` always serves the newest
 * release, so publishing a new release updates the buttons with no code change;
 * only the version and size shown here need updating.
 */
const RELEASES = 'https://github.com/MikDecierdo/bantayledger-downloads/releases/latest/download';

export const DOWNLOADS = {
  android: {
    href: `${RELEASES}/BantayLedger.apk`,
    version: '1.0.0',
    size: '6.7 MB',
  },
  windows: {
    href: `${RELEASES}/BantayLedger-Setup.exe`,
    version: '1.0.0',
    size: '110 MB',
  },
} as const;
