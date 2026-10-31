import { IonIcon } from '@ionic/react';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';
import { useState, type FormEvent } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { Logo } from '../components/brand/Logo';
import Button from '../components/common/Button';
import { TextField } from '../components/common/Field';
import { useToast } from '../components/common/ToastProvider';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import './Login.css';
import { t } from '../i18n';
import LanguageSelect from '../components/common/LanguageSelect';
import PasswordStrength from '../components/auth/PasswordStrength';
import { evaluatePassword } from '../utils/passwordStrength';

/**
 * Sets a new password after following the emailed reset link
 * (/reset-password?token=…&email=…, sent by the server's "forgot password").
 */
export function ResetPassword() {
  const history = useHistory();
  const { search } = useLocation();
  const { showToast } = useToast();
  const { resetPassword } = useAuth();
  const params = new URLSearchParams(search);
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!evaluatePassword(password, { length: '', upper: '', lower: '', number: '', symbol: '' }).ok) {
      setError(t('Use a stronger password: add the items still unchecked below.'));
      return;
    }
    if (password !== confirm) {
      setError(t('Both passwords must match.'));
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, email, password);
      showToast(t('Your password has been updated.'));
      history.replace('/dashboard');
    } catch (err) {
      setError(toUserMessage(err, t('Could not update your password.')));
    } finally {
      setSubmitting(false);
    }
  };

  // The link must carry both parts; the server checks that they are valid and not expired.
  const linkInvalid = !token || !email;

  return (
    <div className="bl-login">
      <aside className="bl-login__aside" aria-hidden="true">
        <div className="bl-login__aside-inner">
          <Logo size="lg" inverse />
          <div className="bl-login__pitch">
            <h2>{t('Choose a new password.')}</h2>
            <p>{t('Pick something you have not used elsewhere, at least eight characters long.')}</p>
          </div>
        </div>
      </aside>

      <main className="bl-login__main">
        <div className="bl-login__card">
          <div className="bl-login__top">
            <div className="bl-login__brand">
              <Logo size="md" />
            </div>
            <LanguageSelect />
          </div>

          <div className="bl-login__intro">
            <h1 className="bl-page-title">{t('Set a new password')}</h1>
            <p className="bl-support">
              {email ? t('For {{email}}. You will be signed in once it is saved.', { email }) : t('You will be signed in once it is saved.')}
            </p>
          </div>

          <form className="bl-login__form" onSubmit={handleSubmit} noValidate>
            {linkInvalid && (
              <p className="bl-login__formerror" role="alert">
                {t('This reset link is invalid or has expired. Request a new one from the sign-in page.')}
              </p>
            )}

            {error && (
              <p className="bl-login__formerror" role="alert">
                {error}
              </p>
            )}

            <div className="bl-login__password">
              <TextField
                label={t('New password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('Create a strong password')}
                value={password}
                required
                disabled={linkInvalid}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="bl-login__reveal"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? t('Hide password') : t('Show password')}
              >
                <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} aria-hidden="true" />
              </button>
            </div>

            <PasswordStrength password={password} />

            <TextField
              label={t('Confirm new password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('Repeat your password')}
              value={confirm}
              required
              disabled={linkInvalid}
              onChange={(e) => setConfirm(e.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={submitting}
              disabled={linkInvalid}
            >
              {submitting ? t('Saving') : t('Save new password')}
            </Button>

            <p className="bl-login__back">
              <Link to="/login" className="bl-login__textlink">
                {t('Back to sign in')}
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default ResetPassword;
