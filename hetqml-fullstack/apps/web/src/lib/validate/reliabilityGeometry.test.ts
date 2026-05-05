import { describe, expect, it } from "vitest";
import {
  CHART_BOX,
  axisTicks,
  curvePoints,
  diagonalLine,
  layoutBins,
  projectX,
  projectY,
} from "./reliabilityGeometry";

describe("projectX/Y", () => {
  it("maps 0 -> left, 1 -> right", () => {
    expect(projectX(0)).toBe(CHART_BOX.x0);
    expect(projectX(1)).toBe(CHART_BOX.x1);
  });

  it("inverts y so 0 is bottom and 1 is top", () => {
    expect(projectY(0)).toBe(CHART_BOX.y1);
    expect(projectY(1)).toBe(CHART_BOX.y0);
  });

  it("clamps out-of-range inputs", () => {
    expect(projectX(2)).toBe(CHART_BOX.x1);
    expect(projectX(-1)).toBe(CHART_BOX.x0);
  });
});

describe("layoutBins", () => {
  const bins = Array.from({ length: 10 }, (_, i) => ({
    binLow: i / 10,
    binHigh: (i + 1) / 10,
    predicted: (i + 0.5) / 10,
    observed: (i + 0.5) / 10,
    count: i + 1,
  }));

  it("emits one BinPoint per input bin", () => {
    expect(layoutBins(bins)).toHaveLength(10);
  });

  it("histogram heights scale to the maximum count", () => {
    const out = layoutBins(bins);
    expect(out[9]!.rh).toBeCloseTo(21, 5); // largest bin gets full 21px
    expect(out[0]!.rh).toBeCloseTo(2.1, 5); // count=1 gets 1/10 of max
  });

  it("centers each bin on its midpoint", () => {
    const out = layoutBins(bins);
    expect(out[0]!.cx).toBeCloseTo(projectX(0.05), 5);
    expect(out[9]!.cx).toBeCloseTo(projectX(0.95), 5);
  });

  it("returns empty for empty input", () => {
    expect(layoutBins([])).toEqual([]);
  });
});

describe("curvePoints + diagonalLine", () => {
  it("produces a polyline string from layout", () => {
    const out = layoutBins([
      { binLow: 0, binHigh: 0.5, predicted: 0.25, observed: 0.5, count: 1 },
    ]);
    expect(curvePoints(out)).toMatch(/^\d+(\.\d+)?,\d+(\.\d+)?$/);
  });

  it("diagonal goes from bottom-left to top-right", () => {
    const d = diagonalLine();
    expect(d.x1).toBe(40);
    expect(d.y1).toBe(230);
    expect(d.x2).toBe(380);
    expect(d.y2).toBe(20);
  });
});

describe("axisTicks", () => {
  it("returns five ticks at 0/0.25/0.5/0.75/1", () => {
    const ticks = axisTicks();
    expect(ticks.map((t) => t.v)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
