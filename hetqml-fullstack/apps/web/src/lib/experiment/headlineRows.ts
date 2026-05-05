/**
 * Map the locked HEADLINE_LEADERBOARD constants into the dashboard's
 * LeaderboardRow shape. Used by the Experiment page's headline-mode view
 * so the same rendering primitives (selectors, footer math) work
 * unchanged on the project's actual preregistered numbers.
 *
 * `rocAuc` is set to NaN by convention because the headline source
 * (preregistration §"Critical disclosure") publishes PR-AUC point
 * estimates only; ROC-AUC will be filled in by the FastAPI endpoint
 * once the headline GPU run produces `bootstrap_ci_analysis.md`.
 *
 * `deltaClassical` is computed against the best classical row's PR-AUC
 * so the existing `getLeaderboardFooter` selector reports a sensible
 * delta in headline mode.
 */
import type { LeaderboardRow } from "@/lib/api/client";
import {
  HEADLINE_LEADERBOARD,
  type HeadlineModel,
} from "@/lib/data/headlineMetrics";

export function buildHeadlineLeaderboardRows(): LeaderboardRow[] {
  const bestClassical = bestClassicalPrAuc(HEADLINE_LEADERBOARD);
  const top = HEADLINE_LEADERBOARD[0];
  return HEADLINE_LEADERBOARD.map((m) => ({
    model: m.name,
    family: m.family,
    prAuc: m.prAuc,
    rocAuc: Number.NaN,
    deltaClassical:
      bestClassical === null ? 0 : round4(m.prAuc - bestClassical),
    isTop: top !== undefined && m.name === top.name,
  }));
}

function bestClassicalPrAuc(rows: readonly HeadlineModel[]): number | null {
  const classical = rows.filter((r) => r.family === "classical");
  if (classical.length === 0) return null;
  return classical.reduce((best, r) => (r.prAuc > best ? r.prAuc : best), 0);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
