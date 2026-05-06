/**
 * MiniKgPreviewLite — static-export drop-in for {@link MiniKgPreview}.
 *
 * The full version dynamic-imports `three` (~676 KB minified) to render a
 * real 3D scene with WebGL. The lite (HF Space) build can't afford that —
 * three is the single largest chunk, and the static export has no live
 * job context to show 3D anyway. Instead we render a compact SVG
 * schematic that captures the same node-edge structure (compound → gene
 * → disease anchor spine + co-targets and pathway), shipping zero extra
 * JS.
 *
 * Sized for the lite (light) theme: tighter viewBox, ~220px tall,
 * theme-driven colours (text via currentColor, accents via CSS
 * variables) so the same component reads well under any palette.
 */
import type { Selection } from "@/lib/investigation/recommendations";

interface Props {
  selection: Selection;
}

// Node kind → CSS variable so the SVG picks up whatever palette is
// active. Falls back to a hard hex for safety in case the variable
// isn't defined.
const NODE_FILL: Record<string, string> = {
  compound: "var(--teal, #1e6f8f)",
  gene: "var(--gold, #1e6f8f)",
  disease: "var(--sienna, #b04a3a)",
  pathway: "var(--purple, #3a4d8a)",
  variant: "var(--amber, #8a5a18)",
};

interface SvgNode {
  id: string;
  label: string;
  kind: keyof typeof NODE_FILL;
  cx: number;
  cy: number;
  focus: boolean;
}

interface SvgEdge {
  from: string;
  to: string;
  primary: boolean;
  metaedge: string;
}

// Compact 320×240 viewport. Spine runs left → right with the focus
// triple centred; co-targets and pathway sit above/below the spine.
const NODES: SvgNode[] = [
  { id: "compound", label: "Compound", kind: "compound", cx: 50, cy: 120, focus: true },
  { id: "gene", label: "Gene", kind: "gene", cx: 160, cy: 120, focus: true },
  { id: "disease", label: "Disease", kind: "disease", cx: 270, cy: 120, focus: true },
  { id: "pathway", label: "Pathway", kind: "pathway", cx: 160, cy: 40, focus: false },
  { id: "variant", label: "Variant", kind: "variant", cx: 105, cy: 200, focus: false },
  { id: "gene2", label: "Co-target", kind: "gene", cx: 50, cy: 40, focus: false },
  { id: "disease2", label: "Co-disease", kind: "disease", cx: 270, cy: 200, focus: false },
];

const EDGES: SvgEdge[] = [
  { from: "compound", to: "gene", primary: true, metaedge: "CbG" },
  { from: "gene", to: "disease", primary: true, metaedge: "GaD" },
  { from: "gene", to: "pathway", primary: false, metaedge: "GpPW" },
  { from: "pathway", to: "disease", primary: false, metaedge: "PWaD" },
  { from: "gene", to: "variant", primary: false, metaedge: "GaV" },
  { from: "compound", to: "gene2", primary: false, metaedge: "CbG" },
  { from: "gene2", to: "disease", primary: false, metaedge: "GaD" },
  { from: "disease", to: "disease2", primary: false, metaedge: "DrD" },
];

function nodeById(id: string): SvgNode | undefined {
  return NODES.find((n) => n.id === id);
}

export function MiniKgPreview({ selection }: Props) {
  const compound = selection.compound || "Compound";
  const gene = selection.gene || "Anchor gene";
  const disease = selection.disease || "Disease";
  const allChosen = !!(selection.compound && selection.gene && selection.disease);
  const ariaLabel = allChosen
    ? `Knowledge graph schematic: ${compound} → ${gene} → ${disease}`
    : "Knowledge graph preview (lite)";

  const labelOverride: Record<string, string> = {
    compound,
    gene,
    disease,
  };

  return (
    <section
      className="panel"
      style={{
        // alignSelf: stop the parent grid (.grid-7-5) from stretching
        // the card to match the left column's full form height — the
        // 3D version filled that space, but the SVG schematic is small
        // and shouldn't fake-pad to ~2.5k pixels of empty card.
        maxWidth: 520,
        alignSelf: "start",
      }}
    >
      <div className="panel-head">
        <div>
          <div className="eyebrow">PREVIEW · KNOWLEDGE GRAPH</div>
          <div className="panel-title">Run anchor schematic</div>
        </div>
        <span className="pill">SVG</span>
      </div>
      <p className="panel-purpose" style={{ marginBottom: 6 }}>
        The 3-hop subgraph the model will see — compound → gene →
        disease, plus co-target / pathway / variant context. Static SVG
        in this lite build; full app renders an interactive 3D version.
      </p>
      <svg
        viewBox="0 0 320 240"
        width="100%"
        height={220}
        role="img"
        aria-label={ariaLabel}
        style={{ display: "block", color: "var(--ink)" }}
      >
        <defs>
          <marker
            id="kg-arrow-primary"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: "var(--gold)" }} />
          </marker>
          <marker
            id="kg-arrow-secondary"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: "var(--faint)" }} />
          </marker>
        </defs>
        {EDGES.map((e) => {
          const a = nodeById(e.from);
          const b = nodeById(e.to);
          if (!a || !b) return null;
          const strokeWidth = e.primary ? 2 : 1;
          const dash = e.primary ? undefined : "4 4";
          const marker = e.primary
            ? "url(#kg-arrow-primary)"
            : "url(#kg-arrow-secondary)";
          const midX = (a.cx + b.cx) / 2;
          const midY = (a.cy + b.cy) / 2;
          return (
            <g key={`${e.from}-${e.to}`}>
              <line
                x1={a.cx}
                y1={a.cy}
                x2={b.cx}
                y2={b.cy}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
                markerEnd={marker}
                opacity={e.primary ? 0.95 : 0.55}
                style={{ stroke: e.primary ? "var(--gold)" : "var(--faint)" }}
              />
              <text
                x={midX}
                y={midY - 4}
                fontSize="9"
                textAnchor="middle"
                style={{
                  fill: "var(--muted)",
                  fontFamily: "ui-monospace, Menlo, monospace",
                }}
              >
                {e.metaedge}
              </text>
            </g>
          );
        })}
        {NODES.map((n) => {
          const r = n.focus ? 14 : 9;
          const label = labelOverride[n.id] ?? n.label;
          return (
            <g key={n.id}>
              <circle
                cx={n.cx}
                cy={n.cy}
                r={r}
                strokeWidth={n.focus ? 1.5 : 1}
                opacity={n.focus ? 1 : 0.7}
                style={{
                  fill: NODE_FILL[n.kind],
                  stroke: "var(--card)",
                }}
              />
              <text
                x={n.cx}
                y={n.cy + r + 12}
                fontSize={n.focus ? 11 : 9.5}
                fontWeight={n.focus ? 600 : 400}
                textAnchor="middle"
                style={{ fill: n.focus ? "var(--ink)" : "var(--muted)" }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 6,
          fontSize: 10.5,
          color: "var(--muted)",
        }}
      >
        {(Object.keys(NODE_FILL) as Array<keyof typeof NODE_FILL>).map((k) => (
          <span
            key={k}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: NODE_FILL[k],
                display: "inline-block",
              }}
            />
            {k}
          </span>
        ))}
      </div>
    </section>
  );
}
