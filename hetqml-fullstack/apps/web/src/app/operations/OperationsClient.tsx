"use client";

import Link from "next/link";
import { useOps } from "@/lib/operations/useOps";
import {
  isLiteMode,
  isLiteStaticDemo,
  useRemoteApiInLite,
  LITE_BACKEND_LINKED_BODY,
  LITE_BANNER_BODY,
} from "@/lib/liteMode";
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
/** Full Ops UI: Fly/standalone builds, or lite static export compiled with linked API. */
const OPS_FULL_UI = !IS_LITE || useRemoteApiInLite();

/** Operations page client.
 *
 * Two layouts:
 *   - Standalone (full): every panel — MetricStrip, SystemHealth,
 *     IbmWorkload, QuantumBackends, ResourceUtilization, JobQueue,
 *     JobHistory, CostBudget, DataSources, AlertsIncidents — driven
 *     by `useOps()` polling /ops/* every 5s with seed fallback.
 *   - Lite static demo: top three panels + fixtures (`isLiteStaticDemo()`).
 *   - Lite linked API (`NEXT_PUBLIC_LITE_REMOTE_API`): same panels + polling +
 *     refresh + deep stack as Hetionet Full.
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
            {OPS_FULL_UI
              ? "Platform health, run history, and resource posture"
              : "Quantum workload and active job queue"}
          </h1>
          <p className="lede">
            {OPS_FULL_UI
              ? "Operations is the systems-side view: are the quantum backends healthy, are upstream data sources fresh, what jobs are running, what's been spent. The Initialize → Visualize pipeline trusts that everything here is green."
              : "Same three blocks as Hetionet Full — metrics, IBM workload, job queue — with illustrative fixtures (no backend in this demo build)."}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          {OPS_FULL_UI ? (
            <button
              type="button"
              className="btn"
              disabled={ops.refreshing}
              aria-busy={ops.refreshing}
              title="Pull the latest Operations data (queues, ETAs, IBM workload)"
              onClick={() => void ops.refresh()}
            >
              {ops.refreshing ? "Refreshing…" : "Refresh feeds"}
            </button>
          ) : null}
          <StatusPill health={ops.health} />
        </div>
      </div>

      <MetricStrip jobs={ops.jobs} cost={ops.cost} />
      {IS_LITE ? (
        <div
          className="panel"
          style={{
            marginTop: 14,
            borderColor: isLiteStaticDemo() ? "var(--gold)" : "var(--teal)",
            padding: "12px 16px",
          }}
          role="note"
        >
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>
            {isLiteStaticDemo() ? LITE_BANNER_BODY : LITE_BACKEND_LINKED_BODY}
          </p>
        </div>
      ) : null}
      <IbmWorkloadPanel ibm={ops.ibm} />
      <JobQueuePanel jobs={ops.jobs} />

      {!OPS_FULL_UI ? null : (
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

      {!OPS_FULL_UI ? null : ops.error && someSeed ? (
        <div className="skeptic-warning" style={{ marginTop: 14 }}>
          API offline — showing fallback seed data. ({ops.error})
        </div>
      ) : null}

      {!OPS_FULL_UI ? null : (
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
