import type { QualityFlag } from "@/lib/api/client";

interface Props {
  flags: QualityFlag[];
}

const STATE_STYLE: Record<
  QualityFlag["state"],
  { bg: string; ring: string; ink: string; glyph: string; label: string }
> = {
  pass: {
    bg: "var(--green-bg)",
    ring: "var(--green)",
    ink: "var(--green)",
    glyph: "✓",
    label: "pass",
  },
  warn: {
    bg: "var(--amber-bg)",
    ring: "var(--amber)",
    ink: "var(--amber)",
    glyph: "!",
    label: "warn",
  },
  fail: {
    bg: "var(--sienna-bg)",
    ring: "var(--sienna)",
    ink: "var(--sienna)",
    glyph: "✕",
    label: "fail",
  },
};

export function QualityFlagsPanel({ flags }: Props) {
  const passed = flags.filter((f) => f.state === "pass").length;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · QUALITY OVERLAY</div>
          <div className="panel-title">Run-time integrity controls</div>
        </div>
        <span className="badge">
          {passed}/{flags.length} passing
        </span>
      </div>
      <p className="panel-purpose">
        Lightweight controls evaluated on the run output (data-leak guards,
        calibration sanity, baseline parity, …). A failed control should
        invalidate the claim until investigated.
      </p>

      {flags.length === 0 ? (
        <p
          style={{
            color: "var(--faint)",
            fontStyle: "italic",
            padding: "16px 0",
          }}
        >
          No quality flags recorded.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 8,
            marginTop: 4,
          }}
        >
          {flags.map((f, i) => {
            const sty = STATE_STYLE[f.state];
            return (
              <div
                key={`${f.label}-${i}`}
                style={{
                  padding: "10px 12px",
                  background: sty.bg,
                  border: `1px solid ${sty.ring}`,
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 600,
                    fontSize: 12.5,
                    color: "var(--ink)",
                  }}
                >
                  <span style={{ color: sty.ink, fontSize: 14 }}>{sty.glyph}</span>
                  {f.label}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 9.5,
                      letterSpacing: "0.08em",
                      color: sty.ink,
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    {sty.label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}
                >
                  {f.detail}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
