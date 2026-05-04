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
  },
  {
    id: "hybrid",
    label: "Hybrid",
    preset: "Hybrid QSVC",
    summary:
      "fast recommended default: quantum kernels plus classical baselines for parameter-efficient comparison.",
    runtime: "~2m",
    algorithms: "3 hybrid + 8 baselines",
  },
  {
    id: "quantum",
    label: "Quantum",
    preset: "Quantum HW",
    summary:
      "Hardware-validated path with QAOA / VQE and classical baselines. Best when reviewer evidence needs backend traces.",
    runtime: "~4m",
    algorithms: "2 quantum + 8 baselines",
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
