"use client";

import type { Job } from "@/lib/api/client";
import { scopeGuards } from "@/lib/experiment/selectors";
import {
  applyToggleOverlay,
  useIntegrityGuards,
} from "@/lib/integrity/useIntegrityGuards";

interface Props {
  job: Job;
}

/** Provenance-style source check. Adapts to run-path family — quantum/hybrid
 * surface the IBM backend, classical falls back to CPU. The fourth card
 * surfaces the integrity-guards subset relevant for this run, overlaid with
 * the user's Initialize toggles (item #8 cascade). */
export function SourceCheckPanel({ job }: Props) {
  const result = job.result;
  const family = job.runPath.family;
  const isQuantumPath = family !== "classical";
  const { catalog, toggles } = useIntegrityGuards();

  const jobShortId = job.id.slice(0, 8);
  const startedAt = new Date(job.createdAt);
  const startedAtUtc = `${pad(startedAt.getUTCHours())}:${pad(
    startedAt.getUTCMinutes(),
  )} UTC`;

  const overlaid = result
    ? applyToggleOverlay(catalog, toggles, result.integrityGuards)
    : null;
  const guards = overlaid ? scopeGuards(overlaid) : null;
  const guardsLabel = guards
    ? guards.failingCritical.length === 0
      ? "all green"
      : `${guards.failingCritical.length} failing`
    : "—";
  const guardsValueClass = guards
    ? guards.failingCritical.length === 0
      ? "green"
      : "sienna"
    : "";

  const apiStatus = result ? "healthy" : job.status;
  const apiSub =
    job.status === "completed"
      ? "200 OK · live result"
      : job.status === "failed"
        ? "5xx · investigate"
        : "polling…";

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · SOURCE CHECK</div>
          <div className="panel-title">Where each piece of evidence comes from</div>
        </div>
        <span className="badge">Provenance</span>
      </div>
      <p className="panel-purpose">
        Before reading any result, see whether the underlying source is live or
        stale. Anything labelled fallback should be looked at with a different
        kind of skepticism than a live one.
      </p>
      <div className="grid-4">
        <div className="source-card">
          <div className="source-card-head">
            <span className="source-card-icon">⊟</span>
            <span className="status-dot" />
          </div>
          <div className="metric-label">API STATUS</div>
          <div className={`source-card-value ${result ? "green" : ""}`}>
            {apiStatus}
          </div>
          <div className="source-card-sub">{apiSub}</div>
        </div>
        <div className="source-card">
          <div className="source-card-head">
            <span className="source-card-icon">▢</span>
            <span className="status-dot" />
          </div>
          <div className="metric-label">LATEST RUN</div>
          <div className="source-card-value mono">job_{jobShortId}</div>
          <div className="source-card-sub">{startedAtUtc} · {job.status}</div>
        </div>
        <div className="source-card">
          <div className="source-card-head">
            <span className="source-card-icon">▤</span>
            <span className="status-dot" />
          </div>
          <div className="metric-label">CANDIDATE SOURCE</div>
          <div className="source-card-value mono">{job.runPath.mode}_results</div>
          <div className="source-card-sub">
            {result
              ? `ranked from PR-AUC ${result.metrics.prAuc.toFixed(3)}`
              : "awaiting completion"}
          </div>
        </div>
        <div className="source-card">
          <div className="source-card-head">
            <span className="source-card-icon">⚙</span>
            <span className="status-dot" />
          </div>
          <div className="metric-label">
            {isQuantumPath ? "QUANTUM SOURCE" : "COMPUTE SOURCE"}
          </div>
          <div className="source-card-value mono">
            {isQuantumPath ? "ibm_torino" : "classical_cpu"}
          </div>
          <div className={`source-card-sub ${guardsValueClass}`}>
            integrity guards · {guardsLabel}
          </div>
        </div>
      </div>
      <div className="panel-footer">
        <span>four upstream services</span>
        <span>
          <em>
            {result
              ? "all live as of run completion"
              : "polling job status"}
          </em>
        </span>
      </div>
    </section>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
