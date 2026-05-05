"use client";

import type { SkepticWarning } from "@/lib/api/client";

interface Props {
  warnings: readonly SkepticWarning[];
}

const SOURCE_LABELS: Record<SkepticWarning["source"], string> = {
  equity: "EQUITY · ANCESTRY",
  "cv-variance": "CV · FOLD VARIANCE",
  "delta-classical": "Δ vs CLASSICAL",
  "top-loses-to-classical": "TOP LOSES TO CLASSICAL",
  guards: "INTEGRITY GUARDS",
  calibration: "CALIBRATION",
  "anchor-mismatch": "ANCHOR TARGET",
};

const ICON: Record<SkepticWarning["severity"], string> = {
  info: "ℹ",
  warn: "⚠",
  crit: "⛔",
};

const COLOR: Record<SkepticWarning["severity"], string> = {
  info: "var(--muted)",
  warn: "var(--amber)",
  crit: "var(--sienna)",
};

/**
 * Auto-generated skeptic warnings from the JobResult. Surfaces the seven
 * failure modes the backend tracks (equity caveat, CV variance, classical
 * delta, top-loses-to-classical, integrity guards, calibration, anchor
 * mismatch).
 */
export function SkepticView({ warnings }: Props) {
  if (warnings.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        No skeptic warnings raised — the auto-checks all passed. Read the
        scorecard and reliability diagram before deciding.
      </p>
    );
  }
  return (
    <div>
      {warnings.map((w, i) => (
        <div key={`${w.source}-${i}`} className="skeptic-warning">
          <span style={{ color: COLOR[w.severity] }}>{ICON[w.severity]}</span>
          <span>
            <strong style={{ color: "var(--ink)" }}>
              {SOURCE_LABELS[w.source]}
            </strong>
            {" · "}
            {w.message}
          </span>
        </div>
      ))}
    </div>
  );
}
