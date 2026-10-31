import { IonIcon } from '@ionic/react';
import {
  arrowForwardOutline,
  barChartOutline,
  cartOutline,
  cloudOfflineOutline,
  cubeOutline,
  downloadOutline,
  globeOutline,
  languageOutline,
  logoAndroid,
  logoWindows,
  shieldCheckmarkOutline,
  trendingUpOutline,
  walletOutline,
} from 'ionicons/icons';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/brand/Logo';
import LanguageSelect from '../components/common/LanguageSelect';
import { DOWNLOADS } from '../data/downloads';
import './Landing.css';
import { t } from '../i18n';

/** Smooth-scrolls to a section inside the page's own scroll area. */
function jump(id: string) {
  return (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

/**
 * Public home page of the website (signed-out visitors at `/`): what the app
 * does, the Android and Windows downloads, and a way into the web version.
 * The installed apps skip it and open on sign-in (see lib/platform.ts).
 */
export function Landing() {
  const features = [
    {
      icon: cartOutline,
      title: t('Record a sale in seconds'),
      text: t('Tap the products, take Cash, GCash or both, and stock updates by itself.'),
    },
    {
      icon: cubeOutline,
      title: t('Never run out by surprise'),
      text: t('See what is running low before the shelf is empty, with the right amount to reorder.'),
    },
    {
      icon: walletOutline,
      title: t('Know your real profit'),
      text: t('Sales, capital and expenses side by side, so you know what you actually earn.'),
    },
    {
      icon: trendingUpOutline,
      title: t('Plan the week ahead'),
      text: t('Forecasts from your own records tell you what will sell and what it will cost to restock.'),
    },
    {
      icon: cloudOfflineOutline,
      title: t('Works without internet'),
      text: t('Keep recording when the signal drops. Everything syncs once you are back online.'),
    },
    {
      icon: languageOutline,
      title: t('In your language'),
      text: t('Use it in English, Tagalog or Cebuano, on your phone or your computer.'),
    },
  ];

  const steps = [
    { title: t('Download the app'), text: t('Install it on your Android phone or Windows computer, or open it in your browser.') },
    { title: t('Add your products'), text: t('Enter what you sell, your buying and selling price, and how many you have.') },
    { title: t('Record as you sell'), text: t('Every sale, purchase and expense goes in. The numbers and alerts take care of themselves.') },
  ];

  const faqs = [
    {
      q: t('Do I need internet all the time?'),
      a: t('No. Sales, expenses, purchases and spoiled items can be recorded offline and are sent automatically when the connection returns. Signing in and changing settings need internet.'),
    },
    {
      q: t('Is my data the same on the phone and the computer?'),
      a: t('Yes. Every device signs in to the same account, so a sale recorded on the phone appears on the computer and the website.'),
    },
    {
      q: t('Why does my phone or computer warn me when installing?'),
      a: t('The apps are installed directly from this website instead of an app store. Android asks you to allow installing from this source, and Windows may show "Windows protected your PC" — choose More info, then Run anyway.'),
    },
    {
      q: t('Can my staff use it too?'),
      a: t('Yes. The owner adds staff in Settings → Team. Staff can record sales and stock; only the owner manages the business settings.'),
    },
  ];

  return (
    <div className="bl-land">
      {/* ---- Top bar ---------------------------------------------------------- */}
      <header className="bl-land__nav">
        <div className="bl-land__wrap bl-land__nav-inner">
          <Link to="/" className="bl-land__brand" aria-label={t('BantayLedger AI home')}>
            <Logo size="md" />
          </Link>
          <nav className="bl-land__links" aria-label={t('Page sections')}>
            <a href="#features" onClick={jump('features')}>{t('Features')}</a>
            <a href="#how" onClick={jump('how')}>{t('How it works')}</a>
            <a href="#download" onClick={jump('download')}>{t('Download')}</a>
            <a href="#faq" onClick={jump('faq')}>{t('Questions')}</a>
          </nav>
          <div className="bl-land__nav-actions">
            <LanguageSelect className="bl-land__lang" />
            <Link to="/login" className="bl-land__signin">{t('Sign in')}</Link>
            <Link to="/register" className="bl-land__btn bl-land__btn--primary bl-land__btn--sm">
              {t('Create account')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---- Hero ------------------------------------------------------------ */}
        <section className="bl-land__hero">
          <div className="bl-land__wrap bl-land__hero-grid">
            <div className="bl-land__hero-copy">
              <p className="bl-land__eyebrow">{t('For sari-sari stores and small shops')}</p>
              <h1 className="bl-land__title">{t('Know your sales, stock and profit — every single day.')}</h1>
              <p className="bl-land__lead">
                {t('BantayLedger keeps your sales, inventory, expenses and suppliers in one place, then tells you what to restock and what is coming next.')}
              </p>
              <div className="bl-land__cta">
                <a className="bl-land__btn bl-land__btn--primary" href={DOWNLOADS.android.href} download>
                  <IonIcon icon={logoAndroid} aria-hidden="true" />
                  {t('Download for Android')}
                </a>
                <a className="bl-land__btn bl-land__btn--secondary" href={DOWNLOADS.windows.href} download>
                  <IonIcon icon={logoWindows} aria-hidden="true" />
                  {t('Download for Windows')}
                </a>
              </div>
              <Link to="/login" className="bl-land__textlink">
                {t('Or use it in your browser')}
                <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
              </Link>
              <ul className="bl-land__proof">
                <li><IonIcon icon={cloudOfflineOutline} aria-hidden="true" />{t('Works offline')}</li>
                <li><IonIcon icon={walletOutline} aria-hidden="true" />{t('Cash and GCash')}</li>
                <li><IonIcon icon={languageOutline} aria-hidden="true" />{t('English, Tagalog, Cebuano')}</li>
              </ul>
            </div>

            <div className="bl-land__hero-art" aria-hidden="true">
              <div className="bl-land__screen">
                <div className="bl-land__screen-bar">
                  <span /><span /><span />
                </div>
                <img src="/landing/dashboard.jpg" alt="" loading="eager" />
              </div>
              <div className="bl-land__phone">
                <img src="/landing/phone.jpg" alt="" loading="eager" />
              </div>
            </div>
          </div>
        </section>

        {/* ---- Features -------------------------------------------------------- */}
        <section id="features" className="bl-land__section">
          <div className="bl-land__wrap">
            <div className="bl-land__head">
              <p className="bl-land__eyebrow">{t('Features')}</p>
              <h2 className="bl-land__h2">{t('Everything the counter needs, nothing it doesn’t')}</h2>
              <p className="bl-land__sub">{t('Built with store owners: simple screens, clear numbers, and help when something needs your attention.')}</p>
            </div>
            <div className="bl-land__features">
              {features.map((f) => (
                <article key={f.title} className="bl-land__feature">
                  <span className="bl-land__feature-icon" aria-hidden="true">
                    <IonIcon icon={f.icon} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---- How it works -------------------------------------------------- */}
        <section id="how" className="bl-land__section bl-land__section--tint">
          <div className="bl-land__wrap bl-land__how">
            <div className="bl-land__head bl-land__head--left">
              <p className="bl-land__eyebrow">{t('How it works')}</p>
              <h2 className="bl-land__h2">{t('Up and running in an afternoon')}</h2>
              <p className="bl-land__sub">{t('No accountant, no training. If you can use a phone, you can use BantayLedger.')}</p>
              <ul className="bl-land__checks">
                <li><IonIcon icon={barChartOutline} aria-hidden="true" />{t('Daily totals, capital and profit at a glance')}</li>
                <li><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />{t('Owner and staff accounts, each with their own sign-in')}</li>
                <li><IonIcon icon={globeOutline} aria-hidden="true" />{t('Same records on your phone, computer and browser')}</li>
              </ul>
            </div>
            <ol className="bl-land__steps">
              {steps.map((s, i) => (
                <li key={s.title} className="bl-land__step">
                  <span className="bl-land__step-num">{i + 1}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- Download ------------------------------------------------------- */}
        <section id="download" className="bl-land__section">
          <div className="bl-land__wrap">
            <div className="bl-land__head">
              <p className="bl-land__eyebrow">{t('Download')}</p>
              <h2 className="bl-land__h2">{t('Get BantayLedger on your devices')}</h2>
              <p className="bl-land__sub">{t('Free to download. Sign in with the same account everywhere.')}</p>
            </div>

            <div className="bl-land__downloads">
              <article className="bl-land__dl">
                <div className="bl-land__dl-top">
                  <span className="bl-land__dl-icon bl-land__dl-icon--android" aria-hidden="true">
                    <IonIcon icon={logoAndroid} />
                  </span>
                  <div>
                    <h3>{t('Android phone')}</h3>
                    <p className="bl-land__meta">
                      {t('Version {{version}} · {{size}} · Android 7.0 or newer', { version: DOWNLOADS.android.version, size: DOWNLOADS.android.size })}
                    </p>
                  </div>
                </div>
                <ol className="bl-land__dl-steps">
                  <li>{t('Tap Download and open the file when it finishes.')}</li>
                  <li>{t('If asked, allow installing apps from this source.')}</li>
                  <li>{t('Open BantayLedger AI and sign in.')}</li>
                </ol>
                <a className="bl-land__btn bl-land__btn--primary bl-land__btn--block" href={DOWNLOADS.android.href} download>
                  <IonIcon icon={downloadOutline} aria-hidden="true" />
                  {t('Download for Android')}
                </a>
              </article>

              <article className="bl-land__dl">
                <div className="bl-land__dl-top">
                  <span className="bl-land__dl-icon bl-land__dl-icon--windows" aria-hidden="true">
                    <IonIcon icon={logoWindows} />
                  </span>
                  <div>
                    <h3>{t('Windows computer')}</h3>
                    <p className="bl-land__meta">
                      {t('Version {{version}} · {{size}} · Windows 10 or 11 (64-bit)', { version: DOWNLOADS.windows.version, size: DOWNLOADS.windows.size })}
                    </p>
                  </div>
                </div>
                <ol className="bl-land__dl-steps">
                  <li>{t('Download and double-click the setup file.')}</li>
                  <li>{t('If Windows warns you, choose More info, then Run anyway.')}</li>
                  <li>{t('BantayLedger AI opens and adds itself to the Start menu.')}</li>
                </ol>
                <a className="bl-land__btn bl-land__btn--primary bl-land__btn--block" href={DOWNLOADS.windows.href} download>
                  <IonIcon icon={downloadOutline} aria-hidden="true" />
                  {t('Download for Windows')}
                </a>
              </article>

              <article className="bl-land__dl bl-land__dl--web">
                <div className="bl-land__dl-top">
                  <span className="bl-land__dl-icon" aria-hidden="true">
                    <IonIcon icon={globeOutline} />
                  </span>
                  <div>
                    <h3>{t('Any browser')}</h3>
                    <p className="bl-land__meta">{t('Nothing to install · Mac, iPhone, tablets')}</p>
                  </div>
                </div>
                <p className="bl-land__dl-note">{t('Use the full app right here in your browser on any device.')}</p>
                <Link to="/login" className="bl-land__btn bl-land__btn--secondary bl-land__btn--block">
                  {t('Open web app')}
                  <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
                </Link>
              </article>
            </div>
          </div>
        </section>

        {/* ---- FAQ ------------------------------------------------------------ */}
        <section id="faq" className="bl-land__section bl-land__section--tint">
          <div className="bl-land__wrap bl-land__faq-wrap">
            <div className="bl-land__head bl-land__head--left">
              <p className="bl-land__eyebrow">{t('Questions')}</p>
              <h2 className="bl-land__h2">{t('Good to know')}</h2>
            </div>
            <div className="bl-land__faq">
              {faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Closing call to action --------------------------------------- */}
        <section className="bl-land__closing">
          <div className="bl-land__wrap bl-land__closing-inner">
            <h2>{t('Start keeping track today')}</h2>
            <p>{t('Create a free account in a minute and record your first sale.')}</p>
            <div className="bl-land__cta bl-land__cta--center">
              <Link to="/register" className="bl-land__btn bl-land__btn--light">{t('Create free account')}</Link>
              <a href="#download" onClick={jump('download')} className="bl-land__btn bl-land__btn--ghost">{t('See downloads')}</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bl-land__footer">
        <div className="bl-land__wrap bl-land__footer-inner">
          <Logo size="sm" />
          <p>{t('Business and forecast tracker for Philippine small businesses.')}</p>
          <p className="bl-land__copy">© {new Date().getFullYear()} BantayLedger AI</p>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
