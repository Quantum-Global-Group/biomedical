import type {
  EvidenceLayer,
  EvidenceMatrix,
  EvidenceState,
} from "@/lib/api/client";

interface Props {
  matrix: EvidenceMatrix;
}

const LAYERS: { id: EvidenceLayer; label: string; sub: string }[] = [
  { id: "molecule", label: "Molecule", sub: "structure · ADMET" },
  { id: "kg", label: "Knowledge graph", sub: "Hetionet edges" },
  { id: "mechanism", label: "Mechanism", sub: "pathway · target" },
  { id: "clinical", label: "Clinical", sub: "trials · outcomes" },
  { id: "classical", label: "Classical model", sub: "GBM · LR · MLP" },
  { id: "quantum", label: "Quantum model", sub: "kernel · VQC" },
];

const STATE_STYLE: Record<
  EvidenceState,
  { bg: string; ring: string; ink: string; glyph: string; word: string }
> = {
  live: { bg: "var(--green-bg)", ring: "var(--green)", ink: "var(--green)", glyph: "●", word: "live" },
  supports: { bg: "var(--green-bg)", ring: "var(--green)", ink: "var(--green)", glyph: "▲", word: "supports" },
  fallback: { bg: "var(--amber-bg)", ring: "var(--amber)", ink: "var(--amber)", glyph: "◐", word: "fallback" },
  weakens: { bg: "var(--sienna-bg)", ring: "var(--sienna)", ink: "var(--sienna)", glyph: "▽", word: "weakens" },
  missing: { bg: "rgba(133,125,117,0.08)", ring: "var(--faint)", ink: "var(--faint)", glyph: "○", word: "missing" },
};

export function EvidenceMatrixPanel({ matrix }: Props) {
  // One row per layer; cells whose `layer` matches go on that row. Most
  // layers will have a single canonical cell, but the schema permits more
  // (e.g. multiple kg overlays) — render them all so nothing is hidden.
  const rows = LAYERS.map((layer) => ({
    layer,
    cells: matrix.cells.filter((c) => c.layer === layer.id),
  }));

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · EVIDENCE STRENGTH MATRIX</div>
          <div className="panel-title">Six layers, who&apos;s vouching</div>
        </div>
        <span className="badge">Cross-source</span>
      </div>
      <p className="panel-purpose">
        Each row is an evidence layer; each cell is a finding from that layer
        with a state — <strong>live</strong> (real source returned data),{" "}
        <strong>supports</strong> / <strong>weakens</strong> (the score moves
        the right way), <strong>fallback</strong> (synthetic stand-in), or{" "}
        <strong>missing</strong> (no signal at all).
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(160px, 200px) 1fr",
          rowGap: 8,
          columnGap: 14,
          alignItems: "start",
          marginTop: 4,
        }}
      >
        {rows.map(({ layer, cells }) => (
          <div
            key={layer.id}
            style={{ display: "contents" }}
            data-layer={layer.id}
          >
            <div
              style={{
                paddingTop: 6,
                borderRight: "1px solid var(--border-soft)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{layer.label}</div>
              <div style={{ color: "var(--faint)", fontSize: 11 }}>
                {layer.sub}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                paddingBottom: 8,
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
              {cells.length === 0 ? (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--faint)",
                    fontStyle: "italic",
                    padding: "6px 0",
                  }}
                >
                  no cell reported for this layer
                </span>
              ) : (
                cells.map((c, i) => {
                  const sty = STATE_STYLE[c.state];
                  return (
                    <span
                      key={`${c.layer}-${i}`}
                      title={c.note}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 9px 4px 8px",
                        background: sty.bg,
                        border: `1px solid ${sty.ring}`,
                        borderRadius: 4,
                        fontSize: 11.5,
                        color: "var(--ink)",
                        maxWidth: 360,
                      }}
                    >
                      <span style={{ color: sty.ink, fontSize: 12 }}>
                        {sty.glyph}
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: sty.ink,
                          textTransform: "uppercase",
                          fontSize: 10,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {sty.word}
                      </span>
                      <span
                        style={{
                          color: "var(--muted)",
                          fontSize: 11,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 260,
                        }}
                      >
                        {c.note}
                      </span>
                    </span>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="panel-footer" style={{ marginTop: 14 }}>
        <span>{matrix.cells.length} cells across 6 layers</span>
        <span>
          <em>{matrix.summary}</em>
        </span>
      </div>
    </section>
  );
}
