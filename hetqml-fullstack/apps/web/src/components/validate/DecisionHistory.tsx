"use client";

import type { DecisionRecord } from "@/lib/api/client";
import { TraceId } from "@/components/common/TraceId";

interface Props {
  decisions: readonly DecisionRecord[];
  /** Pair key currently being shown — highlighted in the list. */
  activePairKey: string | null;
  onSelect: (record: DecisionRecord) => void;
  error: string | null;
  /** Underlying error object so the trace id can be surfaced. */
  errorCause?: unknown;
}

function color(verdict: DecisionRecord["verdict"]): string {
  return verdict === "keep"
    ? "var(--green)"
    : verdict === "review"
      ? "var(--amber)"
      : "var(--sienna)";
}

/** Recent decisions across all pairs (server-truth). Click a row to load
 * that pair into the side panels (TrustRadar still shows the active job
 * data; clicked-row decision history populates the side rail). */
export function DecisionHistory({
  decisions,
  activePairKey,
  onSelect,
  error,
  errorCause,
}: Props) {
  const counts = {
    keep: decisions.filter((d) => d.verdict === "keep").length,
    review: decisions.filter((d) => d.verdict === "review").length,
    reject: decisions.filter((d) => d.verdict === "reject").length,
  };
  const avgTrust =
    decisions.length > 0
      ? (
          decisions.reduce((acc, d) => acc + d.trustScore, 0) / decisions.length
        ).toFixed(2)
      : "0.00";

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · DECISION HISTORY</div>
          <div className="panel-title">What you have decided so far</div>
        </div>
        <span className="badge">Audit log</span>
      </div>
      <div className="panel-purpose">
        Server-side decision log (last 50). Each row is reviewer + session +
        timestamp + trust score; the same record sqlite holds for audit.
        Click any row to focus that pair&apos;s decisions in the panel above.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div className="val-stat-card green">
          <div className="val-stat-num green">{counts.keep}</div>
          <div className="val-stat-label">keep</div>
        </div>
        <div className="val-stat-card amber">
          <div className="val-stat-num amber">{counts.review}</div>
          <div className="val-stat-label">review</div>
        </div>
        <div className="val-stat-card sienna">
          <div className="val-stat-num sienna">{counts.reject}</div>
          <div className="val-stat-label">reject</div>
        </div>
        <div className="val-stat-card">
          <div className="val-stat-num">{avgTrust}</div>
          <div className="val-stat-label">avg trust</div>
        </div>
      </div>

      {error ? (
        <div className="skeptic-warning">
          <span style={{ color: "var(--sienna)" }}>⚠</span>
          <span>Failed to load decisions: {error}</span>
          <TraceId err={errorCause} />
        </div>
      ) : null}

      {decisions.length === 0 ? (
        <p className="bench-empty">
          No decisions logged yet. Click Keep / Review / Reject above to start
          a history.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {decisions.map((d) => {
            const active = d.pairKey === activePairKey;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelect(d)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 1fr 1fr 90px 110px",
                  gap: 12,
                  alignItems: "center",
                  padding: "8px 10px",
                  background: active ? "var(--paper-alt)" : "var(--card)",
                  border: `1px solid ${active ? "var(--teal)" : "var(--border-soft)"}`,
                  borderRadius: 4,
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--ink)",
                }}
              >
                <span
                  style={{
                    color: color(d.verdict),
                    fontWeight: 600,
                    textTransform: "uppercase",
                    fontFamily: "monospace",
                  }}
                >
                  {d.verdict}
                </span>
                <span>
                  <strong>{d.selection.compound}</strong>
                  <span style={{ color: "var(--muted)" }}>
                    {" → "}
                    {d.selection.disease}
                  </span>
                </span>
                <span
                  className="mono"
                  style={{ color: "var(--muted)", fontSize: 11 }}
                >
                  {d.topModel}
                </span>
                <span
                  className="mono"
                  style={{ color: "var(--muted)", fontSize: 11 }}
                >
                  trust {d.trustScore.toFixed(2)}
                </span>
                <span
                  className="mono"
                  style={{ color: "var(--faint)", fontSize: 11 }}
                >
                  {new Date(d.timestamp).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="panel-footer">
        <span>GET /decisions?limit=50</span>
        <span>
          <em>{decisions.length} decisions logged</em>
        </span>
      </div>
    </section>
  );
}
