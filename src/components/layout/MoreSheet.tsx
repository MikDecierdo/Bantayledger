import { IonIcon } from '@ionic/react';
import { chevronForwardOutline, logOutOutline } from 'ionicons/icons';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { toUserMessage } from '../../lib/errors';
import { alertError, confirmLogout } from '../../lib/swal';
import { moreGroups } from './navItems';
import './MoreSheet.css';
import { t } from '../../i18n';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  alertCount: number;
}

/**
 * Phone "More" sheet: every page that is not on the bottom bar, grouped like
 * the desktop sidebar, plus Logout — the one place to sign out on a phone.
 */
export function MoreSheet({ isOpen, onClose, alertCount }: MoreSheetProps) {
  const { pathname } = useLocation();
  const history = useHistory();
  const { activeBusiness, signOut } = useAuth();

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('More')}
      description={activeBusiness?.name}
      icon="menu"
      size="sm"
    >
      <nav className="bl-more" aria-label={t('More')}>
        {moreGroups.map((group) => (
          <section key={group.title} className="bl-more__group">
            <h3 className="bl-more__title">{group.title}</h3>
            <ul className="bl-more__list">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge = item.badgeKey === 'alerts' ? alertCount : 0;
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={`bl-more__item ${active ? 'bl-more__item--active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={onClose}
                    >
                      <span className="bl-more__icon" aria-hidden="true">
                        <IonIcon icon={item.icon} />
                      </span>
                      <span className="bl-more__label">{item.label}</span>
                      {badge > 0 && (
                        <span className="bl-more__badge">
                          {badge > 9 ? '9+' : badge}
                          <span className="bl-sr-only">{' '}{t('unread alerts')}</span>
                        </span>
                      )}
                      <IonIcon icon={chevronForwardOutline} className="bl-more__chev" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
              {group.items.some((i) => i.href === '/settings') && (
                <li>
                  <button
                    type="button"
                    className="bl-more__item bl-more__item--danger"
                    onClick={() => void handleLogout()}
                  >
                    <span className="bl-more__icon" aria-hidden="true">
                      <IonIcon icon={logOutOutline} />
                    </span>
                    <span className="bl-more__label">{t('Logout')}</span>
                  </button>
                </li>
              )}
            </ul>
          </section>
        ))}
      </nav>
    </Modal>
  );
}

export default MoreSheet;
