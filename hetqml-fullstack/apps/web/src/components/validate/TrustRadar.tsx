"use client";

import type { TrustScorecard } from "@/lib/api/client";
import {
  buildRadarLayout,
  pointsAttr,
  valuesToPolygon,
} from "@/lib/validate/radarGeometry";

interface Props {
  scorecard: TrustScorecard;
  threshold?: number;
}

const AXIS_DESCRIPTORS: Record<string, string> = {
  clinical: "Clinical",
  mechanism: "Mechanism",
  model: "Model",
  baseline: "Baseline",
  artifact: "Artifact",
};

/**
 * SVG trust-scorecard radar — five-axis polygon plus per-axis bars.
 *
 * Polygon fills green when all axes are above threshold, amber when one is
 * below, and sienna when two or more fail. The dashed inner pentagon shows
 * the threshold. Per-axis bars below the chart give the precise value and
 * an axis-specific descriptor.
 */
export function TrustRadar({ scorecard, threshold = 0.65 }: Props) {
  const axes = scorecard.axes;
  const values = axes.map((a) => a.value);
  const layout = buildRadarLayout(axes.length, { threshold });
  const polygon = valuesToPolygon(values, layout);

  const failingCount = axes.filter((a) => !a.passing).length;
  const polyColor =
    failingCount === 0
      ? "var(--green)"
      : failingCount === 1
        ? "var(--amber)"
        : "var(--sienna)";
  const polyFill =
    failingCount === 0
      ? "rgba(123, 196, 153, 0.18)"
      : failingCount === 1
        ? "rgba(224, 160, 98, 0.18)"
        : "rgba(224, 132, 116, 0.18)";

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · TRUST SCORECARD</div>
          <div className="panel-title">Five axes of independent evidence</div>
        </div>
        <span className="badge">Scorecard</span>
      </div>
      <div className="panel-purpose">
        The score is decomposed into five axes, each sourced from a different
        system. The radar shows the candidate polygon overlaid on a dashed
        acceptance threshold ({Math.round(threshold * 100)}%) — any axis
        falling below the dashed line is the one to question first.
      </div>

      <div className="radar-container">
        <svg
          viewBox="0 0 400 280"
          role="img"
          aria-label="Trust scorecard radar"
        >
          {/* Concentric rings */}
          {layout.rings.map((ring, i) => (
            <polygon
              key={`ring-${i}`}
              points={pointsAttr(ring)}
              fill="none"
              stroke="#332D27"
              strokeWidth={0.5}
            />
          ))}

          {/* Axis spokes (center -> outermost ring) */}
          {layout.axisOuter.map((p, i) => (
            <line
              key={`spoke-${i}`}
              x1={layout.centerX}
              y1={layout.centerY}
              x2={p.x}
              y2={p.y}
              stroke="#332D27"
              strokeWidth={0.5}
            />
          ))}

          {/* Threshold polygon (dashed) */}
          <polygon
            points={pointsAttr(layout.threshold)}
            fill="none"
            stroke="#7BC499"
            strokeDasharray="3,3"
            strokeWidth={1}
          />

          {/* Candidate polygon */}
          <polygon
            points={pointsAttr(polygon)}
            fill={polyFill}
            stroke={polyColor}
            strokeWidth={2}
          />
          {polygon.map((p, i) => {
            const axis = axes[i];
            if (!axis) return null;
            return (
              <circle
                key={`vertex-${i}`}
                cx={p.x}
                cy={p.y}
                r={4}
                fill={axis.passing ? polyColor : "var(--sienna)"}
              />
            );
          })}

          {/* Axis labels */}
          {layout.labels.map((p, i) => {
            const axis = axes[i];
            if (!axis) return null;
            return (
              <text
                key={`label-${i}`}
                x={p.x}
                y={p.y}
                fontSize={11}
                fill={axis.passing ? "#B8AFA5" : "#E08474"}
                textAnchor="middle"
                alignmentBaseline="middle"
                fontFamily="monospace"
                fontWeight={axis.passing ? 400 : 700}
              >
                {AXIS_DESCRIPTORS[axis.axis] ?? axis.axis}
              </text>
            );
          })}

          {/* Legend */}
          <line
            x1={110}
            y1={270}
            x2={130}
            y2={270}
            stroke={polyColor}
            strokeWidth={2}
          />
          <text x={135} y={274} fontSize={10} fill="#B8AFA5">
            Candidate
          </text>
          <line
            x1={210}
            y1={270}
            x2={230}
            y2={270}
            stroke="#7BC499"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
          <text x={235} y={274} fontSize={10} fill="#B8AFA5">
            Acceptance threshold ({Math.round(threshold * 100)}%)
          </text>
        </svg>

        <div className="radar-bars">
          {axes.map((axis) => {
            const pct = Math.round(axis.value * 100);
            const color = axis.passing ? "var(--green)" : "var(--sienna)";
            return (
              <div key={axis.axis}>
                <div className="radar-bar-head">
                  <div className="radar-bar-name">
                    {AXIS_DESCRIPTORS[axis.axis] ?? axis.axis}
                  </div>
                  <div className="radar-bar-pct">{pct}%</div>
                </div>
                <div className="radar-bar-track">
                  <div
                    className="radar-bar-fill"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <div className="radar-bar-desc">
                  {axis.passing
                    ? `meets the ${Math.round(threshold * 100)}% bar`
                    : `below the ${Math.round(threshold * 100)}% acceptance threshold`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel-footer">
        <span>trust_axes_aggregator</span>
        <span>
          <em>
            {failingCount === 0
              ? `all ${axes.length} axes above threshold (${Math.round(threshold * 100)}%) · trust polygon clean`
              : `${failingCount} axis/axes below threshold · review carefully`}
          </em>
        </span>
      </div>
    </section>
  );
}
