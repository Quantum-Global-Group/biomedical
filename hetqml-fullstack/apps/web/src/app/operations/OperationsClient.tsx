"use client";

import Link from "next/link";
import { useOps } from "@/lib/operations/useOps";
import { AlertsIncidentsPanel } from "@/components/operations/AlertsIncidentsPanel";
import { CostBudgetPanel } from "@/components/operations/CostBudgetPanel";
import { DataSourcesPanel } from "@/components/operations/DataSourcesPanel";
import { IbmWorkloadPanel } from "@/components/operations/IbmWorkloadPanel";
import { JobQueuePanel } from "@/components/operations/JobQueuePanel";
import { MetricStrip } from "@/components/operations/MetricStrip";
import { QuantumBackendsPanel } from "@/components/operations/QuantumBackendsPanel";
import { ResourceUtilizationPanel } from "@/components/operations/ResourceUtilizationPanel";
import { StatusPill } from "@/components/operations/StatusPill";
import { SystemHealthGrid } from "@/components/operations/SystemHealthGrid";

/** Operations page client.
 *
 * Mirrors the InitializeClient/ExperimentClient pattern:
 *   - panels are pure components
 *   - data is sourced from a hook (`useOps`) that polls every 5s and falls
 *     back to seed data while requests are in flight or failing
 *   - the hook returns a per-feed `source` flag for telemetry/footers
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
            Platform health, run history, and resource posture
          </h1>
          <p className="lede">
            Operations is the systems-side view: are the quantum backends
            healthy, are upstream data sources fresh, what jobs are running,
            what&apos;s been spent. The Initialize → Visualize pipeline trusts
            that everything here is green.
          </p>
        </div>
        <StatusPill health={ops.health} />
      </div>

      <MetricStrip jobs={ops.jobs} cost={ops.cost} />
      <SystemHealthGrid health={ops.health} />
      <IbmWorkloadPanel ibm={ops.ibm} />

      <div className="grid-2">
        <QuantumBackendsPanel backends={ops.backends} />
        <ResourceUtilizationPanel resources={ops.resources} />
      </div>

      <JobQueuePanel jobs={ops.jobs} />

      <div className="grid-2">
        <CostBudgetPanel cost={ops.cost} />
        <DataSourcesPanel sources={ops.sources} />
      </div>

      <AlertsIncidentsPanel alerts={ops.alerts} />

      {ops.error && someSeed ? (
        <div className="skeptic-warning" style={{ marginTop: 14 }}>
          API offline — showing fallback seed data. ({ops.error})
        </div>
      ) : null}

      <div className="how-to">
        <div className="how-to-h">⊙ HOW TO READ THIS PAGE</div>
        <div className="how-to-title">
          What this view answers — and what to question
        </div>
        <p className="how-lede">
          Operations is for platform engineers, not researchers. Read it before
          kicking off a run. If anything here is amber or red, the science
          pages will inherit fallback labels — interpret accordingly.
        </p>
        <p
          style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}
        >
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
