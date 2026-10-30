import { IonIcon } from '@ionic/react';
import { NavLink, useLocation } from 'react-router-dom';
import { bottomNav } from './navItems';
import './MobileBottomNav.css';
import { t } from '../../i18n';

interface MobileBottomNavProps {
  alertCount: number;
}

/**
 * Fixed bottom bar with five destinations. Everything else on mobile is reached
 * from within a page or the profile screen, keeping targets comfortably wide.
 */
export function MobileBottomNav({ alertCount }: MobileBottomNavProps) {
  const { pathname } = useLocation();

  return (
    <nav className="bl-bottomnav" aria-label={t('Primary')}>
      <ul>
        {bottomNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badge = item.badgeKey === 'alerts' ? alertCount : 0;

          return (
            <li key={item.href}>
              <NavLink
                to={item.href}
                className={`bl-bottomnav__item ${active ? 'bl-bottomnav__item--active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="bl-bottomnav__icon-wrap">
                  <IonIcon icon={item.icon} className="bl-bottomnav__icon" aria-hidden="true" />
                  {badge > 0 && (
                    <span className="bl-bottomnav__badge">
                      {badge > 9 ? '9+' : badge}
                      <span className="bl-sr-only">{' '}{t('unread alerts')}</span>
                    </span>
                  )}
                </span>
                <span className="bl-bottomnav__label">{item.shortLabel ?? item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default MobileBottomNav;
