export const VISUALIZE_DATA = {
  investigation: {
    compound: "Inaxaplin",
    formula: "C24H26F3N5O3S",
    disease: "Hypertension-attributed ESKD",
    gene: "APOL1",
    metaedge: "CtD · Compound–treats–Disease",
    topModel: "Hybrid (QSVM-RBF)",
    evidenceSource: "Hetionet v1.0 + DepMap 22Q4",
    runId: "run_2026_05_02_a14",
    lastSync: "14:32 UTC",
  },
  metricStrip: [
    { label: "Compound", value: "Inaxaplin", sub: "DrugBank · DB17442" },
    { label: "Formula", value: "C24H26F3N5O3S", sub: "MW 521.6 · logP 3.1" },
    { label: "Top model", value: "Hybrid", sub: "QSVM-RBF · PR-AUC 0.812" },
    { label: "Evidence source", value: "Hetionet v1.0", sub: "+ DepMap 22Q4 augmentation" },
  ],
  clinicalStrip: [
    {
      label: "Trial readouts",
      value: "2 · Phase II",
      detail: "AMPLITUDE & VX-147 in APOL1-mediated FSGS",
      tone: "teal",
    },
    {
      label: "Mechanism support",
      value: "APOL1 channel inhibitor",
      detail: "Closes APOL1 cation channel → reduces podocyte injury",
      tone: "gold",
    },
    {
      label: "Genetic match",
      value: "G1/G2 risk variants",
      detail: "Ancestry-aware enrichment in ESKD cohorts",
      tone: "amber",
    },
    {
      label: "Safety posture",
      value: "Manageable",
      detail: "Mild GI · no observed nephrotoxicity in Phase II",
      tone: "green",
    },
  ],
  evidenceMatrix: {
    columns: ["Hetionet", "Literature", "DepMap", "Trials", "Real-world"],
    rows: [
      { layer: "Compound–Disease (CtD)", cells: ["strong", "strong", "absent", "strong", "weak"] },
      { layer: "Compound–Gene (CbG)",    cells: ["strong", "strong", "strong", "absent", "absent"] },
      { layer: "Gene–Disease (GaD)",     cells: ["strong", "strong", "weak", "strong", "weak"] },
      { layer: "Pathway involvement",    cells: ["strong", "strong", "weak", "absent", "absent"] },
      { layer: "Tissue expression",      cells: ["strong", "weak", "strong", "absent", "absent"] },
      { layer: "Adverse-event signal",   cells: ["absent", "weak", "absent", "strong", "strong"] },
    ],
  },
  pathDiagram: {
    nodes: [
      { id: "compound", label: "Inaxaplin",                  kind: "Compound",  meta: "DrugBank · DB17442" },
      { id: "target",   label: "APOL1",                      kind: "Target",    meta: "NCBI · 8542" },
      { id: "pathway",  label: "APOL1 cation-channel axis",  kind: "Pathway",   meta: "Reactome · R-HSA-9658195" },
      { id: "disease",  label: "Hypertension-attributed ESKD", kind: "Disease", meta: "DOID · 13635" },
    ],
    edges: [
      { from: "compound", to: "target",  metaedge: "CbG", evidence: "Binds · IC50 12 nM" },
      { from: "target",   to: "pathway", metaedge: "Gpw", evidence: "Channel-forming subunit" },
      { from: "pathway",  to: "disease", metaedge: "PwD", evidence: "Risk-genotype-driven podocyte injury" },
    ],
  },
  modelAgreement: {
    models: [
      { id: "classical", label: "Classical (RF)",      score: 0.74, ci: 0.04, color: "var(--muted)" },
      { id: "hybrid",    label: "Hybrid (QSVM-RBF)",   score: 0.81, ci: 0.03, color: "var(--teal)" },
      { id: "quantum",   label: "Quantum HW (Torino)", score: 0.78, ci: 0.05, color: "var(--gold)" },
    ],
    agreement: 0.86,
    note: "All three models rank Inaxaplin in the top 1% for APOL1-mediated ESKD. Disagreement is concentrated in 4-fold tail.",
  },
  evidenceOverlays: [
    {
      id: "ovl-1",
      title: "Genetic prior",
      claim: "APOL1 G1/G2 risk variants confer 7–10× risk of CKD progression in West-African-ancestry cohorts.",
      sources: ["Genovese 2010 · Science", "Parsa 2013 · NEJM"],
      strength: "strong",
    },
    {
      id: "ovl-2",
      title: "Mechanism",
      claim: "Inaxaplin closes the APOL1-formed cation channel and rescues podocyte viability in APOL1-G1 transgenic mice.",
      sources: ["Egbuna 2023 · NEJM", "Wen 2024 · Kidney Int"],
      strength: "strong",
    },
    {
      id: "ovl-3",
      title: "Clinical readout",
      claim: "Phase 2a (AMPLITUDE) showed 47.6% UPCR reduction at 13 weeks in APOL1-mediated FSGS.",
      sources: ["VX-147 AMPLITUDE 2023"],
      strength: "moderate",
    },
    {
      id: "ovl-4",
      title: "Counter-evidence",
      claim: "No prospective hypertensive-ESKD-specific endpoint yet; extrapolation from FSGS to ESKD is indirect.",
      sources: ["Internal skeptic note 04.18"],
      strength: "weak",
    },
  ],
  provenance: [
    { at: "2026-04-30 09:12", who: "ingest", what: "Hetionet v1.0 snapshot loaded · 47k nodes / 2.25M edges" },
    { at: "2026-04-30 09:48", who: "augment", what: "DepMap 22Q4 essentiality scores joined to Gene nodes" },
    { at: "2026-05-01 11:04", who: "model:hybrid", what: "QSVM-RBF trained · 5-fold CV · seed 42" },
    { at: "2026-05-01 14:21", who: "model:quantum", what: "ZZFeatureMap kernel run on ibm_torino · 8192 shots" },
    { at: "2026-05-02 08:30", who: "review", what: "Reviewer J.B. promoted candidate to Validate queue" },
    { at: "2026-05-02 14:32", who: "sync", what: "Visualize page rebuilt from latest run snapshot" },
  ],
  qualityFlags: [
    { level: "ok",     label: "Hard-negative held-out test set used", note: "23 ancestry/popstructure guards passed" },
    { level: "ok",     label: "Calibration slope within tolerance",   note: "0.96 (target 0.85–1.15)" },
    { level: "warn",   label: "Real-world evidence sparse",            note: "Only 1 RW source for adverse events" },
    { level: "warn",   label: "Indirect endpoint extrapolation",       note: "FSGS readout → ESKD application" },
    { level: "info",   label: "Quantum HW depth ≤ 18",                 note: "Within ibm_torino calibration window" },
  ],
  interpretation: {
    headline: "Defensible repurposing signal · escalate to wet-lab confirmation",
    bullets: [
      "Cross-panel reinforcement: genetic prior, mechanism, and clinical readout all converge on APOL1.",
      "Model agreement is high (0.86); disagreement is in the tail, not on this candidate.",
      "Two independent quality flags (RW sparsity, FSGS→ESKD extrapolation) keep this as 'promote to validate', not 'promote to clinic'.",
      "Recommended next action: replicate kernel result on ibm_kyoto, request internal RWE review for hypertensive-ESKD subgroup.",
    ],
  },
  migrationChecklist: [
    { id: "molecule",    label: "3D molecule viewer",         tech: "3Dmol.js · PubChem 3D conformer", status: "done" },
    { id: "kg",          label: "3D Knowledge Graph",         tech: "Three.js · force-directed layout", status: "done" },
    { id: "umap",        label: "3D embedding scatter (demo)", tech: "Three.js · OrbitControls",          status: "done" },
    { id: "circuit",     label: "Quantum kernel circuit",     tech: "D3 · ZZFeatureMap",                 status: "done" },
    { id: "clinical",    label: "Clinical Support Strip",     tech: "4 cards",                            status: "done" },
    { id: "matrix",      label: "Evidence Strength Matrix",   tech: "6 layers × 5 sources",               status: "done" },
    { id: "path",        label: "Path Diagram",                tech: "Compound → Target → Pathway → Disease", status: "done" },
    { id: "agreement",   label: "Model Agreement",             tech: "Classical / Hybrid / Quantum + gauge", status: "done" },
    { id: "provenance",  label: "Provenance Timeline · Quality Flags", tech: "audit + warn/info/ok",       status: "done" },
    { id: "interpret",   label: "Evidence Overlays + Interpretation",   tech: "claims + headline bullets", status: "done" },
  ],
  molecule: {
    name: "Inaxaplin (VX-147)",
    pubchemCid: 145953829,
    formula: "C24H26F3N5O3S",
    style: "stick",
    sdf: `Inaxaplin
  -OEChem-12345

 33 35  0     0  0  0  0  0  0999 V2000
    1.2990    0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.2990   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000   -1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2990   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2990    0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.5981    1.5000    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0
    3.8971    0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    3.8971   -0.7500    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0
    2.5981   -1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    5.1962   -1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    5.1962    1.5000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000   -3.0000    0.0000 S   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2990   -3.7500    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    1.2990   -3.7500    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000   -4.5000    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0
   -2.5981    1.5000    0.0000 F   0  0  0  0  0  0  0  0  0  0  0  0
   -2.5981   -1.5000    0.0000 F   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    3.0000    0.0000 F   0  0  0  0  0  0  0  0  0  0  0  0
    6.4952   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    6.4952    0.7500    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0
    7.7942    1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    7.7942   -1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    9.0933   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    9.0933    0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.2990   -5.2500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2990   -5.2500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.5981   -4.5000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
   -2.5981   -4.5000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
    1.2990   -6.7500    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2990   -6.7500    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
   10.3923   -1.5000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
   10.3923    1.5000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  2  0  0  0  0
  3  4  1  0  0  0  0
  4  5  2  0  0  0  0
  5  6  1  0  0  0  0
  6  1  2  0  0  0  0
  1  7  1  0  0  0  0
  7  8  1  0  0  0  0
  8  9  2  0  0  0  0
  9 10  1  0  0  0  0
 10  2  1  0  0  0  0
  8 12  2  0  0  0  0
  8 11  1  0  0  0  0
  3 13  1  0  0  0  0
 13 14  2  0  0  0  0
 13 15  2  0  0  0  0
 13 16  1  0  0  0  0
 16 26  1  0  0  0  0
 16 27  1  0  0  0  0
  4 18  1  0  0  0  0
  5 17  1  0  0  0  0
  6 19  1  0  0  0  0
 11 20  1  0  0  0  0
 20 21  1  0  0  0  0
 21 22  1  0  0  0  0
 20 23  2  0  0  0  0
 23 24  1  0  0  0  0
 24 25  2  0  0  0  0
 25 21  1  0  0  0  0
 26 28  1  0  0  0  0
 27 29  1  0  0  0  0
 26 30  1  0  0  0  0
 27 31  1  0  0  0  0
 23 32  1  0  0  0  0
 25 33  1  0  0  0  0
M  END
$$$$
`,
  },
  knowledgeGraph: {
    nodes: [
      { id: "compound",  label: "Inaxaplin",   kind: "Compound", color: "#5fa8d3" },
      { id: "apol1",     label: "APOL1",       kind: "Gene",     color: "#d8a75c" },
      { id: "apol2",     label: "APOL2",       kind: "Gene",     color: "#d8a75c" },
      { id: "podxl",     label: "PODXL",       kind: "Gene",     color: "#d8a75c" },
      { id: "myh9",      label: "MYH9",        kind: "Gene",     color: "#d8a75c" },
      { id: "ccr5",      label: "CCR5",        kind: "Gene",     color: "#d8a75c" },
      { id: "cation",    label: "Cation channel", kind: "Pathway", color: "#9bc995" },
      { id: "podocyte",  label: "Podocyte injury", kind: "Pathway", color: "#9bc995" },
      { id: "trypano",   label: "Trypanolysis",   kind: "Pathway", color: "#9bc995" },
      { id: "eskd",      label: "ESKD",        kind: "Disease",  color: "#c98484" },
      { id: "fsgs",      label: "FSGS",        kind: "Disease",  color: "#c98484" },
      { id: "ckd",       label: "CKD",         kind: "Disease",  color: "#c98484" },
    ],
    edges: [
      { source: "compound", target: "apol1",    metaedge: "CbG" },
      { source: "compound", target: "apol2",    metaedge: "CbG" },
      { source: "apol1",    target: "cation",   metaedge: "GpW" },
      { source: "apol1",    target: "podocyte", metaedge: "GpW" },
      { source: "apol1",    target: "trypano",  metaedge: "GpW" },
      { source: "apol2",    target: "trypano",  metaedge: "GpW" },
      { source: "podxl",    target: "podocyte", metaedge: "GpW" },
      { source: "myh9",     target: "podocyte", metaedge: "GpW" },
      { source: "ccr5",     target: "trypano",  metaedge: "GpW" },
      { source: "podocyte", target: "fsgs",     metaedge: "PwD" },
      { source: "podocyte", target: "eskd",     metaedge: "PwD" },
      { source: "fsgs",     target: "eskd",     metaedge: "DrD" },
      { source: "fsgs",     target: "ckd",      metaedge: "DrD" },
      { source: "ckd",      target: "eskd",     metaedge: "DrD" },
      { source: "compound", target: "fsgs",     metaedge: "CtD" },
    ],
  },
  umap: {
    note: "Demo point cloud seeded for layout — not UMAP or learned Hetionet embeddings · candidate highlighted in gold.",
    points: (() => {
      const seed = 42;
      let s = seed;
      const rand = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
      const clusters = [
        { count: 80, cx: -3,  cy: -1, cz:  1, color: "#5fa8d3", label: "Kidney-active drugs" },
        { count: 70, cx:  3,  cy:  2, cz: -1, color: "#9bc995", label: "Cardiometabolic" },
        { count: 60, cx:  0,  cy: -3, cz:  2, color: "#c98484", label: "Immunology" },
        { count: 50, cx:  2,  cy: -2, cz: -2, color: "#b18acb", label: "Oncology" },
      ];
      const points = [];
      for (const cluster of clusters) {
        for (let i = 0; i < cluster.count; i++) {
          points.push({
            x: cluster.cx + (rand() - 0.5) * 1.5,
            y: cluster.cy + (rand() - 0.5) * 1.5,
            z: cluster.cz + (rand() - 0.5) * 1.5,
            color: cluster.color,
            cluster: cluster.label,
            highlight: false,
          });
        }
      }
      points.push({ x: -3.1, y: -1.0, z: 1.05, color: "#d8a75c", cluster: "Inaxaplin · candidate", highlight: true });
      return points;
    })(),
  },
  kernelCircuit: {
    backend: "ibm_torino",
    qubits: 6,
    depth: 3,
    shots: 8192,
    description: "ZZFeatureMap encoding · Hadamard layer + nearest-neighbor ZZ entanglement, repeated by depth.",
  },
};

