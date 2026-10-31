import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

/**
 * "Continue with Google" — gets a Google ID token that the server checks
 * (POST /auth/google).
 *
 * - Website: a small Google popup that returns to /login on this site.
 * - Android app: the phone's own Google account picker (Credential Manager).
 * - Windows app: not offered — Google blocks sign-in inside embedded app
 *   windows; email sign-in works there, or use the website.
 *
 * Needs VITE_GOOGLE_CLIENT_ID (the Web client id from Google Cloud). Without
 * it the button is hidden, so nothing breaks before Google is set up.
 */
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';

export function googleSignInAvailable(): boolean {
  if (!CLIENT_ID) return false;
  return typeof (window as { bantayledgerDesktop?: unknown }).bantayledgerDesktop === 'undefined';
}

let ready: Promise<void> | null = null;

function initialize(): Promise<void> {
  ready ??= SocialLogin.initialize({
    google: {
      webClientId: CLIENT_ID,
      mode: 'online',
      // The website's popup always returns to /login (one redirect address to register with Google).
      ...(Capacitor.isNativePlatform() ? {} : { redirectUrl: `${window.location.origin}/login` }),
    },
  });
  return ready;
}

/** True when the person closed the Google window or picker without choosing an account. */
export function isGoogleCancel(err: unknown): boolean {
  const text = err instanceof Error ? `${err.message} ${(err as { code?: string }).code ?? ''}` : String(err);
  return /cancel|closed|dismiss|no credential|user_cancelled/i.test(text);
}

/** Opens Google sign-in and returns the ID token. */
export async function getGoogleIdToken(): Promise<string> {
  await initialize();
  const res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
  const idToken = (res.result as { idToken?: string | null }).idToken;
  if (!idToken) throw new Error('Google did not return a sign-in token.');
  return idToken;
}
