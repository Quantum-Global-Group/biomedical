export interface DiseaseEntry {
  name: string;
  doid: string;
  category: string;
}

/**
 * Representative subset for v1. The original `hetqml-pages` static export
 * advertises 137 diseases; only the entries that participate in
 * recommendation profiles or category filtering are seeded here.
 * Extend or load from FastAPI when the real catalog is wired up.
 */
export const DISEASES: readonly DiseaseEntry[] = [
  { name: "Hypertension-attributed ESKD", doid: "DOID:2451", category: "renal" },
  { name: "Hypertension", doid: "DOID:10763", category: "cardiovascular" },
  { name: "Kidney disease", doid: "DOID:557", category: "renal" },
  { name: "Glomerulonephritis", doid: "DOID:3744", category: "renal" },
  { name: "Chronic kidney disease", doid: "DOID:11335", category: "renal" },
  { name: "Systemic lupus erythematosus", doid: "DOID:9074", category: "autoimmune" },
  { name: "Multiple myeloma", doid: "DOID:9538", category: "hematological" },
  { name: "Sickle cell disease", doid: "DOID:8577", category: "hematological" },
  { name: "Castration-resistant prostate cancer", doid: "DOID:10283", category: "oncology" },
  { name: "Type 2 diabetes mellitus", doid: "DOID:9352", category: "metabolic" },
];
