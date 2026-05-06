/**
 * Curated, structured Candidate Context enrichment for the Initialize page.
 *
 * Mirrors the static export at `hetqml-pages/initialize/index.html`: when a
 * compound is selected, the Candidate Context panel renders mechanism /
 * primary target / approval / indications / active trials / repurposing /
 * equity note / source citation. Compounds without a curated entry render
 * the placeholder copy and the panel marks the entry as `derived` rather
 * than `curated`.
 *
 * If the API later grows a `/catalog/compound/<id>` enrichment endpoint, this
 * file becomes the seed-fallback source.
 */

export type ApprovalState =
  | { kind: "approved"; label: string } // green pill
  | { kind: "investigational"; label: string } // amber pill
  | { kind: "experimental"; label: string }; // sienna pill

export interface CompoundContextEntry {
  /** Mechanism-of-action tag rendered next to DrugBank id + category. */
  mechanism: string;
  /** Free-prose description (the "DESCRIPTION" body). */
  description: string;
  /** Primary target gene symbol (rendered as gold pill). */
  primaryTarget: string;
  /** FDA / regulatory phase. Rendered green when approved, amber otherwise. */
  approval: ApprovalState;
  /** Indication labels rendered as pills. */
  indications: readonly string[];
  /** Active clinical trial labels (e.g. "AMPLIFY · NCT05312398"). */
  activeTrials: readonly string[];
  /** Repurposing target string (e.g. "Hypertension-attributed ESKD"). */
  repurposing: string;
  /** Equity / ancestry caveat (rendered in sienna). Empty string = omit block. */
  equityNote: string;
  /** Footer source citations row (e.g. "pubchem · clinicaltrials.gov · …"). */
  sources: string;
  /** "curated" if the entry is hand-written; otherwise the panel will derive
   * a placeholder from the base Hetionet record and tag the footer accordingly. */
  origin: "curated" | "derived";
}

