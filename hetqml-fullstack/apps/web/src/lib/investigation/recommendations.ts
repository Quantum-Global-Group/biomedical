export type FieldName = "disease" | "compound" | "gene" | "metaedge";

export interface Selection {
  disease: string;
  compound: string;
  gene: string;
  metaedge: string;
}

export interface RecommendationProfile {
  disease: string;
  compound: string;
  gene: string;
  metaedge: string;
  confidence: "High" | "Medium" | "Low";
  rationale: string;
  nextStep: string;
}

export const RECOMMENDATION_PROFILES: readonly RecommendationProfile[] = [
  {
    disease: "Hypertension-attributed ESKD",
    compound: "Inaxaplin",
    gene: "APOL1",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "High",
    rationale:
      "APOL1 ancestry-aware kidney signal: compound mechanism, anchor gene, and disease context all point at the same causal axis.",
    nextStep:
      "Use Hybrid (Aer kernel) or Quantum HW (IBM when Settings has token+CRN, else Aer) to compare the quantum-kernel headline against classical baselines.",
  },
  {
    disease: "Systemic lupus erythematosus",
    compound: "Deucravacitinib",
    gene: "TYK2",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "High",
    rationale:
      "TYK2 inhibition matches autoimmune inflammatory signaling and a treatment-oriented compound-to-disease query.",
    nextStep:
      "Keep CtD so the comparison asks whether the compound treats the disease, not just whether it binds the target.",
  },
  {
    disease: "Multiple myeloma",
    compound: "Venetoclax",
    gene: "BCL2",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "High",
    rationale:
      "BCL-2 dependence creates a clear mechanism bridge between the compound and hematologic malignancy context.",
    nextStep:
      "Run Classical first if you want a fast baseline before escalating to hybrid kernels.",
  },
  {
    disease: "Hypertension",
    compound: "Empagliflozin",
    gene: "SLC5A2",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "Medium",
    rationale:
      "SGLT2 kidney-cardiometabolic biology supports a plausible disease link, but the hypertension signal is more indirect.",
    nextStep:
      "Use the detailed metrics page to inspect calibration before trusting probability scores.",
  },
  {
    disease: "Sickle cell disease",
    compound: "Decitabine",
    gene: "DNMT1",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "Medium",
    rationale:
      "Epigenetic fetal-hemoglobin induction gives a biologically plausible bridge but requires stricter evidence posture.",
    nextStep:
      "Keep bias and ancestry guards enabled because population structure can dominate this signal.",
  },
  {
    disease: "Castration-resistant prostate cancer",
    compound: "Capivasertib",
    gene: "AKT1",
    metaedge: "CtD · Compound–treats–Disease",
    confidence: "Medium",
    rationale:
      "AKT pathway targeting is mechanistically coherent, but disease heterogeneity makes the model agreement check important.",
    nextStep:
      "Prefer the Benchmark Suite after running to compare ranking and calibration, not only PR-AUC.",
  },
];

export const FIELD_LABELS: Record<FieldName, string> = {
  disease: "Disease",
  compound: "Compound",
  gene: "Anchor gene",
  metaedge: "Metaedge",
};

export const CASCADE_ORDER: readonly FieldName[] = [
  "disease",
  "compound",
  "gene",
  "metaedge",
];

const FIELD_WEIGHTS: Record<FieldName, number> = {
  disease: 24,
  compound: 28,
  gene: 26,
  metaedge: 22,
};

const ANCHOR_ORDER: readonly FieldName[] = [
  "compound",
  "gene",
  "disease",
  "metaedge",
];

