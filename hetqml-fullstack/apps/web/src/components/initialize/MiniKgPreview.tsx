"use client";

import type { Selection } from "@/lib/investigation/recommendations";

interface Props {
  selection: Selection;
}

export function MiniKgPreview({ selection }: Props) {
  const label =
    selection.compound && selection.gene && selection.disease
      ? `3D knowledge graph: ${selection.compound} → ${selection.gene} → ${selection.disease}`
      : "3D knowledge graph preview";

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · LIVE KG PREVIEW</div>
          <div className="panel-title">What the model will see</div>
        </div>
        <span className="badge">Preview</span>
      </div>
      <p className="panel-purpose">
        A 3-hop subgraph from your selections, drawn before the run. In this
        port the WebGL viewer from the static export is not bundled — the frame
        matches layout and dimensions.
      </p>
      <div
        role="img"
        aria-label={label}
        style={{
          width: "100%",
          height: 220,
          background: "#0E0B08",
          border: "1px solid var(--border)",
          borderRadius: 4,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          className="threed-hint"
          style={{
            position: "absolute",
            top: 8,
            left: 12,
            fontSize: 10,
            color: "var(--faint)",
            fontFamily: "monospace",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          3D · placeholder (parity frame)
        </div>
      </div>
      <div className="panel-footer">
        <span>hetionet-v1.0/edges.tsv</span>
        <span>
          <em>path score (demo)</em>
        </span>
      </div>
    </section>
  );
}
