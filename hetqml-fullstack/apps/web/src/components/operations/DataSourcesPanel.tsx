"use client";

import type { OpsSourcesResponse } from "@/lib/api/client";
import { formatAgo } from "@/lib/operations/format";

interface Props {
  sources: OpsSourcesResponse;
}

/** Upstream snapshot freshness with SHA-256 + SLA-aware fresh/stale flag. */
export function DataSourcesPanel({ sources }: Props) {
  const fresh = sources.sources.filter((s) => s.fresh).length;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · DATA SOURCES</div>
          <div className="panel-title">Upstream freshness &amp; integrity</div>
        </div>
        <span className="badge">Provenance</span>
      </div>
      <p className="panel-purpose">
        Versioned data snapshots — when each was last refreshed, the SHA-256 of
        the snapshot, and the integrity-check status.
      </p>
      <div>
        {sources.sources.map((s) => {
          const ts = Date.parse(s.lastSync);
          const ago = Number.isFinite(ts)
            ? formatAgo(Math.max(0, Math.round((Date.now() - ts) / 1000)))
            : "—";
          const shortSha = `${s.sha256.slice(0, 4)}…${s.sha256.slice(-4)}`;
          return (
            <div key={s.name} className="ops-source-row">
              <span className="ops-source-name">
                {s.name}
                <span className="sub">sha256:{shortSha}</span>
              </span>
              <span className="ops-source-time">
                last sync · <span className="v">{ago}</span>
              </span>
              <span
                className={`ops-source-status ${s.fresh ? "fresh" : "stale"}`}
              >
                {s.fresh ? "fresh" : "stale"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="panel-footer">
        <span>data/manifest.json</span>
        <span>
          <em>
            {fresh}/{sources.sources.length} within SLA
          </em>
        </span>
      </div>
    </section>
  );
}
