import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { transitionClick } from '../lib/viewTransition';
import { Logo } from '../components/brand/Logo';
import Button from '../components/common/Button';
import { TextField } from '../components/common/Field';
import { useToast } from '../components/common/ToastProvider';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { ApiError } from '../services/api/client';
import './Login.css';
import { t } from '../i18n';
import LanguageSelect from '../components/common/LanguageSelect';
import AppTour, { tourPanelStyle } from '../components/brand/AppTour';
import Modal from '../components/common/Modal';
import LegalContent, { legalTitle, type LegalDoc } from '../components/legal/LegalContent';
import PasswordStrength from '../components/auth/PasswordStrength';
import { evaluatePassword } from '../utils/passwordStrength';
import { formatPhLocal, isValidPhMobile, normalizePhLocal, toPhE164 } from '../utils/phone';

/**
 * Account creation, one small step at a time (in the style of Google's sign-up):
 * name, business, email, password, then a review with the age and Terms
 * agreement. Back keeps everything typed. Signing up also creates the user's
 * business and makes them its OWNER, since a user without a business would have
 * nothing to look at.
 */

interface Errors {
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  terms?: string;
  form?: string;
}

type Step = 'name' | 'business' | 'email' | 'password' | 'review';
const STEPS: Step[] = ['name', 'business', 'email', 'password', 'review'];

const HEADINGS: Record<Step, { title: string; subtitle: string }> = {
  name: { title: t('Create a BantayLedger account'), subtitle: t('Enter your name.') },
  business: { title: t('Your business'), subtitle: t('Tell us about the store you are setting up.') },
  email: { title: t('Your sign-in email'), subtitle: t('You will use this email address to sign in.') },
  password: { title: t('Create a strong password'), subtitle: t('Use 8 or more characters with a mix of letters, numbers and symbols.') },
  review: { title: t('Review and agree'), subtitle: t('Check your details, then create your account.') },
};

