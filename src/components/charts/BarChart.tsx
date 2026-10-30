import { useMemo, useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import type { SeriesPoint } from '../../types';
import { ChartFrame, ChartTable, ChartTooltip } from './ChartFrame';
import { CHART, labelStride, niceMax, tickValues } from './chartUtils';
import { t } from '../../i18n';

interface BarChartProps {
  data: SeriesPoint[];
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  height?: number;
  seriesName: string;
  summary: string;
  /** Optional second measure — always accompanied by the legend below. */
  comparison?: { data: SeriesPoint[]; seriesName: string };
}

/**
 * Vertical bars for period totals. Data-ends are rounded 4px and anchored to
 * the baseline; adjacent bars keep a 2px surface gap.
 */
export function BarChart({
  data,
  format,
  axisFormat,
  height = 200,
  seriesName,
  summary,
  comparison,
}: BarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const fmtAxis = axisFormat ?? format;
  const padding = { top: 12, right: 8, bottom: 26, left: 46 };
  const innerW = Math.max(40, width - padding.left - padding.right);
  const innerH = Math.max(40, height - padding.top - padding.bottom);

  const geo = useMemo(() => {
    const all = [...data.map((d) => d.value), ...(comparison?.data.map((d) => d.value) ?? [])];
    const max = niceMax(Math.max(...all, 1));
    const slot = innerW / Math.max(data.length, 1);
    const series = comparison ? 2 : 1;
    const barW = Math.max(6, Math.min(34, (slot - 10) / series));

    const bars = data.map((d, i) => {
      const slotCenter = padding.left + slot * i + slot / 2;
      const groupLeft = slotCenter - (barW * series + (series - 1) * 2) / 2;
      const h = (d.value / max) * innerH;
      return {
        label: d.label,
        value: d.value,
        x: groupLeft,
        y: padding.top + innerH - h,
        h,
        center: slotCenter,
        compare: comparison
          ? {
              value: comparison.data[i]?.value ?? 0,
              x: groupLeft + barW + 2,
              y: padding.top + innerH - ((comparison.data[i]?.value ?? 0) / max) * innerH,
              h: ((comparison.data[i]?.value ?? 0) / max) * innerH,
            }
          : null,
      };
    });

    return { max, bars, barW, baseline: padding.top + innerH };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, comparison, innerW, innerH]);

  const stride = labelStride(data.length, innerW);
  const activeBar = hover !== null ? geo.bars[hover] : null;

  return (
    <ChartFrame
      summary={summary}
      legend={
        comparison
          ? [
              { label: seriesName, color: CHART.primary },
              { label: comparison.seriesName, color: CHART.secondary },
            ]
          : undefined
      }
      table={
        <ChartTable
          caption={summary}
          headers={
            comparison ? [t('Period'), seriesName, comparison.seriesName] : [t('Period'), seriesName]
          }
          rows={data.map((d, i) =>
            comparison
              ? [d.label, format(d.value), format(comparison.data[i]?.value ?? 0)]
              : [d.label, format(d.value)],
          )}
        />
      }
    >
      <div ref={ref} style={{ position: 'relative' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
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

          {geo.bars.map((bar, i) => (
            <g key={bar.label} onPointerEnter={() => setHover(i)}>
              {/* Full-height hit target, larger than the mark itself. */}
              <rect
                x={bar.center - (innerW / Math.max(data.length, 1)) / 2}
                y={padding.top}
                width={innerW / Math.max(data.length, 1)}
                height={innerH}
                fill="transparent"
              />
              <rect
                x={bar.x}
                y={bar.y}
                width={geo.barW}
                height={Math.max(bar.h, 1)}
                rx={4}
                fill={CHART.primary}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              {bar.compare && (
                <rect
                  x={bar.compare.x}
                  y={bar.compare.y}
                  width={geo.barW}
                  height={Math.max(bar.compare.h, 1)}
                  rx={4}
                  fill={CHART.secondary}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
            </g>
          ))}

          {geo.bars.map((bar, i) =>
            i % stride === 0 || i === geo.bars.length - 1 ? (
              <text
                key={`${bar.label}-l`}
                x={bar.center}
                y={height - 8}
                textAnchor="middle"
                fontSize={11}
                fill={CHART.axis}
              >
                {bar.label}
              </text>
            ) : null,
          )}
        </svg>

        {activeBar && (
          <ChartTooltip
            x={activeBar.center}
            y={activeBar.y}
            title={activeBar.label}
            rows={[
              { label: seriesName, value: format(activeBar.value), color: CHART.primary },
              ...(activeBar.compare && comparison
                ? [
                    {
                      label: comparison.seriesName,
                      value: format(activeBar.compare.value),
                      color: CHART.secondary,
                    },
                  ]
                : []),
            ]}
            containerWidth={width}
          />
        )}
      </div>
    </ChartFrame>
  );
}

export default BarChart;
