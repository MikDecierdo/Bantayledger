import { IonIcon } from '@ionic/react';
import {
  alertCircle,
  arrowDown,
  arrowForward,
  arrowUp,
  checkmarkCircle,
  closeCircle,
  informationCircle,
  removeCircle,
  warning,
} from 'ionicons/icons';
import type { Severity, StockStatus, TrendDirection } from '../../types';
import { t } from '../../i18n';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

interface BadgeProps {
  tone: Tone;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}

/** Generic pill. Always renders an icon + text so meaning never relies on color. */
export function Badge({ tone, icon, children, className }: BadgeProps) {
  return (
    <span className={['bl-badge', `bl-badge--${tone}`, className ?? ''].filter(Boolean).join(' ')}>
      {icon && <IonIcon icon={icon} aria-hidden="true" />}
      {children}
    </span>
  );
}

const STOCK_META: Record<StockStatus, { tone: Tone; icon: string; label: string }> = {
  healthy: { tone: 'success', icon: checkmarkCircle, label: t('Enough') },
  low: { tone: 'warning', icon: warning, label: t('Low Stock') },
  critical: { tone: 'danger', icon: alertCircle, label: t('Almost out') },
  out: { tone: 'neutral', icon: closeCircle, label: t('Out of Stock') },
};

export function StatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  const meta = STOCK_META[status];
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={className}>
      {meta.label}
    </Badge>
  );
}

const SEVERITY_META: Record<Severity, { tone: Tone; icon: string; label: string }> = {
  critical: { tone: 'danger', icon: alertCircle, label: 'HIGH' },
  warning: { tone: 'warning', icon: warning, label: 'MEDIUM' },
  info: { tone: 'info', icon: informationCircle, label: 'WATCH' },
};

export function SeverityBadge({
  severity,
  label,
  className,
}: {
  severity: Severity;
  label?: string;
  className?: string;
}) {
  const meta = SEVERITY_META[severity];
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={className}>
      {label ?? meta.label}
    </Badge>
  );
}

/** Directional change indicator: arrow + signed value. */
export function TrendDelta({
  direction,
  children,
  label,
}: {
  direction: TrendDirection;
  children: React.ReactNode;
  /** Screen-reader clarification, e.g. "compared with yesterday". */
  label?: string;
}) {
  const icon =
    direction === 'up' ? arrowUp : direction === 'down' ? arrowDown : arrowForward;
  const word = direction === 'up' ? t('Increase') : direction === 'down' ? t('Decrease') : t('No change');

  return (
    <span className={`bl-delta bl-delta--${direction}`}>
      <IonIcon icon={icon} aria-hidden="true" />
      {children}
      <span className="bl-sr-only">
        {word}
        {label ? ` ${label}` : ''}
      </span>
    </span>
  );
}

/** Maps a percentage change to a trend direction (flat within ±0.5%). */
export function directionFromPct(pct: number): TrendDirection {
  if (pct > 0.5) return 'up';
  if (pct < -0.5) return 'down';
  return 'flat';
}

/**
 * For costs and expenses, an increase is unfavourable. This flips the visual
 * tone without changing the arrow direction.
 */
export function CostDelta({ pct, label }: { pct: number; label?: string }) {
  const dir = directionFromPct(pct);
  const tone = dir === 'up' ? 'down' : dir === 'down' ? 'up' : 'flat';
  const icon = dir === 'up' ? arrowUp : dir === 'down' ? arrowDown : arrowForward;
  return (
    <span className={`bl-delta bl-delta--${tone}`}>
      <IonIcon icon={icon} aria-hidden="true" />
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)}%
      <span className="bl-sr-only">
        {dir === 'up' ? t('Higher') : dir === 'down' ? t('Lower') : t('Unchanged')}
        {label ? ` ${label}` : ''}
      </span>
    </span>
  );
}

export const trendIcons = { up: arrowUp, down: arrowDown, flat: removeCircle };
