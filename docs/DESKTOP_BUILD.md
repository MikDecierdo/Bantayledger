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

1. Raise the version in `desktop/package.json` (and `versionName` /
   `versionCode` in `android/app/build.gradle` for Android).
2. Build both files (Android: see `docs/ANDROID_BUILD.md`). Name them
   `BantayLedger.apk` and `BantayLedger-Setup.exe`.
3. Publish:

```
gh release create v1.0.1 BantayLedger.apk BantayLedger-Setup.exe --repo MikDecierdo/bantayledger-downloads --title "BantayLedger AI 1.0.1" --notes "What changed"
```

4. Update the version and size shown on the website in
   `src/data/downloads.ts`, then push.

## The website

The website is the static site **bantayledger-web** in `render.yaml` (free,
never sleeps). It builds the same app with `VITE_API_URL` pointing at the
online server: signed-out visitors at `/` see the home page with the
downloads; `/login` and everything else is the full web app.
