/**
 * Benchmark suite tab schema. Ported verbatim from
 * hetqml-pages/assets/benchmark-suite.js so column keys line up with the
 * cells dict produced by simulate_run on the API side.
 *
 * Each column entry is [cellKey, displayLabel]. The column order on screen
 * matches the order here. Adding a new column is a one-line change in this
 * file plus the corresponding key in `_benchmarks` on the API.
 */
export type BenchmarkColumn = readonly [string, string];

export interface BenchmarkTab {
  id: string;
  label: string;
  summary: string;
  columns: readonly BenchmarkColumn[];
}

export const BENCHMARK_TABS: readonly BenchmarkTab[] = [
  {
    id: "classification",
    label: "Classification",
    summary:
      "Headline discrimination metrics on the held-out hard-negative test set.",
    columns: [
      ["prAuc", "PR-AUC"],
      ["rocAuc", "ROC-AUC"],
      ["f1", "F1"],
      ["mcc", "MCC"],
    ],
  },
  {
    id: "ranking",
    label: "Ranking",
    summary:
      "Candidate ordering quality for reviewer triage and top-K promotion.",
    columns: [
      ["map", "MAP"],
      ["ndcg10", "NDCG@10"],
      ["hit10", "Hit@10"],
      ["deltaClassical", "Δ vs classical"],
    ],
  },
  {
    id: "calibration",
    label: "Calibration",
    summary:
      "Probability reliability checks used before scores are interpreted clinically.",
    columns: [
      ["brier", "Brier"],
      ["ece", "ECE"],
      ["mce", "MCE"],
      ["slope", "Slope"],
    ],
  },
  {
    id: "efficiency",
    label: "Efficiency",
    summary:
      "Runtime, parameter, and cost tradeoffs for repeatable experiment planning.",
    columns: [
      ["runtime", "Runtime"],
      ["params", "Params"],
      ["cost", "Cost"],
      ["cpuHours", "CPU h"],
    ],
  },
  {
    id: "quantum-hw",
    label: "Quantum execution",
    summary:
      "Backend, shots, depth, and readout columns for rows that reference a quantum backend (values are still benchmark-suite SIM cells per row).",
    columns: [
      ["backend", "Backend"],
      ["shots", "Shots"],
      ["depth", "Depth"],
      ["readout", "Readout"],
    ],
  },
  {
    id: "cv-strategy",
    label: "CV strategy",
    summary:
      "5-fold stratified by treatment label with ancestry-aware time-split, plus LODO and LOCO leakage probes. Hard negatives drawn from co-treated diseases. 1,000 paired-bootstrap resamples for every CI.",
    columns: [
      ["folds", "Folds"],
      ["std", "Std"],
      ["split", "Split"],
      ["leakage", "Leakage"],
    ],
  },
];

/** Cells where a lower numeric value is the better outcome — used by the
 * Benchmark Suite's column-wise best/worst highlighting. Anything not in
 * this set is treated as "higher is better". */
export const LOWER_IS_BETTER: ReadonlySet<string> = new Set([
  "brier",
  "ece",
  "mce",
  "runtime",
  "params",
  "cost",
  "cpuHours",
  "depth",
  "std",
]);

/** Cells whose value is a free-form label, not a number — these never
 * receive best/worst highlighting. */
export const NON_NUMERIC_CELLS: ReadonlySet<string> = new Set([
  "backend",
  "split",
  "leakage",
  "folds",
]);

export function getBenchmarkTab(id: string): BenchmarkTab {
  return BENCHMARK_TABS.find((tab) => tab.id === id) ?? BENCHMARK_TABS[0]!;
}
