/**
 * Pure SVG layout helpers for the reliability-diagram panel.
 *
 * Mirrors the static-export viewBox: 400 × 260, with the chart inset:
 *   - left axis at x=40
 *   - bottom axis at y=230
 *   - right edge at x=380
 *   - top edge at y=20
 *
 * Bin counts render as a histogram below the chart, scaled so the tallest
 * bar reaches ~21px (the static export's exact figure).
 */

export interface ReliabilityChartBox {
  /** Plot-area pixel bounds. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const CHART_BOX: ReliabilityChartBox = {
  x0: 40,
  y0: 20,
  x1: 380,
  y1: 230,
};

export interface CalibrationBinLike {
  binLow: number;
  binHigh: number;
  predicted: number;
  observed: number;
  count: number;
}

export interface BinPoint {
  /** Center x of the bin (predicted axis). */
  cx: number;
  /** Plot y for `observed` value. */
  cy: number;
  /** Lower-left x of histogram rect. */
  rx: number;
  /** Width of histogram rect. */
  rw: number;
  /** Height of histogram rect (proportional to count). */
  rh: number;
  /** Pass-through count. */
  count: number;
}

const HIST_MAX_PX = 21;

export function projectX(predicted: number, box = CHART_BOX): number {
  const t = Math.max(0, Math.min(1, predicted));
  return box.x0 + (box.x1 - box.x0) * t;
}

export function projectY(observed: number, box = CHART_BOX): number {
  const t = Math.max(0, Math.min(1, observed));
  // y inverts: 0 at bottom (y1), 1 at top (y0).
  return box.y1 - (box.y1 - box.y0) * t;
}

/** Lay out the 10 bins as histogram rectangles + observed-rate dots/lines. */
export function layoutBins(
  bins: readonly CalibrationBinLike[],
  box: ReliabilityChartBox = CHART_BOX,
): BinPoint[] {
  if (bins.length === 0) return [];
  const maxCount = bins.reduce((acc, b) => Math.max(acc, b.count), 0) || 1;
  const width = box.x1 - box.x0;
  const binWidth = width / bins.length;
  const histPad = 1; // 1px between bars
  return bins.map((b, i) => {
    const cx = projectX((b.binLow + b.binHigh) / 2, box);
    const cy = projectY(b.observed, box);
    return {
      cx,
      cy,
      rx: box.x0 + i * binWidth + histPad,
      rw: binWidth - histPad,
      rh: (b.count / maxCount) * HIST_MAX_PX,
      count: b.count,
    };
  });
}

/** Polyline `points` string for the observed curve through the bin centers. */
export function curvePoints(layout: BinPoint[]): string {
  return layout.map((p) => `${p.cx},${p.cy}`).join(" ");
}

/** SVG line for the diagonal y=x reference, in chart pixels. */
export function diagonalLine(box: ReliabilityChartBox = CHART_BOX): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  return { x1: box.x0, y1: box.y1, x2: box.x1, y2: box.y0 };
}

/** Tick layout for axis labels at 0, 0.25, 0.5, 0.75, 1. */
export function axisTicks(box: ReliabilityChartBox = CHART_BOX): Array<{
  v: number;
  x: number;
  y: number;
}> {
  return [0, 0.25, 0.5, 0.75, 1].map((v) => ({
    v,
    x: projectX(v, box),
    y: projectY(v, box),
  }));
}
