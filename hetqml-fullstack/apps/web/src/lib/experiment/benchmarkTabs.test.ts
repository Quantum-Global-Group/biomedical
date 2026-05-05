import { describe, it, expect } from "vitest";
import {
  BENCHMARK_TABS,
  getBenchmarkTab,
} from "./benchmarkTabs";

describe("BENCHMARK_TABS", () => {
  it("has the six tabs from the legacy spec in canonical order", () => {
    expect(BENCHMARK_TABS.map((t) => t.id)).toEqual([
      "classification",
      "ranking",
      "calibration",
      "efficiency",
      "quantum-hw",
      "cv-strategy",
    ]);
  });

  it("each tab has exactly four columns and stable cell keys", () => {
    for (const tab of BENCHMARK_TABS) {
      expect(tab.columns).toHaveLength(4);
      for (const [key, label] of tab.columns) {
        expect(typeof key).toBe("string");
        expect(typeof label).toBe("string");
        expect(key.length).toBeGreaterThan(0);
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it("classification tab uses the api cell keys produced by simulate_run", () => {
    const cls = getBenchmarkTab("classification");
    const keys = cls.columns.map(([k]) => k);
    expect(keys).toEqual(["prAuc", "rocAuc", "f1", "mcc"]);
  });
});

describe("getBenchmarkTab", () => {
  it("returns the requested tab when it exists", () => {
    expect(getBenchmarkTab("ranking").id).toBe("ranking");
    expect(getBenchmarkTab("quantum-hw").id).toBe("quantum-hw");
  });

  it("falls back to the first tab on unknown id", () => {
    expect(getBenchmarkTab("does-not-exist").id).toBe("classification");
  });
});
