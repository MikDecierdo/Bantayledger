import './Logo.css';
import { t } from '../../i18n';

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * BantayLedger mark — a storekeeper checking stock and forecasts against a
 * shelf of goods, cropped to a circle. The source art is already a
 * self-contained badge (its own background and border), so this just sizes
 * and crops it — no color/appearance variants needed the way the old
 * hand-drawn SVG mark had.
 */
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  return (
    <img
      src="/brand-logo.png"
      width={size}
      height={size}
      alt=""
      className={['bl-logo__mark', className ?? ''].filter(Boolean).join(' ')}
    />
  );
}

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** Hide the wordmark (used by the compact tablet rail). */
  markOnly?: boolean;
  /** Light text for use on dark/green surfaces. */
  inverse?: boolean;
  /** Wordmark below the mark instead of beside it. */
  stacked?: boolean;
  className?: string;
}

const MARK_SIZE: Record<NonNullable<LogoProps['size']>, number> = {
  sm: 28,
  md: 34,
  lg: 48,
};

export function Logo({
  size = 'md',
  markOnly = false,
  inverse = false,
  stacked = false,
  className,
}: LogoProps) {
  return (
    <span
      className={[
        'bl-logo',
        `bl-logo--${size}`,
        inverse ? 'bl-logo--inverse' : '',
        stacked ? 'bl-logo--stacked' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <LogoMark size={MARK_SIZE[size]} />
      {!markOnly && (
        <span className="bl-logo__text">
          <span className="bl-logo__name">
            {t('BantayLedger')}<span className="bl-logo__ai">&nbsp;AI</span>
          </span>
          <span className="bl-logo__tagline">{t('Business & forecast tracker')}</span>
        </span>
      )}
      <span className="bl-sr-only">{t('BantayLedger AI')}</span>
    </span>
  );
}

export default Logo;
