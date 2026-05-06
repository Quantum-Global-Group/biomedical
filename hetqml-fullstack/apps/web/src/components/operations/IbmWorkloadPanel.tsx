"use client";

import Link from "next/link";
import type { IbmWorkloadResponse } from "@/lib/api/client";
import { formatDuration, formatPct, formatUsd } from "@/lib/operations/format";

interface Props {
  ibm: IbmWorkloadResponse;
}

/** IBM Workload panel: per-CRN job tracking and usage.
 *
 * Three states:
 *  - not configured (no CRN on /settings) → empty state with CTA
 *  - configured but not validated → "awaiting validation" state
 *  - configured + validated → connection card + usage + access matrix +
 *    last 5 jobs
 */
export function IbmWorkloadPanel({ ibm }: Props) {
  const badge = ibm.configured
    ? ibm.validated
      ? "Live"
      : "Awaiting validation"
    : "Not configured";

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · IBM WORKLOAD</div>
          <div className="panel-title">Per-CRN job tracking and usage</div>
        </div>
        <span className="badge">{badge}</span>
      </div>
      <p className="panel-purpose">
        IBM Quantum workload scoped to your configured CRN. Quantum-seconds,
        concurrent slots, and per-backend access depend on your IBM Cloud plan.
        Configure on Settings → IBM Quantum Connection.
      </p>

      {!ibm.configured ? (
        <NotConfigured />
      ) : !ibm.validated ? (
        <AwaitingValidation />
      ) : (
        <Connected ibm={ibm} />
      )}

      <div className="panel-footer">
        <span>
          ibm_runtime/instances/
          {ibm.instance ?? "—"}
        </span>
        <span>
          <em>
            {ibm.configured
              ? ibm.validated
                ? `${ibm.recentJobs.length} recent · ${ibm.backendAccess.length} backend tiers`
                : "validation pending"
              : "— add CRN to populate"}
          </em>
        </span>
      </div>
    </section>
  );
}

function NotConfigured() {
  return (
    <div className="ibm-empty">
      <div className="ibm-empty-icon">⊟</div>
      <div className="ibm-empty-title">
        No IBM Quantum connection configured
      </div>
      <div className="ibm-empty-detail">
        Add your IBM Quantum API token and CRN on Settings → IBM Quantum
        Connection. Once validated, this panel will show your account-specific
        workload, quantum-second usage, concurrent job slots, and which
        backends your plan can access.
      </div>
      <Link className="btn-primary" href="/settings">
        Configure on Settings →
      </Link>
    </div>
  );
}

function AwaitingValidation() {
  return (
    <div className="ibm-empty">
      <div className="ibm-empty-icon">⏳</div>
      <div className="ibm-empty-title">Awaiting CRN validation</div>
      <div className="ibm-empty-detail">
        A CRN is configured but has not yet been validated against IBM Quantum.
        Press <strong>Validate connection</strong> on Settings → IBM Quantum
        Connection to populate this panel.
      </div>
      <Link className="btn-primary" href="/settings">
        Validate on Settings →
      </Link>
    </div>
  );
}

function Connected({ ibm }: { ibm: IbmWorkloadResponse }) {
  const usage = ibm.usage;
  return (
    <>
      <div className="ibm-conn-card">
        <div className="ibm-conn-grid">
          <ConnCell label="account" value={ibm.account ?? "—"} mono />
          <ConnCell label="instance" value={ibm.instance ?? "—"} mono />
          <ConnCell label="region" value={ibm.region ?? "—"} />
          <ConnCell label="plan" value={ibm.plan ?? "—"} />
        </div>
      </div>

      {usage ? (
        <div className="ibm-usage-section" style={{ marginTop: 14 }}>
          <UsageRow
            label="Quantum-seconds · MTD"
            value={`${usage.quantumSecondsUsed.toFixed(0)} / ${usage.quantumSecondsAllocated.toFixed(0)}`}
            ratio={usage.quantumSecondsUsed / usage.quantumSecondsAllocated}
          />
          <UsageRow
            label="Concurrent jobs"
            value={`${usage.concurrentJobs}`}
            ratio={Math.min(1, usage.concurrentJobs / 5)}
          />
          <UsageRow
            label="Jobs this month"
            value={`${usage.jobsThisMonth}`}
            ratio={Math.min(1, usage.jobsThisMonth / 200)}
          />
          <UsageRow
            label="Success rate"
            value={formatPct(usage.successRate, 1)}
            ratio={usage.successRate}
          />
          <UsageRow
            label="IBM Cloud spend · MTD"
            value={formatUsd(usage.spendUsd)}
            ratio={Math.min(1, usage.spendUsd / 200)}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          BACKEND ACCESS
        </div>
        <div className="ibm-backends-list">
          {ibm.backendAccess.map((b) => (
            <span
              key={b.backend}
              className={`ibm-backend-pill ${b.access}`}
              title={`${b.backend}: ${b.access}`}
            >
              {b.backend} · {b.access}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          LAST 5 JOBS · {ibm.instance ?? ""}
        </div>
        {ibm.recentJobs.map((j) => (
          <div key={j.id} className="ibm-recent-job">
            <span className="mono" title={j.id}>
              {j.id}
            </span>
            <span>{j.backend}</span>
            <span
              className={`ops-job-status${j.status === "completed" ? " done" : j.status === "failed" ? " failed" : ""}`}
            >
              {j.status === "completed"
                ? "✓ done"
                : j.status === "failed"
                  ? "✗ failed"
                  : j.status}
            </span>
            <span className="num">{formatDuration(j.durationSeconds)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ConnCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="ibm-conn-cell">
      <div className="ibm-conn-cell-label">{label}</div>
      <div className={mono ? "ibm-conn-cell-mono" : "ibm-conn-cell-val"}>
        {value}
      </div>
    </div>
  );
}

function UsageRow({
  label,
  value,
  ratio,
}: {
  label: string;
  value: string;
  ratio: number;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className="ibm-usage-row">
      <div className="ibm-usage-label">{label}</div>
      <div className="ibm-usage-num">{value}</div>
      <div className="ibm-usage-bar">
        <div
          className="ibm-usage-fill"
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
    </div>
  );
}
