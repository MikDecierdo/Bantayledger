import { IonIcon } from '@ionic/react';
import { chevronForwardOutline, ellipseOutline } from 'ionicons/icons';
import { Link } from 'react-router-dom';
import type { Alert } from '../../types';
import { relativeTime } from '../../utils/format';
import { SeverityBadge } from '../common/StatusBadge';
import './AlertCard.css';
import { t } from '../../i18n';

interface AlertCardProps {
  alert: Alert;
  /** Hides the body text for the dashboard's condensed list. */
  compact?: boolean;
}

/** Compact alert row: severity badge, headline, and the reason underneath. */
export function AlertCard({ alert, compact = false }: AlertCardProps) {
  const content = (
    <>
      <div className="bl-alertcard__top">
        <SeverityBadge severity={alert.severity} label={alert.level} />
        <span className="bl-alertcard__meta">
          {!alert.read && (
            <span className="bl-alertcard__unread">
              <IonIcon icon={ellipseOutline} aria-hidden="true" />
              <span className="bl-sr-only">{t('Unread.')}{' '}</span>
            </span>
          )}
          <span className="bl-caption">{alert.category}</span>
          <span className="bl-alertcard__sep" aria-hidden="true">
            ·
          </span>
          <span className="bl-caption">{relativeTime(alert.createdAt)}</span>
        </span>
      </div>

      <p className="bl-alertcard__title">{alert.title}</p>
      {!compact && <p className="bl-alertcard__detail">{alert.detail}</p>}

      {alert.productId && (
        <span className="bl-alertcard__link">
          {t('View product')}
          <IonIcon icon={chevronForwardOutline} aria-hidden="true" />
        </span>
      )}
    </>
  );

  const className = `bl-card bl-alertcard bl-alertcard--${alert.severity} ${
    compact ? 'bl-alertcard--compact' : ''
  }`;

  if (alert.productId) {
    return (
      <Link to={`/inventory/${alert.productId}`} className={`${className} bl-alertcard--link`}>
        {content}
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
}

export default AlertCard;
