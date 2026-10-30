import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/brand/Logo';
import Button from '../components/common/Button';
import { TextField } from '../components/common/Field';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import './Login.css';
import { t } from '../i18n';
import LanguageSelect from '../components/common/LanguageSelect';

/**
 * Requests a password reset email.
 *
 * The confirmation deliberately does not say whether the address is
 * registered — that would let anyone test which emails have accounts.
 */
export function ForgotPassword() {
  const { requestPasswordReset, isDemoMode } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('Enter a valid email address.'));
      return;
    }

    if (isDemoMode) {
      setError(t('Password reset needs an active business. Please sign in again.'));
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(toUserMessage(err, t('Could not send the reset email.')));
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
            <h2>{t('Locked out? It happens.')}</h2>
            <p>{t('Enter the email you signed up with and we will send you a link to set a new password.')}</p>
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
            <h1 className="bl-page-title">{t('Reset your password')}</h1>
            <p className="bl-support">{t('We will email you a link to choose a new one.')}</p>
          </div>

          <form className="bl-login__form" onSubmit={handleSubmit} noValidate>
            {error && (
              <p className="bl-login__formerror" role="alert">
                {error}
              </p>
            )}

            {sent ? (
              <p className="bl-login__formnotice" role="status">
                {t('If an account exists for {{v1}}, a reset link is on its way. The link expires after one hour.', { v1: email.trim() })}
              </p>
            ) : (
              <>
                <TextField
                  label={t('Email address')}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={t('you@yourbusiness.ph')}
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                />

                <Button type="submit" variant="primary" size="lg" block loading={submitting}>
                  {submitting ? t('Sending') : t('Send reset link')}
                </Button>
              </>
            )}

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

export default ForgotPassword;
