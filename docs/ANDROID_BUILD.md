# Building the BantayLedger Android app

The Android app is this same web app wrapped by Capacitor (`android/`,
app id `ph.bantayledger.app`). The app's screens are bundled inside the APK,
so it opens even with no internet; records made offline are saved on the
phone and sent automatically when the connection returns.

## Before you start

- **Android Studio** installed (it includes the Java it needs).
- The server is online and `.env.production` points at it
  (`VITE_API_URL=https://YOUR-SERVICE.onrender.com/api`) — see
  `docs/DEPLOY_RENDER.md`. Without it the app would look for the server on
  the phone itself and show "Unable to load".

## Build

In the project folder:

```
npm run build
npx cap sync android
npx cap open android
```

In Android Studio, wait for Gradle to finish, then
**Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
When it finishes, click **locate**: the file is
`android/app/build/outputs/apk/debug/app-debug.apk`.

## Install on a phone

- **By cable:** turn on *Developer options → USB debugging* on the phone, plug
  it in, and press **Run ▶** in Android Studio.
- **By file:** send `app-debug.apk` to the phone (Messenger, Google Drive,
  USB) and open it. Allow "Install unknown apps" when the phone asks.

## Every time the app changes

Run `npm run build` and `npx cap sync android` again, then build a new APK.

## How offline works

- Pages you have opened before show their last saved copy when there is no
  internet; a yellow bar says so.
- Sales, expenses, purchases and spoiled items can be recorded offline. They
  wait on the phone ("Waiting to sync") and are sent when the internet is
  back — each one exactly once.
- If the server refuses one (for example not enough stock), a red bar says
  "needs your attention"; tap it to see why, then Retry or Delete.
- Signing in, adding products, suppliers, team members and changing settings
  need the internet.
- You cannot sign out while records are still waiting, so they are never lost.

## Google Play (optional, later)

Publishing needs a Google Play developer account (one-time US$25) and a
signed release build (**Build → Generate Signed App Bundle**). The debug APK
above is fine for testing and for a school defense.
