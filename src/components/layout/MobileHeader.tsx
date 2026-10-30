import { IonIcon } from '@ionic/react';
import { arrowBackOutline, notificationsOutline } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogoMark } from '../brand/Logo';
import { titleForPath } from './navItems';
import './MobileHeader.css';
import { t } from '../../i18n';

interface MobileHeaderProps {
  alertCount: number;
}

/** Compact top bar for phones: title, alerts, avatar. */
export function MobileHeader({ alertCount }: MobileHeaderProps) {
  const { pathname } = useLocation();
  const history = useHistory();
  const { profile, activeBusiness } = useAuth();

  const displayName = profile?.full_name ?? profile?.email ?? '';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '—';

  const isDashboard = pathname === '/dashboard';
  const isDetail = pathname.startsWith('/inventory/');
  const title = titleForPath(pathname);

  return (
    <header className="bl-mheader">
      <div className="bl-mheader__left">
        {isDetail ? (
          <button
            type="button"
            className="bl-mheader__icon-btn"
            onClick={() => history.goBack()}
            aria-label={t('Go back')}
          >
            <IonIcon icon={arrowBackOutline} aria-hidden="true" />
          </button>
        ) : (
          <LogoMark size={30} />
        )}

        <div className="bl-mheader__title-wrap">
          {isDashboard ? (
            <>
              <span className="bl-mheader__title">{t('BantayLedger AI')}</span>
              <span className="bl-mheader__sub bl-truncate">
                {activeBusiness?.name ?? t('Your business')}
              </span>
            </>
          ) : (
            <h1 className="bl-mheader__title bl-truncate">{title}</h1>
          )}
        </div>
      </div>

      <div className="bl-mheader__right">
        <button
          type="button"
          className="bl-mheader__icon-btn"
          onClick={() => history.push('/alerts')}
          aria-label={alertCount > 0 ? t('Alerts, {{count}} unread', { count: alertCount }) : t('Alerts')}
        >
          <IonIcon icon={notificationsOutline} aria-hidden="true" />
          {alertCount > 0 && <span className="bl-mheader__dot" aria-hidden="true" />}
        </button>

        <button
          type="button"
          className="bl-mheader__avatar-btn"
          onClick={() => history.push('/profile')}
          aria-label={t('Open your profile')}
        >
          <span className="bl-avatar bl-avatar--sm" aria-hidden="true">
            {initials}
          </span>
        </button>
      </div>
    </header>
  );
}

export default MobileHeader;
