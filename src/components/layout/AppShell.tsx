import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { dataService } from '../../services/dataService';
import { apiFetch } from '../../services/api/client';
import { startOfflineSync } from '../../services/offline/sync';
import DesktopSidebar from './DesktopSidebar';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import OfflineBar from './OfflineBar';
import './AppShell.css';
import { t } from '../../i18n';

interface AppShellProps {
  children: ReactNode;
}

/**
 * Responsive frame around every authenticated page.
 *
 * - < 768px  : sticky top bar + fixed bottom navigation
 * - 768–1023 : icon rail (collapsed sidebar) + top bar
 * - >= 1024px : full sidebar
 */
export function AppShell({ children }: AppShellProps) {
  const { isTablet, isDesktop } = useBreakpoint();
  const { pathname } = useLocation();
  const { activeBusiness } = useAuth();
  const [userCollapsed, setUserCollapsed] = useState(false);

  // Re-read on navigation, and once the active business is ready, so
  // dismissing an alert updates the badge and a fresh signup doesn't show a
  // stale count.
  const { data: counts } = useAsyncData(
    () => dataService.getAlertCounts(),
    [pathname, activeBusiness?.id],
  );
  const unreadAlerts = counts?.unread ?? 0;

  // Tablets always use the rail; desktop respects the user's preference.
  const collapsed = isTablet || (isDesktop && userCollapsed);
  const showSidebar = isTablet || isDesktop;

  // Wake the server early (the free host sleeps when idle) and start sending
  // anything recorded while offline.
  useEffect(() => {
    void apiFetch('/health').catch(() => undefined);
    startOfflineSync();
  }, []);

  // Land at the top of each new page rather than mid-scroll.
  useEffect(() => {
    document.getElementById('bl-main')?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div
      className={[
        'bl-shell',
        showSidebar ? 'bl-shell--sidebar' : '',
        collapsed ? 'bl-shell--collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <a className="bl-skip-link" href="#bl-main">
        {t('Skip to main content')}
      </a>

      {showSidebar && (
        <DesktopSidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setUserCollapsed((c) => !c)}
          alertCount={unreadAlerts}
          canToggle={isDesktop}
        />
      )}

      <div className="bl-shell__body">
        {/* Phones only — the rail plus the page's own H1 cover tablet and up. */}
        {!showSidebar && <MobileHeader alertCount={unreadAlerts} />}
        <OfflineBar />

        <main className="bl-shell__main bl-scroll" id="bl-main" tabIndex={-1}>
          <div className="bl-container">{children}</div>
        </main>
      </div>

      {!showSidebar && <MobileBottomNav alertCount={unreadAlerts} />}
    </div>
  );
}

export default AppShell;
