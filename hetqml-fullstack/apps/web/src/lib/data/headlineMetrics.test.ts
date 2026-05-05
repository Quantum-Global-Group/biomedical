/**
 * Sanity tests on the headline metrics constants. These are the locked
 * project numbers — drift here means the dashboard is out of sync with
 * the OSF preregistration §"Critical disclosure" and someone needs to
 * file a §12 amendment.
 */
import { describe, expect, it } from "vitest";

import {
  HEADLINE_DECISION_STATUS,
  HEADLINE_LEADERBOARD,
  HEADLINE_PR_AUC_HEADLINE,
  HEADLINE_PR_AUC_QSVC_ALONE,
} from "./headlineMetrics";

describe("HEADLINE_LEADERBOARD", () => {
  it("ranks Stacking ensemble (Pauli) at the top with PR-AUC 0.7987", () => {
    const top = HEADLINE_LEADERBOARD[0];
    expect(top).toBeDefined();
    if (!top) return;
    expect(top.name).toBe("Stacking ensemble (Pauli)");
    expect(top.prAuc).toBe(0.7987);
    expect(top.family).toBe("hybrid");
    expect(top.role).toContain("H1b");
  });

  it("includes QSVC-Optimized (Pauli) with PR-AUC 0.7216 — the H1 row", () => {
    const qsvcRow = HEADLINE_LEADERBOARD.find((row) =>
      row.name.includes("QSVC"),
    );
    expect(qsvcRow).toBeDefined();
    if (!qsvcRow) return;
    expect(qsvcRow.prAuc).toBe(0.7216);
    expect(qsvcRow.family).toBe("quantum");
    expect(qsvcRow.role).toContain("H1");
  });

  it("is sorted by PR-AUC descending", () => {
    for (let i = 1; i < HEADLINE_LEADERBOARD.length; i += 1) {
      const prev = HEADLINE_LEADERBOARD[i - 1];
      const cur = HEADLINE_LEADERBOARD[i];
      if (!prev || !cur) throw new Error("unreachable: leaderboard index");
      expect(prev.prAuc).toBeGreaterThanOrEqual(cur.prAuc);
    }
  });

  it("preregistration anchor on every row references at least one §", () => {
    for (const row of HEADLINE_LEADERBOARD) {
      expect(row.prereg).toMatch(/§/);
    }
  });
});

describe("HEADLINE_PR_AUC constants", () => {
  it("HEADLINE_PR_AUC_HEADLINE matches the leaderboard top row", () => {
    const top = HEADLINE_LEADERBOARD[0];
    expect(top).toBeDefined();
    if (!top) return;
    expect(HEADLINE_PR_AUC_HEADLINE).toBe(top.prAuc);
  });

  it("HEADLINE_PR_AUC_QSVC_ALONE matches the QSVC row", () => {
    const qsvc = HEADLINE_LEADERBOARD.find((r) => r.name.includes("QSVC"));
    expect(qsvc).toBeDefined();
    if (!qsvc) return;
    expect(HEADLINE_PR_AUC_QSVC_ALONE).toBe(qsvc.prAuc);
  });
});

describe("HEADLINE_DECISION_STATUS", () => {
  it("declares H1, H1b, H2, H3 — all four hypotheses", () => {
    expect(Object.keys(HEADLINE_DECISION_STATUS).sort()).toEqual([
      "h1",
      "h1b",
      "h2",
      "h3",
    ]);
  });

  it("H1 and H1b are pending the GPU bootstrap CI run", () => {
    expect(HEADLINE_DECISION_STATUS.h1).toContain("bootstrap");
    expect(HEADLINE_DECISION_STATUS.h1b).toContain("bootstrap");
  });

  it("H2 and H3 are pending hardware experiments", () => {
    expect(HEADLINE_DECISION_STATUS.h2).toContain("hardware");
    expect(HEADLINE_DECISION_STATUS.h3).toContain("hardware");
  });
});
