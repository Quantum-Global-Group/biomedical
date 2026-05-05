"use client";

import type { DecisionRecord, Job } from "@/lib/api/client";

interface Props {
  job: Job;
  /** Latest decision for the active pair, or null if none yet. */
  latestDecision: DecisionRecord | null;
}

/** Reactive metric strip for the Validate page:
 *   candidate · model + score · composite trust · current decision pill. */
export function MetricStrip({ job, latestDecision }: Props) {
  const result = job.result;
  const topRow = result?.leaderboard.find((r) => r.isTop);
  const topModel = topRow?.model ?? "—";
  const modelScore = topRow?.prAuc ?? result?.metrics.prAuc ?? null;
  const trust = result?.trustScorecard.composite ?? null;
  const trustPct = trust !== null ? Math.round(trust * 100) : null;

  const decisionLabel = latestDecision ? latestDecision.verdict : "pending";
  const decisionColor = latestDecision
    ? latestDecision.verdict === "keep"
      ? "var(--green)"
      : latestDecision.verdict === "review"
        ? "var(--amber)"
        : "var(--sienna)"
    : "var(--faint)";
  const decisionSub = latestDecision
    ? `${latestDecision.reviewer} · ${new Date(
        latestDecision.timestamp,
      ).toLocaleString()}`
    : "no reviewer logged";

  let trustClass = "metric-value large";
  if (trust !== null) {
    trustClass +=
      trust >= 0.65 ? " green" : trust >= 0.45 ? " amber" : " sienna";
  }

  return (
    <div className="metrics">
      <div className="metric">
        <div className="metric-label">CANDIDATE</div>
        <div className="metric-value" style={{ fontSize: 18 }}>
          {job.selection.compound || "—"}
        </div>
        <div className="metric-sub">{job.selection.disease || "—"}</div>
      </div>
      <div className="metric">
        <div className="metric-label">MODEL SCORE</div>
        <div className="metric-value teal large">
          {modelScore !== null ? modelScore.toFixed(3) : "—"}
        </div>
        <div className="metric-sub">{topModel} · prediction probability</div>
      </div>
      <div className="metric">
        <div className="metric-label">COMPOSITE TRUST</div>
        <div className={trustClass}>
          {trustPct !== null ? `${trustPct}/100` : "—"}
        </div>
        <div className="metric-sub">5-axis weighted average</div>
      </div>
      <div className="metric">
        <div className="metric-label">DECISION</div>
        <div
          className="metric-value"
          style={{ fontSize: 18, color: decisionColor }}
        >
          {decisionLabel}
        </div>
        <div className="metric-sub">{decisionSub}</div>
      </div>
    </div>
  );
}
