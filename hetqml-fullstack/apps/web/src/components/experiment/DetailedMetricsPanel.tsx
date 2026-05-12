"use client";

import type { JobResult } from "@/lib/api/client";
import { cvFoldPct } from "@/lib/experiment/selectors";

interface Props {
  result: JobResult;
}

/** Top-model bootstrap CIs + 5-fold CV bars. The metric value class uses
 * `teal` for the headline metrics, `green` for Brier (lower-is-better, but
 * we're showing a low-Brier as positive). */
export function DetailedMetricsPanel({ result }: Props) {
  const { detailedMetrics } = result;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · DETAILED METRICS</div>
          <div className="panel-title">Top model — full metric breakdown</div>
        </div>
        <span className="badge">Diagnostics</span>
      </div>
      <p className="panel-purpose">
        Beyond PR-AUC: ROC-AUC, F1, calibration, and per-fold variance.
        Bootstrap CIs at 1,000 resamples.
      </p>

      {/* Folds provenance banner */}
      {detailedMetrics.foldsReal ? (
        <div
          style={{
            marginTop: 8,
            marginBottom: 8,
            padding: "8px 12px",
            background: "var(--green-bg, #0d2010)",
            border: "1px solid var(--green, #4caf72)",
            borderRadius: 6,
            fontSize: 11.5,
            lineHeight: 1.55,
            color: "var(--ink)",
          }}
        >
          <strong>● Real CV fold data</strong> — the 5 per-fold PR-AUC and
          ROC-AUC values below are the actual scores from each cross-validation
          fold of this run.
        </div>
      ) : (
        <div
          style={{
            marginTop: 8,
            marginBottom: 8,
            padding: "8px 12px",
            background: "var(--amber-bg, #2d2510)",
            border: "1px solid var(--amber, #d4a574)",
            borderRadius: 6,
            fontSize: 11.5,
            lineHeight: 1.55,
            color: "var(--ink)",
          }}
        >
          <strong>⚠ Provenance disclosure (folds)</strong> — per-fold scores
          shown here are{" "}
          <strong>deterministic jitter around the base metric</strong>, not real
          fold values. Base metrics (PR-AUC, ROC-AUC, Brier, ECE) are real.
        </div>
      )}

      {/* CI provenance banner */}
      {detailedMetrics.cisReal ? (
        <div
          style={{
            marginTop: 0,
            marginBottom: 12,
            padding: "8px 12px",
            background: "var(--green-bg, #0d2010)",
            border: "1px solid var(--green, #4caf72)",
            borderRadius: 6,
            fontSize: 11.5,
            lineHeight: 1.55,
            color: "var(--ink)",
          }}
        >
          <strong>● Real bootstrap CIs</strong> — 95% confidence intervals are
          computed from 1,000 paired bootstrap resamples of the
          cross-validated predictions.
        </div>
      ) : (
        <div
          style={{
            marginTop: 0,
            marginBottom: 12,
            padding: "8px 12px",
            background: "var(--amber-bg, #2d2510)",
            border: "1px solid var(--amber, #d4a574)",
            borderRadius: 6,
            fontSize: 11.5,
            lineHeight: 1.55,
            color: "var(--ink)",
          }}
        >
          <strong>⚠ Provenance disclosure (CIs)</strong> — 95% confidence
          intervals are a fixed ±0.04 scaffold, not a real bootstrap. Do not
          cite CI widths in a paper.
        </div>
      )}
      <div className="exp-metrics-grid">
        {detailedMetrics.metricCis.map((ci) => {
          const valClass =
            ci.name === "PR-AUC" || ci.name === "ROC-AUC"
              ? "teal"
              : ci.name === "Brier"
                ? "green"
                : "";
          return (
            <div key={ci.name} className="exp-metric-card">
              <div className="exp-metric-card-h">{ci.name}</div>
              <div className={`exp-metric-card-val ${valClass}`}>
                {ci.value.toFixed(3)}
              </div>
              <div className="exp-metric-card-ci">
                95% CI [{ci.ciLow.toFixed(3)} – {ci.ciHigh.toFixed(3)}]
              </div>
            </div>
          );
        })}
      </div>
      <div className="exp-cv-section">
        <div className="exp-section-h">5-FOLD CROSS-VALIDATION (PR-AUC)</div>
        <div className="exp-cv-bars">
          {detailedMetrics.cvFolds.map((fold) => (
            <div key={fold.fold} className="exp-cv-bar">
              <div className="exp-cv-bar-label">FOLD {fold.fold}</div>
              <div className="exp-cv-bar-track">
                <div
                  className="exp-cv-bar-fill"
                  style={{ width: `${cvFoldPct(fold.prAuc)}%` }}
                />
              </div>
              <div className="exp-cv-bar-val">{fold.prAuc.toFixed(3)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel-footer">
        <span>{detailedMetrics.cvStrategy}</span>
        <span>
          <em>
            n = bootstrap N=1000 · {detailedMetrics.cvFolds.length} folds
          </em>
        </span>
      </div>
    </section>
  );
}
