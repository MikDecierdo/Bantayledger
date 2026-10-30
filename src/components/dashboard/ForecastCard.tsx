import { IonIcon } from '@ionic/react';
import { arrowForwardOutline } from 'ionicons/icons';
import { Link } from 'react-router-dom';
import type { DemandForecast, PriceForecast, PurchasingCostForecast } from '../../types';
import { number, peso } from '../../utils/format';
import { Badge, CostDelta, TrendDelta } from '../common/StatusBadge';
import './ForecastCard.css';
import { t } from '../../i18n';

/** Confidence shown as a labelled meter rather than a bare percentage. */
function ConfidenceMeter({ value }: { value: number }) {
  const tone = value >= 80 ? '' : value >= 70 ? 'bl-meter__fill--muted' : 'bl-meter__fill--warning';
  return (
    <div className="bl-fc__confidence">
      <div className="bl-fc__confidence-head">
        <span className="bl-caption">{t('How sure we are')}</span>
        <span className="bl-fc__confidence-value">{value}%</span>
      </div>
      <div
        className="bl-meter"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('How sure we are: {{value}} percent', { value })}
      >
        <div className={`bl-meter__fill ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function DemandForecastCard({ forecast }: { forecast: DemandForecast }) {
  const shortfall = forecast.forecastQuantity - forecast.currentStock;

  return (
    <article className="bl-card bl-fc">
      <header className="bl-fc__head">
        <div className="bl-fc__head-text">
          <h3 className="bl-card-title">{forecast.productName}</h3>
          <p className="bl-caption">Next {forecast.horizonDays} days</p>
        </div>
        {shortfall > 0 ? (
          <Badge tone="warning">Short by {number(shortfall)}</Badge>
        ) : (
          <Badge tone="success">{t('Stock is sufficient')}</Badge>
        )}
      </header>

      <div className="bl-fc__metric">
        <span className="bl-metric">
          {number(forecast.forecastQuantity)}
          <span className="bl-fc__unit"> {forecast.unit}</span>
        </span>
        <p className="bl-caption">
          {t('Expected range {{low}}–{{high}} {{unit}}', {
            low: number(forecast.rangeLow),
            high: number(forecast.rangeHigh),
            unit: forecast.unit,
          })}
        </p>
      </div>

      <dl className="bl-fc__facts">
        <div>
          <dt>{t('On hand')}</dt>
          <dd>
            {number(forecast.currentStock)} {forecast.unit}
          </dd>
        </div>
        <div>
          <dt>{t('Sold per day')}</dt>
          <dd>{number(forecast.averageDailyDemand)}</dd>
        </div>
        <div>
          <dt>{t('Days of stock left')}</dt>
          <dd>{number(forecast.daysOfCover)}</dd>
        </div>
      </dl>

      <ConfidenceMeter value={forecast.confidence} />

      <Link to={`/inventory/${forecast.productId}`} className="bl-fc__link">
        {t('View product')}
        <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
      </Link>
    </article>
  );
}

/* -------------------------------------------------------------------------- */

export function PriceForecastCard({ forecast }: { forecast: PriceForecast }) {
  const label =
    forecast.trend === 'up' ? t('Increasing') : forecast.trend === 'down' ? t('Decreasing') : t('Stable');

  return (
    <article className="bl-card bl-fc">
      <header className="bl-fc__head">
        <div className="bl-fc__head-text">
          <h3 className="bl-card-title">{forecast.productName}</h3>
          <p className="bl-caption">{forecast.supplierName}</p>
        </div>
        <Badge tone={forecast.trend === 'up' ? 'warning' : forecast.trend === 'down' ? 'success' : 'neutral'}>
          {label}
        </Badge>
      </header>

      <div className="bl-fc__pricerow">
        <div className="bl-fc__price">
          <span className="bl-label">{t('Current')}</span>
          <span className="bl-fc__price-value">{peso(forecast.currentPrice)}</span>
        </div>
        <IonIcon icon={arrowForwardOutline} className="bl-fc__arrow" aria-hidden="true" />
        <div className="bl-fc__price bl-fc__price--estimate">
          <span className="bl-label">{t('Estimated')}</span>
          <span className="bl-fc__price-value">
            {peso(forecast.estimatedLow)}–{peso(forecast.estimatedHigh)}
          </span>
        </div>
      </div>

      <div className="bl-fc__pricefoot">
        <span className="bl-caption">
          {t('Average estimate')}{' '}<strong>{peso(forecast.estimatedAverage)}</strong>
        </span>
        <CostDelta pct={forecast.changePct} label={t('in supplier price')} />
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */

export function CostForecastCard({ forecast }: { forecast: PurchasingCostForecast }) {
  const higher = forecast.difference > 0;

  return (
    <article className="bl-card bl-fc bl-fc--cost">
      <header className="bl-fc__head">
        <div className="bl-fc__head-text">
          <h3 className="bl-card-title">{forecast.productName}</h3>
          <p className="bl-caption">{t('Estimated next purchase')}</p>
        </div>
      </header>

      {/* The calculation is shown in full so the number is checkable. */}
      <div className="bl-fc__calc">
        <div className="bl-fc__calc-part">
          <span className="bl-caption">{t('Expected sales')}</span>
          <span className="bl-fc__calc-value">
            {number(forecast.forecastDemand)} {forecast.unit}
          </span>
        </div>
        <span className="bl-fc__calc-op" aria-hidden="true">
          ×
        </span>
        <div className="bl-fc__calc-part">
          <span className="bl-caption">{t('Est. unit price')}</span>
          <span className="bl-fc__calc-value">{peso(forecast.estimatedUnitPrice, true)}</span>
        </div>
      </div>

      <div className="bl-fc__total">
        <span className="bl-label">{t('Estimated purchasing cost')}</span>
        <span className="bl-metric">{peso(forecast.estimatedCost)}</span>
      </div>

      <div className="bl-fc__compare">
        <div className="bl-kv__item">
          <span className="bl-kv__k">{t('Previous purchase')}</span>
          <span className="bl-kv__v">{peso(forecast.previousCost)}</span>
        </div>
        <div className="bl-kv__item">
          <span className="bl-kv__k">{t('Difference')}</span>
          <span className="bl-kv__v">
            <span className={higher ? 'bl-fc__diff bl-fc__diff--up' : 'bl-fc__diff bl-fc__diff--down'}>
              {higher ? '+' : '-'}
              {peso(Math.abs(forecast.difference))}
            </span>
          </span>
        </div>
      </div>

      <p className="bl-fc__note">
        {higher
          ? t('Budget about {{amount}} more than last time.', { amount: peso(Math.abs(forecast.difference)) })
          : t('You may spend about {{amount}} less than last time.', { amount: peso(Math.abs(forecast.difference)) })}
      </p>
    </article>
  );
}

/** Small inline forecast summary used on the product detail page. */
export function ForecastStat({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: { pct: number; invert?: boolean };
}) {
  return (
    <div className="bl-fc__stat">
      <span className="bl-label">{label}</span>
      <span className="bl-fc__stat-value">{value}</span>
      {sub && <span className="bl-caption">{sub}</span>}
      {delta &&
        (delta.invert ? (
          <CostDelta pct={delta.pct} />
        ) : (
          <TrendDelta direction={delta.pct > 0.5 ? 'up' : delta.pct < -0.5 ? 'down' : 'flat'}>
            {delta.pct > 0 ? '+' : ''}
            {delta.pct.toFixed(1)}%
          </TrendDelta>
        ))}
    </div>
  );
}
