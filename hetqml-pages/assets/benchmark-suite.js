export const BENCHMARK_TABS = [
  {
    id: "classification",
    label: "Classification",
    summary: "Headline discrimination metrics on the held-out hard-negative test set.",
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
    summary: "Candidate ordering quality for reviewer triage and top-K promotion.",
    columns: [
      ["map", "MAP"],
      ["ndcg10", "NDCG@10"],
      ["hit10", "Hit@10"],
      ["deltaClassical", "Delta vs classical"],
    ],
  },
  {
    id: "calibration",
    label: "Calibration",
    summary: "Probability reliability checks used before candidate scores are interpreted clinically.",
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
    summary: "Runtime, parameter, and cost tradeoffs for repeatable experiment planning.",
    columns: [
      ["runtime", "Runtime"],
      ["params", "Params"],
      ["cost", "Cost"],
      ["cpuHours", "CPU h"],
    ],
  },
  {
    id: "quantum-hw",
    label: "Quantum HW",
    summary: "Hardware-specific execution evidence for models that touched IBM backends.",
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
    summary: "Cross-validation design, variance, and leakage controls behind each score.",
    columns: [
      ["folds", "Folds"],
      ["std", "Std"],
      ["split", "Split"],
      ["leakage", "Leakage"],
    ],
  },
];

export const BENCHMARK_ROWS = [
  {
    model: "Quantum Kernel + Metapath",
    family: "Hybrid",
    status: "LIVE",
    prAuc: "0.827",
    rocAuc: "0.870",
    f1: "0.790",
    mcc: "0.760",
    map: "0.714",
    ndcg10: "0.881",
    hit10: "0.940",
    deltaClassical: "+0.037",
    brier: "0.077",
    ece: "0.031",
    mce: "0.068",
    slope: "0.94",
    runtime: "4m 12s",
    params: "28",
    cost: "$2.14",
    cpuHours: "0.38",
    backend: "ibm_torino",
    shots: "16,432",
    depth: "42",
    readout: "0.982",
    folds: "5 stratified",
    std: "0.014",
    split: "ancestry-aware",
    leakage: "none",
  },
  {
    model: "QSVC (Pauli)",
    family: "Hybrid",
    status: "LIVE",
    prAuc: "0.814",
    rocAuc: "0.861",
    f1: "0.781",
    mcc: "0.741",
    map: "0.702",
    ndcg10: "0.864",
    hit10: "0.921",
    deltaClassical: "+0.024",
    brier: "0.083",
    ece: "0.038",
    mce: "0.074",
    slope: "0.91",
    runtime: "2m 36s",
    params: "16",
    cost: "$1.68",
    cpuHours: "0.31",
    backend: "ibm_torino",
    shots: "12,000",
    depth: "36",
    readout: "0.982",
    folds: "5 stratified",
    std: "0.017",
    split: "ancestry-aware",
    leakage: "none",
  },
  {
    model: "Stacking ensemble",
    family: "Classical",
    status: "LIVE",
    prAuc: "0.790",
    rocAuc: "0.842",
    f1: "0.756",
    mcc: "0.704",
    map: "0.681",
    ndcg10: "0.832",
    hit10: "0.902",
    deltaClassical: "baseline",
    brier: "0.091",
    ece: "0.046",
    mce: "0.088",
    slope: "0.87",
    runtime: "49s",
    params: "2.1k",
    cost: "$0.18",
    cpuHours: "0.12",
    backend: "not used",
    shots: "not used",
    depth: "not used",
    readout: "not used",
    folds: "5 stratified",
    std: "0.021",
    split: "ancestry-aware",
    leakage: "none",
  },
  {
    model: "VQC",
    family: "Hybrid",
    status: "LIVE",
    prAuc: "0.790",
    rocAuc: "0.839",
    f1: "0.748",
    mcc: "0.698",
    map: "0.672",
    ndcg10: "0.821",
    hit10: "0.889",
    deltaClassical: "+0.000",
    brier: "0.096",
    ece: "0.052",
    mce: "0.097",
    slope: "0.84",
    runtime: "3m 44s",
    params: "24",
    cost: "$1.92",
    cpuHours: "0.34",
    backend: "ibm_brisbane",
    shots: "8,192",
    depth: "58",
    readout: "0.976",
    folds: "5 stratified",
    std: "0.024",
    split: "ancestry-aware",
    leakage: "none",
  },
  {
    model: "RotatE -> LR",
    family: "Classical",
    status: "LIVE",
    prAuc: "0.767",
    rocAuc: "0.816",
    f1: "0.731",
    mcc: "0.662",
    map: "0.651",
    ndcg10: "0.804",
    hit10: "0.872",
    deltaClassical: "-0.023",
    brier: "0.103",
    ece: "0.061",
    mce: "0.112",
    slope: "0.79",
    runtime: "37s",
    params: "384",
    cost: "$0.09",
    cpuHours: "0.08",
    backend: "not used",
    shots: "not used",
    depth: "not used",
    readout: "not used",
    folds: "5 stratified",
    std: "0.026",
    split: "ancestry-aware",
    leakage: "none",
  },
  {
    model: "Extra Trees",
    family: "Classical",
    status: "FALLBACK",
    prAuc: "0.766",
    rocAuc: "0.812",
    f1: "0.726",
    mcc: "0.657",
    map: "0.644",
    ndcg10: "0.797",
    hit10: "0.861",
    deltaClassical: "-0.024",
    brier: "0.108",
    ece: "0.067",
    mce: "0.119",
    slope: "0.76",
    runtime: "1m 03s",
    params: "18k",
    cost: "$0.21",
    cpuHours: "0.18",
    backend: "not used",
    shots: "not used",
    depth: "not used",
    readout: "not used",
    folds: "5 stratified",
    std: "0.029",
    split: "ancestry-aware",
    leakage: "none",
  },
];

