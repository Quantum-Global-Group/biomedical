import { describe, expect, it } from "vitest";
import {
  buildRadarLayout,
  pointsAttr,
  polar,
  valuesToPolygon,
} from "./radarGeometry";

describe("polar", () => {
  it("places index 0 at straight up (12 o'clock)", () => {
    const p = polar(200, 140, 90, 1, 0, 5);
    expect(p.x).toBeCloseTo(200, 5);
    expect(p.y).toBeCloseTo(50, 5);
  });

  it("scales by value", () => {
    const p = polar(200, 140, 90, 0.5, 0, 5);
    expect(p.x).toBeCloseTo(200, 5);
    expect(p.y).toBeCloseTo(95, 5);
  });
});

describe("buildRadarLayout", () => {
  it("returns five axes with 4 rings and a threshold polygon", () => {
    const layout = buildRadarLayout(5);
    expect(layout.axisOuter).toHaveLength(5);
    expect(layout.rings).toHaveLength(4);
    expect(layout.rings[0]).toHaveLength(5);
    expect(layout.threshold).toHaveLength(5);
    expect(layout.labels).toHaveLength(5);
  });

  it("threshold sits between center and outer ring", () => {
    const layout = buildRadarLayout(5, { threshold: 0.65 });
    const top = layout.threshold[0];
    expect(top).toBeDefined();
    expect(top!.x).toBeCloseTo(200);
    // 140 - 0.65 * 90 = 81.5
    expect(top!.y).toBeCloseTo(81.5, 5);
  });
});

describe("valuesToPolygon + pointsAttr", () => {
  it("clamps out-of-range values", () => {
    const layout = buildRadarLayout(5);
    const poly = valuesToPolygon([1.5, -0.2, 0.5, 0.5, 0.5], layout);
    expect(poly[0]!.y).toBeCloseTo(50, 5); // clamped to 1.0
    expect(poly[1]!.y).toBeCloseTo(140, 5); // clamped to 0.0
  });

  it("formats points into a space-delimited svg attr", () => {
    const attr = pointsAttr([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    expect(attr).toBe("1,2 3,4");
  });
});
