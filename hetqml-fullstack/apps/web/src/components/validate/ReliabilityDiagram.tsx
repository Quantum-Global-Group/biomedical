"use client";

import type { ReliabilityDiagram as ReliabilityData } from "@/lib/api/client";
import {
  CHART_BOX,
  axisTicks,
  curvePoints,
  diagonalLine,
  layoutBins,
} from "@/lib/validate/reliabilityGeometry";

interface Props {
  reliability: ReliabilityData;
}

interface SummaryRow {
  label: string;
  desc: string;
  value: number;
  /** Lower is better when true. */
  lowerIsBetter: boolean;
  /** Pass threshold: any value below counts as "good" when lowerIsBetter, else above counts as good. */
  goodAt: number;
  warnAt: number;
  /** Data provenance — real values are computed from CV; synthetic are RNG scaffolding. */
  provenance: "real" | "synthetic";
}

function summaryClass(row: SummaryRow): "good" | "warn" | "" {
  const v = row.value;
  if (row.lowerIsBetter) {
    if (v < row.goodAt) return "good";
    if (v < row.warnAt) return "warn";
    return "";
  }
  if (v > row.goodAt) return "good";
  if (v > row.warnAt) return "warn";
  return "";
}

/**
 * 10-bin reliability diagram + per-bin histogram + summary card.
 *
 * Drawn as pure SVG using the geometry helpers in
 * `lib/validate/reliabilityGeometry.ts`. The diagonal reference line shows
 * perfect calibration; the polyline traces the model's predicted-vs-observed
 * curve; the histogram below the chart shows bin populations.
 */