const PLACEHOLDER_TEXT = "6-tab Benchmark Suite";
const ACTIVE_CLASS = "active";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getTab(tabId) {
  return BENCHMARK_TABS.find((tab) => tab.id === tabId) ?? BENCHMARK_TABS[0];
}

function renderTabs(activeTab) {
  return BENCHMARK_TABS.map((tab) => {
    const selected = tab.id === activeTab.id;
    return `<button class="benchmark-tab ${selected ? ACTIVE_CLASS : ""}" type="button" role="tab" aria-selected="${selected}" data-benchmark-tab="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`;
  }).join("");
}

function renderRows(tab) {
  return BENCHMARK_ROWS.map((row, index) => {
    const cells = tab.columns.map(([key]) => `<td>${escapeHtml(row[key])}</td>`).join("");
    const statusClass = row.status === "LIVE" ? "benchmark-status-live" : "benchmark-status-fallback";

    return `<tr>
      <td class="benchmark-rank">${index + 1}</td>
      <td><strong>${escapeHtml(row.model)}</strong><span>${escapeHtml(row.family)}</span></td>
      ${cells}
      <td><span class="benchmark-status ${statusClass}">${escapeHtml(row.status)}</span></td>
    </tr>`;
  }).join("");
}

export function renderBenchmarkSuite(tabId = "classification") {
  const activeTab = getTab(tabId);
  const headings = activeTab.columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("");

  return `<div class="benchmark-suite" data-benchmark-suite>
    <div class="benchmark-tabs" role="tablist" aria-label="Benchmark Suite tabs">
      ${renderTabs(activeTab)}
    </div>
    <div class="benchmark-summary" data-tab-panel="${escapeHtml(activeTab.id)}">
      <div>
        <div class="metric-label">${escapeHtml(activeTab.label.toUpperCase())}</div>
        <p>${escapeHtml(activeTab.summary)}</p>
      </div>
      <div class="benchmark-source">benchmark_suite_v1.json<br><span>seed = 42 · 5-fold stratified CV</span></div>
    </div>
    <div class="benchmark-table-wrap">
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Model</th>
            ${headings}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${renderRows(activeTab)}</tbody>
      </table>
    </div>
  </div>`;
}