export function Register() {
  const history = useHistory();
  const { showToast } = useToast();
  const { signUp, isDemoMode } = useAuth();

  const [step, setStep] = useState<Step>('name');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); // the 10 digits after +63
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [policy, setPolicy] = useState<LegalDoc | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef<Step>('name');
  // True once they've moved between steps; only then does a step slide in.
  const [stepped, setStepped] = useState(false);
  const index = STEPS.indexOf(step);

  // A new step puts the cursor in its first field, like Google's sign-up. Not on
  // the first visit, so a phone's keyboard doesn't jump up before anything is read.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    setStepped(true);
    const field = formRef.current?.querySelector<HTMLInputElement>('input:not([type=checkbox])');
    if (field) field.focus();
    else headingRef.current?.focus();
  }, [step]);

  const fullName = [firstName, middleName, lastName].map((part) => part.trim()).filter(Boolean).join(' ');

  const check = (which: Step): Errors => {
    const next: Errors = {};
    if (which === 'name') {
      if (!firstName.trim()) next.firstName = t('Enter your first name.');
      if (!lastName.trim()) next.lastName = t('Enter your last name.');
    }
    if (which === 'business') {
      if (!businessName.trim()) next.businessName = t('Enter your business name.');
      if (phone && !isValidPhMobile(phone)) next.phone = t('Enter a valid Philippine mobile number, e.g. 917 123 4567.');
    }
    if (which === 'email') {
      if (!email.trim()) next.email = t('Enter your email address.');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t('Enter a valid email address.');
    }
    if (which === 'password') {
      if (!password) next.password = t('Choose a password.');
      else if (!evaluatePassword(password, { length: '', upper: '', lower: '', number: '', symbol: '' }).ok) {
        next.password = t('Use a stronger password: add the items still missing below.');
      }
      if (confirm !== password) next.confirm = t('Both passwords must match.');
    }
    if (which === 'review' && !acceptTerms) {
      next.terms = t('Please confirm you are 18 or older and agree to the Terms and Privacy Policy.');
    }
    return next;
  };

  const goTo = (target: Step) => {
    setErrors({});
    setStep(target);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = check(step);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    if (step !== 'review') {
      setStep(STEPS[index + 1]);
      return;
    }

    if (isDemoMode) {
      setErrors({ form: t('Account creation needs an active business. Please sign in again.') });
      return;
    }

    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUp({
        email,
        password,
        fullName,
        phone: toPhE164(phone),
        businessName,
        acceptTerms,
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
      const message = toUserMessage(error, t('Could not create your account. Please try again.'));
      // An email that's already in use is fixed on the email step, so take them there.
      if (error instanceof ApiError && error.status === 409) {
        setStep('email');
        setErrors({ email: message });
      } else {
        setErrors({ form: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const heading = HEADINGS[step];
  const policyLinks = (
    <>
      <button type="button" className="bl-login__textlink" onClick={() => setPolicy('privacy')}>
        {t('Privacy Policy')}
      </button>
      <button type="button" className="bl-login__textlink" onClick={() => setPolicy('terms')}>
        {t('Terms of Service')}
      </button>
    </>
  );

  let fields: ReactNode = null;
  if (step === 'name') {
    fields = (
      <>
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
          label={t('Middle name')}
          optional
          autoComplete="additional-name"
          placeholder={t('e.g. Santos')}
          value={middleName}
          onChange={(e) => setMiddleName(e.target.value)}
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
      </>
    );
  } else if (step === 'business') {
    fields = (
      <>
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
      </>
    );
  } else if (step === 'email') {
    fields = (
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
    );
  } else if (step === 'password') {
    fields = (
      <>
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
        <label className="bl-check bl-gsu__show">
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          {t('Show password')}
        </label>
        <PasswordStrength password={password} compact />
      </>
    );
  } else {
    const rows: { label: string; value: string; edit: Step }[] = [
      { label: t('Name'), value: fullName, edit: 'name' },
      { label: t('Business name'), value: businessName.trim(), edit: 'business' },
      { label: t('Mobile number'), value: phone ? `+63 ${formatPhLocal(phone)}` : t('Not given'), edit: 'business' },
      { label: t('Email address'), value: email.trim(), edit: 'email' },
    ];
    fields = (
      <>
        <dl className="bl-gsu__review">
          {rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
              <button type="button" className="bl-login__textlink" onClick={() => goTo(r.edit)} aria-label={`${t('Edit')}: ${r.label}`}>
                {t('Edit')}
              </button>
            </div>
          ))}
        </dl>
        <div className="bl-gsu__terms">
          <label className="bl-check bl-login__terms">
            <input
              type="checkbox"
              checked={acceptTerms}
              aria-invalid={errors.terms ? true : undefined}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            <span>{t('I am 18 or older and I agree to the Terms of Service and Privacy Policy.')}</span>
          </label>
          <p className="bl-login__policies bl-caption">{policyLinks}</p>
          {errors.terms && (
            <p className="bl-form-error" role="alert">
              {errors.terms}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="bl-login bl-login--register">
      <main className="bl-login__main">
        <div className="bl-login__card bl-gsu">
          <div
            className="bl-gsu__progress"
            role="progressbar"
            aria-label={t('Sign-up progress')}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={index + 1}
          >
            <i style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
          </div>

          <div className="bl-gsu__body">
            <div className="bl-gsu__head">
              <Logo size="md" />
              <h1 className="bl-gsu__title" ref={headingRef} tabIndex={-1}>
                {heading.title}
              </h1>
              <p className="bl-gsu__sub">{heading.subtitle}</p>
              <p className="bl-gsu__count">
                {t('Step {{n}} of {{total}}', { n: index + 1, total: STEPS.length })}
                {step !== 'review' && (
                  <>
                    {' · '}
                    <span className="bl-login__legend">
                      <b aria-hidden="true">*</b> {t('required')}
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Keyed by step, so each new step fades in. */}
            <form key={step} ref={formRef} className={`bl-gsu__form${stepped ? ' is-stepping' : ''}`} onSubmit={handleSubmit} noValidate>
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

              <div className="bl-gsu__fields">{fields}</div>

              <div className="bl-gsu__actions">
                {step === 'name' ? (
                  <Link to="/login" className="bl-login__textlink" onClick={transitionClick(history, '/login')}>
                    {t('Sign in instead')}
                  </Link>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => goTo(STEPS[index - 1])} disabled={submitting}>
                    {t('Back')}
                  </Button>
                )}
                <Button type="submit" variant="primary" loading={submitting}>
                  {step === 'review' ? (submitting ? t('Creating account') : t('Create account')) : t('Next')}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Under the card, as on Google's sign-up: the language, then the policies. */}
        <div className="bl-gsu__footer">
          <LanguageSelect />
          <span className="bl-gsu__footer-links">{policyLinks}</span>
        </div>
      </main>

      {/* The animated tour, desktop only, as on the sign-in page. Shown on the left,
          but after the form in the page, so the keyboard reaches the fields first. */}
      <aside className="bl-login__aside bl-login__aside--tour" style={tourPanelStyle()} aria-label={t('A quick tour of BantayLedger AI')}>
        <div className="bl-login__aside-inner">
          <Logo size="lg" inverse />
          <div className="bl-login__pitch">
            <h2>{t('Set up your business in a few minutes.')}</h2>
          </div>
          <AppTour desktopOnly />
          <p className="bl-login__aside-foot">{t('Built for Philippine small businesses.')}</p>
        </div>
      </aside>

      {/* Shown in place, so what has been typed in the form isn't lost. */}
      <Modal isOpen={policy !== null} onClose={() => setPolicy(null)} title={policy ? legalTitle(policy) : ''} size="lg" icon="form">
        {policy && <LegalContent doc={policy} />}
      </Modal>
    </div>
  );
}

export default Register;
