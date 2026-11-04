import { IonIcon } from '@ionic/react';
import { logOutOutline, menuOutline } from 'ionicons/icons';
import { useLayoutEffect, useRef } from 'react';
import { NavLink, useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toUserMessage } from '../../lib/errors';
import { alertError, confirmLogout } from '../../lib/swal';
import { Logo } from '../brand/Logo';
import { accountNav, intelligenceNav, primaryNav, profileShortcuts, subscriptionNav, visibleNav, type NavItem } from './navItems';
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
            <li key={item.href} className={item.href === '/profile' && !collapsed ? 'bl-sidebar__with-shortcuts' : undefined}>
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
              {item.href === '/profile' && !collapsed && (
                <span className="bl-sidebar__shortcuts">
                  {profileShortcuts.map((shortcut) => (
                    <NavLink
                      key={shortcut.href}
                      to={shortcut.href}
                      className={`bl-sidebar__shortcut ${currentPath === shortcut.href ? 'bl-sidebar__shortcut--active' : ''}`}
                      aria-label={shortcut.label}
                      aria-current={currentPath === shortcut.href ? 'page' : undefined}
                      title={shortcut.label}
                    >
                      <IonIcon icon={shortcut.icon} aria-hidden="true" />
                    </NavLink>
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * One highlight per menu area that slides to whichever item is active, so changing
 * page moves the highlight from the old item to the new one instead of jumping.
 * It's placed without moving the first time, and when the sidebar itself resizes.
 */
function useSlidingHighlight<T extends HTMLElement>(path: string, collapsed: boolean) {
  const areaRef = useRef<T>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const area = areaRef.current;
    const highlight = highlightRef.current;
    if (!area || !highlight) return;

    const place = (glide: boolean) => {
      const active = area.querySelector<HTMLElement>('.bl-sidenav--active');
      if (!active) {
        highlight.style.opacity = '0';
        return;
      }
      const box = area.getBoundingClientRect();
      const item = active.getBoundingClientRect();
      const still = !glide || !placed.current;
      if (still) highlight.style.transition = 'none';
      highlight.style.opacity = '1';
      highlight.style.width = `${item.width}px`;
      highlight.style.height = `${item.height}px`;
      highlight.style.transform = `translate(${item.left - box.left + area.scrollLeft}px, ${item.top - box.top + area.scrollTop}px)`;
      if (still) {
        highlight.getBoundingClientRect(); // apply the jump before turning the glide back on
        highlight.style.transition = '';
      }
      placed.current = true;
    };

    place(true);
    // A ResizeObserver reports once as soon as it starts; that first report isn't
    // a resize, and handling it would cancel the glide that just began.
    let started = false;
    const resized = new ResizeObserver(() => {
      if (!started) {
        started = true;
        return;
      }
      place(false);
    });
    resized.observe(area);
    return () => resized.disconnect();
  }, [path, collapsed]);

  return { areaRef, highlightRef };
}

export function DesktopSidebar({
  collapsed,
  onToggleCollapsed,
  alertCount,
  canToggle,
}: SidebarProps) {
  const { pathname } = useLocation();
  const history = useHistory();
  const { profile, activeBusiness, isManager, signOut } = useAuth();
  const onPlus = activeBusiness?.plan === 'plus';
  const navHighlight = useSlidingHighlight<HTMLElement>(pathname, collapsed);
  const footerHighlight = useSlidingHighlight<HTMLDivElement>(pathname, collapsed);

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

        <nav className="bl-sidebar__nav bl-scroll" ref={navHighlight.areaRef}>
          <span className="bl-sidenav-highlight" ref={navHighlight.highlightRef} aria-hidden="true" />
          <NavGroup
            title={t('Business')}
            items={primaryNav}
            collapsed={collapsed}
            alertCount={alertCount}
            currentPath={pathname}
          />
          <NavGroup
            title={t('Intelligence')}
            items={visibleNav(intelligenceNav, isManager)}
            collapsed={collapsed}
            alertCount={alertCount}
            currentPath={pathname}
          />
        </nav>

        <div className="bl-sidebar__footer" ref={footerHighlight.areaRef}>
          <span className="bl-sidenav-highlight" ref={footerHighlight.highlightRef} aria-hidden="true" />
          <NavGroup
            // The narrow icon rail has no room beside Profile or for the user card.
            items={collapsed ? [...accountNav, ...profileShortcuts, subscriptionNav] : accountNav}
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
                  {activeBusiness ? (
                    <>
                      <strong className={onPlus ? 'bl-sidebar__plan--plus' : undefined}>{onPlus ? t('Plus') : t('Free')}</strong>
                      {' · '}
                      {activeBusiness.name}
                    </>
                  ) : (
                    t('No business yet')
                  )}
                </span>
              </span>
              {activeBusiness && isManager && (
                <NavLink to="/subscription" className="bl-sidebar__upgrade">
                  {onPlus ? t('Manage') : t('Upgrade')}
                </NavLink>
              )}
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
