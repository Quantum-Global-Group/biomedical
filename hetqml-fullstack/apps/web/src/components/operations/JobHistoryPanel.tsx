"use client";

import type { OpsJobsResponse } from "@/lib/api/client";
import {
  formatAgo,
  formatDuration,
  formatUsd,
} from "@/lib/operations/format";

interface Props {
  jobs: OpsJobsResponse;
}

/**
 * Recent Job History panel.
 *
 * Renders the last 24 hours of completed runs as `.ops-history-table`. Split
 * out from `JobQueuePanel` so each Operations panel maps 1:1 to a section,
 * matching the static export's structure (queue + history are sibling
 * `<section class="panel">` blocks, not nested).
 */
export function JobHistoryPanel({ jobs }: Props) {
  const completed = jobs.history.filter((h) => h.status === "completed").length;
  const failed = jobs.history.filter((h) => h.status === "failed").length;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · RECENT JOB HISTORY</div>
          <div className="panel-title">Last 24 hours of completed runs</div>
        </div>
        <span className="badge">Audit</span>
      </div>
      <p className="panel-purpose">
        Every completed job with status, candidate pair, top model, run path,
        duration, cost, and integrity-guard posture at the time of execution.
      </p>
      {jobs.history.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 12 }}>
          No completed jobs in the last 24 hours.
        </p>
      ) : (
        <table className="ops-history-table">
          <thead>
            <tr>
              <th>JOB ID</th>
              <th>CANDIDATE → DISEASE</th>
              <th>TOP MODEL</th>
              <th>PATH</th>
              <th>STATUS</th>
              <th className="num">DURATION</th>
              <th className="num">COST</th>
              <th className="num">STARTED</th>
            </tr>
          </thead>
          <tbody>
            {jobs.history.map((h) => (
              <tr key={h.id}>
                <td className="mono">{h.id}</td>
                <td>
                  {h.candidate} → {h.disease}
                </td>
                <td>{h.topModel}</td>
                <td>
                  <span className={`bench-path-pill ${h.family}`}>
                    {h.family}
                  </span>
                </td>
                <td>
                  <span
                    className={`ops-job-status ${h.status === "completed" ? "done" : "failed"}`}
                  >
                    {h.status === "completed" ? "✓ done" : "✗ failed"}
                  </span>
                </td>
                <td className="num">{formatDuration(h.durationSeconds)}</td>
                <td className="num">{formatUsd(h.costUsd)}</td>
                <td className="num" style={{ color: "var(--faint)" }}>
                  {formatAgo(h.startedAgoSeconds)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="panel-footer">
        <span>jobs/history_24h.json</span>
        <span>
          <em>
            <strong style={{ color: "var(--green)" }}>{completed} done</strong>{" "}
            ·{" "}
            <strong style={{ color: "var(--sienna)" }}>{failed} failed</strong>{" "}
            · 24h window
          </em>
        </span>
      </div>
    </section>
  );
}
