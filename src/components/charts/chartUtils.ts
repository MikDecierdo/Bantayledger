/**
 * Chart primitives shared by every visualization.
 *
 * Colors: one green carries the main measure. Where two independent measures
 * share a plot, the second uses amber — that pair passes CVD separation
 * (ΔE 12.4 protan) and 3:1 contrast, and is always paired with a legend and a
 * distinct line style so identity is never carried by color alone.
 */

export const CHART = {
  /** Primary measure. */
  primary: '#1F6F5B',
  /** Second independent measure (legend + dash pattern always accompany it). */
  secondary: '#B97818',
  /** Forecast portion of the same measure as `primary`. */
  forecast: '#6FB296',
  /** Confidence band fill. */
  band: 'rgba(111, 178, 150, 0.22)',
  areaTop: 'rgba(31, 111, 91, 0.16)',
  areaBottom: 'rgba(31, 111, 91, 0.01)',
  grid: '#E4EBE7',
  axis: '#718078',
  surface: '#FFFFFF',
  danger: '#C54B4B',
  info: '#437B8F',
} as const;

export interface Scale {
  (value: number): number;
}

/** Linear scale from a data domain to a pixel range. */
export function linearScale(
  domain: [number, number],
  range: [number, number],
): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/**
 * Rounded "nice" upper bound so the y-axis lands on readable ticks.
 */
export function niceMax(max: number, ticks = 4): number {
  if (max <= 0) return ticks;
  const rough = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag * ticks;
}

export function tickValues(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

/** Straight-segment path through points. */
export function linePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}

/** Line path closed to a baseline, for area fills. */
export function areaPath(points: { x: number; y: number }[], baseline: number): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L${last.x.toFixed(2)} ${baseline.toFixed(2)} L${first.x.toFixed(
    2,
  )} ${baseline.toFixed(2)} Z`;
}

/** Band path between an upper and lower series. */
export function bandPath(
  upper: { x: number; y: number }[],
  lower: { x: number; y: number }[],
): string {
  if (upper.length === 0) return '';
  const down = [...lower].reverse();
  return `${linePath(upper)} L${down[0].x.toFixed(2)} ${down[0].y.toFixed(2)} ${down
    .slice(1)
    .map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')} Z`;
}

/**
 * Thins x-axis labels until they fit, so mobile shows first/last/middle rather
 * than an unreadable overlap.
 */
export function labelStride(count: number, width: number, minSpacing = 46): number {
  if (count <= 1) return 1;
  const perLabel = width / count;
  return Math.max(1, Math.ceil(minSpacing / Math.max(perLabel, 1)));
}

/** Index of the point nearest a pointer x position. */
export function nearestIndex(xs: number[], pointerX: number): number {
  let best = 0;
  let bestDist = Infinity;
  xs.forEach((x, i) => {
    const dist = Math.abs(x - pointerX);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}
