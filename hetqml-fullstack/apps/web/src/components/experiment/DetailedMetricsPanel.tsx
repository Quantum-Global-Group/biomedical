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