const STRENGTH_TO_TONE = {
  strong:   { color: "var(--teal)",   bg: "var(--teal-bg)",   label: "Strong" },
  moderate: { color: "var(--gold)",   bg: "rgba(216,167,92,.08)", label: "Moderate" },
  weak:     { color: "var(--amber)",  bg: "var(--amber-bg)",  label: "Weak" },
  absent:   { color: "var(--faint)",  bg: "rgba(0,0,0,.06)",  label: "Absent" },
};

const CELL_TO_TONE = {
  strong: { color: "var(--teal)",   bg: "var(--teal-bg)",  glyph: "●" },
  weak:   { color: "var(--amber)",  bg: "var(--amber-bg)", glyph: "◐" },
  absent: { color: "var(--faint)",  bg: "rgba(0,0,0,.06)", glyph: "○" },
};

const FLAG_TO_TONE = {
  ok:   { color: "var(--green)",  bg: "var(--green-bg)",  label: "OK" },
  warn: { color: "var(--amber)",  bg: "var(--amber-bg)",  label: "WARN" },
  info: { color: "var(--teal)",   bg: "var(--teal-bg)",   label: "INFO" },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderControlBar(data = VISUALIZE_DATA) {
  const inv = data.investigation;
  return `<section class="panel viz-controlbar" data-viz-controlbar>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · CONTROL BAR</div>
        <div class="panel-title">${escapeHtml(inv.compound)} → ${escapeHtml(inv.disease)}</div>
      </div>
      <div class="viz-controlbar-actions">
        <button class="btn" type="button" data-viz-action="sync">↻ Sync</button>
        <button class="btn-primary" type="button" data-viz-action="export">⇩ Export</button>
      </div>
    </div>
    <p class="panel-purpose">Anchored on <strong>${escapeHtml(inv.gene)}</strong> via <strong>${escapeHtml(inv.metaedge)}</strong>. Snapshot ${escapeHtml(inv.runId)} · last sync ${escapeHtml(inv.lastSync)}.</p>
  </section>`;
}

export function renderMetricStrip(data = VISUALIZE_DATA) {
  const cards = data.metricStrip.map((card) => `<div class="metric-card viz-metric">
    <div class="metric-label">${escapeHtml(card.label)}</div>
    <div class="viz-metric-value">${escapeHtml(card.value)}</div>
    <div class="viz-metric-sub">${escapeHtml(card.sub)}</div>
  </div>`).join("");

  return `<section class="grid-4 viz-metric-strip" data-viz-metric-strip>${cards}</section>`;
}

export function renderClinicalStrip(data = VISUALIZE_DATA) {
  const cards = data.clinicalStrip.map((card) => `<div class="panel viz-clinical-card" data-tone="${escapeHtml(card.tone)}">
    <div class="metric-label">${escapeHtml(card.label)}</div>
    <div class="viz-clinical-value">${escapeHtml(card.value)}</div>
    <div class="viz-clinical-detail">${escapeHtml(card.detail)}</div>
  </div>`).join("");

  return `<section class="panel viz-clinical" data-viz-clinical>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · CLINICAL SUPPORT</div>
        <div class="panel-title">Why a clinician would care</div>
      </div>
      <span class="badge">Strip</span>
    </div>
    <div class="grid-4">${cards}</div>
  </section>`;
}

export function renderEvidenceMatrix(data = VISUALIZE_DATA) {
  const matrix = data.evidenceMatrix;
  const head = `<tr><th></th>${matrix.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>`;
  const body = matrix.rows.map((row) => {
    const cells = row.cells.map((cell) => {
      const tone = CELL_TO_TONE[cell] ?? CELL_TO_TONE.absent;
      return `<td class="viz-matrix-cell" data-cell="${escapeHtml(cell)}" style="color:${tone.color};background:${tone.bg}"><span aria-hidden="true">${tone.glyph}</span><span class="viz-sr">${escapeHtml(cell)}</span></td>`;
    }).join("");
    return `<tr><th scope="row">${escapeHtml(row.layer)}</th>${cells}</tr>`;
  }).join("");

  return `<section class="panel viz-matrix" data-viz-matrix>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · EVIDENCE MATRIX</div>
        <div class="panel-title">Six layers × five sources</div>
      </div>
      <span class="badge">Reinforcement</span>
    </div>
    <p class="panel-purpose">A candidate is defensible when reinforcement is dense across rows and columns. Look for an empty row or column — that's where the story is thin.</p>
    <table class="viz-matrix-table"><thead>${head}</thead><tbody>${body}</tbody></table>
  </section>`;
}

export function renderPathDiagram(data = VISUALIZE_DATA) {
  const path = data.pathDiagram;
  const nodeMap = Object.fromEntries(path.nodes.map((node) => [node.id, node]));
  const nodeWidth = 170;
  const nodeHeight = 70;
  const gap = 60;
  const total = path.nodes.length;
  const width = total * nodeWidth + (total - 1) * gap + 40;
  const height = nodeHeight + 80;
  const y = 40;

  const positions = path.nodes.map((node, index) => ({
    node,
    x: 20 + index * (nodeWidth + gap),
  }));

  const edges = path.edges.map((edge) => {
    const fromIndex = positions.findIndex((position) => position.node.id === edge.from);
    const toIndex = positions.findIndex((position) => position.node.id === edge.to);
    if (fromIndex < 0 || toIndex < 0) {
      return "";
    }

    const x1 = positions[fromIndex].x + nodeWidth;
    const x2 = positions[toIndex].x;
    const midX = (x1 + x2) / 2;
    const lineY = y + nodeHeight / 2;
    return `<g class="viz-path-edge">
      <line x1="${x1}" y1="${lineY}" x2="${x2 - 8}" y2="${lineY}" stroke="var(--border)" stroke-width="1.5"/>
      <polygon points="${x2 - 8},${lineY - 4} ${x2 - 8},${lineY + 4} ${x2},${lineY}" fill="var(--border)"/>
      <text x="${midX}" y="${lineY - 8}" text-anchor="middle" font-size="10" fill="var(--teal)" font-weight="700">${escapeHtml(edge.metaedge)}</text>
      <text x="${midX}" y="${lineY + 18}" text-anchor="middle" font-size="10" fill="var(--muted)">${escapeHtml(edge.evidence)}</text>
    </g>`;
  }).join("");

  const nodes = positions.map(({ node, x }) => `<g class="viz-path-node">
    <rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="6" ry="6" fill="var(--paper-alt)" stroke="var(--border)"/>
    <text x="${x + 12}" y="${y + 18}" font-size="9" fill="var(--faint)" letter-spacing="1">${escapeHtml(node.kind.toUpperCase())}</text>
    <text x="${x + 12}" y="${y + 38}" font-size="13" fill="var(--ink)" font-weight="700">${escapeHtml(node.label)}</text>
    <text x="${x + 12}" y="${y + 56}" font-size="10" fill="var(--muted)">${escapeHtml(node.meta)}</text>
  </g>`).join("");

  return `<section class="panel viz-path" data-viz-path>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · PATH DIAGRAM</div>
        <div class="panel-title">Compound → Target → Pathway → Disease</div>
      </div>
      <span class="badge">Mechanism</span>
    </div>
    <div class="viz-path-svg-wrap">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Mechanism path from ${escapeHtml(nodeMap.compound?.label ?? "")} to ${escapeHtml(nodeMap.disease?.label ?? "")}" class="viz-path-svg">
        ${edges}
        ${nodes}
      </svg>
    </div>
  </section>`;
}

export function renderModelAgreement(data = VISUALIZE_DATA) {
  const agreement = data.modelAgreement;
  const bars = agreement.models.map((model) => {
    const pct = Math.round(model.score * 100);
    const ciPct = Math.round(model.ci * 100);
    return `<div class="viz-model-row">
      <div class="viz-model-label">${escapeHtml(model.label)}</div>
      <div class="viz-model-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
        <div class="viz-model-bar" style="width:${pct}%;background:${escapeHtml(model.color)}"></div>
        <div class="viz-model-ci" style="left:${pct - ciPct}%;width:${ciPct * 2}%"></div>
      </div>
      <div class="viz-model-score">${pct}% <span class="viz-model-ci-label">±${ciPct}%</span></div>
    </div>`;
  }).join("");

  const agreementPct = Math.round(agreement.agreement * 100);
  const gaugeR = 48;
  const gaugeC = 2 * Math.PI * gaugeR;
  const gaugeOffset = gaugeC * (1 - agreement.agreement);

  return `<section class="panel viz-agreement" data-viz-agreement>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · MODEL AGREEMENT</div>
        <div class="panel-title">Classical · Hybrid · Quantum HW</div>
      </div>
      <span class="badge">PR-AUC</span>
    </div>
    <div class="viz-agreement-grid">
      <div class="viz-model-bars">${bars}</div>
      <div class="viz-agreement-gauge">
        <svg viewBox="0 0 120 120" role="img" aria-label="Cross-model agreement ${agreementPct} percent">
          <circle cx="60" cy="60" r="${gaugeR}" fill="none" stroke="var(--border-soft)" stroke-width="10"/>
          <circle cx="60" cy="60" r="${gaugeR}" fill="none" stroke="var(--teal)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${gaugeC.toFixed(2)}" stroke-dashoffset="${gaugeOffset.toFixed(2)}" transform="rotate(-90 60 60)"/>
          <text x="60" y="58" text-anchor="middle" font-size="22" font-weight="700" fill="var(--ink)">${agreementPct}%</text>
          <text x="60" y="76" text-anchor="middle" font-size="10" fill="var(--faint)" letter-spacing="1.2">AGREEMENT</text>
        </svg>
        <p class="viz-agreement-note">${escapeHtml(agreement.note)}</p>
      </div>
    </div>
  </section>`;
}

export function renderEvidenceOverlays(data = VISUALIZE_DATA) {
  const items = data.evidenceOverlays.map((overlay) => {
    const tone = STRENGTH_TO_TONE[overlay.strength] ?? STRENGTH_TO_TONE.weak;
    const sources = overlay.sources.map((source) => `<li>${escapeHtml(source)}</li>`).join("");
    return `<article class="viz-overlay" data-overlay-id="${escapeHtml(overlay.id)}">
      <header class="viz-overlay-head">
        <strong>${escapeHtml(overlay.title)}</strong>
        <span class="viz-overlay-strength" style="color:${tone.color};background:${tone.bg}">${escapeHtml(tone.label)}</span>
      </header>
      <p class="viz-overlay-claim">${escapeHtml(overlay.claim)}</p>
      <ul class="viz-overlay-sources">${sources}</ul>
    </article>`;
  }).join("");

  return `<section class="panel viz-overlays" data-viz-overlays>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · EVIDENCE OVERLAYS</div>
        <div class="panel-title">What each panel is asserting</div>
      </div>
      <span class="badge">Claims</span>
    </div>
    <div class="viz-overlays-grid">${items}</div>
  </section>`;
}

export function renderProvenanceTimeline(data = VISUALIZE_DATA) {
  const items = data.provenance.map((event) => `<li class="viz-prov-item">
    <span class="viz-prov-time">${escapeHtml(event.at)}</span>
    <span class="viz-prov-who">${escapeHtml(event.who)}</span>
    <span class="viz-prov-what">${escapeHtml(event.what)}</span>
  </li>`).join("");

  return `<section class="panel viz-provenance" data-viz-provenance>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · PROVENANCE</div>
        <div class="panel-title">How this snapshot was built</div>
      </div>
      <span class="badge">Audit</span>
    </div>
    <ol class="viz-prov-list">${items}</ol>
  </section>`;
}

export function renderQualityFlags(data = VISUALIZE_DATA) {
  const items = data.qualityFlags.map((flag) => {
    const tone = FLAG_TO_TONE[flag.level] ?? FLAG_TO_TONE.info;
    return `<li class="viz-flag">
      <span class="viz-flag-tag" style="color:${tone.color};background:${tone.bg};border-color:${tone.color}">${escapeHtml(tone.label)}</span>
      <div>
        <div class="viz-flag-label">${escapeHtml(flag.label)}</div>
        <div class="viz-flag-note">${escapeHtml(flag.note)}</div>
      </div>
    </li>`;
  }).join("");

  return `<section class="panel viz-flags" data-viz-flags>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · QUALITY FLAGS</div>
        <div class="panel-title">Things that should slow a reviewer down</div>
      </div>
      <span class="badge">Overlay</span>
    </div>
    <ul class="viz-flag-list">${items}</ul>
  </section>`;
}

export function renderInterpretationPanel(data = VISUALIZE_DATA) {
  const bullets = data.interpretation.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("");
  return `<section class="panel viz-interpretation" data-viz-interpretation>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · INTERPRETATION</div>
        <div class="panel-title">${escapeHtml(data.interpretation.headline)}</div>
      </div>
      <span class="pill teal">● defensible</span>
    </div>
    <ul class="viz-interpret-list">${bullets}</ul>
    <div class="panel-footer"><span>interpret_status :: <!-- -->ready_for_validate</span><span><em>cross-panel reinforcement clears the bar</em></span></div>
  </section>`;
}

const STATUS_TO_TONE = {
  done: { color: "var(--green)", bg: "var(--green-bg)", glyph: "✓", label: "Done" },
  wip:  { color: "var(--amber)", bg: "var(--amber-bg)", glyph: "◐", label: "WIP"  },
  todo: { color: "var(--faint)", bg: "rgba(0,0,0,.06)", glyph: "○", label: "TODO" },
};

export function renderMigrationChecklist(data = VISUALIZE_DATA) {
  const items = data.migrationChecklist.map((item) => {
    const tone = STATUS_TO_TONE[item.status] ?? STATUS_TO_TONE.todo;
    return `<li class="viz-mig-item" data-mig-id="${escapeHtml(item.id)}" data-mig-status="${escapeHtml(item.status)}">
      <span class="viz-mig-glyph" style="color:${tone.color};background:${tone.bg};border-color:${tone.color}" aria-hidden="true">${tone.glyph}</span>
      <div>
        <div class="viz-mig-label">${escapeHtml(item.label)}</div>
        <div class="viz-mig-tech">${escapeHtml(item.tech)}</div>
      </div>
      <span class="viz-mig-status" style="color:${tone.color}">${escapeHtml(tone.label)}</span>
    </li>`;
  }).join("");

  const completed = data.migrationChecklist.filter((item) => item.status === "done").length;
  const total = data.migrationChecklist.length;

  return `<section class="panel viz-migration" data-viz-migration>
    <div class="panel-head">
      <div>
        <div class="eyebrow">PAGE STATUS</div>
        <div class="panel-title">Migration checklist · ${completed} / ${total}</div>
      </div>
      <span class="pill teal">● ${completed === total ? "complete" : "in progress"}</span>
    </div>
    <p class="panel-purpose">Every component below is now rendered live on this page. Hover the rows to see which library each one uses.</p>
    <ul class="viz-mig-list">${items}</ul>
  </section>`;
}

export function renderMolecule3D(data = VISUALIZE_DATA) {
  const mol = data.molecule;
  return `<section class="panel viz-mol" data-viz-molecule>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · 3D MOLECULE</div>
        <div class="panel-title">${escapeHtml(mol.name)}</div>
      </div>
      <span class="badge">3Dmol.js</span>
    </div>
    <p class="panel-purpose">Atomic-resolution view of the candidate compound. Drag to rotate · scroll to zoom.</p>
    <div class="viz-mol-stage" data-viz-molecule-stage data-pubchem-cid="${escapeHtml(mol.pubchemCid)}" data-style="${escapeHtml(mol.style)}">
      <div class="viz-mol-fallback">Loading 3Dmol.js…</div>
    </div>
    <div class="panel-footer"><span>formula :: <!-- -->${escapeHtml(mol.formula)}</span><span><em>PubChem CID ${escapeHtml(mol.pubchemCid)}</em></span></div>
  </section>`;
}

export function renderKnowledgeGraph3D(data = VISUALIZE_DATA) {
  const nodeCount = data.knowledgeGraph.nodes.length;
  const edgeCount = data.knowledgeGraph.edges.length;
  return `<section class="panel viz-kg" data-viz-kg>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · 3D KNOWLEDGE GRAPH</div>
        <div class="panel-title">${nodeCount} nodes · ${edgeCount} edges</div>
      </div>
      <span class="badge">Three.js</span>
    </div>
    <p class="panel-purpose">Force-directed neighbourhood around the candidate. Compounds (blue) · Genes (gold) · Pathways (green) · Diseases (red).</p>
    <div class="viz-kg-stage" data-viz-kg-stage>
      <div class="viz-mol-fallback">Loading Three.js…</div>
    </div>
  </section>`;
}

export function renderUmap3D(data = VISUALIZE_DATA) {
  return `<section class="panel viz-umap" data-viz-umap>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · EMBEDDING SCATTER (DEMO)</div>
        <div class="panel-title">Compound embedding projection</div>
      </div>
      <span class="badge">Three.js</span>
    </div>
    <p class="panel-purpose">${escapeHtml(data.umap.note)} OrbitControls · drag to rotate · scroll to zoom.</p>
    <div class="viz-umap-stage" data-viz-umap-stage>
      <div class="viz-mol-fallback">Loading Three.js…</div>
    </div>
  </section>`;
}

export function renderKernelCircuit(data = VISUALIZE_DATA) {
  const k = data.kernelCircuit;
  return `<section class="panel viz-circuit" data-viz-circuit>
    <div class="panel-head">
      <div>
        <div class="eyebrow">VIEW · QUANTUM KERNEL CIRCUIT</div>
        <div class="panel-title">ZZFeatureMap · ${k.qubits} qubits · depth ${k.depth}</div>
      </div>
      <span class="badge">D3</span>
    </div>
    <p class="panel-purpose">${escapeHtml(k.description)} Backend ${escapeHtml(k.backend)} · ${escapeHtml(k.shots)} shots.</p>
    <div class="viz-circuit-stage" data-viz-circuit-stage data-qubits="${escapeHtml(k.qubits)}" data-depth="${escapeHtml(k.depth)}">
      <div class="viz-mol-fallback">Loading D3…</div>
    </div>
  </section>`;
}

export function renderVisualizePanels(data = VISUALIZE_DATA) {
  return `<div data-visualize-panels>
    ${renderMigrationChecklist(data)}
    ${renderControlBar(data)}
    ${renderMetricStrip(data)}
    ${renderClinicalStrip(data)}
    <div class="grid-7-5">
      ${renderMolecule3D(data)}
      ${renderKnowledgeGraph3D(data)}
    </div>
    ${renderEvidenceMatrix(data)}
    <div class="grid-7-5">
      ${renderPathDiagram(data)}
      ${renderModelAgreement(data)}
    </div>
    <div class="grid-7-5">
      ${renderUmap3D(data)}
      ${renderKernelCircuit(data)}
    </div>
    ${renderEvidenceOverlays(data)}
    <div class="grid-7-5">
      ${renderProvenanceTimeline(data)}
      ${renderQualityFlags(data)}
    </div>
    ${renderInterpretationPanel(data)}
  </div>`;
}

function visualizeStyles() {
  return `[data-visualize-panels]{display:flex;flex-direction:column;gap:14px}
.viz-controlbar-actions{display:flex;gap:8px}
.viz-metric-strip{margin-bottom:0}
.viz-metric{padding:14px;border:1px solid var(--border-soft);border-radius:6px;background:rgba(255,255,255,.025)}
.viz-metric-value{font-family:Georgia,serif;font-size:18px;font-weight:600;color:var(--ink);margin-top:6px}
.viz-metric-sub{font-size:11px;color:var(--faint);margin-top:4px;letter-spacing:.04em}
.viz-clinical-card{padding:14px}
.viz-clinical-card[data-tone="teal"]{border-left:3px solid var(--teal)}
.viz-clinical-card[data-tone="gold"]{border-left:3px solid var(--gold)}
.viz-clinical-card[data-tone="amber"]{border-left:3px solid var(--amber)}
.viz-clinical-card[data-tone="green"]{border-left:3px solid var(--green)}
.viz-clinical-value{font-family:Georgia,serif;font-size:15px;font-weight:600;color:var(--ink);margin-top:6px}
.viz-clinical-detail{font-size:12px;color:var(--muted);line-height:1.55;margin-top:6px}
.viz-matrix-table{width:100%;border-collapse:collapse;font-size:12px}
.viz-matrix-table th,.viz-matrix-table td{padding:8px;border-bottom:1px solid var(--border-soft);text-align:left}
.viz-matrix-table th[scope="row"]{font-weight:600;color:var(--ink);width:30%}
.viz-matrix-table thead th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);font-weight:700}
.viz-matrix-cell{text-align:center !important;font-size:14px;width:48px}
.viz-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.viz-path-svg-wrap{overflow-x:auto}
.viz-path-svg{min-width:780px;height:auto}
.viz-agreement-grid{display:grid;grid-template-columns:1.4fr .9fr;gap:18px;align-items:center}
.viz-model-row{display:grid;grid-template-columns:140px 1fr 80px;align-items:center;gap:10px;margin-bottom:10px}
.viz-model-label{font-size:12px;color:var(--muted)}
.viz-model-track{position:relative;height:14px;background:rgba(0,0,0,.08);border-radius:3px;overflow:hidden}
.viz-model-bar{height:100%;border-radius:3px}
.viz-model-ci{position:absolute;top:0;height:100%;background:rgba(255,255,255,.18);border-left:1px dashed var(--border);border-right:1px dashed var(--border);pointer-events:none}
.viz-model-score{font-family:monospace;font-size:12px;color:var(--ink);text-align:right}
.viz-model-ci-label{color:var(--faint)}
.viz-agreement-gauge{display:flex;flex-direction:column;align-items:center;gap:8px}
.viz-agreement-gauge svg{width:140px;height:140px}
.viz-agreement-note{font-size:12px;color:var(--muted);line-height:1.55;text-align:center}
.viz-overlays-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.viz-overlay{padding:12px;border:1px solid var(--border-soft);border-radius:6px;background:rgba(255,255,255,.025)}
.viz-overlay-head{display:flex;justify-content:space-between;gap:10px;align-items:center}
.viz-overlay-strength{padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.06em}
.viz-overlay-claim{margin:8px 0;color:var(--ink);font-size:13px;line-height:1.5}
.viz-overlay-sources{margin:0;padding-left:18px;color:var(--faint);font-size:11px;line-height:1.6}
.viz-prov-list{list-style:none;padding:0;margin:0}
.viz-prov-item{display:grid;grid-template-columns:140px 110px 1fr;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-soft);font-size:12px}
.viz-prov-time{color:var(--faint);font-family:monospace}
.viz-prov-who{color:var(--teal);font-family:monospace;font-size:11px}
.viz-prov-what{color:var(--muted);line-height:1.5}
.viz-flag-list{list-style:none;padding:0;margin:0}
.viz-flag{display:grid;grid-template-columns:60px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-soft);align-items:center}
.viz-flag-tag{border:1px solid;border-radius:3px;padding:3px 0;font-size:10px;font-weight:700;letter-spacing:.08em;text-align:center}
.viz-flag-label{font-size:13px;color:var(--ink);font-weight:600}
.viz-flag-note{font-size:11px;color:var(--muted);margin-top:3px}
.viz-interpret-list{margin:8px 0 14px;padding-left:20px;color:var(--muted);font-size:13px;line-height:1.7}
.viz-interpret-list li{margin-bottom:6px}
.viz-mig-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.viz-mig-item{display:grid;grid-template-columns:32px 1fr 60px;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border-soft);border-radius:5px;background:rgba(255,255,255,.025)}
.viz-mig-glyph{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid;border-radius:50%;font-size:13px;font-weight:700}
.viz-mig-label{font-size:13px;color:var(--ink);font-weight:600}
.viz-mig-tech{font-size:11px;color:var(--faint);margin-top:2px}
.viz-mig-status{font-size:10px;font-weight:700;letter-spacing:.08em;text-align:right;text-transform:uppercase}
.viz-mol-stage,.viz-kg-stage,.viz-umap-stage{position:relative;width:100%;height:340px;border:1px solid var(--border-soft);border-radius:6px;background:rgba(0,0,0,.18);overflow:hidden}
.viz-circuit-stage{position:relative;width:100%;min-height:240px;border:1px solid var(--border-soft);border-radius:6px;background:rgba(255,255,255,.025);padding:12px;overflow-x:auto}
.viz-mol-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--faint);font-size:12px;letter-spacing:.06em;text-transform:uppercase;pointer-events:none}
.viz-mol-fallback.error{color:var(--amber)}
.viz-mol-stage canvas,.viz-kg-stage canvas,.viz-umap-stage canvas{display:block}
.viz-kg-tooltip{position:absolute;pointer-events:none;background:var(--paper-alt);border:1px solid var(--border);border-radius:4px;padding:6px 8px;font-size:11px;color:var(--ink);box-shadow:0 4px 12px rgba(0,0,0,.2);opacity:0;transition:opacity .12s}
.viz-kg-tooltip.show{opacity:1}
.viz-circuit-svg{display:block;width:100%;height:auto}
.viz-circuit-qubit{font-family:monospace;font-size:11px;fill:var(--muted)}
.viz-circuit-gate{stroke:var(--border);stroke-width:1.2}
@media (max-width:900px){.viz-agreement-grid{grid-template-columns:1fr}.viz-overlays-grid{grid-template-columns:1fr}.viz-prov-item,.viz-flag{grid-template-columns:1fr}.viz-mig-list{grid-template-columns:1fr}}`;
}

function injectStyles(documentRef) {
  if (documentRef.getElementById("visualize-panels-styles")) {
    return;
  }
  const style = documentRef.createElement("style");
  style.id = "visualize-panels-styles";
  style.textContent = visualizeStyles();
  documentRef.head.appendChild(style);
}

const SCRIPT_URLS = {
  threeMol:      "https://unpkg.com/3dmol@2.4.0/build/3Dmol-min.js",
  three:         "https://unpkg.com/three@0.160.0/build/three.min.js",
  threeOrbit:    "https://unpkg.com/three@0.160.0/examples/js/controls/OrbitControls.js",
  d3:            "https://unpkg.com/d3@7.8.5/dist/d3.min.js",
};

const scriptLoadPromises = new Map();

function loadScript(url) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no-window"));
  }

  if (scriptLoadPromises.has(url)) {
    return scriptLoadPromises.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    const existing = window.document.querySelector(`script[data-viz-cdn="${url}"]`);
    if (existing && existing.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = window.document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.vizCdn = url;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`failed to load ${url}`)), { once: true });
    window.document.head.appendChild(script);
  });

  scriptLoadPromises.set(url, promise);
  return promise;
}

