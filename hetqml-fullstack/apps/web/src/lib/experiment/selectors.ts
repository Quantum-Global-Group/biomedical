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
  /** Pre-rendered "<top-params> / <classical-params>" string for the
   * footer's PARAM RATIO tile (e.g. "28 / 18,000"). Falls back to "—"
   * when either side has no parseable count. */
  paramRatioLabel: string;
  /** Path-aware deploy / advantage line shown beneath the footer grid;
   * worded differently for classical / hybrid / quantum runs. */
  deployCopy: string;
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
  const heaviestClassical = heaviestByParams(rows.filter((r) => r.family === "classical"));
  return {
    topModel,
    bestClassical,
    deltaVsBestClassical,
    classicalCount: rows.filter((r) => r.family === "classical").length,
    hybridCount: rows.filter((r) => r.family === "hybrid").length,
    quantumCount: rows.filter((r) => r.family === "quantum").length,
    paramRatioLabel: paramRatioLabel(topModel, heaviestClassical),
    deployCopy: deployCopy(topModel, deltaVsBestClassical, family),
  };
}

/** Parse a display-formatted param string ("28", "2.1k", "18k", "n") into
 * a number for ratio math. Returns null when the string is parameter-free
 * ("n", "—", undefined) or unparseable. */
export function parseParamCount(value: string | undefined | null): number | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "" || v === "n" || v === "—" || v === "-" || v === "np") return null;
  const m = v.match(/^([0-9]*\.?[0-9]+)\s*([km]?)$/);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const unit = m[2];
  if (unit === "k") return Math.round(base * 1_000);
  if (unit === "m") return Math.round(base * 1_000_000);
  return Math.round(base);
}

function heaviestByParams(rows: readonly LeaderboardRow[]): LeaderboardRow | null {
  let best: { row: LeaderboardRow; n: number } | null = null;
  for (const r of rows) {
    const n = parseParamCount(r.params);
    if (n == null) continue;
    if (!best || n > best.n) best = { row: r, n };
  }
  return best?.row ?? null;
}

function paramRatioLabel(
  top: LeaderboardRow | null,
  heaviestClassical: LeaderboardRow | null,
): string {
  const tp = parseParamCount(top?.params);
  const cp = parseParamCount(heaviestClassical?.params);
  if (tp == null || cp == null) return "—";
  return `${tp.toLocaleString("en-US")} / ${cp.toLocaleString("en-US")}`;
}

/** Per-path footer prose under the leaderboard. Reads the static export's
 * tone: classical runs reframe the top model as a deployable baseline,
 * hybrid and quantum runs lean into the parameter-efficiency story. */
function deployCopy(
  top: LeaderboardRow | null,
  delta: number,
  family: RunFamilyId,
): string {
  if (!top) {
    return "Pick a candidate on Initialize to populate the leaderboard.";
  }
  const sign = delta > 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3);
  if (family === "classical") {
    return `Classical-only path: ${top.model} would deploy. Δ ${sign} PR-AUC vs the next-best classical — no quantum hardware involved on this run.`;
  }
  if (family === "quantum") {
    return `Pure-quantum path: ${top.model} would deploy. Δ ${sign} vs best classical at a fraction of the parameter count — variance still wider than the hybrid leaders.`;
  }
  return `Hybrid path: ${top.model} would deploy. Δ ${sign} vs best classical with two-orders-of-magnitude fewer parameters — the headline parameter-efficiency result.`;
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
