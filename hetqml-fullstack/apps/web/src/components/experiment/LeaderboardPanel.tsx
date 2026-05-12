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
  const runRows = rows.filter((r) => (r.rowStatus ?? "SIM") === "RUN");
  const simRows = rows.filter((r) => (r.rowStatus ?? "SIM") !== "RUN");
  const simCount = simRows.length;
  const runCount = runRows.length;

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
        parameter-efficiency, not raw advantage. The status column comes from the
        API: <strong>RUN</strong> on the path-aware row whose metrics were spliced
        from this job&apos;s ML execution; <strong>SIM</strong> on deterministic
        scaffold scores (same envelope as the benchmark suite tabs).
      </p>

      {simCount > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "var(--amber-bg, #2d2510)",
            border: "1px solid var(--amber, #d4a574)",
            borderRadius: 6,
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--ink)",
          }}
        >
          <strong>⚠ {simCount} row{simCount !== 1 ? "s are" : " is"} SIM projection{simCount !== 1 ? "s" : ""}</strong>
          {" "}— only the {runCount} row{runCount !== 1 ? "s" : ""} marked{" "}
          <strong>RUN</strong> {runCount !== 1 ? "were" : "was"} executed in
          this investigation. SIM rows are deterministic placeholders derived
          from the algorithm catalog and should <em>not</em> be treated as
          independent empirical measurements in a research paper.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {runRows.length > 0 && (
          <>
            <SectionHeader
              label="Executed (RUN)"
              count={runCount}
              tone="run"
              note="Real cross-validated metrics from this job."
            />
            {runRows.map((r, i) => (
              <LeaderRow
                key={`run-${r.model}-${i}`}
                row={r}
                rank={i + 1}
                isTop={r.model === topId}
                max={max}
                dimmed={false}
              />
            ))}
          </>
        )}
        {simRows.length > 0 && (
          <>
            <SectionHeader
              label="Projected (SIM)"
              count={simCount}
              tone="sim"
              note="Deterministic scaffolding from the algorithm catalog — not from this run."
            />
            {simRows.map((r, i) => (
              <LeaderRow
                key={`sim-${r.model}-${i}`}
                row={r}
                rank={runCount + i + 1}
                isTop={false}
                max={max}
                dimmed={true}
              />
            ))}
          </>
        )}
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

type LeaderRowType = JobResult["leaderboard"][number];

function SectionHeader({
  label,
  count,
  tone,
  note,
}: {
  label: string;
  count: number;
  tone: "run" | "sim";
  note: string;
}) {
  const color = tone === "run" ? "var(--green)" : "var(--amber)";
  const bg = tone === "run" ? "var(--green-bg)" : "var(--amber-bg)";
  return (
    <div
      style={{
        marginTop: 8,
        marginBottom: 8,
        padding: "6px 10px",
        borderTop: `1px solid ${color}`,
        background: bg,
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        ── {label} ──
      </span>
      <span
        style={{
          fontSize: 10.5,
          fontFamily: "var(--font-mono, monospace)",
          color: "var(--muted)",
        }}
      >
        {count} row{count === 1 ? "" : "s"}
      </span>
      <span style={{ fontSize: 11, color: "var(--muted)", flex: "1 1 200px" }}>
        {note}
      </span>
    </div>
  );
}

function LeaderRow({
  row,
  rank,
  isTop,
  max,
  dimmed,
}: {
  row: LeaderRowType;
  rank: number;
  isTop: boolean;
  max: number;
  dimmed: boolean;
}) {
  const rowStatus = row.rowStatus ?? "SIM";
  const barColor =
    row.family === "classical" ? "var(--sienna)" : "var(--teal)";
  return (
    <div
      className="leader-row"
      style={{
        ...(isTop ? { background: "var(--teal-light)" } : undefined),
        opacity: dimmed ? 0.7 : 1,
        filter: dimmed ? "saturate(0.7)" : undefined,
      }}
    >
      <div className="leader-rank">{rank}</div>
      <div
        className="leader-name"
        style={isTop ? { color: "var(--teal)", fontWeight: 600 } : undefined}
      >
        {row.model}
      </div>
      <div className="leader-bar">
        <div
          className="leader-fill"
          style={{
            width: `${leaderBarPct(row.prAuc, max)}%`,
            background: barColor,
          }}
        />
      </div>
      <div className="leader-score">{row.prAuc.toFixed(3)}</div>
      <div className="leader-params">
        {row.params && row.params.trim() !== "" ? `${row.params}p` : "—"}
      </div>
      <div className="leader-status">
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background:
              rowStatus === "RUN" ? "var(--green)" : "var(--amber)",
            marginRight: 4,
          }}
        />
        {rowStatus}
      </div>
    </div>
  );
}
