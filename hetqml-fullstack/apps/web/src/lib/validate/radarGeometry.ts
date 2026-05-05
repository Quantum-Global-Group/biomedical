/**
 * Pure SVG geometry for the trust scorecard radar.
 *
 * The static export uses a 400x280 viewBox with the polygon centered at
 * (200, 140) and a radius of 90px (matching the rendered HTML). The radar
 * has 5 axes, evenly spaced starting from straight up (12 o'clock).
 *
 * Radar values arrive in 0..1 (TrustAxis.value). Each axis is rendered at
 * `value * radius` along its spoke. Acceptance threshold defaults to 0.65.
 */

export interface RadarPoint {
  x: number;
  y: number;
}

export interface RadarLayout {
  centerX: number;
  centerY: number;
  radius: number;
  /** SVG point list per axis at value=1.0 (outermost ring). */
  axisOuter: RadarPoint[];
  /** Concentric ring polygons (4 rings: 25%, 50%, 75%, 100%). */
  rings: RadarPoint[][];
  /** Threshold polygon (default 65%). */
  threshold: RadarPoint[];
  /** Label positions (slightly outside outermost ring). */
  labels: RadarPoint[];
}

const DEFAULT_RINGS = [0.25, 0.5, 0.75, 1.0];

/** Polar -> cartesian. theta=0 means 12 o'clock (straight up). */
export function polar(
  centerX: number,
  centerY: number,
  radius: number,
  value: number,
  index: number,
  count: number,
): RadarPoint {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return {
    x: centerX + Math.cos(angle) * radius * value,
    y: centerY + Math.sin(angle) * radius * value,
  };
}

export function buildRadarLayout(
  axisCount: number,
  opts?: {
    centerX?: number;
    centerY?: number;
    radius?: number;
    threshold?: number;
    labelPad?: number;
  },
): RadarLayout {
  const centerX = opts?.centerX ?? 200;
  const centerY = opts?.centerY ?? 140;
  const radius = opts?.radius ?? 90;
  const threshold = opts?.threshold ?? 0.65;
  const labelPad = opts?.labelPad ?? 18;

  const axisOuter: RadarPoint[] = [];
  const labels: RadarPoint[] = [];
  const thresholdPts: RadarPoint[] = [];
  for (let i = 0; i < axisCount; i++) {
    axisOuter.push(polar(centerX, centerY, radius, 1, i, axisCount));
    labels.push(polar(centerX, centerY, radius + labelPad, 1, i, axisCount));
    thresholdPts.push(polar(centerX, centerY, radius, threshold, i, axisCount));
  }

  const rings: RadarPoint[][] = DEFAULT_RINGS.map((r) => {
    const ring: RadarPoint[] = [];
    for (let i = 0; i < axisCount; i++) {
      ring.push(polar(centerX, centerY, radius, r, i, axisCount));
    }
    return ring;
  });

  return {
    centerX,
    centerY,
    radius,
    axisOuter,
    rings,
    threshold: thresholdPts,
    labels,
  };
}

/** Plot an axis-value array (0..1 each) to a polygon point list. */
export function valuesToPolygon(
  values: number[],
  layout: Pick<RadarLayout, "centerX" | "centerY" | "radius">,
): RadarPoint[] {
  return values.map((v, i) =>
    polar(
      layout.centerX,
      layout.centerY,
      layout.radius,
      Math.max(0, Math.min(1, v)),
      i,
      values.length,
    ),
  );
}

/** Format an array of points into an SVG `points` attribute string. */
export function pointsAttr(points: RadarPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}
