import type { ModelAgreement } from "@/lib/api/client";

interface Props {
  agreement: ModelAgreement;
}

const FAMILY_COLOR: Record<string, string> = {
  classical: "var(--gold)",
  hybrid: "var(--teal)",
  quantum: "var(--purple)",
};

const VERDICT_STYLE: Record<
  ModelAgreement["verdict"],
  { tone: string; bg: string; ring: string; line: string }
> = {
  STRONG_AGREEMENT: {
    tone: "var(--green)",
    bg: "var(--green-bg)",
    ring: "var(--green)",
    line: "Strong agreement across families — claim is robust.",
  },
  PARTIAL_DIVERGENCE: {
    tone: "var(--amber)",
    bg: "var(--amber-bg)",
    ring: "var(--amber)",
    line: "Partial divergence — one family disagrees materially. Inspect the outlier.",
  },
  BRANCH_DIVERGENCE: {
    tone: "var(--sienna)",
    bg: "var(--sienna-bg)",
    ring: "var(--sienna)",
    line: "Branch divergence — families disagree about direction. Treat with caution.",
  },
};

export function ModelAgreementPanel({ agreement }: Props) {
  const v = VERDICT_STYLE[agreement.verdict];
  const max = Math.max(...agreement.bars.map((b) => b.score), 1);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · MODEL AGREEMENT</div>
          <div className="panel-title">Do families converge?</div>
        </div>
        <span
          className="pill"
          style={{
            background: v.bg,
            color: v.tone,
            borderColor: v.ring,
            border: `1px solid ${v.ring}`,
          }}
        >
          {agreement.verdict.replace(/_/g, " ").toLowerCase()}
        </span>
      </div>
      <p className="panel-purpose">
        Top score per family vs the cross-family mean. Spread is the signal:
        small spread means classical/hybrid/quantum agree, large spread means
        you should probably not bet the run on a single family.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 6,
        }}
      >
        {agreement.bars.map((bar) => {
          const pct = (bar.score / max) * 100;
          const delta = bar.deltaReference;
          const deltaColor =
            delta > 0.01
              ? "var(--green)"
              : delta < -0.01
                ? "var(--sienna)"
                : "var(--muted)";
          return (
            <div key={bar.family}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ink)",
                    textTransform: "capitalize",
                  }}
                >
                  {bar.family}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono), monospace",
                    color: "var(--muted)",
                  }}
                >
                  {bar.score.toFixed(3)}{" "}
                  <span style={{ color: deltaColor }}>
                    ({delta >= 0 ? "+" : ""}
                    {delta.toFixed(3)})
                  </span>
                </div>
              </div>
              <div
                style={{
                  height: 10,
                  background: "var(--border-soft)",
                  borderRadius: 4,
                  overflow: "hidden",
                  position: "relative",
                }}
                role="meter"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={bar.score}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: FAMILY_COLOR[bar.family] ?? "var(--ink)",
                    boxShadow: `0 0 10px ${FAMILY_COLOR[bar.family]}55`,
                  }}
                />
                {/* Mean reference marker */}
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    bottom: -2,
                    left: `${(agreement.mean / max) * 100}%`,
                    width: 1.5,
                    background: "var(--ink)",
                    opacity: 0.6,
                  }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
          marginTop: 16,
        }}
      >
        <Stat label="mean" value={agreement.mean.toFixed(3)} />
        <Stat label="spread (max−min)" value={agreement.spread.toFixed(3)} />
      </div>

      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          background: v.bg,
          border: `1px solid ${v.ring}`,
          borderRadius: 4,
          fontSize: 12,
          color: v.tone,
          fontWeight: 500,
        }}
      >
        {v.line}
      </div>

      <div className="panel-footer" style={{ marginTop: 12 }}>
        <span>top score per family · CV-mean</span>
        <span>
          <em>vertical line = cross-family mean</em>
        </span>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "var(--paper-alt)",
        border: "1px solid var(--border-soft)",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--faint)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--ink)",
          marginTop: 2,
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {value}
      </div>
    </div>
  );
}
