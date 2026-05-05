"use client";

import type { OpsAlertEntry, OpsAlertsResponse } from "@/lib/api/client";
import { formatAgo } from "@/lib/operations/format";

interface Props {
  alerts: OpsAlertsResponse;
}

/** Active warnings + last-7d resolved log. Severity glyphs map to .warn /
 * .crit / .ok via the existing `.ops-alert-icon` styles. */
export function AlertsIncidentsPanel({ alerts }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · ALERTS &amp; INCIDENTS</div>
          <div className="panel-title">Active warnings + recent resolved</div>
        </div>
        <span className="badge">Incidents</span>
      </div>
      <p className="panel-purpose">
        Active warnings (degraded services, calibration drift, budget burn).
        Resolved incidents from the last 7 days for trend awareness.
      </p>
      <div>
        {alerts.active.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 12 }}>
            No active alerts.
          </p>
        ) : (
          alerts.active.map((a, i) => <Row key={`a-${i}`} a={a} active />)
        )}
        {alerts.recentResolved.map((a, i) => (
          <Row key={`r-${i}`} a={a} active={false} />
        ))}
      </div>
      <div className="panel-footer">
        <span>alerts/active.json</span>
        <span>
          <em>
            <strong style={{ color: "var(--amber)" }}>
              {alerts.active.length} active
            </strong>{" "}
            · {alerts.recentResolved.length} resolved (7d)
          </em>
        </span>
      </div>
    </section>
  );
}

function Row({ a, active }: { a: OpsAlertEntry; active: boolean }) {
  const glyph =
    a.severity === "crit" ? "⛔" : a.severity === "warn" ? "⚠" : "✓";
  return (
    <div className={`ops-alert-row ${active ? "active" : "resolved"}`}>
      <span className={`ops-alert-icon ${a.severity}`}>{glyph}</span>
      <span className="ops-alert-msg">
        {a.title}
        <span className="sub">{a.source}</span>
      </span>
      <span className="ops-alert-time">{formatAgo(a.ageSeconds)}</span>
    </div>
  );
}
