"use client";

import type { Job } from "@/lib/api/client";
import { RingGauge } from "@/components/charts/RingGauge";
import { Sparkline } from "@/components/charts/Sparkline";

interface Props {
  job: Job;
}

/**
 * Top-of-page reactive metric strip with embedded mini-charts:
 *
 *   - candidate card with run-family stripe
 *   - PR-AUC card: large ring gauge (auto-toned vs 0.65 threshold)
 *   - ROC-AUC card: per-fold sparkline (5-fold CV) so variance is visible
 *   - calibration card: Brier value with ECE caption + tiny sparkline of
 *     the reliability bins
 *
 * Renders gracefully when the job is still queued/running (charts go
 * dim and metric values become em-dashes) so the layout is stable
 * across the polling lifecycle.
 */
export function MetricStrip({ job }: Props) {
  const m = job.result?.metrics ?? job.metrics;
  const detailed = job.result?.detailedMetrics;
  const reliability = job.result?.reliability;

  const fmt = (n: number | undefined | null, digits = 3) =>
    typeof n === "number" ? n.toFixed(digits) : "—";

  const family = job.runPath.family;
  const familyTone =
    family === "classical"
      ? "var(--sienna)"
      : family === "hybrid"
        ? "var(--teal)"
        : "var(--purple)";

  const cvPrAucs = detailed?.cvFolds.map((f) => f.prAuc) ?? [];
  const cvRocAucs = detailed?.cvFolds.map((f) => f.rocAuc) ?? [];
  const reliabilityErrors =
    reliability?.bins.map((b) => Math.abs(b.observed - b.predicted)) ?? [];

  return (
    <div className="metrics" data-mode="experiment">
      {/* Candidate card */}
      <div
        className="metric"
        style={{
          borderTop: `2px solid ${familyTone}`,
        }}
      >
        <div className="metric-label">CANDIDATE</div>
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
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={job.selection.disease || ""}
          >
            {job.selection.disease || "—"}
          </span>
        </div>
      </div>

      {/* PR-AUC ring */}
      <div
        className="metric"
        style={{ display: "flex", alignItems: "center", gap: 14 }}
      >
        <div style={{ flex: 1 }}>
          <div className="metric-label">PR-AUC</div>
          <div className="metric-value teal" style={{ fontSize: 26 }}>
            {fmt(m?.prAuc)}
          </div>
          <div className="metric-sub">
            {family} pipeline · {detailed?.cvStrategy ?? "5-fold CV"}
          </div>
        </div>
        <RingGauge
          value={m?.prAuc ?? 0}
          size={62}
          threshold={0.65}
          sublabel="of 100"
          ariaLabel={`PR-AUC ${fmt(m?.prAuc)}`}
        />
      </div>

      {/* ROC-AUC card with per-fold sparkline */}
      <div className="metric">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div className="metric-label">ROC-AUC</div>
          <div
            style={{
              fontSize: 9.5,
              color: "var(--faint)",
              fontFamily: "var(--font-mono), monospace",
              letterSpacing: "0.04em",
            }}
          >
            {detailed ? `${detailed.cvFolds.length} folds` : "no CV yet"}
          </div>
        </div>
        <div className="metric-value teal">{fmt(m?.rocAuc)}</div>
        <div
          className="metric-sub"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <span>per-fold variance</span>
          <Sparkline
            values={cvRocAucs.length > 0 ? cvRocAucs : cvPrAucs}
            domain={[0.4, 1.0]}
            baseline={m?.rocAuc ?? null}
            color="var(--teal)"
            ariaLabel="Per-fold ROC-AUC"
          />
        </div>
      </div>

      {/* Calibration card with reliability sparkline */}
      <div className="metric">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div className="metric-label">CALIBRATION</div>
          <div
            style={{
              fontSize: 9.5,
              color: "var(--faint)",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            ECE {fmt(m?.ece)}
          </div>
        </div>
        <div className="metric-value">{fmt(m?.brier)}</div>
        <div
          className="metric-sub"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <span>Brier · 10-bin error</span>
          <Sparkline
            values={reliabilityErrors}
            domain={[0, 0.25]}
            color="var(--amber)"
            ariaLabel="Reliability bin errors"
          />
        </div>
      </div>
    </div>
  );
}