export function emptySelection(): Selection {
  return { disease: "", compound: "", gene: "", metaedge: "" };
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldMatchesFuzzy(selected: string, expected: string): boolean {
  const s = normalize(selected);
  const e = normalize(expected);
  return Boolean(s) && (s === e || s.includes(e) || e.includes(s));
}

function fieldMatchesExact(selected: string, expected: string): boolean {
  const s = normalize(selected);
  const e = normalize(expected);
  return Boolean(s) && s === e;
}

function selectedFields(selection: Selection): FieldName[] {
  return CASCADE_ORDER.filter((field) => normalize(selection[field]));
}

function scoreProfile(
  selection: Selection,
  profile: RecommendationProfile,
): number {
  return (Object.keys(FIELD_WEIGHTS) as FieldName[]).reduce((score, field) => {
    return (
      score +
      (fieldMatchesFuzzy(selection[field], profile[field])
        ? FIELD_WEIGHTS[field]
        : 0)
    );
  }, 0);
}

function recommendationCandidates(
  selection: Selection,
): readonly RecommendationProfile[] {
  for (const field of ANCHOR_ORDER) {
    if (!normalize(selection[field])) continue;
    const anchored = RECOMMENDATION_PROFILES.filter((profile) =>
      fieldMatchesFuzzy(selection[field], profile[field]),
    );
    if (anchored.length > 0) return anchored;
  }
  return RECOMMENDATION_PROFILES;
}

export interface InvestigationEvaluation {
  score: number;
  label: "Strong fit" | "Partial fit" | "Needs review" | "Pick a starting point";
  missing: FieldName[];
  mismatched: FieldName[];
  primaryRecommendation: RecommendationProfile;
  alternatives: (RecommendationProfile & { score: number })[];
  reasons: string[];
}

export function evaluateInvestigation(
  selection: Selection,
): InvestigationEvaluation {
  const selected = selectedFields(selection);
  const candidates = recommendationCandidates(selection);
  const ranked = candidates
    .map((profile) => ({ profile, score: scoreProfile(selection, profile) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) {
    throw new Error("RECOMMENDATION_PROFILES must be non-empty");
  }
  const alternatives = RECOMMENDATION_PROFILES.filter(
    (profile) => profile !== best.profile,
  )
    .map((profile) => ({ profile, score: scoreProfile(selection, profile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ profile, score }) => ({ ...profile, score }));

  const missing = (Object.keys(FIELD_WEIGHTS) as FieldName[]).filter(
    (field) => !normalize(selection[field]),
  );
  const mismatched = (Object.keys(FIELD_WEIGHTS) as FieldName[]).filter(
    (field) =>
      normalize(selection[field]) &&
      !fieldMatchesFuzzy(selection[field], best.profile[field]),
  );
  const score =
    selected.length === 0 ? 0 : Math.round((best.score / 100) * 100);
  const label: InvestigationEvaluation["label"] =
    score >= 90
      ? "Strong fit"
      : score >= 55
        ? "Partial fit"
        : selected.length > 0
          ? "Needs review"
          : "Pick a starting point";

  return {
    score,
    label,
    missing,
    mismatched,
    primaryRecommendation: best.profile,
    alternatives,
    reasons: [
      best.profile.rationale,
      missing.length
        ? `Recommended next fields: ${missing.map((f) => FIELD_LABELS[f]).join(", ")}.`
        : "All four investigation fields are populated.",
      mismatched.length
        ? `Review mismatched fields: ${mismatched.map((f) => FIELD_LABELS[f]).join(", ")}.`
        : best.profile.nextStep,
    ],
  };
}

export function getNextRecommendedField(
  selection: Selection,
): { field: FieldName; label: string; value: string } | null {
  const result = evaluateInvestigation(selection);
  const rec = result.primaryRecommendation;
  const nextField = CASCADE_ORDER.find(
    (field) => !fieldMatchesFuzzy(selection[field], rec[field]),
  );
  if (!nextField) return null;
  return {
    field: nextField,
    label: FIELD_LABELS[nextField],
    value: rec[nextField],
  };
}

/**
 * Returns the set of values that are consistent with the upstream selections
 * (in CASCADE_ORDER). Returns null when there is no upstream constraint —
 * meaning the field is unconstrained and every option is valid.
 */
export function allowedValuesForField(
  field: FieldName,
  selection: Selection,
): Set<string> | null {
  const fieldIndex = CASCADE_ORDER.indexOf(field);
  if (fieldIndex <= 0) return null;
  const upstream = CASCADE_ORDER.slice(0, fieldIndex);
  const setUpstream = upstream.filter((f) => normalize(selection[f]));
  if (setUpstream.length === 0) return null;
  const matching = RECOMMENDATION_PROFILES.filter((profile) =>
    setUpstream.every((f) => fieldMatchesExact(selection[f], profile[f])),
  );
  return new Set(matching.map((profile) => profile[field]));
}

export function isOptionGuided(
  field: FieldName,
  optionName: string,
  selection: Selection,
): boolean {
  const allowed = allowedValuesForField(field, selection);
  if (allowed === null) return true;
  for (const value of allowed) {
    if (fieldMatchesExact(optionName, value)) return true;
  }
  return false;
}

/** Guided mode: disease options are only those that appear in a recommendation profile. */
export function isOptionGuidedInCascade(
  field: FieldName,
  optionName: string,
  selection: Selection,
): boolean {
  if (field === "disease") {
    return RECOMMENDATION_PROFILES.some((p) =>
      fieldMatchesExact(optionName, p.disease),
    );
  }
  return isOptionGuided(field, optionName, selection);
}

/**
 * Sequential flow (disease → compound → gene → metaedge): a field is editable
 * only after every upstream field in CASCADE_ORDER is non-empty.
 */
export function isCascadeFieldUnlocked(
  field: FieldName,
  selection: Selection,
): boolean {
  const idx = CASCADE_ORDER.indexOf(field);
  if (idx <= 0) return true;
  for (let i = 0; i < idx; i++) {
    const f = CASCADE_ORDER[i]!;
    if (!normalize(selection[f])) return false;
  }
  return true;
}
