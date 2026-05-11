"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { BenchmarkRow, JobResult, StatComparisonRow } from "@/lib/api/client";
import {
  BENCHMARK_TABS,
  LOWER_IS_BETTER,
  NON_NUMERIC_CELLS,
  getBenchmarkTab,
} from "@/lib/experiment/benchmarkTabs";

/** Parse a benchmark cell's display string into a comparable number.
 * Handles the formatted units used by `_benchmarks` on the API side:
 *   - plain decimals ("0.827", "+0.037", "-0.024")
 *   - thousands ("16,432", "2.1k", "18k")
 *   - dollar amounts ("$2.14")
 *   - mm:ss runtimes ("4m 12s", "49s")
 *   - percentages ("0.94" — interpreted as plain decimal)
 * Returns `null` for non-numeric / sentinel values ("—", "not used"). */
function parseCell(raw: string | undefined): number | null {
  if (!raw) return null;
  const v = raw.trim();
  if (v === "" || v === "—" || v === "-" || v === "not used" || v === "n/a") {
    return null;
  }
  // Runtime: "Xm YYs" or "YYs"
  const mm = v.match(/^(?:(\d+)m\s+)?(\d+)s$/);
  if (mm) {
    const minutes = mm[1] ? Number(mm[1]) : 0;
    const seconds = Number(mm[2]);
    return minutes * 60 + seconds;
  }
  // Strip leading $/+/- and trailing % then handle k/m suffixes.
  const cleaned = v.replace(/[$,]/g, "").replace(/^\+/, "");
  const km = cleaned.match(/^(-?[0-9]*\.?[0-9]+)\s*([km])?$/i);
  if (km) {
    const base = Number(km[1]);
    if (!Number.isFinite(base)) return null;
    const unit = km[2]?.toLowerCase();
    if (unit === "k") return base * 1_000;
    if (unit === "m") return base * 1_000_000;
    return base;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Compute, per column, the cell index of the best and worst row so the
 * table can paint them gold (best) / sienna-dim (worst). Only numeric
 * columns participate; ties are broken by first-occurrence. */
function computeColumnExtrema(
  rows: readonly BenchmarkRow[],
  columns: readonly (readonly [string, string])[],
): Map<string, { best: number; worst: number }> {
  const out = new Map<string, { best: number; worst: number }>();
  for (const [key] of columns) {
    if (NON_NUMERIC_CELLS.has(key)) continue;
    const lowerBetter = LOWER_IS_BETTER.has(key);
    let bestIdx = -1;
    let worstIdx = -1;
    let bestVal = lowerBetter ? Infinity : -Infinity;
    let worstVal = lowerBetter ? -Infinity : Infinity;
    let numericCount = 0;
    rows.forEach((row, i) => {
      const n = parseCell(row.cells[key]);
      if (n == null) return;
      numericCount += 1;
      if (lowerBetter ? n < bestVal : n > bestVal) {
        bestVal = n;
        bestIdx = i;
      }
      if (lowerBetter ? n > worstVal : n < worstVal) {
        worstVal = n;
        worstIdx = i;
      }
    });
    // Don't highlight a single-row column — best == worst is misleading.
    if (numericCount >= 2) {
      out.set(key, { best: bestIdx, worst: worstIdx });
    }
  }
  return out;
}

interface Props {
  result: JobResult;
}

/** 6-tab benchmark suite. Tab selection is local component state — no
 * external state library involved. The active tab decides which cell keys
 * are pulled from each BenchmarkRow.cells dict. */
export function BenchmarkSuitePanel({ result }: Props) {
  const [activeId, setActiveId] = useState<string>("classification");
  const tab = getBenchmarkTab(activeId);
  const rows = result.benchmarkRows;
  const isQuantumDisabled =
    tab.id === "quantum-hw" &&
    rows.every((r) => r.family === "Classical");
  // Column-wise best/worst is computed once per (rows × tab) pair so the
  // O(rows × cols) scan doesn't repeat on every cell render.
  const extrema = useMemo(
    () => computeColumnExtrema(rows, tab.columns),
    [rows, tab.columns],
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · BENCHMARK SUITE</div>
          <div className="panel-title">
            Compare every model across the metrics that matter
          </div>
        </div>
        <span className="badge">Comparison</span>
      </div>
      <p className="panel-purpose">
        Comprehensive evaluation across classification, ranking, calibration,
        resource efficiency, and (where applicable) quantum hardware metrics.
        Row status <strong>SIM</strong> means tab cells are deterministic
        simulated displays keyed to this job&apos;s leaderboard — not separate
        live benchmark runs.
      </p>
      <div className="benchmark-suite" data-benchmark-suite>
        <div className="benchmark-tabs" role="tablist" aria-label="Benchmark Suite tabs">
          {BENCHMARK_TABS.map((t) => {
            const selected = t.id === tab.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`benchmark-tab${selected ? " active" : ""}`}
                onClick={() => setActiveId(t.id)}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="benchmark-summary">
          <div>
            <div className="metric-label">{tab.label.toUpperCase()}</div>
            <p>{tab.summary}</p>
          </div>
          <div className="benchmark-source">
            benchmark_suite_v1.json
            <br />
            <span>seed = stable per-selection · 5-fold stratified CV</span>
          </div>
        </div>
        {isQuantumDisabled ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--faint)",
              fontSize: 12,
            }}
          >
            No quantum-hw evidence — current run path is classical-only.
          </div>
        ) : (
          <div className="benchmark-table-wrap">
            <table className="benchmark-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Model</th>
                  {tab.columns.map(([key, label]) => (
                    <th key={key}>{label}</th>
                  ))}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.model}-${i}`}>
                    <td className="benchmark-rank">{i + 1}</td>
                    <td>
                      <strong>{row.model}</strong>
                      <span>{row.family}</span>
                    </td>
                    {tab.columns.map(([key]) => {
                      const ext = extrema.get(key);
                      const isBest = ext?.best === i;
                      const isWorst = ext?.worst === i;
                      const cellStyle: CSSProperties | undefined = isBest
                        ? {
                            color: "var(--gold)",
                            fontWeight: 600,
                          }
                        : isWorst
                          ? {
                              color: "var(--sienna)",
                              opacity: 0.75,
                            }
                          : undefined;
                      return (
                        <td
                          key={key}
                          style={cellStyle}
                          title={
                            isBest
                              ? "best in column"
                              : isWorst
                                ? "worst in column"
                                : undefined
                          }
                        >
                          {row.cells[key] ?? "—"}
                        </td>
                      );
                    })}
                    <td>
                      <span
                        className={`benchmark-status ${
                          row.status === "SIM" || row.status === "LIVE"
                            ? "benchmark-status-live"
                            : "benchmark-status-fallback"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <StatComparisonRows rows={result.statComparison} />
      <div className="panel-footer">
        <span>benchmark_suite_v1.json</span>
        <span>
          <em>Hetionet v1.0 · 5-fold stratified CV · 1,000 bootstrap resamples</em>
        </span>
      </div>
    </section>
  );
}

function StatComparisonRows({ rows }: { rows: StatComparisonRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div className="exp-section-h">STATISTICAL COMPARISON</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr repeat(4, 1fr)",
          gap: 8,
          marginTop: 8,
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        <div className="metric-label">vs reference</div>
        <div className="metric-label">Δ</div>
        <div className="metric-label">p-value</div>
        <div className="metric-label">effect size</div>
        <div className="metric-label">significance</div>
        {rows.map((r) => (
          <Row key={r.label} row={r} />
        ))}
      </div>
    </div>
  );
}

function Row({ row }: { row: StatComparisonRow }) {
  const sigColor =
    row.significance === "highly-significant"
      ? "var(--green)"
      : row.significance === "significant"
        ? "var(--teal)"
        : row.significance === "marginal"
          ? "var(--amber)"
          : "var(--faint)";
  return (
    <>
      <div style={{ color: "var(--ink)" }}>{row.label}</div>
      <div style={{ fontFamily: "monospace" }}>
        {row.delta > 0 ? "+" : ""}
        {row.delta.toFixed(3)}
      </div>
      <div style={{ fontFamily: "monospace" }}>{row.pValue.toFixed(4)}</div>
      <div style={{ fontFamily: "monospace" }}>{row.effectSize.toFixed(3)}</div>
      <div style={{ color: sigColor, fontWeight: 600 }}>{row.significance}</div>
    </>
  );
}