function setStageError(stage, message) {
  if (!stage) return;
  const fallback = stage.querySelector(".viz-mol-fallback");
  if (fallback) {
    fallback.textContent = message;
    fallback.classList.add("error");
  }
}

function clearFallback(stage) {
  const fallback = stage?.querySelector(".viz-mol-fallback");
  if (fallback) fallback.remove();
}

export async function activateMolecule3D(documentRef = globalThis.document) {
  const stage = documentRef.querySelector("[data-viz-molecule-stage]");
  if (!stage || stage.dataset.activated === "true") return;
  stage.dataset.activated = "true";

  try {
    await loadScript(SCRIPT_URLS.threeMol);
    if (typeof window === "undefined" || !window.$3Dmol) {
      throw new Error("3Dmol global missing");
    }
    clearFallback(stage);
    const viewer = window.$3Dmol.createViewer(stage, { backgroundColor: "#0e0e10" });
    viewer.addModel(VISUALIZE_DATA.molecule.sdf, "sdf");
    viewer.setStyle({}, { stick: { radius: 0.18 }, sphere: { scale: 0.22 } });
    viewer.zoomTo();
    viewer.render();
    viewer.zoom(1.1, 600);
    stage.dataset.engine = "3dmol";
  } catch (error) {
    setStageError(stage, "3D molecule unavailable (CDN blocked?)");
    stage.dataset.activated = "false";
  }
}

