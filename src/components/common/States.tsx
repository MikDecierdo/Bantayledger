import { IonIcon } from '@ionic/react';
import { cloudOfflineOutline, refreshOutline } from 'ionicons/icons';
import type { ReactNode } from 'react';
import Button from './Button';
import './States.css';
import { t } from '../../i18n';

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`bl-state ${compact ? 'bl-state--compact' : ''}`}>
      <span className="bl-state__icon" aria-hidden="true">
        <IonIcon icon={icon} />
      </span>
      <h3 className="bl-state__title">{title}</h3>
      <p className="bl-state__desc">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" icon={actionIcon} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Error state                                                                */
/* -------------------------------------------------------------------------- */

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  title = t('Something went wrong'),
  description = t('We could not load this information right now. Please try again.'),
  onRetry,
  compact = false,
}: ErrorStateProps) {
  return (
    <div className={`bl-state bl-state--error ${compact ? 'bl-state--compact' : ''}`} role="alert">
      <span className="bl-state__icon" aria-hidden="true">
        <IonIcon icon={cloudOfflineOutline} />
      </span>
      <h3 className="bl-state__title">{title}</h3>
      <p className="bl-state__desc">{description}</p>
      {onRetry && (
        <Button variant="secondary" icon={refreshOutline} onClick={onRetry}>
          {t('Try Again')}
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading states                                                             */
/* -------------------------------------------------------------------------- */

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={['bl-skeleton', className ?? ''].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, width = '100%' }: { lines?: number; width?: string }) {
  return (
    <span className="bl-skeleton-text" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '62%' : width} />
      ))}
    </span>
  );
}

export function SkeletonCard({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div className="bl-card bl-skeleton-card" style={height ? { minHeight: height } : undefined}>
      <Skeleton width={110} height={11} />
      <Skeleton width="55%" height={26} />
      <SkeletonText lines={lines} />
    </div>
  );
}

export function SkeletonGrid({ count = 4, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <div className="bl-skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bl-card bl-card--flush bl-skeleton-rows">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="bl-skeleton-row" key={i}>
          <Skeleton width={38} height={38} radius={10} />
          <div className="bl-skeleton-row__body">
            <Skeleton width="42%" height={13} />
            <Skeleton width="26%" height={11} />
          </div>
          <Skeleton width={70} height={13} />
        </div>
      ))}
    </div>
  );
}

/**
 * Announces loading to assistive technology while skeletons render visually.
 */
export function LoadingState({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="bl-sr-only">{label}</span>
      {children}
    </div>
  );
}
