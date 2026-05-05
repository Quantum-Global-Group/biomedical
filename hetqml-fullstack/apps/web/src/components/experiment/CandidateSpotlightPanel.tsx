"use client";

import type { CandidateRankingRow, JobResult } from "@/lib/api/client";

interface Props {
  result: JobResult;
  selectedCompound: string;
  onSelectCandidate?: (row: CandidateRankingRow) => void;
}

/** Pair-specific score, three contextual reasons, and a 6-row ranking table.
 * Row click is wired through `onSelectCandidate` so a future build can swap
 * the active compound; today it's a no-op when the prop is omitted. */
export function CandidateSpotlightPanel({
  result,
  selectedCompound,
  onSelectCandidate,
}: Props) {
  const { candidateSpotlight } = result;
  const ranking = candidateSpotlight.ranking;
  const score = candidateSpotlight.score;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · CANDIDATE SPOTLIGHT</div>
          <div className="panel-title">
            Why {selectedCompound || "this candidate"} surfaced
          </div>
        </div>
        <span className="badge">Detail</span>
      </div>
      <p className="panel-purpose">
        The selected candidate&apos;s prediction probability for this disease,
        with explicit reasoning. Click any other candidate row to load it as
        the primary.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 24,
          marginTop: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 56,
              color: "var(--teal)",
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {score.toFixed(3)}
          </div>
          <div className="metric-sub" style={{ marginTop: 4 }}>
            top model · prediction probability
          </div>
        </div>
        <div>
          <div className="metric-label">WHY IT SURFACED</div>
          <div style={{ marginTop: 12 }}>
            {candidateSpotlight.reasons.map((reason, i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 12, marginBottom: 12 }}
              >
                <span
                  className="mono"
                  style={{ color: "var(--gold)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {reason}
                </span>
              </div>
            ))}
          </div>
          <div className="metric-label" style={{ marginTop: 24 }}>
            OTHER RANKED CANDIDATES · CLICK TO MAKE PRIMARY
          </div>
          <div style={{ marginTop: 12 }}>
            {ranking.map((row, i) => (
              <CandidateRow
                key={`${row.compound}-${i}`}
                row={row}
                isActive={row.compound === selectedCompound}
                onSelect={onSelectCandidate}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="panel-footer">
        <span>predictions · top {ranking.length}</span>
        <span>
          <em>scored against same hard-negative test set</em>
        </span>
      </div>
    </section>
  );
}

function CandidateRow({
  row,
  isActive,
  onSelect,
}: {
  row: CandidateRankingRow;
  isActive: boolean;
  onSelect?: (row: CandidateRankingRow) => void;
}) {
  const tier =
    row.score > 0.85 ? "conf-high" : row.score > 0.75 ? "conf-med" : "conf-low";
  const tierLabel =
    tier === "conf-high" ? "High" : tier === "conf-med" ? "Medium" : "Low";

  return (
    <div
      className={`candidate-row${isActive ? " active" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(row);
        }
      }}
    >
      <span className="candidate-rank">{row.rank}</span>
      <span className="candidate-name">{row.compound}</span>
      <span className="candidate-disease">{row.disease}</span>
      <span className={`conf-tag ${tier}`}>{tierLabel}</span>
      <span className="candidate-score">{row.score.toFixed(3)}</span>
    </div>
  );
}
