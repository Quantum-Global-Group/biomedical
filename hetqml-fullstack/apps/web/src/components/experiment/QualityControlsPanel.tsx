"use client";

import type { JobResult } from "@/lib/api/client";
import {
  applyToggleOverlay,
  useIntegrityGuards,
} from "@/lib/integrity/useIntegrityGuards";

interface Props {
  result: JobResult;
}

/** Scientific quality controls — the QC grid surfaces every quality flag
 * from the result. Failing critical guards turn the audit footer red.
 *
 * The "audit blocked" footer reads from the global integrity-guard store
 * (see punch-list item #8) overlaid on the JobResult snapshot, so toggling
 * a critical guard off on Initialize cascades here without a re-run. */
export function QualityControlsPanel({ result }: Props) {
  const { catalog, toggles } = useIntegrityGuards();
  const flags = result.qualityFlags;
  const passing = flags.filter((f) => f.state === "pass").length;
  const total = flags.length;
  const overlaid = applyToggleOverlay(catalog, toggles, result.integrityGuards);
  const failingCriticalGuards = overlaid.filter(
    (g) => g.critical && !g.passing,
  );
  const auditBlocked = failingCriticalGuards.length > 0;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · SCIENTIFIC QUALITY CONTROLS</div>
          <div className="panel-title">Did the experiment do what it claimed</div>
        </div>
        <span className="badge">Audit</span>
      </div>
      <p className="panel-purpose">
        Each integrity guard from Initialize and quality flag from the run
        rolled up into a pass/fail audit. A failed critical guard halts the
        pipeline; a failed recommended guard surfaces a warning.
      </p>
      <div className="qc-grid" style={{ marginTop: 16 }}>
        {flags.map((flag, i) => {
          const colorVar =
            flag.state === "pass"
              ? "var(--green)"
              : flag.state === "warn"
                ? "var(--amber)"
                : "var(--sienna)";
          const icon =
            flag.state === "pass" ? "✓" : flag.state === "warn" ? "!" : "✗";
          return (
            <div key={`${flag.label}-${i}`} className="qc-item">
              <div className="qc-label">
                <span style={{ color: colorVar }}>{icon}</span>
                {flag.label.toUpperCase()}
              </div>
              <div className="qc-value" style={{ color: colorVar }}>
                {flag.detail}
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel-footer">
        <span>
          {auditBlocked
            ? `audit BLOCKED · ${failingCriticalGuards.length} critical guard(s) off`
            : "qa_log · derived from config/integrity.yaml"}
        </span>
        <span>
          <em>
            {passing} / {total} passed
          </em>
        </span>
      </div>
    </section>
  );
}
