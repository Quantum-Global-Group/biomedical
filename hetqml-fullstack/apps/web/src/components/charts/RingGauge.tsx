interface Props {
  /** Value in [0, 1]. */
  value: number;
  /** Diameter in px. */
  size?: number;
  /** Stroke width as a fraction of size. */
  thickness?: number;
  /** Override the auto-tone (good/warn/bad). */
  color?: string;
  /** Acceptance threshold; ring shows a small tick at this fraction. */
  threshold?: number;
  /** Centre label override. Defaults to `Math.round(value * 100)`. */
  label?: string;
  /** Centre sub-label (small caption under the value). */
  sublabel?: string;
  ariaLabel?: string;
}

/**
 * Compact circular progress ring. Used for headline metrics like the
 * composite trust score. Animates softly via CSS transition on the
 * dasharray so the ring "draws" when the value changes.
 *
 * Tone (when no `color` passed):
 *   value ≥ threshold        → green
 *   threshold − 0.20 to thr  → amber
 *   < threshold − 0.20       → sienna
 */
export function RingGauge({
  value,
  size = 84,
  thickness = 0.12,
  color,
  threshold = 0.65,
  label,
  sublabel,
  ariaLabel,
}: Props) {
  const v = Math.max(0, Math.min(1, value));
  const stroke = Math.max(2, Math.round(size * thickness));
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  const dash = c * v;
  const tone =
    color ??
    (v >= threshold
      ? "var(--green)"
      : v >= threshold - 0.2
        ? "var(--amber)"
        : "var(--sienna)");
  const tickAngle = -90 + threshold * 360;
  const tickX1 = size / 2 + (r - stroke / 2) * Math.cos((tickAngle * Math.PI) / 180);
  const tickY1 = size / 2 + (r - stroke / 2) * Math.sin((tickAngle * Math.PI) / 180);
  const tickX2 = size / 2 + (r + stroke / 2) * Math.cos((tickAngle * Math.PI) / 180);
  const tickY2 = size / 2 + (r + stroke / 2) * Math.sin((tickAngle * Math.PI) / 180);

  const centerLabel = label ?? `${Math.round(v * 100)}`;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flex: "0 0 auto",
      }}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: "block", transform: "rotate(-90deg)" }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{
            transition: "stroke-dasharray 0.6s ease, stroke 0.4s ease",
            filter: `drop-shadow(0 0 4px ${tone}66)`,
          }}
        />
      </svg>
      {/* Threshold tick — drawn in screen-coords on top of the rotated svg. */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <line
          x1={tickX1}
          y1={tickY1}
          x2={tickX2}
          y2={tickY2}
          stroke="var(--ink)"
          strokeWidth={1}
          opacity={0.55}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: Math.max(14, size * 0.28),
            fontWeight: 700,
            color: "var(--ink)",
            fontFamily: "var(--font-mono), monospace",
            lineHeight: 1,
          }}
        >
          {centerLabel}
        </span>
        {sublabel && (
          <span
            style={{
              fontSize: Math.max(8, size * 0.1),
              color: "var(--faint)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginTop: 2,
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
