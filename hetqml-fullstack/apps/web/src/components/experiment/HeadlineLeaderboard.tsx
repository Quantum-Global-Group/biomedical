/**
 * HeadlineLeaderboard
 *
 * Compact mode-switched leaderboard for the Experiment page when
 * dashboard mode = "headline". Renders LeaderboardRow[] directly
 * (no JobResult shell), using the same `leaderBarPct` selector and
 * the same CSS classes as the LeaderboardPanel so the visual
 * treatment matches.
 *
 * Server component — no client interactivity.
 */
import type { LeaderboardRow } from "@/lib/api/client";
import { leaderBarPct } from "@/lib/experiment/selectors";

interface HeadlineLeaderboardProps {
  rows: readonly LeaderboardRow[];
}

export function HeadlineLeaderboard({ rows }: HeadlineLeaderboardProps) {
  if (rows.length === 0) {
    return (
      <div className="panel">
        <p className="panel-purpose">Headline leaderboard is empty.</p>
      </div>
    );
  }
  const sorted = [...rows].sort((a, b) => b.prAuc - a.prAuc);
  const top = sorted[0];
  // top is defined because rows.length > 0
  const max = top ? top.prAuc : 1;
  const bestClassical = sorted.find((r) => r.family === "classical");

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · MODEL LEADERBOARD (HEADLINE)</div>
          <div className="panel-title">Project preregistered panel · PR-AUC on Hetionet CtD</div>
        </div>
        <span className="badge">Headline</span>
      </div>
      <p className="panel-purpose">
        Five-row panel locked by{" "}
        <code>preregistration/osf_preregistration_v1.md</code> §&ldquo;Critical
        disclosure&rdquo;. Demo-mode candidate-and-disease pair is replaced by
        the panel-wide methodology comparison; per-pair scoring isn&rsquo;t
        meaningful here. Paired-bootstrap CIs land once the GPU run on the
        DGX produces <code>docs/results/bootstrap_ci_analysis.md</code>.
      </p>
      <div style={{ marginTop: 16 }}>
        {sorted.map((r, i) => {
          const isTopRow = top !== undefined && r.model === top.model;
          const barColor =
            r.family === "hybrid"
              ? "var(--teal)"
              : r.family === "quantum"
                ? "var(--teal)"
                : "var(--sienna)";
          return (
            <div className="leader-row" key={r.model}>
              <div className="leader-rank">{i + 1}</div>
              <div
                className="leader-name"
                style={isTopRow ? { color: "var(--teal)", fontWeight: 600 } : undefined}
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
              <div className="leader-score">{r.prAuc.toFixed(4)}</div>
              <div className="leader-params">
                {r.family.slice(0, 1).toUpperCase()}
              </div>
              <div className="leader-status">
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--gold)",
                    marginRight: 4,
                  }}
                  aria-hidden="true"
                />
                LOCKED
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
          <div className="metric-label">HEADLINE (H1b)</div>
          <div style={{ fontSize: 14, color: "var(--teal)", fontWeight: 600 }}>
            {top?.model ?? "—"}
          </div>
        </div>
        <div>
          <div className="metric-label">Δ vs best classical</div>
          <div style={{ fontSize: 14, color: "var(--green)", fontWeight: 600 }}>
            {top !== undefined && bestClassical !== undefined
              ? `+${(top.prAuc - bestClassical.prAuc).toFixed(4)}`
              : "—"}
          </div>
        </div>
        <div>
          <div className="metric-label">QSVC alone (H1)</div>
          <div style={{ fontSize: 14, fontFamily: "var(--font-mono, monospace)" }}>
            {sorted.find((r) => r.model.includes("QSVC"))?.prAuc.toFixed(4) ??
              "—"}
          </div>
        </div>
        <div>
          <div className="metric-label">Panel size</div>
          <div style={{ fontSize: 14, fontFamily: "var(--font-mono, monospace)" }}>
            {sorted.length} models · 5-fold CV (pending)
          </div>
        </div>
      </div>
      <div className="panel-footer">
        <span>preregistration/osf_preregistration_v1.md §&ldquo;Critical disclosure&rdquo;</span>
        <span>
          <em>5-fold CV · hard negatives · seed 20260504</em>
        </span>
      </div>
    </div>
  );
}
