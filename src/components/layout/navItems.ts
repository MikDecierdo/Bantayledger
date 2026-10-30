import {
  bagOutline,
  barChartOutline,
  bulbOutline,
  cartOutline,
  cubeOutline,
  homeOutline,
  logOutOutline,
  notificationsOutline,
  peopleOutline,
  personOutline,
  settingsOutline,
  trashOutline,
  trendingUpOutline,
  walletOutline,
} from 'ionicons/icons';
import { t } from '../../i18n';

export interface NavItem {
  label: string;
  /** Shorter label for the bottom bar, where space is tight. */
  shortLabel?: string;
  href: string;
  icon: string;
  /** Renders the unread-alert count. */
  badgeKey?: 'alerts';
}

/** Grouped sidebar navigation for tablet and desktop. */
export const primaryNav: NavItem[] = [
  { label: t('Dashboard'), href: '/dashboard', icon: homeOutline },
  { label: t('Inventory'), href: '/inventory', icon: cubeOutline },
  { label: t('Sales'), href: '/sales', icon: cartOutline },
  { label: t('Purchases'), href: '/purchases', icon: bagOutline },
  { label: t('Suppliers'), href: '/suppliers', icon: peopleOutline },
  { label: t('Expenses'), href: '/expenses', icon: walletOutline },
  { label: t('Spoiled & Damaged'), href: '/waste', icon: trashOutline },
];

export const intelligenceNav: NavItem[] = [
  { label: t('Forecast'), href: '/forecast', icon: trendingUpOutline },
  { label: t('AI Insights'), href: '/ai-insights', icon: bulbOutline },
  { label: t('Alerts'), href: '/alerts', icon: notificationsOutline, badgeKey: 'alerts' },
  { label: t('Reports'), href: '/reports', icon: barChartOutline },
];

export const accountNav: NavItem[] = [
  { label: t('Profile'), href: '/profile', icon: personOutline },
  { label: t('Settings'), href: '/settings', icon: settingsOutline },
];

export const logoutItem = { label: t('Logout'), href: '/login', icon: logOutOutline };

/** Five destinations only — the bottom bar stays tappable. */
export const bottomNav: NavItem[] = [
  { label: t('Home'), href: '/dashboard', icon: homeOutline },
  { label: t('Inventory'), href: '/inventory', icon: cubeOutline },
  { label: t('Forecast'), href: '/forecast', icon: trendingUpOutline },
  { label: t('Alerts'), href: '/alerts', icon: notificationsOutline, badgeKey: 'alerts' },
  { label: t('Profile'), href: '/profile', icon: personOutline },
];

/** Reachable on mobile through the "More" sheet rather than the bottom bar. */
export const moreNav: NavItem[] = [
  ...primaryNav.filter((i) => !['/dashboard', '/inventory'].includes(i.href)),
  { label: t('AI Insights'), href: '/ai-insights', icon: bulbOutline },
  { label: t('Reports'), href: '/reports', icon: barChartOutline },
  { label: t('Settings'), href: '/settings', icon: settingsOutline },
];

const ALL = [...primaryNav, ...intelligenceNav, ...accountNav];

/** Page title used by the mobile header, matched on the longest prefix. */
export function titleForPath(path: string): string {
  if (path.startsWith('/inventory/')) return t('Product Details');
  const match = ALL.find((i) => i.href === path);
  return match?.label ?? t('BantayLedger AI');
}
