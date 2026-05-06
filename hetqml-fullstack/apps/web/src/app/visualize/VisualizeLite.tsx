/**
 * VisualizeLite — focused static demo of the Visualize page for the
 * Hugging Face Space build.
 *
 * The full Visualize page renders 13 panels driven by a real completed
 * job — 3D knowledge graph (three.js), molecule viewer (three.js),
 * quantum-circuit renderer, UMAP scatter, evidence overlays, etc. The
 * lite build can't ship those (no backend, three.js excluded for size),
 * so this stripped-down view shows three lighter panels with static
 * fixtures so visitors get a feel for the visualisation surface
 * without the WebGL/data-tensor weight.
 *
 * Mirrors the lite Settings + Operations pattern: 3 focused cards.
 *
 * Server component — ships zero JS for the panel content. Fixtures are
 * inlined here so the import map doesn't widen the lite ship.
 */
import type {
  EvidenceMatrix,
  EvidencePath,
  ModelAgreement,
} from "@/lib/api/client";
import { EvidenceMatrixPanel } from "@/components/visualize/EvidenceMatrixPanel";
import { ModelAgreementPanel } from "@/components/visualize/ModelAgreementPanel";
import { MoleculeSvgPanel } from "@/components/visualize/MoleculeSvgPanel";
import { PathDiagramPanel } from "@/components/visualize/PathDiagramPanel";
import { QuantumCircuitSvgPanel } from "@/components/visualize/QuantumCircuitSvgPanel";

// Demo path — Inaxaplin → APOL1 → APOL1-mediated kidney disease, the
// same compound/disease pair the full app's demo mode walks through.
// Step weights are illustrative; in a live job they'd be model-derived.
const DEMO_PATH: EvidencePath = {
  steps: [
    {
      from: "Inaxaplin",
      to: "APOL1",
      metaedge: "CbG",
      weight: 0.91,
      sources: ["DrugBank", "ChEMBL"],
    },
    {
      from: "APOL1",
      to: "Lipid metabolism",
      metaedge: "GpPW",
      weight: 0.74,
      sources: ["Reactome"],
    },
    {
      from: "Lipid metabolism",
      to: "APOL1-mediated kidney disease",
      metaedge: "PWaD",
      weight: 0.78,
      sources: ["DisGeNET", "OpenTargets"],
    },
  ],
  plausibility: 0.81,
  threshold: 0.55,
};

const DEMO_EVIDENCE: EvidenceMatrix = {
  cells: [
    {
      layer: "molecule",
      state: "supports",
      note:
        "Small-molecule inhibitor profile + ADMET in a known-tolerable window.",
    },
    {
      layer: "kg",
      state: "supports",
      note:
        "Two-hop CbG → GpPW → PWaD chain backed by multiple curated sources.",
    },
    {
      layer: "mechanism",
      state: "supports",
      note: "APOL1 → kidney disease pathway implicated in trial readouts.",
    },
    {
      layer: "clinical",
      state: "live",
      note:
        "Phase 2/3 readouts on AMKD endpoints — directional consistency only in the demo.",
    },
    {
      layer: "classical",
      state: "supports",
      note:
        "RandomForest + ExtraTrees baseline both rank the pair in the top decile.",
    },
    {
      layer: "quantum",
      state: "fallback",
      note:
        "Simulator score (no IBM hardware in this lite demo). Headline run reports the QSVC + Stacking PR-AUC.",
    },
  ],
  summary:
    "Five of six layers support the candidate; the quantum layer is showing the simulator fallback in this demo build.",
};

const DEMO_AGREEMENT: ModelAgreement = {
  bars: [
    { family: "classical", score: 0.7838, deltaReference: 0 },
    { family: "hybrid", score: 0.7987, deltaReference: 0.0149 },
    { family: "quantum", score: 0.7216, deltaReference: -0.0622 },
  ],
  spread: 0.0771,
  mean: 0.7680,
  verdict: "PARTIAL_DIVERGENCE",
};

export function VisualizeLite() {
  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">04 · VISUALIZE</div>
          <h1 className="h1">Molecule · Circuit · Path · Evidence</h1>
          <p className="lede">
            Five focused views — a 2D molecular sketch, the Pauli feature-map
            quantum circuit, the compound → gene → disease evidence path, the
            six-layer evidence matrix, and per-family model agreement. All
            rendered as static SVG so the lite build stays small. The full
            version replaces these with interactive 3D / live-job-driven
            counterparts.
          </p>
        </div>
        <span
          className="pill"
          style={{ background: "var(--paper-alt)", color: "var(--gold)" }}
        >
          ● demo
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
        }}
      >
        <MoleculeSvgPanel />
        <QuantumCircuitSvgPanel />
      </div>
      <PathDiagramPanel path={DEMO_PATH} />
      <EvidenceMatrixPanel matrix={DEMO_EVIDENCE} />
      <ModelAgreementPanel agreement={DEMO_AGREEMENT} />
    </>
  );
}
