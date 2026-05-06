"use client";

import type { Job, JobResult } from "@/lib/api/client";
import { RingGauge } from "@/components/charts/RingGauge";

interface Props {
  job: Job;
  result: JobResult;
  /** Optional DrugBank ID resolved from the catalog for the active compound. */
  drugbankId?: string | null;
  /** Optional therapeutic class resolved from the catalog. */
  therapeuticClass?: string | null;
}

/**
 * Visualize-page metric strip — per-compound metadata band shown above the
 * evidence panels. Mirrors the layout of the Experiment / Validate strips
 * (4 cards, ring gauge on the model card) but the content contract is
 * different: this strip describes *what's being inspected*, not *how well
 * the model scored*.
 *
 * Cards (left → right):
 *   1. Compound — name + DrugBank ID + therapeutic class, edge-tinted by
 *      the run path family
 *   2. Disease — anchor target + run path mode
 *   3. Top model — model name + PR-AUC ring gauge
 *   4. Evidence source — primary path step count + dominant provenance
 *      source (most-cited file in the timeline) so the reviewer sees where
 *      the evidence is coming from at a glance
 *
 * The strip stays robust when fields are missing: each card falls back to
 * em-dashes so layout never collapses.
 */
export function MetricStrip({
  job,
  result,
  drugbankId,
  therapeuticClass,
}: Props) {
  const family = job.runPath.family;
  const familyTone =
    family === "classical"
      ? "var(--sienna)"
      : family === "hybrid"
        ? "var(--teal)"
        : "var(--purple)";

  const topRow =
    result.leaderboard.find((r) => r.isTop) ?? result.leaderboard[0] ?? null;
  const topModel = topRow?.model ?? "—";
  const modelScore = topRow?.prAuc ?? result.metrics.prAuc ?? null;

  const stepCount = result.evidencePath.steps.length;
  const provenanceSource = dominantProvenanceSource(result);

  return (
    <div className="metrics" data-mode="visualize">
      {/* Compound card */}
      <div
        className="metric"
        style={{ borderTop: `2px solid ${familyTone}` }}
      >
        <div className="metric-label">COMPOUND</div>
        <div
          className="metric-value"
          style={{
            fontSize: 16,
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
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              color: "var(--muted)",
            }}
          >
            {drugbankId ?? "—"}
          </span>
          {therapeuticClass && (
            <>
              <span style={{ color: "var(--faint)" }}>·</span>
              <span style={{ textTransform: "capitalize" }}>
                {therapeuticClass.replace(/-/g, " ")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Disease / run-path card */}
      <div className="metric">
        <div className="metric-label">DISEASE · RUN PATH</div>
        <div
          className="metric-value"
          style={{
            fontSize: 16,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={job.selection.disease || ""}
        >
          {job.selection.disease || "—"}
        </div>
        <div
          className="metric-sub"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: familyTone,
              boxShadow: `0 0 6px ${familyTone}`,
            }}
          />
          <span style={{ textTransform: "capitalize" }}>{family}</span>
          <span style={{ color: "var(--faint)" }}>·</span>
          <span style={{ textTransform: "capitalize" }}>
            {job.runPath.mode || "—"}
          </span>
        </div>
      </div>

      {/* Top model card with PR-AUC ring */}
      <div
        className="metric"
        style={{ display: "flex", alignItems: "center", gap: 14 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="metric-label">TOP MODEL</div>
          <div
            className="metric-value teal"
            style={{
              fontSize: 16,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={topModel}
          >
            {topModel}
          </div>
          <div className="metric-sub">
            PR-AUC{" "}
            {typeof modelScore === "number" ? modelScore.toFixed(3) : "—"}
          </div>
        </div>
        <RingGauge
          value={modelScore ?? 0}
          size={58}
          threshold={0.65}
          color="var(--teal)"
          sublabel="PR-AUC"
          label={
            typeof modelScore === "number"
              ? Math.round(modelScore * 100).toString()
              : "—"
          }
          ariaLabel={`Top model PR-AUC ${
            typeof modelScore === "number" ? modelScore.toFixed(3) : "unknown"
          }`}
        />
      </div>

      {/* Evidence source card */}
      <div className="metric">
        <div className="metric-label">EVIDENCE SOURCE</div>
        <div
          className="metric-value"
          style={{ fontSize: 16 }}
          title={`${stepCount} path steps`}
        >
          {stepCount > 0 ? `${stepCount}-step path` : "—"}
        </div>
        <div
          className="metric-sub"
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono), monospace",
          }}
          title={provenanceSource ?? ""}
        >
          {provenanceSource ?? "no provenance source"}
        </div>
      </div>
    </div>
  );
}

/** Pick the most-cited provenance source path; ties broken by recency. */
function dominantProvenanceSource(result: JobResult): string | null {
  const counts = new Map<string, number>();
  for (const ev of result.provenance) {
    counts.set(ev.source, (counts.get(ev.source) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [src, n] of counts) {
    if (n > bestCount) {
      best = src;
      bestCount = n;
    }
  }
  return best;
}
