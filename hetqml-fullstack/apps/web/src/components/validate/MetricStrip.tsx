"use client";

import type { DecisionRecord, Job } from "@/lib/api/client";
import { RingGauge } from "@/components/charts/RingGauge";
import { Sparkline } from "@/components/charts/Sparkline";

interface Props {
  job: Job;
  /** Latest decision for the active pair, or null if none yet. */
  latestDecision: DecisionRecord | null;
  /** Optional pair-decision history (most recent first). Powers the
   * trust-trend sparkline beneath the trust gauge. */
  pairDecisions?: DecisionRecord[];
}

/**
 * Validate-page metric strip with embedded mini-charts:
 *
 *   - candidate card (compound · disease) with verdict-tinted edge
 *   - model-score card (PR-AUC of the top model) + ring gauge
 *   - composite-trust card (5-axis weighted average) + ring gauge
 *     auto-toned vs the 0.65 threshold
 *   - decision card (latest verdict pill) + sparkline of trust-scores
 *     across the pair's prior decisions, so the reviewer sees momentum
 */
export function MetricStrip({
  job,
  latestDecision,
  pairDecisions = [],
}: Props) {
  const result = job.result;
  const topRow = result?.leaderboard.find((r) => r.isTop);
  const topModel = topRow?.model ?? "—";
  const modelScore = topRow?.prAuc ?? result?.metrics.prAuc ?? null;
  const trust = result?.trustScorecard.composite ?? null;
  const trustPct = trust !== null ? Math.round(trust * 100) : null;

  const decisionLabel = latestDecision ? latestDecision.verdict : "pending";
  const decisionColor = latestDecision
    ? latestDecision.verdict === "keep"
      ? "var(--green)"
      : latestDecision.verdict === "review"
        ? "var(--amber)"
        : "var(--sienna)"
    : "var(--faint)";
  const decisionGlyph = latestDecision
    ? latestDecision.verdict === "keep"
      ? "✓"
      : latestDecision.verdict === "review"
        ? "?"
        : "✕"
    : "○";
  const decisionSub = latestDecision
    ? `${latestDecision.reviewer} · ${new Date(
        latestDecision.timestamp,
      ).toLocaleString()}`
    : "no reviewer logged";

  // Trust trend across prior pair decisions, oldest → newest. Empty when
  // this is the first decision on the pair.
  const trustHistory = [...pairDecisions]
    .reverse()
    .map((d) => d.trustScore)
    .filter((v): v is number => typeof v === "number");

  return (
    <div className="metrics" data-mode="validate">
      {/* Candidate */}
      <div
        className="metric"
        style={{
          borderTop: `2px solid ${decisionColor}`,
        }}
      >
        <div className="metric-label">CANDIDATE</div>
        <div
          className="metric-value"
          style={{
            fontSize: 18,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={job.selection.compound || ""}
        >
          {job.selection.compound || "—"}
        </div>
        <div
          className="metric-sub"
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={job.selection.disease || ""}
        >
          {job.selection.disease || "—"}
        </div>
      </div>

      {/* Model score with PR-AUC ring */}
      <div
        className="metric"
        style={{ display: "flex", alignItems: "center", gap: 14 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="metric-label">MODEL SCORE</div>
          <div className="metric-value teal large">
            {modelScore !== null ? modelScore.toFixed(3) : "—"}
          </div>
          <div
            className="metric-sub"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={topModel}
          >
            {topModel}
          </div>
        </div>
        <RingGauge
          value={modelScore ?? 0}
          size={58}
          threshold={0.65}
          color="var(--teal)"
          sublabel="PR-AUC"
          label={modelScore !== null ? Math.round(modelScore * 100).toString() : "—"}
        />
      </div>

      {/* Composite trust ring */}
      <div
        className="metric"
        style={{ display: "flex", alignItems: "center", gap: 14 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="metric-label">COMPOSITE TRUST</div>
          <div
            className="metric-value large"
            style={{ color: "var(--ink)" }}
          >
            {trustPct !== null ? `${trustPct}/100` : "—"}
          </div>
          <div className="metric-sub">5-axis weighted</div>
        </div>
        <RingGauge
          value={trust ?? 0}
          size={62}
          threshold={0.65}
          ariaLabel={`Composite trust ${trustPct ?? "—"}/100`}
        />
      </div>

      {/* Decision pill + history sparkline */}
      <div className="metric">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div className="metric-label">DECISION</div>
          <div
            style={{
              fontSize: 9.5,
              color: "var(--faint)",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {pairDecisions.length} prior
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 2,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: `${decisionColor}22`,
              border: `1px solid ${decisionColor}`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              color: decisionColor,
              fontSize: 12,
            }}
          >
            {decisionGlyph}
          </span>
          <span
            className="metric-value"
            style={{
              fontSize: 18,
              color: decisionColor,
              textTransform: "capitalize",
            }}
          >
            {decisionLabel}
          </span>
        </div>
        <div
          className="metric-sub"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {decisionSub}
          </span>
          {trustHistory.length > 0 && (
            <Sparkline
              values={trustHistory}
              domain={[0, 1]}
              baseline={0.65}
              color={decisionColor}
              fill={false}
              width={56}
              height={18}
              ariaLabel="Trust history for this pair"
            />
          )}
        </div>
      </div>
    </div>
  );
}
