"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ChartSeries, SeriesPoint } from "@/lib/types";
import {
  formatDateTime,
  formatInt,
  formatShortDate,
  formatShortDateTime,
} from "@/lib/format";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MINUTE = 60 * 1000;
const X_INTERVALS = [
  5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
  HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY,
];
const LABEL_MIN_GAP = 14;

interface LineChartProps {
  series: ChartSeries[];
  /** Accessible name, e.g. "Level over time". */
  label: string;
  /** Name of the measure, used in the table view. */
  valueName: string;
  /** Fixed y-domain, e.g. [1, 60] for levels. Computed from data when omitted. */
  yDomain?: [number, number];
  /** Explicit y ticks (used with a fixed domain). */
  yTicks?: number[];
  height?: number;
  emptyMessage?: string;
}

function niceStep(raw: number): number {
  if (raw <= 0 || !Number.isFinite(raw)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return Math.max(1, nf * exp);
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }
  const step = niceStep((max - min) / count);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

/** Latest point at or before t (step-after semantics). */
function asOf(points: SeriesPoint[], t: number): SeriesPoint | null {
  let found: SeriesPoint | null = null;
  for (const p of points) {
    if (p.t > t) break;
    found = p;
  }
  return found;
}

export function LineChart({
  series,
  label,
  valueName,
  yDomain,
  yTicks: yTicksProp,
  height = 260,
  emptyMessage = "No snapshots recorded yet.",
}: LineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const withData = series.filter((s) => s.points.length > 0);
  const times = useMemo(
    () => Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.t)))).sort((a, b) => a - b),
    [series],
  );

  const showLegend = series.length > 1;
  const narrow = width < 480;

  if (withData.length === 0) {
    return (
      <div className="chart-empty" role="note">
        <p className="chart-empty-title">{emptyMessage}</p>
        <p className="chart-empty-body">
          This chart fills in as soon as the first snapshot is recorded.
        </p>
      </div>
    );
  }

  // Scales -------------------------------------------------------------------
  const allValues = withData.flatMap((s) => s.points.map((p) => p.v));
  const vMin = Math.min(...allValues);
  const vMax = Math.max(...allValues);
  // Keep points off the baseline: leave ~8% of the range below the lowest value.
  const yTicks = yTicksProp ?? niceTicks(
    yDomain ? yDomain[0] : vMin === vMax ? vMin : Math.max(0, vMin - (vMax - vMin) * 0.08),
    yDomain ? yDomain[1] : vMax,
  );
  const [y0, y1] = yDomain ?? [yTicks[0], yTicks[yTicks.length - 1]];

  let x0 = times[0];
  let x1 = times[times.length - 1];
  if (x0 === x1) {
    x0 -= 12 * HOUR;
    x1 += 12 * HOUR;
  } else {
    // A little air so the first and last snapshots don't sit on the plot edges.
    const pad = Math.max((x1 - x0) * 0.04, 2 * MINUTE);
    x0 -= pad;
    x1 += pad;
  }

  // Direct end-labels need a right gutter; drop them on narrow screens.
  const tentativeLabels = !narrow;
  // ~6.8px per character at 12px; name + space + value, plus the 9px offset.
  const longestLabel = Math.max(
    0,
    ...withData.map((s) => `${s.name} ${formatInt(s.points[s.points.length - 1].v)}`.length),
  );
  const margin = {
    top: 12,
    right: tentativeLabels ? Math.min(180, Math.max(88, Math.ceil(longestLabel * 6.8) + 16)) : 16,
    bottom: 28,
    left: 44,
  };
  const plotW = Math.max(40, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const sx = (t: number) => margin.left + ((t - x0) / (x1 - x0)) * plotW;
  const sy = (v: number) => margin.top + (1 - (v - y0) / (y1 - y0 || 1)) * plotH;

  // X ticks ------------------------------------------------------------------
  const maxXTicks = Math.max(2, Math.floor(plotW / 84));
  const interval = X_INTERVALS.find((iv) => (x1 - x0) / iv <= maxXTicks) ?? 30 * DAY;
  const xTicks: number[] = [];
  for (let t = Math.ceil(x0 / interval) * interval; t <= x1; t += interval) xTicks.push(t);
  const fmtX = interval < DAY ? formatShortDateTime : formatShortDate;

  // Paths (step-after: a value holds until the next snapshot) ---------------
  const paths = withData.map((s) => {
    let d = "";
    s.points.forEach((p, i) => {
      const x = sx(p.t).toFixed(1);
      const y = sy(p.v).toFixed(1);
      d += i === 0 ? `M${x},${y}` : `H${x}V${y}`;
    });
    return { s, d };
  });

  // End labels: shown only when none collide (legend carries identity otherwise).
  const ends = withData
    .map((s) => {
      const last = s.points[s.points.length - 1];
      return { s, x: sx(last.t), y: sy(last.v), v: last.v };
    })
    .sort((a, b) => a.y - b.y);
  const collide = ends.some((e, i) => i > 0 && e.y - ends[i - 1].y < LABEL_MIN_GAP);
  const directLabels = tentativeLabels && !collide;

  // Hover / focus --------------------------------------------------------------
  const activeT = active !== null ? times[active] : null;
  const activeRows =
    activeT === null
      ? []
      : withData
          .map((s) => ({ s, p: asOf(s.points, activeT) }))
          .filter((r): r is { s: ChartSeries; p: SeriesPoint } => r.p !== null)
          .sort((a, b) => b.p.v - a.p.v);

  function indexFromClientX(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    times.forEach((t, i) => {
      const dist = Math.abs(sx(t) - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (times.length === 0) return;
    const last = times.length - 1;
    if (e.key === "ArrowRight") setActive((a) => (a === null ? last : Math.min(last, a + 1)));
    else if (e.key === "ArrowLeft") setActive((a) => (a === null ? last : Math.max(0, a - 1)));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  const tooltipX = activeT !== null ? sx(activeT) : 0;
  const tooltipLeft = tooltipX + 196 > width ? tooltipX - 196 : tooltipX + 12;

  const latestSummary = ends
    .map((e) => `${e.s.name} ${formatInt(e.v)}`)
    .join(", ");

  return (
    <div className="chart">
      {showLegend && (
        <ul className="legend" aria-label="Legend">
          {series.map((s) => (
            <li key={s.id}>
              <span className="legend-key" style={{ background: `var(--series-${s.slot})` }} aria-hidden />
              {s.name}
              {s.points.length === 0 && <span className="muted"> (no data)</span>}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={wrapRef}
        className="chart-plot"
        tabIndex={0}
        role="group"
        aria-label={`${label}. Latest values: ${latestSummary}. Use left and right arrow keys to inspect snapshots.`}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? times.length - 1)}
        onBlur={() => setActive(null)}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden
          onPointerMove={(e) => setActive(indexFromClientX(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActive(null)}
        >
          {/* Grid + y ticks */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={margin.left}
                x2={margin.left + plotW}
                y1={sy(v)}
                y2={sy(v)}
                className="grid-line"
              />
              <text x={margin.left - 8} y={sy(v)} dy="0.32em" textAnchor="end" className="tick">
                {formatInt(v)}
              </text>
            </g>
          ))}
          {/* Baseline */}
          <line
            x1={margin.left}
            x2={margin.left + plotW}
            y1={margin.top + plotH}
            y2={margin.top + plotH}
            className="axis-line"
          />
          {/* X ticks */}
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={height - 8} textAnchor="middle" className="tick">
              {fmtX(t)}
            </text>
          ))}

          {/* Series lines */}
          {paths.map(({ s, d }) => (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={`var(--series-${s.slot})`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* End dots with surface ring */}
          {ends.map((e) => (
            <circle
              key={e.s.id}
              cx={e.x}
              cy={e.y}
              r={4}
              fill={`var(--series-${e.s.slot})`}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}

          {/* Direct labels (text tokens, never the series color) */}
          {directLabels &&
            ends.map((e) => (
              <text key={e.s.id} x={e.x + 9} y={e.y} dy="0.32em" className="end-label">
                {e.s.name} <tspan className="end-value">{formatInt(e.v)}</tspan>
              </text>
            ))}

          {/* Crosshair */}
          {activeT !== null && (
            <g>
              <line
                x1={sx(activeT)}
                x2={sx(activeT)}
                y1={margin.top}
                y2={margin.top + plotH}
                className="crosshair"
              />
              {activeRows.map(({ s, p }) => (
                <circle
                  key={s.id}
                  cx={sx(activeT)}
                  cy={sy(p.v)}
                  r={4.5}
                  fill={`var(--series-${s.slot})`}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>

        {activeT !== null && (
          <div className="tooltip" style={{ left: Math.max(0, tooltipLeft), top: margin.top }} role="status">
            <div className="tooltip-date">As of {formatDateTime(activeT)}</div>
            {activeRows.map(({ s, p }) => (
              <div key={s.id} className="tooltip-row">
                <span className="tooltip-key" style={{ background: `var(--series-${s.slot})` }} aria-hidden />
                <strong className="tooltip-value">{formatInt(p.v)}</strong>
                <span className="tooltip-name">{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="table-view">
        <summary>Show data table</summary>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr>
                <th scope="col">Snapshot (UTC)</th>
                {series.map((s) => (
                  <th key={s.id} scope="col" className="num">
                    {series.length > 1 ? s.name : valueName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...times].reverse().map((t) => (
                <tr key={t}>
                  <td>{formatDateTime(t)}</td>
                  {series.map((s) => {
                    const p = s.points.find((pt) => pt.t === t);
                    return (
                      <td key={s.id} className="num">
                        {p ? formatInt(p.v) : <span className="muted">–</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
