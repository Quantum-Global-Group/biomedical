export interface CompoundEntry {
  name: string;
  drugbank: string;
  category: string;
  /** PubChem CID for the Visualize · 3D molecule viewer. Null when no
   * PubChem mapping is curated for this compound — the viewer falls
   * back to an empty state. */
  pubchemCid?: number | null;
}

export const COMPOUNDS: readonly CompoundEntry[] = [
  { name: "Inaxaplin", drugbank: "DB12015", category: "targeted-therapy", pubchemCid: 145953829 },
  { name: "Empagliflozin", drugbank: "DB09038", category: "metabolic", pubchemCid: 11949646 },
  { name: "Deucravacitinib", drugbank: "DB16650", category: "immunology", pubchemCid: 134821691 },
  { name: "Venetoclax", drugbank: "DB11581", category: "oncology", pubchemCid: 49846579 },
  { name: "Decitabine", drugbank: "DB01262", category: "oncology", pubchemCid: 451668 },
  { name: "Capivasertib", drugbank: "DB17118", category: "oncology", pubchemCid: 25227436 },
  { name: "Metformin", drugbank: "DB00331", category: "metabolic", pubchemCid: 4091 },
  { name: "Atorvastatin", drugbank: "DB01076", category: "cardiovascular", pubchemCid: 60823 },
];
