"use client";

import type { OpsResourcesResponse } from "@/lib/api/client";
import { utilizationClass } from "@/lib/operations/format";

interface Props {
  resources: OpsResourcesResponse;
}

/** 6 counters with caps + bars (amber > 65%, sienna > 85%). */
export function ResourceUtilizationPanel({ resources }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · RESOURCE UTILIZATION</div>
          <div className="panel-title">Compute consumed this month</div>
        </div>
        <span className="badge">Diagnostics</span>
      </div>
      <p className="panel-purpose">
        Resource counters and utilization bars. Quantum-second is shots ×
        circuit depth × wall-clock; CPU-hour is wall-clock × core count.
      </p>
      <div className="ops-resource-grid">
        {resources.counters.map((c) => {
          const ratio = c.cap > 0 ? c.used / c.cap : 0;
          const pct = Math.max(0, Math.min(100, ratio * 100));
          const cls = utilizationClass(pct);
          const usedDisplay =
            c.unit === "%"
              ? `${c.used.toFixed(0)}%`
              : c.used.toLocaleString();
          const capDisplay =
            c.unit === "%"
              ? `${c.cap.toFixed(0)}%`
              : `${c.cap.toLocaleString()} ${c.unit}`;
          return (
            <div key={c.label} className="ops-resource-card">
              <div className="ops-resource-head">
                <span className="ops-resource-label">{c.label} · MTD</span>
                <span className="ops-resource-val">
                  {usedDisplay}
                  <span style={{ color: "var(--faint)", fontSize: 10 }}>
                    {" / "}
                    {capDisplay}
                  </span>
                </span>
              </div>
              <div className="ops-resource-bar">
                <div
                  className={`ops-resource-fill ${cls}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="ops-resource-meta">
                {pct.toFixed(0)}% of cap
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel-footer">
        <span>telemetry/resources.json</span>
        <span>
          <em>{resources.counters.length} counters · MTD</em>
        </span>
      </div>
    </section>
  );
}
