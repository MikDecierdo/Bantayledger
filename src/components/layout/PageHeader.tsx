import type { ReactNode } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary action and any secondary controls. */
  actions?: ReactNode;
  /** Rendered above the title — breadcrumbs, status badges. */
  eyebrow?: ReactNode;
  /**
   * Suppresses the description on phones. Use where the page already shows an
   * equivalent line of its own (the dashboard greeting, for example).
   */
  hideDescriptionOnMobile?: boolean;
}

/**
 * Desktop page header. On phones the title lives in the sticky top bar, so this
 * hides its heading there and keeps only the description and actions.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  hideDescriptionOnMobile = false,
}: PageHeaderProps) {
  return (
    <div className="bl-pageheader">
      <div className="bl-pageheader__text">
        {eyebrow && <div className="bl-pageheader__eyebrow">{eyebrow}</div>}
        <h1 className="bl-page-title bl-pageheader__title">{title}</h1>
        {description && (
          <p
            className={`bl-support bl-pageheader__desc ${
              hideDescriptionOnMobile ? 'bl-hide-mobile' : ''
            }`}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="bl-pageheader__actions">{actions}</div>}
    </div>
  );
}

export default PageHeader;
