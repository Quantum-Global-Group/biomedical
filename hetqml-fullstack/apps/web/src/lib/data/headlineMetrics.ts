/**
 * Headline metrics — the project's locked preregistration §"Critical
 * disclosure" PR-AUC values from `preregistration/osf_preregistration_v1.md`
 * (in the sibling `hybrid-qml-kg-poc` repo).
 *
 * These are the numbers headline mode shows. Demo mode keeps the fictional
 * Inaxaplin → ESKD walkthrough with PR-AUC 0.827 (defined elsewhere — see
 * the original `lib/experiment/selectors.ts`).
 *
 * Source: hybrid-qml-kg-poc/preregistration/osf_preregistration_v1.md §"Critical
 * disclosure" / README.md "Experiment Log". Updating these requires a §12
 * preregistration amendment + deviation-log entry in the source repo.
 */

export interface HeadlineModel {
  name: string;
  family: "classical" | "hybrid" | "quantum";
  prAuc: number;
  /** Brief role in the manuscript narrative. */
  role: string;
  /** Reference to the relevant preregistration § anchor. */
  prereg: string;
}

/**
 * The five rows from the README's "Results" table, ordered by PR-AUC desc.
 * The stacking ensemble (Pauli) is the H1b headline; QSVC alone is the
 * H1 methodology claim.
 */
export const HEADLINE_LEADERBOARD: readonly HeadlineModel[] = [
  {
    name: "Stacking ensemble (Pauli)",
    family: "hybrid",
    prAuc: 0.7987,
    role: "Headline (H1b) — preregistered hybrid configuration",
    prereg: "§1.3 H1b · §5.4",
  },
  {
    name: "RandomForest-Optimized",
    family: "classical",
    prAuc: 0.7838,
    role: "Best-tuned classical baseline (GridSearchCV)",
    prereg: "§6.1",
  },
  {
    name: "ExtraTrees-Optimized",
    family: "classical",
    prAuc: 0.7807,
    role: "Tuned classical baseline (GridSearchCV)",
    prereg: "§6.1",
  },
  {
    name: "Stacking ensemble (ZZ)",
    family: "hybrid",
    prAuc: 0.7408,
    role: "Sensitivity vs primary feature map (Pauli)",
    prereg: "§5.2 · §8.6",
  },
  {
    name: "QSVC-Optimized (Pauli)",
    family: "quantum",
    prAuc: 0.7216,
    role: "QSVC alone — H1 methodology claim",
    prereg: "§1.3 H1 · §5.1 · §5.3",
  },
] as const;

export const HEADLINE_CONFIG = {
  /** Knowledge graph snapshot. */
  graph: "Hetionet v1.0 · CtD edges",
  /** Embedding pipeline. */
  embedding: "RotatE 128D · 200 epochs · full-graph",
  /** Pair-feature ops applied before the quantum kernel. */
  pairOps: "concat + diff + Hadamard",
  /** Pre-PCA dimensionality reduction. */
  prePca: 24,
  /** Quantum kernel dimensionality (number of qubits). */
  qmlDim: 16,
  /** Primary feature map. */
  featureMap: "PauliFeatureMap (reps=2)",
  /** QSVC regularization. */
  qsvcC: 0.1,
  /** Negative sampling. */
  negativeSampling: "hard (1:1)",
  /** Bootstrap configuration locked by §8.4. */
  bootstrap: "10,000 resamples · seed 20260504 · 95% CI",
} as const;

/**
 * Decision rule status — H1 / H1b booleans become known only after the
 * headline GPU run on the DGX produces `bootstrap_ci_analysis.md`. Until
 * then, headline mode shows the rule plus a "pending bootstrap CI" banner.
 */
export const HEADLINE_DECISION_STATUS = {
  /**
   * Pre-bootstrap point estimate suggests H1b favored (Stacking 0.7987 >
   * each baseline). The conjunction-across-baselines rule needs the
   * paired-bootstrap CIs to formally support H1b.
   */
  h1: "pending bootstrap CI run",
  h1b: "pending bootstrap CI run",
  h2: "pending hardware experiments (IBM Torino + ZNE)",
  h3: "pending hardware experiments (sub-quadratic scaling)",
} as const;

export const HEADLINE_PR_AUC_HEADLINE = 0.7987;
export const HEADLINE_PR_AUC_QSVC_ALONE = 0.7216;
