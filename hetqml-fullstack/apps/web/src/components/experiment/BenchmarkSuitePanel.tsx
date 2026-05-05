"use client";

import { useState } from "react";
import type { JobResult, StatComparisonRow } from "@/lib/api/client";
import {
  BENCHMARK_TABS,
  getBenchmarkTab,
} from "@/lib/experiment/benchmarkTabs";

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
                    {tab.columns.map(([key]) => (
                      <td key={key}>{row.cells[key] ?? "—"}</td>
                    ))}
                    <td>
                      <span
                        className={`benchmark-status ${
                          row.status === "LIVE"
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
