import { useMemo, useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import type { ForecastPoint } from '../../types';
import { ChartFrame, ChartTable, ChartTooltip } from './ChartFrame';
import {
  CHART,
  bandPath,
  labelStride,
  linePath,
  linearScale,
  nearestIndex,
  niceMax,
  tickValues,
} from './chartUtils';
import { t } from '../../i18n';

interface ForecastChartProps {
  data: ForecastPoint[];
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  height?: number;
  /** Name of the measure, e.g. "Bottles sold" or "Unit price". */
  measure: string;
  summary: string;
}

/**
 * Recorded history and forecast for the same measure.
 *
 * Past and future are the same hue by design — they are one measure, not two
 * identities. They are told apart by line style (solid vs. dashed) plus the
 * shaded confidence band, with a legend naming each.
 */
export function ForecastChart({
  data,
  format,
  axisFormat,
  height = 220,
  measure,
  summary,
}: ForecastChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const fmtAxis = axisFormat ?? format;
  const padding = { top: 12, right: 8, bottom: 26, left: 46 };
  const innerW = Math.max(40, width - padding.left - padding.right);
  const innerH = Math.max(40, height - padding.top - padding.bottom);

  const geo = useMemo(() => {
    const values = data.flatMap((d) =>
      [d.actual, d.forecast, d.high].filter((v): v is number => typeof v === 'number'),
    );
    const max = niceMax(Math.max(...values, 1));
    const x = linearScale([0, Math.max(data.length - 1, 1)], [padding.left, padding.left + innerW]);
    const y = linearScale([0, max], [padding.top + innerH, padding.top]);

    const xs = data.map((_, i) => x(i));

    const actual = data
      .map((d, i) => (typeof d.actual === 'number' ? { x: xs[i], y: y(d.actual) } : null))
      .filter((p): p is { x: number; y: number } => p !== null);

    const forecast = data
      .map((d, i) => (typeof d.forecast === 'number' ? { x: xs[i], y: y(d.forecast) } : null))
      .filter((p): p is { x: number; y: number } => p !== null);

    const bandIdx = data
      .map((d, i) => (typeof d.low === 'number' && typeof d.high === 'number' ? i : -1))
      .filter((i) => i >= 0);

    const upper = bandIdx.map((i) => ({ x: xs[i], y: y(data[i].high as number) }));
    const lower = bandIdx.map((i) => ({ x: xs[i], y: y(data[i].low as number) }));

    /** Divider marking where recorded data ends and the forecast begins. */
    const lastActual = data.reduce((acc, d, i) => (typeof d.actual === 'number' ? i : acc), -1);

    return {
      max,
      xs,
      actual,
      forecast,
      upper,
      lower,
      dividerX: lastActual >= 0 ? xs[lastActual] : null,
      baseline: padding.top + innerH,
      y,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, innerW, innerH]);

  const stride = labelStride(data.length, innerW);
  const active = hover !== null ? data[hover] : null;

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(nearestIndex(geo.xs, e.clientX - rect.left));
  };

  const activeValue = active
    ? typeof active.actual === 'number'
      ? active.actual
      : active.forecast
    : undefined;

  return (
    <ChartFrame
      summary={summary}
      legend={[
        { label: t('Recorded'), color: CHART.primary, style: 'solid' },
        { label: t('Forecast'), color: CHART.forecast, style: 'dashed' },
        { label: t('Expected range'), color: CHART.forecast, style: 'band' },
      ]}
      table={
        <ChartTable
          caption={summary}
          headers={[t('Period'), t('Recorded'), t('Forecast'), t('Range')]}
          rows={data.map((d) => [
            d.label,
            typeof d.actual === 'number' ? format(d.actual) : '—',
            typeof d.forecast === 'number' ? format(d.forecast) : '—',
            typeof d.low === 'number' && typeof d.high === 'number'
              ? `${format(d.low)} – ${format(d.high)}`
              : '—',
          ])}
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
          {tickValues(geo.max).map((t) => {
            const y = geo.baseline - (t / geo.max) * innerH;
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
                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill={CHART.axis}>
                  {fmtAxis(t)}
                </text>
              </g>
            );
          })}

          {geo.upper.length > 1 && (
            <path d={bandPath(geo.upper, geo.lower)} fill={CHART.band} stroke="none" />
          )}

          {geo.dividerX !== null && (
            <line
              x1={geo.dividerX}
              x2={geo.dividerX}
              y1={padding.top}
              y2={geo.baseline}
              stroke={CHART.axis}
              strokeWidth={1}
              strokeDasharray="2 4"
              opacity={0.55}
            />
          )}

          {geo.forecast.length > 1 && (
            <path
              d={linePath(geo.forecast)}
              fill="none"
              stroke={CHART.forecast}
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {geo.actual.length > 1 && (
            <path
              d={linePath(geo.actual)}
              fill="none"
              stroke={CHART.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {data.map((d, i) =>
            i % stride === 0 || i === data.length - 1 ? (
              <text
                key={`${d.label}-${i}`}
                x={geo.xs[i]}
                y={height - 8}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                fontSize={11}
                fill={CHART.axis}
              >
                {d.label}
              </text>
            ) : null,
          )}

          {hover !== null && typeof activeValue === 'number' && (
            <g>
              <line
                x1={geo.xs[hover]}
                x2={geo.xs[hover]}
                y1={padding.top}
                y2={geo.baseline}
                stroke={CHART.primary}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <circle
                cx={geo.xs[hover]}
                cy={geo.y(activeValue)}
                r={5}
                fill={typeof active?.actual === 'number' ? CHART.primary : CHART.forecast}
                stroke={CHART.surface}
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {active && typeof activeValue === 'number' && hover !== null && (
          <ChartTooltip
            x={geo.xs[hover]}
            y={geo.y(activeValue)}
            title={active.label}
            rows={[
              typeof active.actual === 'number'
                ? { label: measure, value: format(active.actual), color: CHART.primary }
                : { label: t('{{measure}} (forecast)', { measure }), value: format(active.forecast as number), color: CHART.forecast },
              ...(typeof active.low === 'number' && typeof active.high === 'number' && typeof active.actual !== 'number'
                ? [{ label: t('Range'), value: `${format(active.low)}–${format(active.high)}` }]
                : []),
            ]}
            containerWidth={width}
          />
        )}
      </div>
    </ChartFrame>
  );
}

export default ForecastChart;
