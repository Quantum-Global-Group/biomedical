"use client";

import type { JobResult } from "@/lib/api/client";
import {
  getLeaderboardFooter,
  leaderBarPct,
} from "@/lib/experiment/selectors";
import type { RunFamilyId } from "@/lib/investigation/runPath";

interface Props {
  result: JobResult;
  family: RunFamilyId;
}

/** 13-row model leaderboard with bar chart. Rows are color-coded by family
 * (teal for quantum/hybrid, sienna for classical) and the path-aware top
 * model is highlighted regardless of which row the API tagged isTop. */
export function LeaderboardPanel({ result, family }: Props) {
  const rows = [...result.leaderboard].sort((a, b) => b.prAuc - a.prAuc);
  const max = rows.length > 0 ? rows[0]!.prAuc : 1;
  const footer = getLeaderboardFooter(rows, family);
  const topId = footer.topModel?.model;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · MODEL LEADERBOARD</div>
          <div className="panel-title">Which model performed best</div>
        </div>
        <span className="badge">Results</span>
      </div>
      <p className="panel-purpose">
        PR-AUC across the algorithms in the current run path, on the same test
        set with the same features. The honest story for this project is
        parameter-efficiency, not raw advantage.
      </p>
      <div style={{ marginTop: 16 }}>
        {rows.map((r, i) => {
          const isTop = r.model === topId;
          const barColor =
            r.family === "classical" ? "var(--sienna)" : "var(--teal)";
          return (
            <div
              key={`${r.model}-${i}`}
              className="leader-row"
              style={isTop ? { background: "var(--teal-light)" } : undefined}
            >
              <div className="leader-rank">{i + 1}</div>
              <div
                className="leader-name"
                style={isTop ? { color: "var(--teal)", fontWeight: 600 } : undefined}
              >
                {r.model}
              </div>
              <div className="leader-bar">
                <div
                  className="leader-fill"
                  style={{
                    width: `${leaderBarPct(r.prAuc, max)}%`,
                    background: barColor,
                  }}
                />
              </div>
              <div className="leader-score">{r.prAuc.toFixed(3)}</div>
              <div className="leader-params">
                {r.params && r.params.trim() !== "" ? `${r.params}p` : "—"}
              </div>
              <div className="leader-status">
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--green)",
                    marginRight: 4,
                  }}
                />
                LIVE
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid var(--border-soft)",
        }}
      >
        <div>
          <div className="metric-label">TOP MODEL</div>
          <div style={{ fontSize: 14, color: "var(--teal)", fontWeight: 600 }}>
            {footer.topModel?.model ?? "—"}
          </div>
        </div>
        <div>
          <div className="metric-label">Δ VS BEST CLASSICAL</div>
          <div
            style={{
              fontSize: 14,
              color:
                footer.deltaVsBestClassical > 0
                  ? "var(--green)"
                  : footer.deltaVsBestClassical < 0
                    ? "var(--sienna)"
                    : "var(--muted)",
              fontWeight: 600,
            }}
          >
            {formatDelta(footer.deltaVsBestClassical)}
          </div>
        </div>
        <div>
          <div className="metric-label">PARAM RATIO</div>
          <div style={{ fontSize: 14, fontFamily: "monospace" }}>
            {footer.paramRatioLabel}
          </div>
        </div>
        <div>
          <div className="metric-label">ALGORITHMS RUN</div>
          <div style={{ fontSize: 14, fontFamily: "monospace" }}>
            {footer.classicalCount} classical · {footer.hybridCount} hybrid ·{" "}
            {footer.quantumCount} quantum
          </div>
        </div>
      </div>
      <p
        style={{
          marginTop: 12,
          fontSize: 12,
          lineHeight: 1.55,
          color: "var(--muted)",
        }}
      >
        {footer.deployCopy}
      </p>
      <div className="panel-footer">
        <span>leaderboard · {rows.length} algorithms</span>
        <span>
          <em>5-fold CV · hard negatives · stratified by ancestry</em>
        </span>
      </div>
    </section>
  );
}

function formatDelta(d: number): string {
  if (d === 0) return "±0.000";
  return `${d > 0 ? "+" : ""}${d.toFixed(3)}`;
}