export const COMPOUND_CONTEXT: Readonly<Record<string, CompoundContextEntry>> = {
  Inaxaplin: {
    mechanism: "APOL1 inhibitor",
    description:
      "First-in-class APOL1 inhibitor in Phase III for APOL1-mediated kidney disease. Connects HTN-attributed ESKD, lupus nephritis, and sickle cell nephropathy via the APOL1 G1/G2 risk genotype enriched in African ancestry.",
    primaryTarget: "APOL1",
    approval: { kind: "investigational", label: "Phase III · investigational" },
    indications: ["APOL1-mediated kidney disease (investigational)"],
    activeTrials: ["AMPLIFY · NCT05312398"],
    repurposing: "Hypertension-attributed ESKD",
    equityNote:
      "APOL1 G1/G2 risk allele: ≈22% AA frequency vs ~0% in European-ancestry populations.",
    sources: "pubchem · clinicaltrials.gov · drugbank · literature",
    origin: "curated",
  },
  Empagliflozin: {
    mechanism: "SGLT2 inhibitor",
    description:
      "SGLT2 inhibitor approved for type 2 diabetes, heart failure, and chronic kidney disease. Cardio-renal benefits observed across ancestry groups; trial enrollment skewed toward European-ancestry cohorts.",
    primaryTarget: "SLC5A2",
    approval: { kind: "approved", label: "FDA approved" },
    indications: ["Type 2 diabetes", "Heart failure", "Chronic kidney disease"],
    activeTrials: ["EMPA-KIDNEY · NCT03594110"],
    repurposing: "Hypertension-attributed ESKD",
    equityNote:
      "Pivotal CKD trials underrepresented African-ancestry participants (<10%); subgroup confidence intervals are wide.",
    sources: "pubchem · clinicaltrials.gov · drugbank · fda label",
    origin: "curated",
  },
  Deucravacitinib: {
    mechanism: "TYK2 allosteric inhibitor",
    description:
      "Oral allosteric TYK2 inhibitor approved for plaque psoriasis. Investigational across IBD and lupus nephritis. Reflects gain-of-function TYK2 signaling implicated in autoimmune kidney injury.",
    primaryTarget: "TYK2",
    approval: { kind: "approved", label: "FDA approved (psoriasis)" },
    indications: ["Plaque psoriasis", "Lupus nephritis (investigational)"],
    activeTrials: ["POETYK PsO-3 · NCT04167462"],
    repurposing: "Lupus nephritis",
    equityNote:
      "Lupus nephritis disproportionately affects Black, Hispanic, and Asian populations; trial demographics should be reviewed before subgroup claims.",
    sources: "pubchem · clinicaltrials.gov · drugbank · fda label",
    origin: "curated",
  },
  Venetoclax: {
    mechanism: "BCL2 inhibitor",
    description:
      "Selective BCL2 inhibitor approved for CLL/SLL and AML. Apoptosis-driven; combined with hypomethylators in unfit AML patients. Repurposing interest in MDS and select solid tumors.",
    primaryTarget: "BCL2",
    approval: { kind: "approved", label: "FDA approved" },
    indications: ["CLL / SLL", "AML (combination)"],
    activeTrials: ["VIALE-A · NCT02993523"],
    repurposing: "MDS · Richter transformation",
    equityNote:
      "AML outcomes by ancestry diverge in real-world data; pivotal trial enrollment skews European-ancestry.",
    sources: "pubchem · clinicaltrials.gov · drugbank · fda label",
    origin: "curated",
  },
  Decitabine: {
    mechanism: "DNMT1 hypomethylating agent",
    description:
      "Hypomethylating agent approved for MDS and AML. Often paired with venetoclax in unfit AML. Repurposing interest in solid tumors with epigenetic dysregulation.",
    primaryTarget: "DNMT1",
    approval: { kind: "approved", label: "FDA approved" },
    indications: ["MDS", "AML"],
    activeTrials: ["ASTRAL-1 · NCT03306264"],
    repurposing: "AML (combination)",
    equityNote: "",
    sources: "pubchem · clinicaltrials.gov · drugbank · fda label",
    origin: "curated",
  },
  Capivasertib: {
    mechanism: "AKT inhibitor",
    description:
      "Pan-AKT inhibitor approved with fulvestrant for HR+ HER2- breast cancer with PIK3CA/AKT1/PTEN alterations. Investigational across other PI3K-pathway-driven solid tumors.",
    primaryTarget: "AKT1",
    approval: { kind: "approved", label: "FDA approved" },
    indications: ["HR+ HER2- breast cancer (combo)"],
    activeTrials: ["CAPItello-291 · NCT04305496"],
    repurposing: "Prostate cancer (PI3K-altered)",
    equityNote:
      "Pivotal trial enrolled <5% Black participants; AKT-pathway prevalence by ancestry is under-characterized.",
    sources: "pubchem · clinicaltrials.gov · drugbank · fda label",
    origin: "curated",
  },
  Metformin: {
    mechanism: "AMPK activator (indirect)",
    description:
      "First-line oral biguanide for type 2 diabetes. Decades of post-marketing data; repurposing interest in oncology, longevity, and PCOS. Acts via mitochondrial complex I and downstream AMPK activation.",
    primaryTarget: "PRKAA1",
    approval: { kind: "approved", label: "FDA approved" },
    indications: ["Type 2 diabetes", "PCOS (off-label)"],
    activeTrials: ["TAME · NCT04141696"],
    repurposing: "Oncology adjuvant · longevity",
    equityNote: "",
    sources: "pubchem · clinicaltrials.gov · drugbank · fda label",
    origin: "curated",
  },
  Atorvastatin: {
    mechanism: "HMG-CoA reductase inhibitor",
    description:
      "High-intensity statin for primary and secondary cardiovascular prevention. Lipid-lowering plus pleiotropic anti-inflammatory effects; repurposing interest in inflammatory and autoimmune indications.",
    primaryTarget: "HMGCR",
    approval: { kind: "approved", label: "FDA approved" },
    indications: ["Hyperlipidemia", "Cardiovascular prevention"],
    activeTrials: ["JUPITER follow-on cohorts"],
    repurposing: "Anti-inflammatory adjuvant",
    equityNote: "",
    sources: "pubchem · clinicaltrials.gov · drugbank · fda label",
    origin: "curated",
  },
};

/** Look up a compound's curated context. Returns null when absent. */
export function getCompoundContext(name: string | undefined | null): CompoundContextEntry | null {
  if (!name) return null;
  return COMPOUND_CONTEXT[name] ?? null;
}
