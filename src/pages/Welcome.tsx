import { useState } from 'react';
import { Logo } from '../components/brand/Logo';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { LANGUAGES, currentLanguage, t } from '../i18n';
import { useLanguage } from '../i18n/LanguageContext';
import { toUserMessage } from '../lib/errors';
import { authClient } from '../services/api/authClient';
import Modal from '../components/common/Modal';
import LegalContent, { legalTitle, type LegalDoc } from '../components/legal/LegalContent';
import './Welcome.css';

/**
 * Remembers that the notice was agreed to, so choosing a language (which
 * reloads the page) keeps the person on the language step.
 */
const AGREED_KEY = 'bl-welcome-agreed';

function readAgreed(): boolean {
  try {
    return sessionStorage.getItem(AGREED_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberAgreed(on: boolean) {
  try {
    if (on) sessionStorage.setItem(AGREED_KEY, '1');
    else sessionStorage.removeItem(AGREED_KEY);
  } catch {
    /* the step simply starts again after a reload */
  }
}

/**
 * The step shown once per account, after sign-up or the first login. Step 1:
 * read how data is handled and agree. Step 2 (after Continue): choose a
 * language. Nothing is saved until "Get started". Bumping the notice version
 * on the server asks everyone again.
 */
export function Welcome() {
  const { privacyNoticeVersion, refresh, signOut } = useAuth();
  const { setLanguage } = useLanguage();
  const [step, setStep] = useState<'notice' | 'language'>(readAgreed() ? 'language' : 'notice');
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<LegalDoc | null>(null);
  const selected = currentLanguage();

  const handleContinue = () => {
    rememberAgreed(true);
    setStep('language');
  };

  const handleStart = async () => {
    setError(null);
    setSaving(true);
    try {
      await authClient.acceptPrivacy(privacyNoticeVersion, currentLanguage());
      rememberAgreed(false);
      await refresh();
    } catch (err) {
      setError(toUserMessage(err, t('Could not save your choice. Please try again.')));
      setSaving(false);
    }
  };

  if (step === 'language') {
    return (
      <main className="bl-welcome">
        <section className="bl-welcome__card" aria-labelledby="welcome-lang-title">
          <Logo size="md" />
          <h1 id="welcome-lang-title" className="bl-page-title bl-welcome__title">
            {t('Choose your language')}
          </h1>
          <p className="bl-support">{t('You can change this later in Settings.')}</p>

          <div className="bl-welcome__langs" role="radiogroup" aria-label={t('Language')}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={selected === l.code}
                className={`bl-welcome__lang-option${selected === l.code ? ' is-selected' : ''}`}
                onClick={() => setLanguage(l.code)}
              >
                {l.native}
              </button>
            ))}
          </div>

          {error && (
            <p className="bl-form-error" role="alert">
              {error}
            </p>
          )}

          <div className="bl-welcome__actions">
            <Button variant="primary" size="lg" block loading={saving} onClick={() => void handleStart()}>
              {saving ? t('Saving') : t('Get started')}
            </Button>
            <button
              type="button"
              className="bl-login__textlink bl-welcome__signout"
              onClick={() => {
                rememberAgreed(false);
                setStep('notice');
              }}
            >
              {t('Back to the notice')}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="bl-welcome">
      <section className="bl-welcome__card" aria-labelledby="welcome-title">
        <Logo size="md" />
        <h1 id="welcome-title" className="bl-page-title bl-welcome__title">
          {t('Welcome to BantayLedger AI')}
        </h1>
        <p className="bl-support">{t('Before you start, please read how your data is handled.')}</p>

        <div className="bl-welcome__notice">
          <details open>
            <summary>{t('What we collect and why')}</summary>
            <ul>
              <li>{t('Your name, email, phone number and password. Your password is stored scrambled, never as plain text.')}</li>
              <li>{t('Your business name, type and address.')}</li>
              <li>{t('The products, stock, prices, sales, purchases, expenses and spoiled or damaged items you record, and any photos you upload.')}</li>
              <li>{t('Optional map locations of your suppliers.')}</li>
              <li>{t('We use this only to run your inventory, sales and reports, and to give you forecasts and tips.')}</li>
            </ul>
          </details>

          <details open>
            <summary>{t('Where it is stored and who can see it')}</summary>
            <ul>
              <li>{t('The database is run by Aiven and the app server by Render, both in the United States, so your information is stored outside the Philippines.')}</li>
              <li>{t('Only people you add to your business (owner or staff) can see your business data, and what they can change depends on their role.')}</li>
              <li>{t('Your data is not sold and is not used for advertising.')}</li>
            </ul>
          </details>

          <details open>
            <summary>{t('AI features and outside services')}</summary>
            <ul>
              <li>{t('Forecasts, alerts and tips are calculated on the server from your own records.')}</li>
              <li>{t('If an administrator turns on "Explain with AI", only a product name, its category and its weekly unit counts are sent to the AI service. Your name, customers and prices are never sent.')}</li>
              <li>{t('Address search and maps use OpenStreetMap services, which receive the text you type or the map position you pick.')}</li>
              <li>{t('Brevo sends password reset emails, so it receives your email address when you ask for one.')}</li>
              <li>{t('GitHub provides the app downloads and the update check.')}</li>
            </ul>
          </details>

          <details open>
            <summary>{t('Your rights and how to reach us')}</summary>
            <ul>
              <li>{t('You can see and correct your details in Profile, and download or delete your data in Settings → Your data. Deleting your account withdraws your consent.')}</li>
              <li>{t('The owner controls a store\'s records. Deleting a staff account removes the login, but the records it entered stay with the store, without the name.')}</li>
            </ul>
          </details>
        </div>

        <label className="bl-check bl-welcome__agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{t('I am 18 or older, I have read this notice, and I agree to it and to the Terms of Service.')}</span>
        </label>

        <p className="bl-login__policies bl-caption">
          <button type="button" className="bl-login__textlink" onClick={() => setPolicy('terms')}>
            {t('Read the Terms of Service')}
          </button>
          <button type="button" className="bl-login__textlink" onClick={() => setPolicy('privacy')}>
            {t('Read the Privacy Policy')}
          </button>
        </p>

        <div className="bl-welcome__actions">
          <Button variant="primary" size="lg" block disabled={!agreed} onClick={handleContinue}>
            {t('Continue')}
          </Button>
          <button type="button" className="bl-login__textlink bl-welcome__signout" onClick={() => void signOut()}>
            {t('Sign out')}
          </button>
        </div>

        <p className="bl-caption">{t('This is a plain-language summary of how your data is handled.')}</p>
      </section>

      <Modal isOpen={policy !== null} onClose={() => setPolicy(null)} title={policy ? legalTitle(policy) : ''} size="lg" icon="form">
        {policy && <LegalContent doc={policy} />}
      </Modal>
    </main>
  );
}

export default Welcome;
