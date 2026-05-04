"use client";

import { useMemo } from "react";
import {
  evaluateInvestigation,
  getNextRecommendedField,
  FIELD_LABELS,
  type FieldName,
  type Selection,
} from "@/lib/investigation/recommendations";

interface Props {
  selection: Selection;
  onApplyField: (field: FieldName, value: string) => void;
  embedded?: boolean;
}

export function RecommendationCard({
  selection,
  onApplyField,
  embedded = false,
}: Props) {
  const evaluation = useMemo(
    () => evaluateInvestigation(selection),
    [selection],
  );
  const next = useMemo(() => getNextRecommendedField(selection), [selection]);
  const rec = evaluation.primaryRecommendation;

  const body = (
    <>
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · RECOMMENDATION ENGINE</div>
          <div className="panel-title">
            Recommended combination for this investigation
          </div>
        </div>
        <span className="badge">
          {evaluation.label} · {evaluation.score}%
        </span>
      </div>
      <p className="panel-purpose">
        Based on the current selections, this bundle is the most coherent
        disease-compound-gene-metaedge combination to investigate next.
      </p>
      {next ? (
        <button
          type="button"
          className="btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => onApplyField(next.field, next.value)}
        >
          <span style={{ fontSize: 10, opacity: 0.85, display: "block" }}>
            RECOMMENDED {next.label.toUpperCase()}
          </span>
          <span>{next.value}</span>
        </button>
      ) : (
        <div className="badge" style={{ display: "block", textAlign: "center" }}>
          Recommended sequence complete · all four fields aligned
        </div>
      )}
      <div className="metrics" style={{ marginTop: 14 }}>
        {(Object.keys(FIELD_LABELS) as FieldName[]).map((field) => (
          <div key={field} className="metric">
            <div className="metric-label">{FIELD_LABELS[field]}</div>
            <div className="metric-value">{rec[field]}</div>
          </div>
        ))}
      </div>
      <div className="ctx-section">
        <div className="ctx-section-h">WHY THIS COMBINATION</div>
        <ul className="ctx-description" style={{ margin: 0, paddingLeft: 18 }}>
          {evaluation.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div
        style={{
          marginTop: 18,
          paddingTop: 18,
          borderTop: "1px solid var(--border-soft)",
        }}
      >
        {body}
      </div>
    );
  }

  return <section className="panel">{body}</section>;
}