export async function activateKnowledgeGraph3D(documentRef = globalThis.document) {
  const stage = documentRef.querySelector("[data-viz-kg-stage]");
  if (!stage || stage.dataset.activated === "true") return;
  stage.dataset.activated = "true";

  try {
    await loadScript(SCRIPT_URLS.three);
    await loadScript(SCRIPT_URLS.threeOrbit);
    if (typeof window === "undefined" || !window.THREE) throw new Error("THREE missing");
    runForceDirectedKG(stage, window.THREE);
  } catch (error) {
    setStageError(stage, "3D KG unavailable (CDN blocked?)");
    stage.dataset.activated = "false";
  }
}

function runForceDirectedKG(stage, THREE) {
  clearFallback(stage);
  const width = stage.clientWidth || 600;
  const height = stage.clientHeight || 340;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0e10);
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
  camera.position.set(0, 0, 18);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(width, height);
  stage.appendChild(renderer.domElement);

  const controls = window.THREE.OrbitControls ? new window.THREE.OrbitControls(camera, renderer.domElement) : null;
  if (controls) {
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }

  const data = VISUALIZE_DATA.knowledgeGraph;
  const positions = new Map();
  const radius = 6;
  data.nodes.forEach((node, index) => {
    const phi = Math.acos(1 - 2 * (index + 0.5) / data.nodes.length);
    const theta = Math.PI * (1 + Math.sqrt(5)) * index;
    positions.set(node.id, {
      x: radius * Math.cos(theta) * Math.sin(phi),
      y: radius * Math.sin(theta) * Math.sin(phi),
      z: radius * Math.cos(phi),
      vx: 0, vy: 0, vz: 0,
    });
  });

  const linkLength = 4;
  const stiffness = 0.04;
  const repulsion = 6;
  const damping = 0.86;
  const iterations = 240;
  for (let step = 0; step < iterations; step++) {
    for (const [idA, a] of positions) {
      for (const [idB, b] of positions) {
        if (idA === idB) continue;
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const d2 = dx * dx + dy * dy + dz * dz + 0.01;
        const force = repulsion / d2;
        a.vx += (dx / Math.sqrt(d2)) * force;
        a.vy += (dy / Math.sqrt(d2)) * force;
        a.vz += (dz / Math.sqrt(d2)) * force;
      }
    }
    for (const edge of data.edges) {
      const a = positions.get(edge.source);
      const b = positions.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      const delta = (dist - linkLength) * stiffness;
      a.vx += dx / dist * delta;
      a.vy += dy / dist * delta;
      a.vz += dz / dist * delta;
      b.vx -= dx / dist * delta;
      b.vy -= dy / dist * delta;
      b.vz -= dz / dist * delta;
    }
    for (const p of positions.values()) {
      p.vx *= damping; p.vy *= damping; p.vz *= damping;
      p.x += p.vx;     p.y += p.vy;     p.z += p.vz;
    }
  }

  const sphereGeom = new THREE.SphereGeometry(0.32, 18, 18);
  for (const node of data.nodes) {
    const pos = positions.get(node.id);
    const mat = new THREE.MeshBasicMaterial({ color: node.color });
    const mesh = new THREE.Mesh(sphereGeom, mat);
    mesh.position.set(pos.x, pos.y, pos.z);
    scene.add(mesh);
  }

  const lineMat = new THREE.LineBasicMaterial({ color: 0x444a52, transparent: true, opacity: 0.8 });
  for (const edge of data.edges) {
    const a = positions.get(edge.source);
    const b = positions.get(edge.target);
    if (!a || !b) continue;
    const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]);
    scene.add(new THREE.Line(geom, lineMat));
  }

  let raf = 0;
  const animate = () => {
    raf = window.requestAnimationFrame(animate);
    if (controls) controls.update();
    else scene.rotation.y += 0.003;
    renderer.render(scene, camera);
  };
  animate();

  const onResize = () => {
    const w = stage.clientWidth || width;
    const h = stage.clientHeight || height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);
  stage.dataset.engine = "three-kg";
}

