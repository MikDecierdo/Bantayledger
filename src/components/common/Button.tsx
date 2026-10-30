import { IonIcon } from '@ionic/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Ionicon imported from `ionicons/icons`. */
  icon?: string;
  iconPosition?: 'start' | 'end';
  block?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'start',
  block = false,
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconOnly = !children && !!icon;

  return (
    <button
      type="button"
      className={[
        'bl-btn',
        `bl-btn--${variant}`,
        size !== 'md' ? `bl-btn--${size}` : '',
        block ? 'bl-btn--block' : '',
        iconOnly ? 'bl-btn--icon-only' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="bl-btn__spinner" aria-hidden="true" />
      ) : (
        icon &&
        iconPosition === 'start' && <IonIcon icon={icon} className="bl-btn__icon" aria-hidden="true" />
      )}
      {children}
      {!loading && icon && iconPosition === 'end' && (
        <IonIcon icon={icon} className="bl-btn__icon" aria-hidden="true" />
      )}
    </button>
  );
}

export default Button;
