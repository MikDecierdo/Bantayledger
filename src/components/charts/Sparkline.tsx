import { CHART, linePath, linearScale } from './chartUtils';
import './charts.css';

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Describes the trend for screen readers; the plot itself is decorative. */
  label: string;
}

/** Tiny inline trend indicator for stat cards and table rows. */
export function Sparkline({
  values,
  width = 84,
  height = 28,
  color = CHART.primary,
  label,
}: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = linearScale([0, values.length - 1], [1, width - 1]);
  const y = linearScale([min === max ? min - 1 : min, max], [height - 3, 3]);
  const points = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const last = points[points.length - 1];

  return (
    <svg
      className="bl-spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <path
        d={linePath(points)}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The end point is ringed in the surface color so it reads on any ground. */}
      <circle cx={last.x} cy={last.y} r={3} fill={color} stroke="none" />
    </svg>
  );
}

export default Sparkline;
