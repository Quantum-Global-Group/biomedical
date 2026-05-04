export interface CompoundEntry {
  name: string;
  drugbank: string;
  category: string;
}

export const COMPOUNDS: readonly CompoundEntry[] = [
  { name: "Inaxaplin", drugbank: "DB12015", category: "targeted-therapy" },
  { name: "Empagliflozin", drugbank: "DB09038", category: "metabolic" },
  { name: "Deucravacitinib", drugbank: "DB16650", category: "immunology" },
  { name: "Venetoclax", drugbank: "DB11581", category: "oncology" },
  { name: "Decitabine", drugbank: "DB01262", category: "oncology" },
  { name: "Capivasertib", drugbank: "DB17118", category: "oncology" },
  { name: "Metformin", drugbank: "DB00331", category: "metabolic" },
  { name: "Atorvastatin", drugbank: "DB01076", category: "cardiovascular" },
];