export async function activateUmap3D(documentRef = globalThis.document) {
  const stage = documentRef.querySelector("[data-viz-umap-stage]");
  if (!stage || stage.dataset.activated === "true") return;
  stage.dataset.activated = "true";

  try {
    await loadScript(SCRIPT_URLS.three);
    await loadScript(SCRIPT_URLS.threeOrbit);
    if (typeof window === "undefined" || !window.THREE) throw new Error("THREE missing");
    runUmap(stage, window.THREE);
  } catch (error) {
    setStageError(stage, "Embedding scatter unavailable (CDN blocked?)");
    stage.dataset.activated = "false";
  }
}

function runUmap(stage, THREE) {
  clearFallback(stage);
  const width = stage.clientWidth || 600;
  const height = stage.clientHeight || 340;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0e10);
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
  camera.position.set(6, 4, 10);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(width, height);
  stage.appendChild(renderer.domElement);

  const controls = window.THREE.OrbitControls ? new window.THREE.OrbitControls(camera, renderer.domElement) : null;
  if (controls) {
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }

  const points = VISUALIZE_DATA.umap.points;
  const geometry = new THREE.BufferGeometry();
  const positionAttr = new Float32Array(points.length * 3);
  const colorAttr = new Float32Array(points.length * 3);
  const sizeAttr = new Float32Array(points.length);
  const tmpColor = new THREE.Color();
  points.forEach((point, index) => {
    positionAttr[index * 3] = point.x;
    positionAttr[index * 3 + 1] = point.y;
    positionAttr[index * 3 + 2] = point.z;
    tmpColor.set(point.color);
    colorAttr[index * 3] = tmpColor.r;
    colorAttr[index * 3 + 1] = tmpColor.g;
    colorAttr[index * 3 + 2] = tmpColor.b;
    sizeAttr[index] = point.highlight ? 18 : 7;
  });
  geometry.setAttribute("position", new THREE.BufferAttribute(positionAttr, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colorAttr, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizeAttr, 1));

  const material = new THREE.PointsMaterial({ size: 0.18, vertexColors: true, sizeAttenuation: true, transparent: true });
  const cloud = new THREE.Points(geometry, material);
  scene.add(cloud);

  const highlight = points.find((point) => point.highlight);
  if (highlight) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.55, 24),
      new THREE.MeshBasicMaterial({ color: 0xd8a75c, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    ring.position.set(highlight.x, highlight.y, highlight.z);
    scene.add(ring);
  }

  const axes = new THREE.AxesHelper(2);
  scene.add(axes);

  let raf = 0;
  const animate = () => {
    raf = window.requestAnimationFrame(animate);
    if (controls) controls.update();
    else cloud.rotation.y += 0.002;
    renderer.render(scene, camera);
  };
  animate();

  const onResize = () => {
    const w = stage.clientWidth || width;
    const h = stage.clientHeight || height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);
  stage.dataset.engine = "three-embedding-demo";
}

