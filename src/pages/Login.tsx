import { IonIcon } from '@ionic/react';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';
import { useState, type FormEvent } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { Logo } from '../components/brand/Logo';
import Button from '../components/common/Button';
import { TextField } from '../components/common/Field';
import { useToast } from '../components/common/ToastProvider';
import './Login.css';
import { transitionClick } from '../lib/viewTransition';
import { t } from '../i18n';
import LanguageSelect from '../components/common/LanguageSelect';
import LoginShowcase from '../components/auth/LoginShowcase';

interface Errors {
  email?: string;
  password?: string;
  /** Errors that belong to the whole form, e.g. wrong credentials. */
  form?: string;
}

export function Login() {
  const history = useHistory();
  const location = useLocation<{ from?: { pathname: string } }>();
  const { showToast } = useToast();
  const { signIn, isDemoMode } = useAuth();

  // Prefilled only in sample-data mode, where any password is accepted.
  const [email, setEmail] = useState(isDemoMode ? 'owner@example.com' : '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const next: Errors = {};
    if (!email.trim()) next.email = t('Enter your email address.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t('Enter a valid email address.');
    if (!password) next.password = t('Enter your password.');
    else if (password.length < 6) next.password = t('Password must be at least 6 characters.');

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // Where the user was heading before being sent here to sign in.
    const destination = location.state?.from?.pathname ?? '/dashboard';

    setSubmitting(true);
    try {
      await signIn(email, password);
      showToast(t('Welcome back.'));
      history.replace(destination);
    } catch (error) {
      setErrors({ form: toUserMessage(error, t('Could not sign you in. Please try again.')) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bl-login">
      <main className="bl-login__main">
        <div className="bl-login__card">
          <div className="bl-login__top">
            <div className="bl-login__brand">
              <Logo size="md" />
            </div>
            <LanguageSelect />
          </div>

          <div className="bl-login__intro">
            <h1 className="bl-page-title">{t('Welcome back')}</h1>
            <p className="bl-support">{t('Sign in to continue managing your business.')}</p>
          </div>

          <form className="bl-login__form" onSubmit={handleSubmit} noValidate>
            {errors.form && (
              <p className="bl-login__formerror" role="alert">
                {errors.form}
              </p>
            )}

            <TextField
              label={t('Email address')}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t('you@yourbusiness.ph')}
              value={email}
              error={errors.email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />

            <div className="bl-login__password">
              <TextField
                label={t('Password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('Enter your password')}
                value={password}
                error={errors.password}
                required
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

            <div className="bl-login__row">
              <label className="bl-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                {t('Remember me')}
              </label>

              <Link to="/forgot-password" className="bl-login__textlink">
                {t('Forgot password?')}
              </Link>
            </div>

            <Button type="submit" variant="primary" size="lg" block loading={submitting}>
              {submitting ? t('Signing in') : t('Login')}
            </Button>

            <p className="bl-login__signup">
              {t('New to BantayLedger AI?')}{' '}
              <Link to="/register" className="bl-login__textlink" onClick={transitionClick(history, '/register')}>
                {t('Create account')}
              </Link>
            </p>
          </form>
        </div>

        <p className="bl-login__foot bl-caption">
          {isDemoMode
            ? t('Sample-data mode — sign-in is simulated and nothing leaves this device.') : t('Your data is protected by your sign-in and shared only with people in your business.')}
        </p>
        <p className="bl-login__legal bl-caption">
          <Link to="/privacy">{t('Privacy Policy')}</Link>
          <Link to="/terms">{t('Terms of Service')}</Link>
        </p>
      </main>

      {/* The animated tour, desktop only. Shown on the left, but after the form in
          the page, so the keyboard reaches the sign-in fields first. */}
      <aside className="bl-login__aside bl-login__aside--tour" aria-label={t('A quick tour of BantayLedger AI')}>
        <div className="bl-login__aside-inner">
          <Logo size="lg" inverse />

          <div className="bl-login__pitch">
            <h2>{t('Run your store on numbers, not guesswork.')}</h2>
          </div>

          <LoginShowcase />

          <p className="bl-login__aside-foot">{t('Built for Philippine small businesses.')}</p>
        </div>
      </aside>
    </div>
  );
}

export default Login;
