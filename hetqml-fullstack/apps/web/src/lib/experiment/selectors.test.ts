import { describe, it, expect } from "vitest";
import type { IntegrityGuardState, LeaderboardRow } from "@/lib/api/client";
import {
  cvFoldPct,
  getBestClassical,
  getLeaderboardFooter,
  getTopAlgorithm,
  leaderBarPct,
  scopeGuards,
} from "./selectors";

const row = (
  model: string,
  family: "classical" | "hybrid" | "quantum",
  prAuc: number,
  opts: { isTop?: boolean; deltaClassical?: number } = {},
): LeaderboardRow => ({
  model,
  family,
  prAuc,
  rocAuc: prAuc + 0.04,
  deltaClassical: opts.deltaClassical ?? 0,
  isTop: opts.isTop ?? false,
});

const guard = (
  id: string,
  critical: boolean,
  passing: boolean,
): IntegrityGuardState => ({ id, label: id, critical, passing });

describe("getTopAlgorithm", () => {
  const rows: LeaderboardRow[] = [
    row("Stacking", "classical", 0.79),
    row("QSVC", "hybrid", 0.81),
    row("QAOA", "quantum", 0.74),
    row("RotatE → LR", "classical", 0.77),
    row("Quantum Kernel + Metapath", "hybrid", 0.83, { isTop: true }),
  ];

  it("picks the highest PR-AUC row matching the requested family", () => {
    expect(getTopAlgorithm(rows, "hybrid")?.model).toBe(
      "Quantum Kernel + Metapath",
    );
    expect(getTopAlgorithm(rows, "classical")?.model).toBe("Stacking");
    expect(getTopAlgorithm(rows, "quantum")?.model).toBe("QAOA");
  });

  it("falls back to the row flagged isTop when no family matches", () => {
    const onlyClassical: LeaderboardRow[] = [
      row("LR", "classical", 0.6),
      row("RF", "classical", 0.7, { isTop: true }),
    ];
    expect(getTopAlgorithm(onlyClassical, "quantum")?.model).toBe("RF");
  });

  it("returns null on empty rows", () => {
    expect(getTopAlgorithm([], "hybrid")).toBeNull();
  });
});

describe("getLeaderboardFooter", () => {
  it("computes Δ vs best classical with sign preserved", () => {
    const rows: LeaderboardRow[] = [
      row("Stacking", "classical", 0.79),
      row("Quantum Kernel + Metapath", "hybrid", 0.83),
      row("QAOA", "quantum", 0.74),
      row("VQC", "hybrid", 0.78),
    ];
    const footer = getLeaderboardFooter(rows, "hybrid");
    expect(footer.topModel?.model).toBe("Quantum Kernel + Metapath");
    expect(footer.bestClassical?.model).toBe("Stacking");
    expect(footer.deltaVsBestClassical).toBeCloseTo(0.04, 4);
    expect(footer.classicalCount).toBe(1);
    expect(footer.hybridCount).toBe(2);
    expect(footer.quantumCount).toBe(1);
  });
});

describe("getBestClassical", () => {
  it("returns null when no classical rows present", () => {
    const rows: LeaderboardRow[] = [row("VQC", "hybrid", 0.7)];
    expect(getBestClassical(rows)).toBeNull();
  });
});

describe("scopeGuards", () => {
  it("only surfaces critical guards but counts pass/total over the full set", () => {
    const guards = [
      guard("anc", true, true),
      guard("equity", true, false),
      guard("dedup", false, true),
      guard("kfold", true, true),
      guard("audit", false, false),
    ];
    const scoped = scopeGuards(guards);
    expect(scoped.inScope.map((g) => g.id)).toEqual(["anc", "equity", "kfold"]);
    expect(scoped.failingCritical.map((g) => g.id)).toEqual(["equity"]);
    expect(scoped.passingCount).toBe(3);
    expect(scoped.totalCount).toBe(5);
  });
});

describe("leaderBarPct + cvFoldPct", () => {
  it("clamps leaderBarPct between 0 and 100", () => {
    expect(leaderBarPct(0.83, 0.83)).toBe(100);
    expect(leaderBarPct(0.0, 0.83)).toBe(0);
    expect(leaderBarPct(2, 1)).toBe(100); // clamped
    expect(leaderBarPct(0.5, 0)).toBe(0); // guards divide-by-zero
  });

  it("clamps cvFoldPct to 0..100", () => {
    expect(cvFoldPct(0.84)).toBeCloseTo(84, 4);
    expect(cvFoldPct(-0.1)).toBe(0);
    expect(cvFoldPct(1.5)).toBe(100);
    expect(cvFoldPct(NaN)).toBe(0);
  });
});
