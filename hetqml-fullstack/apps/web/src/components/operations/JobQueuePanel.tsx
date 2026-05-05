"use client";

import type { OpsJobsResponse } from "@/lib/api/client";
import {
  formatAgo,
  formatDuration,
  formatEta,
  formatUsd,
} from "@/lib/operations/format";

interface Props {
  jobs: OpsJobsResponse;
}

/** Active queue + recent history. The static export uses two separate panels;
 * we follow that structure to match `.ops-job-row` and `.ops-history-table`. */
export function JobQueuePanel({ jobs }: Props) {
  const running = jobs.queue.filter((q) => q.status !== "queued").length;
  const queued = jobs.queue.filter((q) => q.status === "queued").length;

  const completed = jobs.history.filter((h) => h.status === "completed").length;
  const failed = jobs.history.filter((h) => h.status === "failed").length;

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">TOOL · ACTIVE JOB QUEUE</div>
            <div className="panel-title">What&apos;s running now</div>
          </div>
          <span className="badge">Live</span>
        </div>
        <p className="panel-purpose">
          Pending and in-progress jobs across the cluster. Each row links to
          its full execution log.
        </p>
        <div>
          {jobs.queue.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 12 }}>
              No active jobs.
            </p>
          ) : (
            jobs.queue.map((q) => (
              <div key={q.id} className="ops-job-row">
                <span className="ops-job-id">{q.id}</span>
                <span className="ops-job-detail">
                  {q.type}
                  <span className="sub">
                    {q.candidate} · {q.backend}
                  </span>
                </span>
                <span className={`ops-job-status ${q.status}`}>{q.status}</span>
                <span className="ops-job-progress">{q.progressPct}%</span>
                <span className="ops-job-eta">{formatEta(q.etaSeconds)}</span>
              </div>
            ))
          )}
        </div>
        <div className="panel-footer">
          <span>scheduler/queue.json</span>
          <span>
            <em>
              {running} running · {queued} queued
            </em>
          </span>
        </div>
      </section>

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
        <div className="panel-footer">
          <span>jobs/history_24h.json</span>
          <span>
            <em>
              <strong style={{ color: "var(--green)" }}>
                {completed} done
              </strong>{" "}
              ·{" "}
              <strong style={{ color: "var(--sienna)" }}>
                {failed} failed
              </strong>{" "}
              · 24h window
            </em>
          </span>
        </div>
      </section>
    </>
  );
}
