/**
 * Canonical 23-guard catalog mirrored from the API
 * (`hetqml_api.catalog.INTEGRITY_GUARDS`). This file is the seed/fallback
 * for `useIntegrityGuards()` — when `/catalog/integrity-guards` is reachable
 * the live envelope replaces this list, but when the API is offline (or
 * during SSR / lite static-export) Initialize, Experiment, and Validate
 * still render the full set in the same six groups.
 *
 * Group names are taken verbatim from the static export
 * (`hetqml-pages/initialize/index.html`).
 */

export type GuardLevel = "critical" | "recommended" | "optional";

export interface GuardCatalogEntry {
  id: string;
  label: string;
  description: string;
  critical: boolean;
  defaultOn: boolean;
  /** Top-level group as rendered on Initialize · Evidence posture. */
  group: string;
}

/**
 * Six Evidence-posture groups, in render order. Mirror of the static export
 * (`hetqml-pages/initialize/index.html`).
 */
export const GUARD_GROUP_ORDER: readonly string[] = [
  "Bias / equity",
  "Data quality",
  "Statistical rigor",
  "Reproducibility",
  "Quantum integrity",
  "Hetionet integrity",
] as const;

/** Map a guard's `critical` + `defaultOn` shape to the three-tier level
 * pill rendered on Evidence posture. Critical guards are always "critical";
 * non-critical guards default-on are "recommended"; default-off are
 * "optional". */
export function levelFor(entry: { critical: boolean; defaultOn: boolean }): GuardLevel {
  if (entry.critical) return "critical";
  if (entry.defaultOn) return "recommended";
  return "optional";
}

export const GUARD_CATALOG_FALLBACK: readonly GuardCatalogEntry[] = [
  // --- Bias / equity (4) -----------------------------------------------
  {
    id: "ancestry-balance",
    label: "Ancestry-balanced negatives",
    description: "Hard negatives sampled per ancestry stratum",
    critical: true,
    defaultOn: true,
    group: "Bias / equity",
  },
  {
    id: "equity-flag",
    label: "Equity caveat surfaced",
    description: "Compound equity caveat shown when present",
    critical: true,
    defaultOn: true,
    group: "Bias / equity",
  },
  {
    id: "hard-negatives",
    label: "Hard negatives included",
    description: "Negatives drawn from co-treated diseases",
    critical: true,
    defaultOn: true,
    group: "Bias / equity",
  },
  {
    id: "negative-ratio",
    label: "Hard-negative ratio",
    description: "≥1:5 hard:positive negatives",
    critical: false,
    defaultOn: true,
    group: "Bias / equity",
  },
  // --- Data quality (4) ------------------------------------------------
  {
    id: "leakage-anchor",
    label: "Anchor-target leakage check",
    description: "Anchor gene held out from training metapaths",
    critical: true,
    defaultOn: true,
    group: "Data quality",
  },
  {
    id: "feature-leakage",
    label: "Feature leakage check",
    description: "No metapath includes the held-out edge",
    critical: true,
    defaultOn: true,
    group: "Data quality",
  },
  {
    id: "time-split",
    label: "Time-split validation",
    description: "Train < cutoff < test by curation date",
    critical: false,
    defaultOn: true,
    group: "Data quality",
  },
  {
    id: "provenance",
    label: "Provenance hashed",
    description: "Inputs SHA-256 hashed and logged",
    critical: false,
    defaultOn: true,
    group: "Data quality",
  },
  // --- Statistical rigor (5) ------------------------------------------
  {
    id: "bootstrap-ci",
    label: "Bootstrap 95% CI",
    description: "N=1000 bootstrap on metric of interest",
    critical: false,
    defaultOn: true,
    group: "Statistical rigor",
  },
  {
    id: "multi-seed",
    label: "Multi-seed stability",
    description: "≥3 seeds per configuration; report std",
    critical: false,
    defaultOn: true,
    group: "Statistical rigor",
  },
  {
    id: "calibration",
    label: "Calibration check",
    description: "Reliability diagram + ECE/MCE",
    critical: true,
    defaultOn: true,
    group: "Statistical rigor",
  },
  {
    id: "dwpc-baseline",
    label: "DWPC baseline parity",
    description: "Top model must beat DWPC by margin",
    critical: true,
    defaultOn: true,
    group: "Statistical rigor",
  },
  {
    id: "random-baseline",
    label: "Random baseline parity",
    description: "Top model must beat random by p<0.05",
    critical: true,
    defaultOn: true,
    group: "Statistical rigor",
  },
  // --- Reproducibility (3) --------------------------------------------
  {
    id: "reviewer-blind",
    label: "Reviewer-blind ranking",
    description: "Top-K ranking computed without label peek",
    critical: true,
    defaultOn: true,
    group: "Reproducibility",
  },
  {
    id: "unit-tests",
    label: "Unit tests green",
    description: "`pytest` and `vitest` green on this branch",
    critical: false,
    defaultOn: true,
    group: "Reproducibility",
  },
  {
    id: "lodo",
    label: "Leave-one-disease-out",
    description: "Each fold withholds one disease entirely",
    critical: false,
    defaultOn: false,
    group: "Reproducibility",
  },
  // --- Quantum integrity (4) ------------------------------------------
  {
    id: "quantum-zne",
    label: "ZNE error mitigation",
    description: "Zero-noise extrapolation on quantum runs",
    critical: false,
    defaultOn: true,
    group: "Quantum integrity",
  },
  {
    id: "readout-mit",
    label: "Readout error mitigation",
    description: "M3 readout-error mitigation",
    critical: false,
    defaultOn: true,
    group: "Quantum integrity",
  },
  {
    id: "shot-budget",
    label: "Shot-budget check",
    description: "Total shots ≤ tier allocation",
    critical: false,
    defaultOn: true,
    group: "Quantum integrity",
  },
  {
    id: "kernel-spread",
    label: "Kernel spread sanity",
    description: "Kernel σ within plausible range",
    critical: false,
    defaultOn: true,
    group: "Quantum integrity",
  },
  // --- Hetionet integrity (3) -----------------------------------------
  {
    id: "degree-correction",
    label: "Degree correction",
    description: "DWPC-style hub penalty applied",
    critical: false,
    defaultOn: true,
    group: "Hetionet integrity",
  },
  {
    id: "path-length-cap",
    label: "Path-length cap",
    description: "Metapaths capped at length 4",
    critical: false,
    defaultOn: true,
    group: "Hetionet integrity",
  },
  {
    id: "loco",
    label: "Leave-one-compound-out",
    description: "Each fold withholds one compound entirely",
    critical: false,
    defaultOn: false,
    group: "Hetionet integrity",
  },
];

/** Default toggle map — derived from `defaultOn`. Used when no Initialize
 * write has happened yet. */
export function defaultToggleMap(
  catalog: readonly GuardCatalogEntry[] = GUARD_CATALOG_FALLBACK,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const g of catalog) out[g.id] = g.defaultOn;
  return out;
}
