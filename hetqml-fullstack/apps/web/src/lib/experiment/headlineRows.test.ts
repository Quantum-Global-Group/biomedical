/**
 * Tests on the headline-rows builder. Verifies the mapping into
 * `LeaderboardRow` shape preserves the locked PR-AUC values, places
 * the headline (Stacking-Pauli) on top, and computes a sensible
 * delta vs the best classical row so the existing leaderboard footer
 * selector reports correctly in headline mode.
 */
import { describe, expect, it } from "vitest";

import {
  HEADLINE_LEADERBOARD,
  HEADLINE_PR_AUC_HEADLINE,
} from "@/lib/data/headlineMetrics";

import { buildHeadlineLeaderboardRows } from "./headlineRows";

describe("buildHeadlineLeaderboardRows", () => {
  it("emits one LeaderboardRow per HEADLINE_LEADERBOARD entry", () => {
    const rows = buildHeadlineLeaderboardRows();
    expect(rows.length).toBe(HEADLINE_LEADERBOARD.length);
  });

  it("preserves model name, family, and PR-AUC verbatim", () => {
    const rows = buildHeadlineLeaderboardRows();
    for (const src of HEADLINE_LEADERBOARD) {
      const row = rows.find((r) => r.model === src.name);
      expect(row).toBeDefined();
      if (!row) return;
      expect(row.family).toBe(src.family);
      expect(row.prAuc).toBe(src.prAuc);
    }
  });

  it("flags the Stacking-Pauli headline row as isTop", () => {
    const rows = buildHeadlineLeaderboardRows();
    const top = rows.find((r) => r.isTop);
    expect(top).toBeDefined();
    if (!top) return;
    expect(top.model).toBe("Stacking ensemble (Pauli)");
    expect(top.prAuc).toBe(HEADLINE_PR_AUC_HEADLINE);
  });

  it("computes deltaClassical relative to the best classical PR-AUC", () => {
    const rows = buildHeadlineLeaderboardRows();
    // RandomForest-Optimized at 0.7838 is the best classical in the panel.
    const top = rows.find((r) => r.model === "Stacking ensemble (Pauli)");
    expect(top).toBeDefined();
    if (!top) return;
    expect(top.deltaClassical).toBeCloseTo(0.7987 - 0.7838, 4);
    // Best classical's delta vs itself is 0.
    const bestC = rows.find((r) => r.model === "RandomForest-Optimized");
    expect(bestC).toBeDefined();
    if (!bestC) return;
    expect(bestC.deltaClassical).toBeCloseTo(0, 4);
  });

  it("sets rocAuc to NaN — preregistration publishes PR-AUC point estimates only", () => {
    const rows = buildHeadlineLeaderboardRows();
    for (const r of rows) {
      expect(Number.isNaN(r.rocAuc)).toBe(true);
    }
  });

  it("flags exactly one isTop row", () => {
    const rows = buildHeadlineLeaderboardRows();
    const tops = rows.filter((r) => r.isTop);
    expect(tops.length).toBe(1);
  });
});
