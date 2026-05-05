"use client";

import type { OpsHealthResponse, OpsService } from "@/lib/api/client";
import { formatAgo } from "@/lib/operations/format";

interface Props {
  health: OpsHealthResponse;
}

function probeAge(svc: OpsService): string {
  const t = Date.parse(svc.lastProbe);
  if (!Number.isFinite(t)) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - t) / 1000));
  return formatAgo(seconds);
}

/** 3×3 grid of service tiles for /ops/health. */
export function SystemHealthGrid({ health }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · SYSTEM HEALTH</div>
          <div className="panel-title">Service status across the platform</div>
        </div>
        <span className="badge">Monitor</span>
      </div>
      <p className="panel-purpose">
        Every external dependency this dashboard relies on. Anything degraded
        turns the platform into &quot;fallback mode&quot; — the source check on
        Experiment will mark the affected source as fallback rather than live.
      </p>
      <div className="ops-health-grid">
        {health.services.map((svc) => (
          <div
            key={svc.id}
            className={`ops-health-card${svc.state !== "healthy" ? " " + svc.state : ""}`}
          >
            <div className="ops-health-head">
              <div className="ops-health-name">{svc.label}</div>
              <div className={`ops-health-status ${svc.state}`}>
                {svc.state}
              </div>
            </div>
            <div className="ops-health-detail">
              latency {svc.latencyMs.toFixed(0)}ms · uptime{" "}
              {(svc.uptime30d * 100).toFixed(2)}% (30d)
            </div>
            <div className="ops-health-meta">
              last probe: {probeAge(svc)} · {svc.latencyMs.toFixed(0)}ms
            </div>
          </div>
        ))}
      </div>
      <div className="panel-footer">
        <span>health/probe.json</span>
        <span>
          <em>
            {health.healthyCount}/{health.totalCount} services healthy
          </em>
        </span>
      </div>
    </section>
  );
}
