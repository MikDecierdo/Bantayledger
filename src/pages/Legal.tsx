import { Link, useHistory, useLocation } from 'react-router-dom';
import { Logo } from '../components/brand/Logo';
import LanguageSelect from '../components/common/LanguageSelect';
import LegalContent, { legalTitle, type LegalDoc } from '../components/legal/LegalContent';
import { t } from '../i18n';
import './Legal.css';

export const LEGAL_ROUTES: Record<string, LegalDoc> = {
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/refunds': 'refunds',
  '/cookies': 'cookies',
};

/** The public policy pages. They open for everyone, signed in or not. */
export function Legal() {
  const history = useHistory();
  const { pathname } = useLocation();
  const doc = LEGAL_ROUTES[pathname] ?? 'privacy';

  return (
    <div className="bl-legal">
      <header className="bl-legal__bar">
        <Link to="/" aria-label={t('BantayLedger AI home')}>
          <Logo size="md" />
        </Link>
        <LanguageSelect />
      </header>

      <main className="bl-legal__main">
        <button type="button" className="bl-login__textlink bl-legal__back" onClick={() => (window.history.length > 1 ? history.goBack() : history.replace('/'))}>
          {t('Back')}
        </button>
        <h1 className="bl-page-title">{legalTitle(doc)}</h1>
        <nav className="bl-legal__tabs" aria-label={t('Policies')}>
          {Object.entries(LEGAL_ROUTES).map(([path, item]) => (
            <Link key={path} to={path} replace aria-current={item === doc ? 'page' : undefined}>
              {legalTitle(item)}
            </Link>
          ))}
        </nav>
        <LegalContent doc={doc} />
      </main>
    </div>
  );
}

export default Legal;
