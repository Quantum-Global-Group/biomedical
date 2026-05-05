/**
 * Sanity tests on the headline metrics constants. These are the locked
 * project numbers — drift here means the dashboard is out of sync with
 * the OSF preregistration §"Critical disclosure" and someone needs to
 * file a §12 amendment.
 */
import { describe, expect, it } from "vitest";

import {
  computeHeadlineCompositeTrust,
  HEADLINE_DECISION_STATUS,
  HEADLINE_LEADERBOARD,
  HEADLINE_PR_AUC_HEADLINE,
  HEADLINE_PR_AUC_QSVC_ALONE,
  HEADLINE_TRUST_AXES,
  HETIONET_EDGES_SHA256_PREFIX,
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

describe("HEADLINE_TRUST_AXES", () => {
  it("declares all five axes in the canonical order", () => {
    expect(HEADLINE_TRUST_AXES.map((a) => a.id)).toEqual([
      "clinical",
      "mechanism",
      "model",
      "baseline",
      "artifact",
    ]);
  });

  it("clinical and mechanism are marked n/a (per-candidate, not methodology)", () => {
    const clinical = HEADLINE_TRUST_AXES.find((a) => a.id === "clinical");
    const mechanism = HEADLINE_TRUST_AXES.find((a) => a.id === "mechanism");
    expect(clinical?.applicability).toBe("na");
    expect(mechanism?.applicability).toBe("na");
    expect(clinical?.value).toBeNull();
    expect(mechanism?.value).toBeNull();
  });

  it("model axis cites §1.3 H1b and uses the headline PR-AUC", () => {
    const model = HEADLINE_TRUST_AXES.find((a) => a.id === "model");
    expect(model).toBeDefined();
    if (!model) return;
    expect(model.applicability).toBe("applies");
    expect(model.value).toBe(HEADLINE_PR_AUC_HEADLINE);
    expect(model.prereg).toContain("§1.3");
    expect(model.prereg).toContain("H1b");
  });

  it("baseline axis cites §6 and references the Δ-vs-best-classical", () => {
    const baseline = HEADLINE_TRUST_AXES.find((a) => a.id === "baseline");
    expect(baseline).toBeDefined();
    if (!baseline) return;
    expect(baseline.applicability).toBe("applies");
    expect(baseline.prereg).toContain("§6");
    // Description should mention the delta and the best classical row.
    expect(baseline.description).toMatch(/Δ/);
    expect(baseline.description).toMatch(/RandomForest/i);
  });

  it("artifact axis references the Hetionet snapshot SHA-256 prefix and locked constants", () => {
    const artifact = HEADLINE_TRUST_AXES.find((a) => a.id === "artifact");
    expect(artifact).toBeDefined();
    if (!artifact) return;
    expect(artifact.applicability).toBe("applies");
    expect(artifact.value).toBe(1);
    expect(artifact.description).toContain(HETIONET_EDGES_SHA256_PREFIX);
    expect(artifact.prereg).toContain("hetionet_snapshot.md");
    expect(artifact.prereg).toContain("preregistered_constants");
  });

  it("all applicable axes have value in [0, 1]", () => {
    for (const a of HEADLINE_TRUST_AXES) {
      if (a.applicability === "applies" && a.value !== null) {
        expect(a.value).toBeGreaterThanOrEqual(0);
        expect(a.value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("every axis has a non-empty description and prereg field", () => {
    for (const a of HEADLINE_TRUST_AXES) {
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.prereg.length).toBeGreaterThan(0);
    }
  });
});

describe("computeHeadlineCompositeTrust", () => {
  it("averages only the applicable axes (n/a excluded)", () => {
    const applicable = HEADLINE_TRUST_AXES.filter(
      (a) => a.applicability === "applies" && a.value !== null,
    );
    const expected =
      applicable.reduce((acc, a) => acc + (a.value ?? 0), 0) /
      applicable.length;
    expect(computeHeadlineCompositeTrust()).toBeCloseTo(expected, 6);
  });

  it("returns a value in [0, 1]", () => {
    const v = computeHeadlineCompositeTrust();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});
