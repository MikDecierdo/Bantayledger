import type { SeriesPoint } from '../../types';
import './charts.css';

interface BarListProps {
  data: SeriesPoint[];
  format: (value: number) => string;
  /** Show each item's share of the total beside its value. */
  showShare?: boolean;
  max?: number;
}

/**
 * Ranked horizontal bars for category breakdowns.
 *
 * Bar length already encodes magnitude, so every bar uses the same green —
 * shading by rank would encode the same fact twice.
 */
export function BarList({ data, format, showShare = true, max }: BarListProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const scaleMax = max ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="bl-barlist">
      {data.map((d) => {
        const share = (d.value / total) * 100;
        return (
          <li className="bl-barlist__row" key={d.label}>
            <div className="bl-barlist__head">
              <span className="bl-barlist__label bl-truncate">{d.label}</span>
              <span className="bl-barlist__value">
                {format(d.value)}
                {showShare && <span className="bl-barlist__pct">{share.toFixed(0)}%</span>}
              </span>
            </div>
            <div
              className="bl-meter"
              role="meter"
              aria-valuenow={Math.round(d.value)}
              aria-valuemin={0}
              aria-valuemax={Math.round(scaleMax)}
              aria-label={`${d.label}: ${format(d.value)}`}
            >
              <div
                className="bl-meter__fill"
                style={{ width: `${Math.max((d.value / scaleMax) * 100, 2)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default BarList;
