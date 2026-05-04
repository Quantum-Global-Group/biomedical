export interface MetaedgeEntry {
  name: string;
  description: string;
  edges: number;
  directed: boolean;
}

export const METAEDGES: readonly MetaedgeEntry[] = [
  {
    name: "CtD · Compound–treats–Disease",
    description: "Compound → Disease",
    edges: 755,
    directed: false,
  },
  {
    name: "CbG · Compound–binds–Gene",
    description: "Compound → Gene",
    edges: 11571,
    directed: false,
  },
  {
    name: "DaG · Disease–associates–Gene",
    description: "Disease → Gene",
    edges: 12623,
    directed: false,
  },
  {
    name: "GiG · Gene–interacts–Gene",
    description: "Gene ↔ Gene",
    edges: 147164,
    directed: false,
  },
];
