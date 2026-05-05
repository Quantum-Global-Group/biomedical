"use client";

import type {
  OpsCostResponse,
  OpsJobsResponse,
} from "@/lib/api/client";
import { formatEta, formatUsd } from "@/lib/operations/format";

interface Props {
  jobs: OpsJobsResponse;
  cost: OpsCostResponse;
}

/** Top metric strip — Active jobs · Queue depth · Success rate 24h · MTD spend.
 * Numbers derive from /ops/jobs (queue + history) and /ops/cost. */
export function MetricStrip({ jobs, cost }: Props) {
  const active = jobs.queue.filter(
    (q) => q.status !== "queued",
  ).length;
  const queued = jobs.queue.filter((q) => q.status === "queued").length;
  const queuedEta = jobs.queue
    .filter((q) => q.status === "queued")
    .reduce((acc, q) => Math.max(acc, q.etaSeconds), 0);

  const completed = jobs.history.filter((h) => h.status === "completed").length;
  const totalH = jobs.history.length;
  const successRate = totalH > 0 ? (completed / totalH) * 100 : 0;

  const budgetPct =
    cost.monthlyBudget > 0 ? (cost.mtdSpend / cost.monthlyBudget) * 100 : 0;
  const linearPct =
    cost.monthlyBudget > 0 ? (cost.linearPace / cost.monthlyBudget) * 100 : 0;
  let spendClass: "green" | "amber" | "sienna" = "green";
  if (budgetPct > linearPct + 10) spendClass = "sienna";
  else if (budgetPct > linearPct) spendClass = "amber";

  return (
    <div className="metrics">
      <div className="metric">
        <div className="metric-label">ACTIVE JOBS</div>
        <div className="metric-value" style={{ fontSize: 24 }}>
          {active}
        </div>
        <div className="metric-sub">currently executing</div>
      </div>
      <div className="metric">
        <div className="metric-label">QUEUE DEPTH</div>
        <div className="metric-value" style={{ fontSize: 24 }}>
          {queued}
        </div>
        <div className="metric-sub">
          {queued > 0 ? `${formatEta(queuedEta)} wait` : "no waiting jobs"}
        </div>
      </div>
      <div className="metric">
        <div className="metric-label">SUCCESS RATE · 24H</div>
        <div className="metric-value teal" style={{ fontSize: 24 }}>
          {successRate.toFixed(1)}%
        </div>
        <div className="metric-sub">
          {completed}/{totalH} jobs · 24h
        </div>
      </div>
      <div className="metric">
        <div className="metric-label">SPEND · MTD</div>
        <div
          className={`metric-value ${spendClass}`}
          style={{ fontSize: 24 }}
        >
          {formatUsd(cost.mtdSpend)}
        </div>
        <div className="metric-sub">
          {budgetPct.toFixed(0)}% of {formatUsd(cost.monthlyBudget)} budget
        </div>
      </div>
    </div>
  );
}
