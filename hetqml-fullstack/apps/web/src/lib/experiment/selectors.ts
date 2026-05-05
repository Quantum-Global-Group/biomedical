/**
 * Pure selectors over a `JobResult`. Kept separate from the React tree so
 * they're trivial to unit-test and so the components don't recompute the
 * same derivation in three different places.
 */
import type {
  IntegrityGuardState,
  JobResult,
  LeaderboardRow,
} from "@/lib/api/client";
import type { RunFamilyId } from "@/lib/investigation/runPath";

export interface LeaderboardFooter {
  topModel: LeaderboardRow | null;
  bestClassical: LeaderboardRow | null;
  deltaVsBestClassical: number;
  classicalCount: number;
  hybridCount: number;
  quantumCount: number;
}

/** Path-aware top: prefer the highest PR-AUC row matching the active run-path
 * family; otherwise fall back to the row flagged `isTop` on the wire, then
 * to the first row. The leaderboard table itself is global on purpose. */
export function getTopAlgorithm(
  rows: readonly LeaderboardRow[],
  family: RunFamilyId,
): LeaderboardRow | null {
  if (rows.length === 0) return null;
  const sameFamily = rows.filter((r) => r.family === family);
  if (sameFamily.length > 0) {
    return [...sameFamily].sort((a, b) => b.prAuc - a.prAuc)[0]!;
  }
  return rows.find((r) => r.isTop) ?? rows[0] ?? null;
}

export function getBestClassical(
  rows: readonly LeaderboardRow[],
): LeaderboardRow | null {
  const c = rows.filter((r) => r.family === "classical");
  if (c.length === 0) return null;
  return [...c].sort((a, b) => b.prAuc - a.prAuc)[0]!;
}

export function getLeaderboardFooter(
  rows: readonly LeaderboardRow[],
  family: RunFamilyId,
): LeaderboardFooter {
  const topModel = getTopAlgorithm(rows, family);
  const bestClassical = getBestClassical(rows);
  const deltaVsBestClassical =
    topModel && bestClassical
      ? round4(topModel.prAuc - bestClassical.prAuc)
      : 0;
  return {
    topModel,
    bestClassical,
    deltaVsBestClassical,
    classicalCount: rows.filter((r) => r.family === "classical").length,
    hybridCount: rows.filter((r) => r.family === "hybrid").length,
    quantumCount: rows.filter((r) => r.family === "quantum").length,
  };
}

/** The Source-Check panel surfaces only critical guards. A `criticalCount`
 * value of 0 means everything is healthy. */
export interface ScopedGuards {
  inScope: IntegrityGuardState[];
  failingCritical: IntegrityGuardState[];
  passingCount: number;
  totalCount: number;
}

export function scopeGuards(
  guards: readonly IntegrityGuardState[],
): ScopedGuards {
  const inScope = guards.filter((g) => g.critical);
  return {
    inScope,
    failingCritical: inScope.filter((g) => !g.passing),
    passingCount: guards.filter((g) => g.passing).length,
    totalCount: guards.length,
  };
}

/** Range scaling for leaderboard bars: best PR-AUC always fills 100%, others
 * scale proportionally. Returns 0..100. */
export function leaderBarPct(value: number, max: number): number {
  if (max <= 0) return 0;
  const pct = (value / max) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

/** Deterministic CV-bar width: the API already returns per-fold PR-AUC, so
 * we just scale to 0..100. Kept here so tests can target it. */
export function cvFoldPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value * 100));
}

export function deriveLede(
  result: JobResult,
  selection: { compound: string; disease: string },
  family: RunFamilyId,
): string {
  const topModel = getTopAlgorithm(result.leaderboard, family);
  const familyLabel =
    family === "classical"
      ? "Classical"
      : family === "quantum"
        ? "Quantum"
        : "Hybrid";
  const compound = selection.compound || "the candidate";
  const disease = selection.disease || "the disease";
  const top = topModel ? topModel.model : "the top model";
  return `${familyLabel} pipeline ran ${compound} against ${disease}. The page lays out where each piece of evidence comes from, why ${top} surfaced, and whether the experiment passed scientific quality checks.`;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
