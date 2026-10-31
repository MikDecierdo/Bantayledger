import { IonIcon } from '@ionic/react';
import { addOutline, gridOutline } from 'ionicons/icons';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import MoreSheet from './MoreSheet';
import QuickAddSheet from './QuickAddSheet';
import { bottomNav, moreGroups, type NavItem } from './navItems';
import './MobileBottomNav.css';
import { t } from '../../i18n';

interface MobileBottomNavProps {
  alertCount: number;
}

/**
 * Fixed bottom bar: Home · Sales · ( + ) · Inventory · More. The raised "+"
 * opens Quick add (record a sale, an expense, a purchase…); "More" opens a
 * sheet with every other page, Profile, Settings and Logout.
 */
export function MobileBottomNav({ alertCount }: MobileBottomNavProps) {
  const { pathname } = useLocation();
  // A sheet belongs to the page it was opened on, so moving to another page
  // closes it.
  const [sheet, setSheet] = useState<{ kind: 'more' | 'add'; on: string } | null>(null);
  const moreOpen = sheet?.kind === 'more' && sheet.on === pathname;
  const addOpen = sheet?.kind === 'add' && sheet.on === pathname;

  const inMore = moreGroups.some((g) =>
    g.items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)),
  );

  const link = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <li key={item.href}>
        <NavLink
          to={item.href}
          className={`bl-bottomnav__item ${active ? 'bl-bottomnav__item--active' : ''}`}
          aria-current={active ? 'page' : undefined}
        >
          <span className="bl-bottomnav__icon-wrap">
            <IonIcon icon={item.icon} className="bl-bottomnav__icon" aria-hidden="true" />
          </span>
          <span className="bl-bottomnav__label">{item.shortLabel ?? item.label}</span>
        </NavLink>
      </li>
    );
  };

  return (
    <nav className="bl-bottomnav" aria-label={t('Primary')}>
      <ul>
        {bottomNav.slice(0, 2).map(link)}
        <li className="bl-bottomnav__center">
          <button
            type="button"
            className="bl-bottomnav__add"
            aria-haspopup="dialog"
            aria-expanded={addOpen}
            aria-label={t('Quick add')}
            onClick={() => setSheet({ kind: 'add', on: pathname })}
          >
            <IonIcon icon={addOutline} aria-hidden="true" />
          </button>
        </li>
        {bottomNav.slice(2).map(link)}
        <li>
          <button
            type="button"
            className={`bl-bottomnav__item ${inMore || moreOpen ? 'bl-bottomnav__item--active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setSheet({ kind: 'more', on: pathname })}
          >
            <span className="bl-bottomnav__icon-wrap">
              <IonIcon icon={gridOutline} className="bl-bottomnav__icon" aria-hidden="true" />
              {alertCount > 0 && <span className="bl-bottomnav__dot" aria-hidden="true" />}
            </span>
            <span className="bl-bottomnav__label">{t('More')}</span>
          </button>
        </li>
      </ul>
      <QuickAddSheet isOpen={addOpen} onClose={() => setSheet(null)} />
      <MoreSheet isOpen={moreOpen} onClose={() => setSheet(null)} alertCount={alertCount} />
    </nav>
  );
}

export default MobileBottomNav;
