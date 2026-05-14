export type RunModeId = "quick" | "custom";
export type RunFamilyId = "classical" | "hybrid" | "quantum";

export interface RunMode {
  id: RunModeId;
  label: string;
  description: string;
}

export interface RunFamily {
  id: RunFamilyId;
  label: string;
  preset: string;
  summary: string;
  runtime: string;
  algorithms: string;
  /** Default "generalist" recommended algorithm for this family — when no
   * live catalog data is available, the chooser falls back to this name +
   * rationale. The catalog lookup wins when present. */
  defaultGeneralist?: { name: string; rationale: string };
}

export const RUN_PATH_MODES: readonly RunMode[] = [
  {
    id: "quick",
    label: "Quick / Simple",
    description:
      "Use the recommended preset for the selected family with conservative defaults.",
  },
  {
    id: "custom",
    label: "Pick family",
    description:
      "Choose whether this investigation should run classical, hybrid, or quantum.",
  },
];

export const RUN_PATH_FAMILIES: readonly RunFamily[] = [
  {
    id: "classical",
    label: "Classical",
    preset: "Classical",
    summary:
      "Fast CPU baseline with stacking, GBDT, and KGE models. Best for quick sanity checks.",
    runtime: "~50s",
    algorithms: "8 algorithms",
    defaultGeneralist: {
      name: "Stacking",
      rationale:
        "Heterogeneous ensemble — strongest classical baseline across PR-AUC and calibration.",
    },
  },
  {
    id: "hybrid",
    label: "Hybrid",
    preset: "Hybrid QSVC",
    summary:
      "Precomputed quantum kernel (ZZ feature map) + SVC on metapath features, evaluated on the local Aer simulator, with classical baselines for comparison.",
    runtime: "~2m",
    algorithms: "3 hybrid + 8 baselines",
    defaultGeneralist: {
      name: "Quantum Kernel + Metapath",
      rationale:
        "Parameter-efficient quantum kernel over Hetionet metapath features; the default hybrid pick.",
    },
  },
  {
    id: "quantum",
    label: "Quantum",
    preset: "Quantum HW",
    summary:
      "Same quantum-kernel headline trainer as Hybrid; uses IBM Quantum when Settings has token + CRN, otherwise falls back to Aer. Experiment labels SIM rows that are leaderboard scaffolding, not re-trained variational runs.",
    runtime: "~4m",
    algorithms: "2 quantum + 8 baselines",
    defaultGeneralist: {
      name: "QK-SVC (hardware path)",
      rationale:
        "Cross-validated precomputed kernel SVC — backend and shots reflect Aer or IBM from the Settings you provide.",
    },
  },
];

export interface RunPathChoice {
  mode?: RunModeId;
  family?: RunFamilyId;
}

export interface RunPathSelection {
  mode: RunMode;
  family: RunFamily;
  summary: string;
}

function byId<T extends { id: string }>(
  collection: readonly T[],
  id: string | undefined,
  fallbackIndex = 0,
): T {
  const found = collection.find((item) => item.id === id);
  if (found) return found;
  const fallback = collection[fallbackIndex];
  if (!fallback) {
    throw new Error("collection must be non-empty");
  }
  return fallback;
}

export function getRunPathSelection(
  choice: RunPathChoice = {},
): RunPathSelection {
  const mode = byId(RUN_PATH_MODES, choice.mode, 0);
  const family = byId(RUN_PATH_FAMILIES, choice.family, 1);
  return {
    mode,
    family,
    summary:
      mode.id === "quick"
        ? `${family.summary} Quick mode keeps default shots, folds, and guard parity.`
        : `${family.summary} Custom mode lets the family choice be explicit before downstream evidence is read.`,
  };
}
