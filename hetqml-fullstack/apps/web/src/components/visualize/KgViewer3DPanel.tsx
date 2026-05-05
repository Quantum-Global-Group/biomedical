"use client";

import { MiniKgPreview } from "@/components/initialize/MiniKgPreview";
import type { Selection } from "@/lib/investigation/recommendations";

interface Props {
  selection: Selection;
}

/**
 * Visualize-page wrapper around the 3D KG renderer used on Initialize.
 * Same engine, larger canvas, plus a focused caption that frames what
 * the viewer is showing in the post-run context.
 */
export function KgViewer3DPanel({ selection }: Props) {
  return (
    <div data-panel="kg-3d">
      <MiniKgPreview selection={selection} />
    </div>
  );
}
