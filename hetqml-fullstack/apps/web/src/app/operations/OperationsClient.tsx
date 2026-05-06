"use client";

import Link from "next/link";
import { useOps } from "@/lib/operations/useOps";
import { isLiteMode } from "@/lib/liteMode";
import { AlertsIncidentsPanel } from "@/components/operations/AlertsIncidentsPanel";
import { CostBudgetPanel } from "@/components/operations/CostBudgetPanel";
import { DataSourcesPanel } from "@/components/operations/DataSourcesPanel";
import { IbmWorkloadPanel } from "@/components/operations/IbmWorkloadPanel";
import { JobHistoryPanel } from "@/components/operations/JobHistoryPanel";
import { JobQueuePanel } from "@/components/operations/JobQueuePanel";
import { MetricStrip } from "@/components/operations/MetricStrip";
import { QuantumBackendsPanel } from "@/components/operations/QuantumBackendsPanel";
import { ResourceUtilizationPanel } from "@/components/operations/ResourceUtilizationPanel";
import { StatusPill } from "@/components/operations/StatusPill";
import { SystemHealthGrid } from "@/components/operations/SystemHealthGrid";

const IS_LITE = isLiteMode();

/** Operations page client.
 *
 * Two layouts:
 *   - Standalone (full): every panel — MetricStrip, SystemHealth,
 *     IbmWorkload, QuantumBackends, ResourceUtilization, JobQueue,
 *     JobHistory, CostBudget, DataSources, AlertsIncidents — driven
 *     by `useOps()` polling /ops/* every 5s with seed fallback.
 *   - Lite (HF Space, static export): focused 3-panel layout matching
 *     the lite Settings page — top-level metrics, IBM workload, and
 *     the active job queue. The other panels are operational depth
 *     that doesn't earn its space in a public demo with seed data.
 */
export function OperationsClient() {
  const ops = useOps();

  const allLive = Object.values(ops.source).every((s) => s === "live");
  const someSeed = Object.values(ops.source).some((s) => s === "seed");

  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">SYSTEM · OPERATIONS</div>
          <h1 className="h1">
            {IS_LITE
              ? "Quantum workload and active job queue"
              : "Platform health, run history, and resource posture"}
          </h1>
          <p className="lede">
            {IS_LITE
              ? "The systems-side view of what's running. Top-level metrics, the IBM Quantum workload, and the active job queue."
              : "Operations is the systems-side view: are the quantum backends healthy, are upstream data sources fresh, what jobs are running, what's been spent. The Initialize → Visualize pipeline trusts that everything here is green."}
          </p>
        </div>
        <StatusPill health={ops.health} />
      </div>

      <MetricStrip jobs={ops.jobs} cost={ops.cost} />
      <IbmWorkloadPanel ibm={ops.ibm} />
      <JobQueuePanel jobs={ops.jobs} />

      {IS_LITE ? null : (
        <>
          <SystemHealthGrid health={ops.health} />

          <div className="grid-2">
            <QuantumBackendsPanel backends={ops.backends} />
            <ResourceUtilizationPanel resources={ops.resources} />
          </div>

          <JobHistoryPanel jobs={ops.jobs} />

          <div className="grid-2">
            <CostBudgetPanel cost={ops.cost} />
            <DataSourcesPanel sources={ops.sources} />
          </div>

          <AlertsIncidentsPanel alerts={ops.alerts} />
        </>
      )}

      {IS_LITE ? null : ops.error && someSeed ? (
        <div className="skeptic-warning" style={{ marginTop: 14 }}>
          API offline — showing fallback seed data. ({ops.error})
        </div>
      ) : null}

      {IS_LITE ? null : (
        <div className="how-to">
          <div className="how-to-h">⊙ HOW TO READ THIS PAGE</div>
          <div className="how-to-title">
            What this view answers — and what to question
          </div>
          <p className="how-lede">
            Operations is for platform engineers, not researchers. Read it
            before kicking off a run. If anything here is amber or red, the
            science pages will inherit fallback labels — interpret accordingly.
          </p>
          <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>
            {allLive
              ? "All eight feeds live."
              : someSeed
                ? "Some feeds are showing seed fallback."
                : "Mixed sources — see footer."}
            {ops.lastUpdated
              ? ` · last refresh ${ops.lastUpdated.toLocaleTimeString()}`
              : ""}
          </p>
        </div>
      )}

      <div className="footer-actions">
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/initialize">
            ⌥ Back to Initialize
          </Link>
        </div>
        <Link className="btn-primary" href="/experiment">
          View latest experiment →
        </Link>
      </div>
    </>
  );
}
