import { IonIcon } from '@ionic/react';
import { logOutOutline } from 'ionicons/icons';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { toUserMessage } from '../../lib/errors';
import { alertError, confirmLogout } from '../../lib/swal';
import { moreGroups, profileShortcuts, subscriptionNav, visibleNav, type NavItem } from './navItems';
import './MoreSheet.css';
import { t } from '../../i18n';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  alertCount: number;
}

/**
 * Phone "More" sheet: every page that is not on the bottom bar, as tiles that fit
 * on one screen, plus Logout, the one place to sign out on a phone.
 */
export function MoreSheet({ isOpen, onClose, alertCount }: MoreSheetProps) {
  const { pathname } = useLocation();
  const history = useHistory();
  const { activeBusiness, isManager, signOut } = useAuth();

  const handleLogout = async () => {
    onClose();
    if (!(await confirmLogout())) return;

    try {
      await signOut();
      history.replace('/login');
    } catch (err) {
      await alertError(t('Could not sign you out'), toUserMessage(err));
    }
  };

  const tile = (item: NavItem, badge = 0) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <li key={item.href}>
        <Link
          to={item.href}
          className={`bl-more__tile${active ? ' bl-more__tile--active' : ''}`}
          aria-current={active ? 'page' : undefined}
          onClick={onClose}
        >
          <IonIcon icon={item.icon} aria-hidden="true" />
          <span>{item.label}</span>
          {badge > 0 && (
            <span className="bl-more__badge bl-more__badge--tile">
              {badge > 9 ? '9+' : badge}
              <span className="bl-sr-only">{' '}{t('unread alerts')}</span>
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('More')}
      description={activeBusiness ? `${activeBusiness.name} · ${activeBusiness.plan === 'plus' ? t('Plus') : t('Free')}` : undefined}
      icon="menu"
      size="sm"
    >
      <nav className="bl-more" aria-label={t('More')}>
        {moreGroups.map((group) => {
          const isAccount = group.items.some((i) => i.href === '/settings');
          return (
            <section key={group.title} className="bl-more__group">
              <h3 className="bl-more__title">{group.title}</h3>
              <ul className="bl-more__tiles">
                {visibleNav(group.items, isManager).map((item) => tile(item, item.badgeKey === 'alerts' ? alertCount : 0))}
                {isAccount && profileShortcuts.map((item) => tile(item))}
                {isAccount && activeBusiness && isManager && tile({
                  ...subscriptionNav,
                  label: `${subscriptionNav.label}: ${activeBusiness.plan === 'plus' ? t('Plus') : t('Free')}`,
                })}
                {isAccount && (
                  <li>
                    <button type="button" className="bl-more__tile bl-more__tile--danger" onClick={() => void handleLogout()}>
                      <IonIcon icon={logOutOutline} aria-hidden="true" />
                      <span>{t('Logout')}</span>
                    </button>
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </nav>
    </Modal>
  );
}

export default MoreSheet;
