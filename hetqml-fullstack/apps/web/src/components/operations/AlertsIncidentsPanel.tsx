"use client";

import type { OpsAlertEntry, OpsAlertsResponse } from "@/lib/api/client";
import { formatAgo } from "@/lib/operations/format";

interface Props {
  alerts: OpsAlertsResponse;
}

const SUBHEAD: React.CSSProperties = {
  fontSize: 10,
  color: "var(--gold)",
  textTransform: "uppercase",
  letterSpacing: 1,
  margin: "12px 0 6px",
};

/**
 * Alerts & Incidents panel.
 *
 * Two explicit subsections: **Active** (unresolved warnings/criticals) and
 * **Resolved (last 7d)**. The split mirrors the static export's `.active` /
 * `.resolved` row modifiers, with eyebrow-style subheadings added so the
 * grouping is unambiguous when many rows are present.
 */
export function AlertsIncidentsPanel({ alerts }: Props) {
  const activeCount = alerts.active.length;
  const resolvedCount = alerts.recentResolved.length;

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

      <div style={SUBHEAD}>
        Active <span style={{ color: "var(--faint)" }}>· {activeCount}</span>
      </div>
      <div>
        {activeCount === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 12 }}>
            No active alerts.
          </p>
        ) : (
          alerts.active.map((a, i) => <Row key={`a-${i}`} a={a} active />)
        )}
      </div>

      <div style={SUBHEAD}>
        Resolved (last 7d){" "}
        <span style={{ color: "var(--faint)" }}>· {resolvedCount}</span>
      </div>
      <div>
        {resolvedCount === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 12 }}>
            No incidents resolved in the last 7 days.
          </p>
        ) : (
          alerts.recentResolved.map((a, i) => (
            <Row key={`r-${i}`} a={a} active={false} />
          ))
        )}
      </div>

      <div className="panel-footer">
        <span>alerts/active.json</span>
        <span>
          <em>
            <strong style={{ color: "var(--amber)" }}>
              {activeCount} active
            </strong>{" "}
            · {resolvedCount} resolved (7d)
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
