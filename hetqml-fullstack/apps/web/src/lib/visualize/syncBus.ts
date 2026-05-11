"use client";

/**
 * Visualize · auto-sync bus.
 *
 * Cross-panel selection sync without React context. The molecule
 * viewer, embedding scatter, and KG panel all want to highlight the same
 * pair when the user clicks one of them. Wiring this through
 * VisualizeClient state would force a re-render of every sibling on
 * every click; a window-event bus keeps each panel imperatively in
 * sync with O(1) work per listener.
 *
 * Auto-sync defaults on (toggle in the controls bar to disable). When off,
 * panels still emit events but Visualize-level listeners ignore incoming
 * ones, so manual exploration in one panel doesn't disturb the others.
 *
 * Wire shape: a single CustomEvent type carrying the pair the user
 * just focused on. Listeners filter by `source` so a panel doesn't
 * react to its own emission and re-loop.
 */

export const VIZ_SYNC_EVENT = "hetqml:viz-sync" as const;

/** `embedding` = 2D surrogate layout panel (`JobResult.embedding`), not UMAP. */
export type VizSyncSource = "molecule" | "embedding" | "kg" | "external";

export interface VizSyncDetail {
  /** Compound display name (matches Selection.compound). */
  compound: string;
  /** Disease display name (matches Selection.disease). */
  disease: string;
  /** Which panel emitted the event — used by listeners to ignore self. */
  source: VizSyncSource;
}

export function emitVizSync(detail: VizSyncDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VIZ_SYNC_EVENT, { detail }));
}
