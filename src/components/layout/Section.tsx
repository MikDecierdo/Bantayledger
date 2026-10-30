import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  description?: string;
  /** Right-aligned controls: filters, "View all" links. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Renders the heading at h2 (default) or h3 for nested sections. */
  as?: 'h2' | 'h3';
}

/** Titled block used to group related content on every page. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  as: Heading = 'h2',
}: SectionProps) {
  return (
    <section className={['bl-section', className ?? ''].filter(Boolean).join(' ')}>
      <div className="bl-section__head">
        <div>
          <Heading className="bl-section-title">{title}</Heading>
          {description && <p className="bl-caption">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Card with an optional heading row — the most common container in the app. */
export function Card({
  title,
  description,
  action,
  children,
  className,
  padding = 'normal',
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: 'normal' | 'tight' | 'none';
}) {
  return (
    <div
      className={[
        'bl-card',
        padding === 'tight' ? 'bl-card--tight' : '',
        padding === 'none' ? 'bl-card--flush' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {(title || action) && (
        <div className="bl-card__header">
          <div className="bl-card__header-text">
            {title && <h3 className="bl-card-title">{title}</h3>}
            {description && <p className="bl-caption">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export default Section;
