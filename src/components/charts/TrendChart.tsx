import { useMemo, useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import type { SeriesPoint } from '../../types';
import { ChartFrame, ChartTable, ChartTooltip } from './ChartFrame';
import {
  CHART,
  areaPath,
  labelStride,
  linePath,
  linearScale,
  nearestIndex,
  niceMax,
  tickValues,
} from './chartUtils';
import { t } from '../../i18n';

interface TrendChartProps {
  data: SeriesPoint[];
  /** Formats values in the tooltip and the data table. */
  format: (value: number) => string;
  /** Shorter format for the y-axis. Defaults to `format`. */
  axisFormat?: (value: number) => string;
  height?: number;
  seriesName: string;
  summary: string;
  /** `area` fills under the line; `line` draws the stroke only. */
  variant?: 'area' | 'line';
}

/**
 * Single-measure trend line with a hover crosshair.
 *
 * One series means no legend is needed — the card title names the measure.
 */
export function TrendChart({
  data,
  format,
  axisFormat,
  height = 200,
  seriesName,
  summary,
  variant = 'area',
}: TrendChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const fmtAxis = axisFormat ?? format;
  const padding = { top: 12, right: 8, bottom: 26, left: 46 };
  const innerW = Math.max(40, width - padding.left - padding.right);
  const innerH = Math.max(40, height - padding.top - padding.bottom);

  const geometry = useMemo(() => {
    const max = niceMax(Math.max(...data.map((d) => d.value), 1));
    const x = linearScale([0, Math.max(data.length - 1, 1)], [padding.left, padding.left + innerW]);
    const y = linearScale([0, max], [padding.top + innerH, padding.top]);
    const points = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
    return { max, points, ticks: tickValues(max), baseline: padding.top + innerH };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, innerW, innerH]);

  const stride = labelStride(data.length, innerW);
  const active = hover !== null ? data[hover] : null;
  const activePoint = hover !== null ? geometry.points[hover] : null;

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(nearestIndex(geometry.points.map((p) => p.x), e.clientX - rect.left));
  };

  return (
    <ChartFrame
      summary={summary}
      table={
        <ChartTable
          caption={summary}
          headers={[t('Period'), seriesName]}
          rows={data.map((d) => [d.label, format(d.value)])}
        />
      }
    >
      <div ref={ref} style={{ position: 'relative' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="bl-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.areaTop} />
              <stop offset="100%" stopColor={CHART.areaBottom} />
            </linearGradient>
          </defs>

          {/* Recessive gridlines and y labels */}
          {geometry.ticks.map((t) => {
            const y = geometry.baseline - (t / geometry.max) * innerH;
            return (
              <g key={t}>
                <line
                  x1={padding.left}
                  x2={padding.left + innerW}
                  y1={y}
                  y2={y}
                  stroke={CHART.grid}
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={CHART.axis}
                >
                  {fmtAxis(t)}
                </text>
              </g>
            );
          })}

          {variant === 'area' && (
            <path d={areaPath(geometry.points, geometry.baseline)} fill="url(#bl-trend-fill)" />
          )}

          <path
            d={linePath(geometry.points)}
            fill="none"
            stroke={CHART.primary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* x labels, thinned to avoid collisions on narrow screens */}
          {data.map((d, i) =>
            i % stride === 0 || i === data.length - 1 ? (
              <text
                key={d.label}
                x={geometry.points[i].x}
                y={height - 8}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                fontSize={11}
                fill={CHART.axis}
              >
                {d.label}
              </text>
            ) : null,
          )}

          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={padding.top}
                y2={geometry.baseline}
                stroke={CHART.primary}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={5}
                fill={CHART.primary}
                stroke={CHART.surface}
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {active && activePoint && (
          <ChartTooltip
            x={activePoint.x}
            y={activePoint.y}
            title={active.label}
            rows={[{ label: seriesName, value: format(active.value), color: CHART.primary }]}
            containerWidth={width}
          />
        )}
      </div>
    </ChartFrame>
  );
}

export default TrendChart;