export async function activateKernelCircuit(documentRef = globalThis.document) {
  const stage = documentRef.querySelector("[data-viz-circuit-stage]");
  if (!stage || stage.dataset.activated === "true") return;
  stage.dataset.activated = "true";

  try {
    await loadScript(SCRIPT_URLS.d3);
    if (typeof window === "undefined" || !window.d3) throw new Error("d3 missing");
    drawZZFeatureMap(stage, window.d3);
  } catch (error) {
    setStageError(stage, "Kernel circuit unavailable (CDN blocked?)");
    stage.dataset.activated = "false";
  }
}

function drawZZFeatureMap(stage, d3) {
  clearFallback(stage);
  const k = VISUALIZE_DATA.kernelCircuit;
  const qubits = k.qubits;
  const depth = k.depth;
  const margin = { top: 28, right: 24, bottom: 28, left: 70 };
  const colWidth = 70;
  const rowHeight = 36;
  const colCount = depth * 3 + 1;
  const innerWidth = colCount * colWidth;
  const innerHeight = qubits * rowHeight;
  const width = innerWidth + margin.left + margin.right;
  const height = innerHeight + margin.top + margin.bottom;

  while (stage.firstChild) stage.removeChild(stage.firstChild);

  const svg = d3.select(stage).append("svg")
    .attr("class", "viz-circuit-svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", `ZZFeatureMap circuit, ${qubits} qubits depth ${depth}`);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  for (let q = 0; q < qubits; q++) {
    const y = q * rowHeight + rowHeight / 2;
    g.append("line")
      .attr("x1", 0).attr("y1", y).attr("x2", innerWidth).attr("y2", y)
      .attr("stroke", "var(--border)").attr("stroke-width", 1);
    svg.append("text")
      .attr("class", "viz-circuit-qubit")
      .attr("x", margin.left - 10).attr("y", margin.top + y + 4)
      .attr("text-anchor", "end")
      .text(`q${q}`);
  }

  let col = 0;
  const placeGate = (q, label, fill) => {
    const x = col * colWidth;
    const y = q * rowHeight + rowHeight / 2;
    g.append("rect")
      .attr("class", "viz-circuit-gate")
      .attr("x", x + 14).attr("y", y - 12).attr("width", 32).attr("height", 24)
      .attr("rx", 3).attr("fill", fill);
    g.append("text")
      .attr("x", x + 30).attr("y", y + 4)
      .attr("text-anchor", "middle").attr("font-size", 11)
      .attr("fill", "var(--ink)").attr("font-weight", 700)
      .text(label);
  };
  const placeZZ = (q1, q2) => {
    const x = col * colWidth + 30;
    const y1 = q1 * rowHeight + rowHeight / 2;
    const y2 = q2 * rowHeight + rowHeight / 2;
    g.append("line")
      .attr("x1", x).attr("y1", y1).attr("x2", x).attr("y2", y2)
      .attr("stroke", "var(--teal)").attr("stroke-width", 2);
    [y1, y2].forEach((cy) => {
      g.append("circle").attr("cx", x).attr("cy", cy).attr("r", 5).attr("fill", "var(--teal)");
    });
    g.append("text")
      .attr("x", x + 12).attr("y", (y1 + y2) / 2 + 4)
      .attr("font-size", 10).attr("fill", "var(--teal)")
      .text("ZZ");
  };

  for (let layer = 0; layer < depth; layer++) {
    for (let q = 0; q < qubits; q++) placeGate(q, "H", "var(--paper-alt)");
    col++;
    for (let q = 0; q < qubits; q++) placeGate(q, "P(x)", "var(--teal-bg)");
    col++;
    for (let q = 0; q < qubits - 1; q++) {
      placeZZ(q, q + 1);
      col += (q === qubits - 2) ? 0 : 0;
    }
    col++;
  }
  for (let q = 0; q < qubits; q++) placeGate(q, "M", "var(--amber-bg)");

  stage.dataset.engine = "d3-circuit";
}

