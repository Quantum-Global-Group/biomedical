"use client";

import { MiniKgPreview } from "@/components/initialize/MiniKgPreview";
import type { Selection } from "@/lib/investigation/recommendations";

interface Props {
  selection: Selection;
  /** Currently-active gene anchor — used in the description line so the
   * user can see the 2-hop neighborhood the panel is rendering. Falls
   * back to selection.gene for the empty case. */
  anchorGene?: string;
}

/**
 * Visualize-page wrapper around the 3D KG renderer used on Initialize.
 * Same engine, larger canvas, plus the plan's description line:
 * "2-hop neighborhood from <compound> through <gene> to <disease>".
 */
export function KgViewer3DPanel({ selection, anchorGene }: Props) {
  const compound = selection.compound || "compound";
  const disease = selection.disease || "disease";
  const gene = anchorGene ?? selection.gene ?? "gene";
  const description =
    selection.compound && selection.disease
      ? `2-hop neighborhood from ${compound} through ${gene} to ${disease}.`
      : "Pick a compound, gene, and disease to populate the 2-hop neighborhood.";

  return (
    <div data-panel="kg-3d">
      <MiniKgPreview selection={selection} />
      {/* Plan-specified description line under the 3D KG. Sits in its
        * own block so it survives both the full and the lite renderer. */}
      <div
        style={{
          marginTop: 6,
          padding: "8px 12px",
          fontSize: 12,
          color: "var(--muted)",
          background: "rgba(255,255,255,0.025)",
          border: "1px solid var(--border-soft)",
          borderRadius: 5,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );
}
