# Windows app and the downloads page

The Windows app (`desktop/`) is the same web app wrapped in Electron. It
opens on sign-in (no website home page), talks to the online server, and
works offline like the phone app.

## Build the installer

From the project folder:

```
npm run build
cd desktop
npm install
npm run dist
```

`npm run build` reads `.env.production`, so the app uses the online server.
The installer appears at `desktop\release\BantayLedger-Setup.exe` (about
110 MB). `npm start` in `desktop/` opens the app without installing, for a
quick check.

The installer is not signed with a paid code-signing certificate, so Windows
SmartScreen shows "Windows protected your PC" the first time — users choose
**More info → Run anyway**.

## Publish a new version (website download buttons)

Installers are too large for the private source repo, so they are published
as a GitHub Release in the public repository
**MikDecierdo/bantayledger-downloads** (installers only, no source code).
The website buttons link to `releases/latest/download/…`, so the newest
release is always what people download.

1. Set the new version everywhere at once (website, Android, Windows):

```
npm run version:set -- 1.0.3
```

2. Build both apps (Android: see `docs/ANDROID_BUILD.md`). Name them
   `BantayLedger.apk` and `BantayLedger-Setup.exe`. The Windows build also
   makes `desktopelease\latest.yml` and
   `BantayLedger-Setup.exe.blockmap` — **upload both too**, the Windows app
   reads them to update itself.
3. Publish (the tag must be `v` + the version):

```
gh release create v1.0.3 BantayLedger.apk BantayLedger-Setup.exe latest.yml BantayLedger-Setup.exe.blockmap --repo MikDecierdo/bantayledger-downloads --title "BantayLedger AI 1.0.3" --notes "What changed"
```

4. Update the sizes shown on the website in `src/data/downloads.ts`
   (the version is already set), then push.

## How the apps learn about a new version

- **Windows** checks the latest release when it starts and every 6 hours,
  downloads the new installer in the background, then shows
  *Update ready → Restart to update*. If the user waits, it installs when the
  app is closed.
- **Android** checks the latest release (at most every 6 hours, and from
  Settings → About → Check for updates) and shows *New version available*.
  **Update now** downloads the new APK in the phone's browser; installing it
  over the old app keeps everything.
- **Website and iPhone home-screen app** are always the newest version after
  Render deploys the push.

Apps older than 1.0.2 have no update check, so they must be updated by hand
once.

## The website

The website is the static site **bantayledger-web** in `render.yaml` (free,
never sleeps). It builds the same app with `VITE_API_URL` pointing at the
online server: signed-out visitors at `/` see the home page with the
downloads; `/login` and everything else is the full web app.
