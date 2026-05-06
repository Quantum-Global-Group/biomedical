"use client";

import type { OpsJobsResponse } from "@/lib/api/client";
import { isLiteMode } from "@/lib/liteMode";
import { formatEta } from "@/lib/operations/format";

interface Props {
  jobs: OpsJobsResponse;
}

/**
 * Active Job Queue panel.
 *
 * Pending and in-progress jobs across the cluster. Recent (completed/failed)
 * history lives in a sibling `JobHistoryPanel`, mirroring the static export
 * which renders queue and history as two separate `<section class="panel">`
 * blocks.
 */
export function JobQueuePanel({ jobs }: Props) {
  const running = jobs.queue.filter((q) => q.status !== "queued").length;
  const queued = jobs.queue.filter((q) => q.status === "queued").length;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · ACTIVE JOB QUEUE</div>
          <div className="panel-title">What&apos;s running now</div>
        </div>
        <span className="badge">{isLiteMode() ? "Demo" : "Live"}</span>
      </div>
      <p className="panel-purpose">
        Pending and in-progress jobs across the cluster. Each row links to its
        full execution log.
      </p>
      <div>
        {jobs.queue.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 12 }}>
            No active jobs.
          </p>
        ) : (
          jobs.queue.map((q) => (
            <div key={q.id} className="ops-job-row">
              <span className="ops-job-id" title={q.id}>
                {q.id}
              </span>
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
  );
}
