import { IonIcon } from '@ionic/react';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';
import { useState, type FormEvent } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { transitionClick } from '../lib/viewTransition';
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
import { formatPhLocal, isValidPhMobile, normalizePhLocal, toPhE164 } from '../utils/phone';

/**
 * Account creation.
 *
 * Reuses the login screen's layout and styles exactly — same card, same
 * fields, same brand panel — so nothing about the approved visual system
 * changes. Signing up also creates the user's business and makes them its
 * OWNER, since a user without a business would have nothing to look at.
 */

interface Errors {
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  form?: string;
}

export function Register() {
  const history = useHistory();
  const { showToast } = useToast();
  const { signUp, isDemoMode } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); // the 10 digits after +63
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const next: Errors = {};
    if (!firstName.trim()) next.firstName = t('Enter your first name.');
    if (!lastName.trim()) next.lastName = t('Enter your last name.');
    if (!businessName.trim()) next.businessName = t('Enter your business name.');
    if (!email.trim()) next.email = t('Enter your email address.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t('Enter a valid email address.');
    if (!password) next.password = t('Choose a password.');
    else if (!evaluatePassword(password, { length: '', upper: '', lower: '', number: '', symbol: '' }).ok) {
      next.password = t('Use a stronger password: add the items still unchecked below.');
    }
    if (phone && !isValidPhMobile(phone)) next.phone = t('Enter a valid Philippine mobile number, e.g. 917 123 4567.');
    if (confirm !== password) next.confirm = t('Both passwords must match.');

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    if (isDemoMode) {
      setErrors({
        form: t('Account creation needs an active business. Please sign in again.'),
      });
      return;
    }

    // Middle name is optional, so it's only stitched in when actually given.
    const fullName = [firstName, middleName, lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');

    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUp({
        email,
        password,
        fullName,
        phone: toPhE164(phone),
        businessName,
      });

      if (needsEmailConfirmation) {
        setNotice(
          t('We sent a confirmation link to {{v1}}. Open it to finish setting up your account, then sign in.', { v1: email.trim() }),
        );
      } else {
        showToast(t('Your account is ready.'));
        history.replace('/dashboard');
      }
    } catch (error) {
      setErrors({ form: toUserMessage(error, t('Could not create your account. Please try again.')) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bl-login">
      <aside className="bl-login__aside" aria-hidden="true">
        <div className="bl-login__aside-inner">
          <Logo size="lg" inverse />
          <div className="bl-login__pitch">
            <h2>{t('Set up your business in a few minutes.')}</h2>
            <p>
              {t('Add your products, record what you sell and buy, and BantayLedger AI starts showing you what is running low and what it will cost to restock.')}
            </p>
          </div>
          <p className="bl-login__aside-foot">{t('Built for Philippine small businesses.')}</p>
        </div>
      </aside>

      <main className="bl-login__main">
        <div className="bl-login__card bl-login__card--wide">
          <div className="bl-login__top">
            <div className="bl-login__brand">
              <Logo size="md" />
            </div>
            <LanguageSelect />
          </div>

          <div className="bl-login__intro">
            <h1 className="bl-page-title">{t('Create your account')}</h1>
            <p className="bl-support">{t('Start tracking your inventory, sales and costs.')}</p>
          </div>

          <form className="bl-login__form" onSubmit={handleSubmit} noValidate>
            {errors.form && (
              <p className="bl-login__formerror" role="alert">
                {errors.form}
              </p>
            )}

            {notice && (
              <p className="bl-login__formnotice" role="status">
                {notice}
              </p>
            )}

            <p className="bl-login__legend">
              <b aria-hidden="true">*</b> {t('Fields marked * are required.')}
            </p>

            <div className="bl-form-grid bl-form-grid--2">
              <TextField
                label={t('First name')}
                autoComplete="given-name"
                placeholder={t('e.g. Juan')}
                value={firstName}
                error={errors.firstName}
                required
                onChange={(e) => setFirstName(e.target.value)}
              />
              <TextField
                label={t('Last name')}
                autoComplete="family-name"
                placeholder={t('e.g. Dela Cruz')}
                value={lastName}
                error={errors.lastName}
                required
                onChange={(e) => setLastName(e.target.value)}
              />
              <TextField
                label={t('Middle name')}
                optional
                autoComplete="additional-name"
                placeholder={t('e.g. Santos')}
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
              />
              <TextField
                label={t('Business name')}
                autoComplete="organization"
                placeholder={t("e.g. Maria's Mini Mart")}
                value={businessName}
                error={errors.businessName}
                required
                onChange={(e) => setBusinessName(e.target.value)}
              />
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
              <TextField
                label={t('Mobile number')}
                optional
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                className="bl-field--phone"
                prefix="+63"
                placeholder="9XX XXX XXXX"
                value={formatPhLocal(phone)}
                error={errors.phone}
                onChange={(e) => setPhone(normalizePhLocal(e.target.value))}
              />
              <div className="bl-login__password">
                <TextField
                  label={t('Password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={t('Create a strong password')}
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
              <TextField
                label={t('Confirm password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('Repeat your password')}
                value={confirm}
                error={errors.confirm}
                required
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            <PasswordStrength password={password} />

            <p className="bl-caption">{t('You can change this later in Settings.')}</p>

            <Button type="submit" variant="primary" size="lg" block loading={submitting}>
              {submitting ? t('Creating account') : t('Create account')}
            </Button>

            <p className="bl-login__signup">
              {t('Already have an account?')}{' '}
              <Link to="/login" className="bl-login__textlink" onClick={transitionClick(history, '/login')}>
                {t('Sign in')}
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Register;