export function ReliabilityDiagram({ reliability }: Props) {
  const layout = layoutBins(reliability.bins);
  const diag = diagonalLine();
  const ticks = axisTicks();

  const summary: SummaryRow[] = [
    {
      label: "Brier score",
      desc: "lower is better · 0 perfect, 0.25 random",
      value: reliability.brier,
      lowerIsBetter: true,
      goodAt: 0.15,
      warnAt: 0.2,
      provenance: "real",
    },
    {
      label: "Expected Calibration Error",
      desc: "mean |predicted − observed| across bins",
      value: reliability.ece,
      lowerIsBetter: true,
      goodAt: 0.05,
      warnAt: 0.1,
      provenance: "real",
    },
    {
      label: "Maximum Calibration Error",
      desc: "worst-bin gap",
      value: reliability.mce,
      lowerIsBetter: true,
      goodAt: 0.08,
      warnAt: 0.15,
      provenance: reliability.binsReal ? "real" : "synthetic",
    },
    {
      label: "Log loss",
      desc: "penalises confident mistakes",
      value: reliability.logLoss,
      lowerIsBetter: true,
      goodAt: 0.3,
      warnAt: 0.5,
      provenance: reliability.binsReal ? "real" : "synthetic",
    },
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · RELIABILITY DIAGRAM</div>
          <div className="panel-title">
            Are predicted probabilities actually probabilities?
          </div>
        </div>
        <span className="badge">Calibration</span>
      </div>
      <div className="panel-purpose">
        Reliability diagram: x-axis is the model&apos;s predicted probability,
        y-axis is the observed positive rate within that bin. A perfectly
        calibrated model lies on the diagonal. Deviation upward → underconfident;
        downward → overconfident. Brier score and ECE summarise the gap in a
        single number.
      </div>

      {reliability.binsReal ? (
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
          <strong>● Real calibration data</strong> — all 10 bins, MCE, and
          log-loss are computed from the actual cross-validated predicted
          probabilities. The polyline represents empirical calibration for this
          run.
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
          <strong>⚠ Provenance disclosure</strong> — <strong>Brier</strong> and{" "}
          <strong>ECE</strong> are computed from the real cross-validated run.
          The 10 calibration bins (curve below) and{" "}
          <strong>MCE</strong> + <strong>Log loss</strong> values are
          deterministic scaffolding seeded per-investigation — do not cite as
          empirical calibration evidence.
        </div>
      )}

      <div className="grid-2">
        <svg
          viewBox="0 0 400 260"
          style={{
            width: "100%",
            height: 260,
            background: "var(--card)",
            border: "1px solid var(--border-soft)",
            borderRadius: 4,
          }}
          role="img"
          aria-label="Reliability diagram"
        >
          {/* Diagonal reference */}
          <line
            x1={diag.x1}
            y1={diag.y1}
            x2={diag.x2}
            y2={diag.y2}
            stroke="#7BC499"
            strokeDasharray="4,4"
            strokeWidth={1}
          />

          {/* Axis lines */}
          <line
            x1={CHART_BOX.x0}
            y1={CHART_BOX.y1}
            x2={CHART_BOX.x1}
            y2={CHART_BOX.y1}
            stroke="#332D27"
            strokeWidth={0.5}
          />
          <line
            x1={CHART_BOX.x0}
            y1={CHART_BOX.y0}
            x2={CHART_BOX.x0}
            y2={CHART_BOX.y1}
            stroke="#332D27"
            strokeWidth={0.5}
          />

          {/* Gridlines (at the same fractions as the ticks) */}
          {ticks.map((t) => (
            <g key={`grid-${t.v}`}>
              <line
                x1={CHART_BOX.x0}
                y1={t.y}
                x2={CHART_BOX.x1}
                y2={t.y}
                stroke="#332D27"
                strokeWidth={0.5}
              />
              <line
                x1={t.x}
                y1={CHART_BOX.y1}
                x2={t.x}
                y2={CHART_BOX.y0}
                stroke="#332D27"
                strokeWidth={0.5}
              />
            </g>
          ))}

          {/* Bin histogram (under chart baseline) */}
          {layout.map((p, i) => (
            <rect
              key={`bin-${i}`}
              x={p.rx}
              y={CHART_BOX.y1 + 3}
              width={p.rw}
              height={p.rh}
              fill="#332D27"
            />
          ))}

          {/* Curve through observed-rate points. Solid when bins are real CV
              data; dashed when synthetic scaffolding. */}
          {layout.length > 1 ? (
            <polyline
              points={curvePoints(layout)}
              fill="none"
              stroke="#6BB5B5"
              strokeWidth={2}
              strokeDasharray={reliability.binsReal ? undefined : "5,3"}
            />
          ) : null}
          {layout.map((p, i) => (
            <circle
              key={`pt-${i}`}
              cx={p.cx}
              cy={p.cy}
              r={4}
              fill="#6BB5B5"
              stroke="#161310"
              strokeWidth={1}
            />
          ))}

          {/* Axis titles */}
          <text
            x={210}
            y={254}
            fontSize={10}
            fill="#857D75"
            textAnchor="middle"
            fontFamily="monospace"
          >
            Predicted probability
          </text>
          <text
            x={12}
            y={125}
            fontSize={10}
            fill="#857D75"
            textAnchor="middle"
            fontFamily="monospace"
            transform="rotate(-90, 12, 125)"
          >
            Observed positive rate
          </text>

          {/* Tick labels */}
          {ticks.map((t) => (
            <g key={`tick-${t.v}`}>
              <text
                x={t.x}
                y={CHART_BOX.y1 + 14}
                fontSize={9}
                fill="#857D75"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {t.v.toFixed(2)}
              </text>
              <text
                x={CHART_BOX.x0 - 6}
                y={t.y}
                fontSize={9}
                fill="#857D75"
                textAnchor="end"
                fontFamily="monospace"
              >
                {t.v.toFixed(2)}
              </text>
            </g>
          ))}
        </svg>

        <div>
          <div className="exp-section-h" style={{ marginBottom: 12 }}>
            CALIBRATION SUMMARY
          </div>
          <div>
            {summary.map((row) => (
              <div key={row.label} className="val-cal-row">
                <div>
                  <div className="val-cal-label">
                    {row.label}
                    {row.provenance === "synthetic" && (
                      <span
                        title="Value is deterministic scaffolding — not derived from this run's predicted probabilities"
                        style={{
                          marginLeft: 8,
                          fontSize: 9,
                          fontFamily: "var(--font-mono, monospace)",
                          color: "var(--faint)",
                          padding: "1px 5px",
                          border: "1px solid var(--faint)",
                          borderRadius: 3,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          fontWeight: 600,
                          verticalAlign: "middle",
                        }}
                      >
                        ○ synthetic
                      </span>
                    )}
                    {row.provenance === "real" && (
                      <span
                        title="Computed from real cross-validated run"
                        style={{
                          marginLeft: 8,
                          fontSize: 9,
                          fontFamily: "var(--font-mono, monospace)",
                          color: "var(--green)",
                          padding: "1px 5px",
                          border: "1px solid var(--green)",
                          borderRadius: 3,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          fontWeight: 600,
                          verticalAlign: "middle",
                        }}
                      >
                        ● real
                      </span>
                    )}
                  </div>
                  <div className="desc">{row.desc}</div>
                </div>
                <div
                  className={`val-cal-val ${summaryClass(row)}`}
                  style={
                    row.provenance === "synthetic"
                      ? { opacity: 0.6 }
                      : undefined
                  }
                >
                  {row.value.toFixed(3)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="panel-footer">
        <span>calibration_diagnostics.json</span>
        <span>
          <em>
            {reliability.bins.length} bins · stratified · seed = 42
          </em>
        </span>
      </div>
    </section>
  );
}
