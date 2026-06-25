"use client";

import type { DecisionRecord, DecisionVerdict } from "@/lib/api/client";
import { TraceId } from "@/components/common/TraceId";

interface Props {
  pairKey: string;
  pending: boolean;
  /** Most recent decision for this pair (highest in the pair-decisions list). */
  latestDecision: DecisionRecord | null;
  error: string | null;
  /** Underlying error object (e.g. `ApiError`) so the trace id can be
   *  surfaced alongside the human-readable message. */
  errorCause?: unknown;
  onSubmit: (verdict: DecisionVerdict) => void;
}

const BUTTONS: Array<{
  verdict: DecisionVerdict;
  label: string;
  sub: string;
}> = [
  { verdict: "keep", label: "▢ KEEP", sub: "becomes research lead" },
  { verdict: "review", label: "⌥ Review", sub: "needs more evidence" },
  { verdict: "reject", label: "✕ Reject", sub: "does not meet bar" },
];

/** Three-decision panel — Keep / Review / Reject. POSTs /decisions and
 * triggers a refresh of the decision list. Disabled while a request is in
 * flight; the latest decision pill rides under the buttons. */
export function ReviewerDecisionPanel({
  pairKey,
  pending,
  latestDecision,
  error,
  errorCause,
  onSubmit,
}: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · REVIEWER DECISION</div>
          <div className="panel-title">Log your decision</div>
        </div>
        <span className="badge">Action</span>
      </div>
      <div className="panel-purpose">
        Three decisions, three downstream paths. The decision is logged with
        reviewer, session, timestamp, and trust score so the choice can be
        audited later.
      </div>
      <div className="decision-buttons">
        {BUTTONS.map((btn) => {
          const active = latestDecision?.verdict === btn.verdict;
          return (
            <button
              key={btn.verdict}
              type="button"
              className="decision-btn"
              disabled={pending}
              onClick={() => onSubmit(btn.verdict)}
              style={{
                opacity: pending ? 0.6 : 1,
                borderColor: active ? "var(--teal)" : undefined,
              }}
            >
              <div className="decision-btn-label">{btn.label}</div>
              <div className="decision-btn-sub">{btn.sub}</div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          marginTop: 16,
          fontSize: 11,
          color: "var(--faint)",
        }}
      >
        <div>
          Pair ·{" "}
          <span className="mono" style={{ color: "var(--ink)" }}>
            {pairKey}
          </span>
        </div>
        <div>
          Latest ·{" "}
          <span style={{ color: "var(--ink)" }}>
            {latestDecision ? latestDecision.verdict : "—"}
          </span>
        </div>
        <div>
          Logged ·{" "}
          <span className="mono" style={{ color: "var(--ink)" }}>
            {latestDecision
              ? new Date(latestDecision.timestamp).toLocaleString()
              : "—"}
          </span>
        </div>
      </div>

      {error ? (
        <div className="skeptic-warning" style={{ marginTop: 12 }}>
          <span style={{ color: "var(--sienna)" }}>⚠</span>
          <span>Failed to save decision: {error}</span>
          <TraceId err={errorCause} />
        </div>
      ) : null}

      <div className="panel-footer">
        <span>POST /decisions</span>
        <span>
          <em>
            {latestDecision
              ? `${latestDecision.reviewer} · session ${latestDecision.sessionId}`
              : "no decision yet"}
          </em>
        </span>
      </div>
    </section>
  );
}
