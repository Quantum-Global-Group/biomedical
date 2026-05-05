/**
 * HeadlineTrustScorecard
 *
 * Validate-page Trust Scorecard for headline (methodology) mode. Mirrors
 * TrustRadar's panel chrome but renders a flat axis list instead of the
 * per-pair radar polygon — the "balance across 5 evidence types" framing
 * doesn't apply at the methodology level.
 *
 * Each axis row carries:
 *   - label + value (or "n/a — methodology view")
 *   - description grounded in the project's locked numbers
 *   - § citation pointing into the OSF preregistration
 *
 * Server component — no interactivity, ships zero JS.
 *
 * Source data: lib/data/headlineMetrics.ts → HEADLINE_TRUST_AXES.
 */

import {
  computeHeadlineCompositeTrust,
  HEADLINE_TRUST_AXES,
  type HeadlineTrustAxis,
} from "@/lib/data/headlineMetrics";

interface Props {
  threshold?: number;
}

export function HeadlineTrustScorecard({ threshold = 0.65 }: Props) {
  const composite = computeHeadlineCompositeTrust();
  const compositePct = Math.round(composite * 100);
  const passing = composite >= threshold;
  const applicableCount = HEADLINE_TRUST_AXES.filter(
    (a) => a.applicability === "applies",
  ).length;
  const naCount = HEADLINE_TRUST_AXES.length - applicableCount;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · TRUST SCORECARD (HEADLINE)</div>
          <div className="panel-title">
            Five evidence axes — methodology view
          </div>
        </div>
        <span className="badge">Headline</span>
      </div>
      <div className="panel-purpose">
        Demo mode shows a per-pair polygon of the 5-axis score; headline mode
        flattens that into a citation-grounded list — Clinical and Mechanism
        axes are per-candidate evidence and don&rsquo;t apply to a panel-wide
        methodology study, so they&rsquo;re marked <strong>n/a</strong>. The
        composite below is the mean of the {applicableCount} applicable axes.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginTop: 12,
          marginBottom: 16,
          padding: "12px 16px",
          background: "var(--paper-alt, #161310)",
          border: "1px solid var(--border-soft, #332D27)",
          borderRadius: 4,
        }}
      >
        <Stat
          label="Composite (applicable)"
          value={`${compositePct}/100`}
          color={passing ? "var(--green)" : "var(--amber)"}
        />
        <Stat label="Threshold" value={`${Math.round(threshold * 100)}%`} />
        <Stat
          label="N/A axes"
          value={`${naCount} of ${HEADLINE_TRUST_AXES.length}`}
        />
      </div>

      <div>
        {HEADLINE_TRUST_AXES.map((axis) => (
          <HeadlineAxisRow key={axis.id} axis={axis} threshold={threshold} />
        ))}
      </div>

      <div className="panel-footer">
        <span>preregistration §1.3 · §6.1 · §6.2 · §“Critical disclosure”</span>
        <span>
          <em>headline mode · methodology view</em>
        </span>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: color ?? "var(--ink, #E8E0D6)",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function HeadlineAxisRow({
  axis,
  threshold,
}: {
  axis: HeadlineTrustAxis;
  threshold: number;
}) {
  const applicable = axis.applicability === "applies";
  const value = axis.value;
  const valuePct =
    applicable && value !== null ? Math.round(value * 100) : null;
  const tone =
    !applicable
      ? "var(--faint, #857D75)"
      : value !== null && value >= threshold
        ? "var(--green, #7BC499)"
        : "var(--amber, #E0A062)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 80px 1fr",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid var(--border-soft, #332D27)",
        alignItems: "baseline",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: applicable ? "var(--ink, #E8E0D6)" : "var(--faint, #857D75)",
        }}
      >
        {axis.label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: tone,
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        {applicable ? (valuePct !== null ? `${valuePct}%` : "—") : "n/a"}
      </div>
      <div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--muted, #B8AFA5)",
          }}
        >
          {axis.description}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            fontFamily: "var(--font-mono, monospace)",
            color: applicable ? "var(--gold, #C8A45A)" : "var(--faint, #857D75)",
          }}
        >
          {axis.prereg}
        </div>
      </div>
    </div>
  );
}