function benchmarkStyles() {
  return `.benchmark-suite{margin-top:16px;border:1px solid var(--border-soft);border-radius:6px;overflow:hidden;background:rgba(255,255,255,.02)}
.benchmark-tabs{display:flex;flex-wrap:wrap;gap:8px;padding:14px;border-bottom:1px solid var(--border-soft)}
.benchmark-tab{border:1px solid var(--border-soft);background:transparent;color:var(--muted);border-radius:999px;padding:7px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;cursor:pointer}
.benchmark-tab.active{border-color:var(--teal);color:var(--teal);background:var(--teal-bg)}
.benchmark-summary{display:flex;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid var(--border-soft)}
.benchmark-summary p{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.55}
.benchmark-source{font-family:monospace;color:var(--gold);font-size:12px;text-align:right;white-space:nowrap}
.benchmark-source span{color:var(--faint)}
.benchmark-table-wrap{overflow-x:auto}
.benchmark-table{width:100%;border-collapse:collapse;font-size:12px;min-width:760px}
.benchmark-table th{padding:10px 12px;text-align:left;color:var(--faint);font-size:10px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--border-soft)}
.benchmark-table td{padding:12px;border-bottom:1px solid var(--border-soft);color:var(--muted)}
.benchmark-table tbody tr:hover{background:rgba(255,255,255,.03)}
.benchmark-table strong{display:block;color:var(--ink);font-size:13px}
.benchmark-table td span:not(.benchmark-status){display:block;color:var(--faint);font-size:11px;margin-top:3px}
.benchmark-rank{color:var(--gold)!important;font-family:monospace}
.benchmark-status{display:inline-flex;align-items:center;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:700;letter-spacing:.08em}
.benchmark-status-live{color:var(--green);background:var(--green-bg)}
.benchmark-status-fallback{color:var(--amber);background:var(--amber-bg)}
@media (max-width: 760px){.benchmark-summary{display:block}.benchmark-source{text-align:left;margin-top:12px}.benchmark-tabs{gap:6px}}`;
}

function injectStyles(documentRef) {
  if (documentRef.getElementById("benchmark-suite-styles")) {
    return;
  }

  const style = documentRef.createElement("style");
  style.id = "benchmark-suite-styles";
  style.textContent = benchmarkStyles();
  documentRef.head.appendChild(style);
}

function findBenchmarkPlaceholder(documentRef) {
  const panels = Array.from(documentRef.querySelectorAll(".panel"));

  return panels.find((panel) => {
    const eyebrow = panel.querySelector(".eyebrow");
    return eyebrow?.textContent?.trim() === "TOOL · BENCHMARK SUITE" && panel.textContent.includes(PLACEHOLDER_TEXT);
  });
}

export function mountBenchmarkSuite(documentRef = globalThis.document) {
  if (!documentRef) {
    return false;
  }

  const panel = findBenchmarkPlaceholder(documentRef);
  if (!panel || panel.querySelector("[data-benchmark-suite]")) {
    return false;
  }

  const placeholder = Array.from(panel.querySelectorAll("div")).find((element) => element.textContent.includes(PLACEHOLDER_TEXT));
  if (!placeholder) {
    return false;
  }

  injectStyles(documentRef);
  placeholder.outerHTML = renderBenchmarkSuite("classification");

  const suite = panel.querySelector("[data-benchmark-suite]");
  suite?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-benchmark-tab]");
    if (!tab) {
      return;
    }

    suite.innerHTML = renderBenchmarkSuite(tab.dataset.benchmarkTab).replace(/^<div class="benchmark-suite" data-benchmark-suite>|<\/div>$/g, "");
  });

  return true;
}

if (typeof window !== "undefined") {
  const mount = () => mountBenchmarkSuite(window.document);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  window.addEventListener("load", mount, { once: true });
  window.setTimeout(mount, 300);
}
