export interface GeneEntry {
  name: string;
  ncbi: string;
  category: string;
}

export const GENES: readonly GeneEntry[] = [
  { name: "APOL1", ncbi: "NCBIGene:8542", category: "kidney" },
  { name: "TYK2", ncbi: "NCBIGene:7297", category: "immune" },
  { name: "BCL2", ncbi: "NCBIGene:596", category: "apoptosis" },
  { name: "SLC5A2", ncbi: "NCBIGene:6524", category: "transporter" },
  { name: "DNMT1", ncbi: "NCBIGene:1786", category: "epigenetic" },
  { name: "AKT1", ncbi: "NCBIGene:207", category: "signaling" },
  { name: "TP53", ncbi: "NCBIGene:7157", category: "tumor-suppressor" },
];
