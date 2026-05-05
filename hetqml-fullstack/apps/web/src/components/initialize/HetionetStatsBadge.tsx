"use client";

import type { CatalogsState } from "@/lib/data/useCatalogs";

interface Props {
  state: CatalogsState;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Hetionet-scale stats bar — diseases · compounds · genes · metaedges.
 * Reads counts from the live `/catalog/*` envelopes (see `useCatalogs`).
 * Falls back to seed counts if the API is offline.
 */
export function HetionetStatsBadge({ state }: Props) {
  const totalEdges =
    // sum of edge_count from the metaedges (when known); otherwise omit
    null;

  const allLive =
    state.source.diseases === "live" &&
    state.source.compounds === "live" &&
    state.source.genes === "live" &&
    state.source.metaedges === "live";

  return (
    <div
      className="dataset-stats"
      data-testid="hetionet-stats"
      title={`source · ${allLive ? "live /catalog/*" : "seed fallback"}`}
    >
      <div className="dataset-stat">
        <div className="dataset-stat-num">{fmt(state.counts.diseases)}</div>
        <div className="dataset-stat-label">DISEASES</div>
      </div>
      <div className="dataset-stat">
        <div className="dataset-stat-num">{fmt(state.counts.compounds)}</div>
        <div className="dataset-stat-label">COMPOUNDS</div>
      </div>
      <div className="dataset-stat">
        <div className="dataset-stat-num">{fmt(state.counts.genes)}</div>
        <div className="dataset-stat-label">GENES</div>
      </div>
      <div className="dataset-stat">
        <div className="dataset-stat-num">{fmt(state.counts.metaedges)}</div>
        <div className="dataset-stat-label">METAEDGES</div>
      </div>
      {totalEdges !== null ? (
        <div className="dataset-stat" style={{ gridColumn: "span 4" }}>
          <div className="dataset-stat-label">{fmt(totalEdges)} edges</div>
        </div>
      ) : null}
    </div>
  );
}
