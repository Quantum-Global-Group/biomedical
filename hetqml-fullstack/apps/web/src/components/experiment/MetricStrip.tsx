"use client";

import type { Job } from "@/lib/api/client";

interface Props {
  job: Job;
}

/** Top-of-page reactive metric strip — pulls disease/compound from selection
 * and the four headline numbers from result.metrics. Renders dashes when the
 * job is still queued/running so layout stays stable. */
export function MetricStrip({ job }: Props) {
  const m = job.result?.metrics ?? job.metrics;
  const fmt = (n: number | undefined | null) =>
    typeof n === "number" ? n.toFixed(3) : "—";

  return (
    <div className="metrics">
      <div className="metric">
        <div className="metric-label">CANDIDATE</div>
        <div className="metric-value" style={{ fontSize: 16 }}>
          {job.selection.compound || "—"}
        </div>
        <div className="metric-sub">{job.selection.disease || "—"}</div>
      </div>
      <div className="metric">
        <div className="metric-label">PR-AUC</div>
        <div className="metric-value teal">{fmt(m?.prAuc)}</div>
        <div className="metric-sub">{job.runPath.family} pipeline</div>
      </div>
      <div className="metric">
        <div className="metric-label">ROC-AUC</div>
        <div className="metric-value teal">{fmt(m?.rocAuc)}</div>
        <div className="metric-sub">held-out test set</div>
      </div>
      <div className="metric">
        <div className="metric-label">CALIBRATION</div>
        <div className="metric-value">{fmt(m?.brier)}</div>
        <div className="metric-sub">Brier · ECE {fmt(m?.ece)}</div>
      </div>
    </div>
  );
}
