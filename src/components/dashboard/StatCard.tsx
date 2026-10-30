import { IonIcon } from '@ionic/react';
import type { ReactNode } from 'react';
import { chevronForwardOutline } from 'ionicons/icons';
import { Link } from 'react-router-dom';
import { Sparkline } from '../charts/Sparkline';
import { CostDelta, TrendDelta, directionFromPct } from '../common/StatusBadge';
import './StatCard.css';
import { t } from '../../i18n';

interface StatCardProps {
  label: string;
  value: string;
  /** Signed percentage change; omit when there is no comparison period. */
  changePct?: number;
  /** Context for the change, e.g. "vs yesterday". */
  changeLabel?: string;
  /** Inverts the tone so a rising cost reads as unfavourable. */
  invertDelta?: boolean;
  /** `hero` is the single most important figure; `plain` is a supporting count. */
  emphasis?: 'hero' | 'default' | 'plain';
  icon?: string;
  tone?: 'brand' | 'warning' | 'danger' | 'info' | 'neutral';
  /** Small trend history rendered as a sparkline. */
  spark?: number[];
  /** Makes the whole card a link. */
  href?: string;
  /** Extra line under the value, e.g. "3 need reordering". */
  footnote?: string;
  /** Brand artwork shown top-right in place of the small icon. */
  logo?: ReactNode;
  /** Tints the card to match a payment method. */
  accent?: 'gcash' | 'cash';
}

/**
 * KPI tile. Hierarchy is deliberate: the hero card carries the headline figure
 * at a larger size, while counts render plainly so the row is not four
 * identical boxes competing for attention.
 */
export function StatCard({
  label,
  value,
  changePct,
  changeLabel,
  invertDelta = false,
  emphasis = 'default',
  icon,
  tone = 'brand',
  spark,
  href,
  footnote,
  logo,
  accent,
}: StatCardProps) {
  const body = (
    <>
      <div className="bl-stat__top">
        <span className="bl-label bl-stat__label">{label}</span>
        {logo ? (
          <span className="bl-stat__logo">{logo}</span>
        ) : (
          icon && (
          <span className={`bl-stat__icon bl-stat__icon--${tone}`} aria-hidden="true">
            <IonIcon icon={icon} />
          </span>
          )
        )}
      </div>

      <div className="bl-stat__value-row">
        <span className={`bl-stat__value ${emphasis === 'hero' ? 'bl-stat__value--hero' : ''}`}>
          {value}
        </span>
        {spark && spark.length > 1 && (
          <Sparkline
            values={spark}
            /* The hero tile sits on green, so its trend line needs a light stroke. */
            color={emphasis === 'hero' ? '#A8E4C6' : undefined}
            label={t('{{label}} trend over the recent period', { label })}
          />
        )}
      </div>

      {(typeof changePct === 'number' || footnote) && (
        <div className="bl-stat__foot">
          {typeof changePct === 'number' &&
            (invertDelta ? (
              <CostDelta pct={changePct} label={changeLabel} />
            ) : (
              <TrendDelta direction={directionFromPct(changePct)} label={changeLabel}>
                {changePct > 0 ? '+' : ''}
                {changePct.toFixed(1)}%
              </TrendDelta>
            ))}
          {changeLabel && typeof changePct === 'number' && (
            <span className="bl-caption">{changeLabel}</span>
          )}
          {footnote && <span className="bl-caption">{footnote}</span>}
          {href && (
            <IonIcon icon={chevronForwardOutline} className="bl-stat__chev" aria-hidden="true" />
          )}
        </div>
      )}
    </>
  );

  const className = [
    'bl-card',
    'bl-stat',
    `bl-stat--${emphasis}`,
    accent ? `bl-stat--${accent}` : '',
    href ? 'bl-stat--link' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (href) {
    return (
      <Link to={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export default StatCard;
