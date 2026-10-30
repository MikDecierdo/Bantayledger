import { IonIcon } from '@ionic/react';
import { logOutOutline, menuOutline } from 'ionicons/icons';
import { NavLink, useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toUserMessage } from '../../lib/errors';
import { alertError, confirmLogout } from '../../lib/swal';
import { Logo } from '../brand/Logo';
import { accountNav, intelligenceNav, primaryNav, type NavItem } from './navItems';
import './DesktopSidebar.css';
import { t } from '../../i18n';

interface SidebarProps {
  /** Collapsed rail: icons only, used on tablet and when the user collapses it. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  alertCount: number;
  /**
   * Whether collapsing is the user's choice. Tablets are always collapsed for
   * want of width, so the toggle is hidden there rather than shown inert.
   */
  canToggle: boolean;
}

function NavGroup({
  title,
  items,
  collapsed,
  alertCount,
  currentPath,
}: {
  title?: string;
  items: NavItem[];
  collapsed: boolean;
  alertCount: number;
  currentPath: string;
}) {
  return (
    <div className="bl-sidebar__group">
      {title && !collapsed && <p className="bl-sidebar__group-title">{title}</p>}
      <ul>
        {items.map((item) => {
          const active =
            currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          const badge = item.badgeKey === 'alerts' ? alertCount : 0;

          return (
            <li key={item.href}>
              <NavLink
                to={item.href}
                className={`bl-sidenav ${active ? 'bl-sidenav--active' : ''}`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <IonIcon icon={item.icon} className="bl-sidenav__icon" aria-hidden="true" />
                <span className={collapsed ? 'bl-sr-only' : 'bl-sidenav__label'}>{item.label}</span>
                {badge > 0 && (
                  <span className="bl-sidenav__badge">
                    {badge}
                    <span className="bl-sr-only">{' '}{t('unread alerts')}</span>
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DesktopSidebar({
  collapsed,
  onToggleCollapsed,
  alertCount,
  canToggle,
}: SidebarProps) {
  const { pathname } = useLocation();
  const history = useHistory();
  const { profile, activeBusiness, signOut } = useAuth();

  const displayName = profile?.full_name ?? profile?.email ?? t('Signed in');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!(await confirmLogout())) return;

    try {
      await signOut();
      history.replace('/login');
    } catch (err) {
      await alertError(t('Could not sign you out'), toUserMessage(err));
    }
  };

  return (
    <>
      {canToggle && (
        <button
          type="button"
          className={`bl-sidebar-toggle ${collapsed ? 'bl-sidebar-toggle--collapsed' : ''}`}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? t('Expand navigation') : t('Collapse navigation')}
          aria-expanded={!collapsed}
        >
          <IonIcon icon={menuOutline} aria-hidden="true" />
        </button>
      )}

      <aside
        className={`bl-sidebar ${collapsed ? 'bl-sidebar--collapsed' : ''}`}
        aria-label={t('Main navigation')}
      >
        <div className="bl-sidebar__brand">
          <NavLink
            to="/dashboard"
            className="bl-sidebar__brand-link"
            aria-label={t('BantayLedger AI, go to dashboard')}
          >
            <Logo size="lg" stacked markOnly={collapsed} />
          </NavLink>
        </div>

        <nav className="bl-sidebar__nav bl-scroll">
          <NavGroup
            title={t('Business')}
            items={primaryNav}
            collapsed={collapsed}
            alertCount={alertCount}
            currentPath={pathname}
          />
          <NavGroup
            title={t('Intelligence')}
            items={intelligenceNav}
            collapsed={collapsed}
            alertCount={alertCount}
            currentPath={pathname}
          />
        </nav>

        <div className="bl-sidebar__footer">
          <NavGroup
            items={accountNav}
            collapsed={collapsed}
            alertCount={0}
            currentPath={pathname}
          />

          {!collapsed && (
            <div className="bl-sidebar__user">
              <span className="bl-avatar bl-avatar--sm" aria-hidden="true">
                {initials}
              </span>
              <span className="bl-sidebar__user-text">
                <span className="bl-sidebar__user-name bl-truncate">{displayName}</span>
                <span className="bl-sidebar__user-biz bl-truncate">
                  {activeBusiness?.name ?? t('No business yet')}
                </span>
              </span>
            </div>
          )}

          <button
            type="button"
            className="bl-sidenav bl-sidenav--logout"
            onClick={(e) => void handleLogout(e)}
            title={collapsed ? t('Logout') : undefined}
          >
            <IonIcon icon={logOutOutline} className="bl-sidenav__icon" aria-hidden="true" />
            <span className={collapsed ? 'bl-sr-only' : 'bl-sidenav__label'}>{t('Logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default DesktopSidebar;
