import type { EvidenceOverlay } from "@/lib/api/client";

interface Props {
  overlays: EvidenceOverlay[];
}

const COLUMN_LABEL: Record<EvidenceOverlay["column"], string> = {
  target_pathway: "Target pathway",
  relation: "Relation",
  model_score: "Model score",
};

const COLUMN_TONE: Record<EvidenceOverlay["column"], string> = {
  target_pathway: "var(--teal)",
  relation: "var(--gold)",
  model_score: "var(--purple)",
};

export function EvidenceOverlaysPanel({ overlays }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · EVIDENCE OVERLAYS</div>
          <div className="panel-title">What features lit up</div>
        </div>
        <span className="badge">Top-k per column</span>
      </div>
      <p className="panel-purpose">
        Per-column attribution: which target/pathway names entered the
        candidate&apos;s neighborhood, which relations dominated, and which
        per-model scores tipped the aggregate.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginTop: 4,
        }}
      >
        {overlays.length === 0 ? (
          <p
            style={{
              color: "var(--faint)",
              fontStyle: "italic",
              gridColumn: "1 / -1",
              padding: "16px 0",
            }}
          >
            No overlays reported.
          </p>
        ) : (
          overlays.map((o) => {
            const tone = COLUMN_TONE[o.column];
            return (
              <div
                key={o.column}
                style={{
                  border: "1px solid var(--border-soft)",
                  borderRadius: 4,
                  background: "var(--paper-alt)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "6px 10px",
                    fontSize: 10.5,
                    color: tone,
                    background: "var(--paper)",
                    borderBottom: `1px solid ${tone}55`,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                  }}
                >
                  {COLUMN_LABEL[o.column]}
                </div>
                <div
                  style={{
                    padding: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  {o.items.length === 0 ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--faint)",
                        fontStyle: "italic",
                      }}
                    >
                      empty
                    </span>
                  ) : (
                    o.items.map((it, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 11,
                          color: "var(--ink)",
                          padding: "3px 8px",
                          background: "var(--card)",
                          border: `1px solid ${tone}55`,
                          borderRadius: 3,
                          fontFamily: "var(--font-mono), monospace",
                        }}
                      >
                        {it}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="panel-footer" style={{ marginTop: 14 }}>
        <span>3 overlay columns · per-run derived</span>
        <span>
          <em>chips are clickable in the legacy export — coming next pass</em>
        </span>
      </div>
    </section>
  );
}
