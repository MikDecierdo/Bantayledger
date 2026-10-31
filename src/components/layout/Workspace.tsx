import type { CSSProperties, ReactNode } from 'react';
import './Workspace.css';

/**
 * Page frame for desktop "fit" mode (>= 1024px wide and >= 640px tall): the
 * page fills the screen exactly and never scrolls. Header and summary rows
 * keep their natural height; the `Bento` grid takes whatever is left, and
 * long lists scroll inside their own cards (`<Card fill>`).
 *
 * Below that size it is a plain block and the page scrolls as before.
 */
export function Workspace({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['bl-ws', className ?? ''].filter(Boolean).join(' ')}>{children}</div>;
}

/**
 * 12-column grid that fills the rest of the page. Children set their width
 * with `bl-span-*` and, where a page needs it, rows via `style`.
 */
export function Bento({
  children,
  className,
  rows,
}: {
  children: ReactNode;
  className?: string;
  /** CSS grid-template-rows for desktop fit mode, e.g. "minmax(0,1fr) minmax(0,1fr)". */
  rows?: string;
}) {
  const style = rows ? ({ '--bl-bento-rows': rows } as CSSProperties) : undefined;
  return (
    <div className={['bl-bento', className ?? ''].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}

/** Column of stacked cards that share the column's height. */
export function Rail({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['bl-rail', className ?? ''].filter(Boolean).join(' ')}>{children}</div>;
}

/**
 * Small grid of labelled figures for a rail card (e.g. capital and profit):
 * lighter than a row of stat cards, two across.
 */
export function MiniStats({
  items,
}: {
  items: { label: string; value: string; foot?: string; tone?: 'brand' | 'danger' | 'warning' }[];
}) {
  return (
    <dl className="bl-ministats">
      {items.map((item) => (
        <div key={item.label} className="bl-ministats__item">
          <dt className="bl-label">{item.label}</dt>
          <dd className={`bl-ministats__value ${item.tone ? `bl-ministats__value--${item.tone}` : ''}`}>
            {item.value}
          </dd>
          {item.foot && <dd className="bl-caption bl-ministats__foot">{item.foot}</dd>}
        </div>
      ))}
    </dl>
  );
}

export default Workspace;
