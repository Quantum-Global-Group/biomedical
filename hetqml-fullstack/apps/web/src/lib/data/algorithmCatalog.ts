export type AlgoPathKind = "classical" | "hybrid" | "quantum";

export interface CatalogRow {
  name: string;
  mech: string;
  path: AlgoPathKind;
  params: string;
  runtime: string;
  status: "live" | "dev" | "fallback";
}

export interface CatalogGroup {
  name: string;
  rows: CatalogRow[];
}

/** Representative subset — static export lists 32 algorithms in 7 groups. */
export const ALGORITHM_CATALOG: readonly CatalogGroup[] = [
  {
    name: "Quantum kernels",
    rows: [
      {
        name: "QSVC (Pauli)",
        mech: "Pauli ZZ feature map → quantum kernel → classical SVM",
        path: "hybrid",
        params: "16p",
        runtime: "~2m",
        status: "live",
      },
      {
        name: "QSVC (Z)",
        mech: "Z feature map → quantum kernel",
        path: "hybrid",
        params: "12p",
        runtime: "~2m",
        status: "dev",
      },
      {
        name: "Fidelity Quantum Kernel",
        mech: "|⟨ψ(x)|ψ(x′)⟩|² with hardware-efficient encoding",
        path: "hybrid",
        params: "18p",
        runtime: "~3m",
        status: "dev",
      },
    ],
  },
  {
    name: "Variational quantum",
    rows: [
      {
        name: "VQC",
        mech: "parameterized circuit + classical optimizer (COBYLA)",
        path: "hybrid",
        params: "24p",
        runtime: "~3m",
        status: "live",
      },
      {
        name: "QAOA",
        mech: "cost + mixer Hamiltonian, depth p=3",
        path: "quantum",
        params: "36p",
        runtime: "~5m",
        status: "live",
      },
      {
        name: "VQE-classifier",
        mech: "VQE-based ground-state distinguishability",
        path: "quantum",
        params: "30p",
        runtime: "~5m",
        status: "live",
      },
    ],
  },
  {
    name: "Classical baselines",
    rows: [
      {
        name: "Stacking",
        mech: "heterogeneous ensemble meta-learner",
        path: "classical",
        params: "12c",
        runtime: "~45s",
        status: "live",
      },
      {
        name: "XGBoost",
        mech: "gradient boosted trees",
        path: "classical",
        params: "np",
        runtime: "~30s",
        status: "live",
      },
    ],
  },
  {
    name: "KG embeddings",
    rows: [
      {
        name: "RotatE",
        mech: "relation rotation in complex space",
        path: "classical",
        params: "512p",
        runtime: "~50s",
        status: "fallback",
      },
    ],
  },
  {
    name: "Graph neural networks",
    rows: [
      {
        name: "R-GCN",
        mech: "relational GCN (one matrix per metaedge)",
        path: "classical",
        params: "16kp",
        runtime: "~150s",
        status: "dev",
      },
    ],
  },
  {
    name: "Hybrid quantum-classical",
    rows: [
      {
        name: "Quantum Kernel + Metapath",
        mech: "metapath features → quantum kernel → SVM",
        path: "hybrid",
        params: "28p",
        runtime: "~3m",
        status: "live",
      },
    ],
  },
  {
    name: "Heuristic / metapath",
    rows: [
      {
        name: "DWPC (Project Rephetio)",
        mech: "Degree-Weighted Path Count over Hetionet metapaths",
        path: "classical",
        params: "np",
        runtime: "~10s",
        status: "live",
      },
    ],
  },
] as const;

export function catalogStats(groups: readonly CatalogGroup[]) {
  let rows = 0;
  for (const g of groups) rows += g.rows.length;
  return { rows, groups: groups.length };
}
