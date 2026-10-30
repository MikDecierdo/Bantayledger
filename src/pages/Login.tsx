import { IonIcon } from '@ionic/react';
import {
  bulbOutline,
  cubeOutline,
  eyeOffOutline,
  eyeOutline,
  trendingUpOutline,
} from 'ionicons/icons';
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

interface Errors {
  email?: string;
  password?: string;
  /** Errors that belong to the whole form, e.g. wrong credentials. */
  form?: string;
}

const HIGHLIGHTS = [
  {
    icon: cubeOutline,
    title: t('Track stock in real time'),
    body: t('Know what is running low before it runs out.'),
  },
  {
    icon: trendingUpOutline,
    title: t('Know what to buy and what it costs'),
    body: t('See what you will need next week and what it will cost.'),
  },
  {
    icon: bulbOutline,
    title: t('Act on clear recommendations'),
    body: t('Plain-language guidance backed by your own records.'),
  },
];

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
      {/* Brand panel — desktop only, so phones get the form immediately. */}
      <aside className="bl-login__aside" aria-hidden="true">
        <div className="bl-login__aside-inner">
          <Logo size="lg" inverse />

          <div className="bl-login__pitch">
            <h2>{t('Run your store on numbers, not guesswork.')}</h2>
            <p>
              {t('BantayLedger AI keeps your inventory, sales and supplier costs in one place, then forecasts what comes next.')}
            </p>
          </div>

          <ul className="bl-login__highlights">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title}>
                <span className="bl-login__highlight-icon">
                  <IonIcon icon={item.icon} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="bl-login__aside-foot">{t('Built for Philippine small businesses.')}</p>
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
            ? t('Sample-data mode — sign-in is simulated and nothing leaves this device.') : t('Your data is stored securely and is only visible to your business.')}
        </p>
      </main>
    </div>
  );
}

export default Login;