function activateAllPanels(documentRef = globalThis.document) {
  if (typeof window === "undefined") return;
  activateMolecule3D(documentRef);
  activateKnowledgeGraph3D(documentRef);
  activateUmap3D(documentRef);
  activateKernelCircuit(documentRef);
}

function findMigrationPanel(documentRef) {
  return Array.from(documentRef.querySelectorAll(".panel")).find((panel) => {
    const eyebrow = panel.querySelector(".eyebrow");
    return eyebrow?.textContent?.trim() === "PAGE STATUS";
  });
}

export function mountVisualizePanels(documentRef = globalThis.document) {
  if (!documentRef) {
    return false;
  }

  const main = documentRef.querySelector("main.main");
  if (!main) {
    return false;
  }

  if (main.querySelector("[data-visualize-panels]")) {
    return false;
  }

  injectStyles(documentRef);

  const wrapper = documentRef.createElement("div");
  wrapper.innerHTML = renderVisualizePanels(VISUALIZE_DATA);
  const panels = wrapper.firstElementChild;

  const migrationPanel = findMigrationPanel(documentRef);
  if (migrationPanel) {
    migrationPanel.replaceWith(panels);
  } else {
    const footer = main.querySelector(".footer-actions");
    if (footer) {
      main.insertBefore(panels, footer);
    } else {
      main.appendChild(panels);
    }
  }

  return true;
}

if (typeof window !== "undefined") {
  window.__hetqmlVisualizeBoot = (window.__hetqmlVisualizeBoot ?? 0) + 1;
  console.info("[viz] visualize-panels.js loaded · boot", window.__hetqmlVisualizeBoot);

  const mount = () => {
    const mounted = mountVisualizePanels(window.document);
    if (mounted) {
      console.info("[viz] panels mounted");
    }
    activateAllPanels(window.document);
    return mounted;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  window.addEventListener("load", mount, { once: true });

  for (const delay of [50, 200, 500, 1000, 2000, 4000]) {
    window.setTimeout(mount, delay);
  }

  let observerRetries = 0;
  const startObserver = () => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      if (!window.document.querySelector("[data-visualize-panels]")) {
        if (observerRetries++ < 50) {
          mount();
        } else {
          observer.disconnect();
        }
      }
    });
    observer.observe(window.document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 15000);
  };

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  }
}
