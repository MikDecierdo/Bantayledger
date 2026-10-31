import { useState, type FormEvent } from 'react';
import Button from '../common/Button';
import { TextField } from '../common/Field';
import { useAuth } from '../../context/AuthContext';
import { getGoogleIdToken, googleSignInAvailable, isGoogleCancel } from '../../lib/googleSignIn';
import { toUserMessage } from '../../lib/errors';
import './GoogleButton.css';
import { t } from '../../i18n';

/** Google's multi-colour "G" (brand guidelines: the logo on a white button). */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * "Continue with Google", shown above the email form with an "or use your
 * email" divider below it. New Google users
 * name their store in a small step right here; then the normal privacy notice
 * and dashboard follow (the sign-in pages redirect once signed in).
 * Renders nothing where Google sign-in isn't available (see googleSignIn.ts).
 */
export function GoogleButton() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');

  if (!googleSignInAvailable()) return null;

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      const outcome = await signInWithGoogle(idToken);
      if (outcome === 'needsBusinessName') setPendingToken(idToken);
    } catch (err) {
      if (!isGoogleCancel(err)) setError(toUserMessage(err, t('Google sign-in did not work. Please try again.')));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    if (!businessName.trim()) {
      setError(t('Enter the name of your store.'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle(pendingToken, businessName);
    } catch (err) {
      // The Google token lasts about an hour; if it ran out, start again.
      setPendingToken(null);
      setError(toUserMessage(err, t('Google sign-in did not work. Please try again.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bl-google">
      {pendingToken ? (
        <form className="bl-google__step" onSubmit={finish} noValidate>
          <p className="bl-google__step-title">{t('Almost done. What is the name of your store?')}</p>
          <TextField
            label={t('Business name')}
            required
            autoFocus
            placeholder={t('e.g. Santos Sari-Sari Store')}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
          <Button type="submit" variant="primary" size="lg" block loading={busy}>
            {t('Continue')}
          </Button>
          <button type="button" className="bl-google__back" onClick={() => setPendingToken(null)} disabled={busy}>
            {t('Use a different account')}
          </button>
        </form>
      ) : (
        <button type="button" className="bl-google__btn" onClick={() => void start()} disabled={busy}>
          <GoogleLogo />
          <span>{busy ? t('Connecting to Google…') : t('Continue with Google')}</span>
        </button>
      )}

      {error && (
        <p className="bl-form-error" role="alert">
          {error}
        </p>
      )}

      {!pendingToken && (
        <div className="bl-google__or" aria-hidden="true">
          <span>{t('or use your email')}</span>
        </div>
      )}
    </div>
  );
}

export default GoogleButton;
