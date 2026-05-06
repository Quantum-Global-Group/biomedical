interface Props {
  values: number[];
  /** Floor + ceiling of the y-axis. Defaults to [min(values), max(values)]. */
  domain?: [number, number];
  /** Reference line — drawn as a dashed horizontal at this y. */
  baseline?: number | null;
  width?: number;
  height?: number;
  /** Stroke colour. */
  color?: string;
  /** Fill area under the line for emphasis. */
  fill?: boolean;
  ariaLabel?: string;
}

/**
 * Tiny inline sparkline (SVG). Used in metric strips to show CV-fold
 * variance, decision-history trend, etc. Stateless — just a polyline +
 * optional area + optional baseline ref.
 */
export function Sparkline({
  values,
  domain,
  baseline = null,
  width = 78,
  height = 22,
  color = "var(--teal)",
  fill = true,
  ariaLabel,
}: Props) {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--border-soft)"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const lo = domain?.[0] ?? Math.min(...values);
  const hi = domain?.[1] ?? Math.max(...values);
  const span = hi - lo || 1;
  const padX = 1;
  const padY = 2;

  const xs = values.map(
    (_, i) => padX + (i / Math.max(values.length - 1, 1)) * (width - padX * 2),
  );
  const ys = values.map((v) =>
    height - padY - ((v - lo) / span) * (height - padY * 2),
  );
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(" ");

  const areaPath =
    fill && values.length > 1
      ? `M ${xs[0]} ${height - padY} L ${points
          .split(" ")
          .join(" L ")} L ${xs[xs.length - 1]} ${height - padY} Z`
      : "";

  const baselineY =
    baseline != null
      ? height - padY - ((baseline - lo) / span) * (height - padY * 2)
      : null;

  return (
    <svg
      width={width}
      height={height}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : "true"}
      style={{ display: "block" }}
    >
      {baselineY != null && (
        <line
          x1={0}
          y1={baselineY}
          x2={width}
          y2={baselineY}
          stroke="var(--faint)"
          strokeDasharray="2 3"
          strokeWidth={0.7}
          opacity={0.6}
        />
      )}
      {areaPath && <path d={areaPath} fill={color} opacity={0.18} />}
      {values.length > 1 && (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Highlight the most-recent point. */}
      {values.length > 0 && (
        <circle
          cx={xs[xs.length - 1]}
          cy={ys[ys.length - 1]}
          r={2}
          fill={color}
        />
      )}
    </svg>
  );
}
