import type { ReactNode } from 'react';
import './charts.css';
import { t } from '../../i18n';

interface LegendItem {
  label: string;
  color: string;
  /** `dashed` renders the swatch as a dashed rule, matching the plotted line. */
  style?: 'solid' | 'dashed' | 'band';
}

interface ChartFrameProps {
  /** Describes the chart for screen readers, replacing the visual plot. */
  summary: string;
  legend?: LegendItem[];
  /** Accessible table alternative, revealed by the "View data" toggle. */
  table?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a plot with its legend, screen-reader summary and data-table fallback,
 * so every chart in the app carries the same accessibility affordances.
 */
export function ChartFrame({ summary, legend, table, children, className }: ChartFrameProps) {
  return (
    <figure className={['bl-chart', className ?? ''].filter(Boolean).join(' ')}>
      {legend && legend.length > 0 && (
        <ul className="bl-chart__legend">
          {legend.map((item) => (
            <li key={item.label} className="bl-chart__legend-item">
              <span
                className={`bl-chart__swatch bl-chart__swatch--${item.style ?? 'solid'}`}
                style={{ color: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      )}

      <div className="bl-chart__plot" role="img" aria-label={summary}>
        {children}
      </div>

      {table && (
        <details className="bl-chart__data">
          <summary>{t('View data')}</summary>
          <div className="bl-table-wrap bl-scroll">{table}</div>
        </details>
      )}
    </figure>
  );
}

/** Compact table used as the data fallback under charts. */
export function ChartTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="bl-table bl-chart__table">
      <caption className="bl-sr-only">{caption}</caption>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={h} scope="col" className={i === 0 ? '' : 'bl-td-num'}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) =>
              ci === 0 ? (
                <th key={ci} scope="row" className="bl-table__primary">
                  {cell}
                </th>
              ) : (
                <td key={ci} className="bl-td-num">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface TooltipProps {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; color?: string }[];
  containerWidth: number;
}

/** Positioned hover card, flipped near the right edge so it never overflows. */
export function ChartTooltip({ x, y, title, rows, containerWidth }: TooltipProps) {
  const flip = x > containerWidth - 130;
  return (
    <div
      className={`bl-chart__tip ${flip ? 'bl-chart__tip--flip' : ''}`}
      style={{ left: x, top: y }}
    >
      <span className="bl-chart__tip-title">{title}</span>
      {rows.map((row) => (
        <span className="bl-chart__tip-row" key={row.label}>
          {row.color && (
            <span className="bl-chart__tip-dot" style={{ background: row.color }} aria-hidden="true" />
          )}
          <span className="bl-chart__tip-label">{row.label}</span>
          <span className="bl-chart__tip-value">{row.value}</span>
        </span>
      ))}
    </div>
  );
}

export default ChartFrame;
