/**
 * Pure-logic tests on the DashboardMode constants.
 *
 * The provider itself uses React hooks + localStorage and would need
 * @testing-library/react to render-test. Adding that dependency is
 * deliberately deferred — the provider is small (~70 lines), and the
 * critical behaviors (persist key spelling, valid value handling) are
 * exercised here without DOM rendering.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_MODE,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  PERSIST_KEY,
  type DashboardMode,
} from "./types";

describe("DashboardMode constants", () => {
  it("default mode is 'demo' so HF Space visitors see the walkthrough first", () => {
    expect(DEFAULT_MODE).toBe<DashboardMode>("demo");
  });

  it("PERSIST_KEY is namespaced under 'hetqml.' to avoid collision", () => {
    expect(PERSIST_KEY).toBe("hetqml.dashboardMode");
  });

  it("labels exist for every mode", () => {
    for (const mode of ["demo", "headline"] as const) {
      expect(MODE_LABELS[mode]).toBeTruthy();
      expect(typeof MODE_LABELS[mode]).toBe("string");
    }
  });

  it("descriptions reference the project's headline numbers explicitly", () => {
    expect(MODE_DESCRIPTIONS.demo).toContain("Inaxaplin");
    expect(MODE_DESCRIPTIONS.demo).toContain("0.827");
    expect(MODE_DESCRIPTIONS.headline).toContain("0.7987");
    expect(MODE_DESCRIPTIONS.headline).toContain("CtD");
  });
});
