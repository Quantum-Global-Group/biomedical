/**
 * Adapter helpers that turn live `/catalog/*` API payloads into the UI
 * entry shapes (`CompoundEntry`, `DiseaseEntry`, …) used by the comboboxes
 * and the algorithm catalog. The local seed files in this directory are
 * kept as fallback data: if the API is offline we render the seeds.
 */
import type {
  ApiAlgorithmEntry,
  ApiCompoundEntry,
  ApiDiseaseEntry,
  ApiGeneEntry,
  ApiMetaedgeEntry,
} from "@/lib/api/client";
import { findCompoundEntryByName } from "@/lib/data/compoundLookup";
import { COMPOUNDS, type CompoundEntry } from "./compounds";
import type { DiseaseEntry } from "./diseases";
import type { GeneEntry } from "./genes";
import type { MetaedgeEntry } from "./metaedges";
import type {
  AlgoPathKind,
  CatalogGroup,
  CatalogRow,
} from "./algorithmCatalog";

export function adaptDisease(api: ApiDiseaseEntry): DiseaseEntry {
  return { name: api.name, doid: api.doid, category: api.category };
}

export function adaptCompound(api: ApiCompoundEntry): CompoundEntry {
  let pubchemCid = api.pubchemCid ?? null;
  // If the wire payload omits CID (older API, proxy strip, or partial
  // JSON), fall back to the tiny local seed list so Visualize · 3Dmol
  // keeps working for demo compounds like Inaxaplin / Metformin.
  if (pubchemCid == null) {
    const seed = findCompoundEntryByName(COMPOUNDS, api.name);
    if (seed?.pubchemCid != null) pubchemCid = seed.pubchemCid;
  }
  return {
    name: api.name,
    drugbank: api.drugbankId,
    category: api.therapeuticClass,
    pubchemCid,
  };
}

export function adaptGene(api: ApiGeneEntry): GeneEntry {
  return {
    name: api.symbol,
    ncbi: api.ncbiId.startsWith("NCBIGene:")
      ? api.ncbiId
      : `NCBIGene:${api.ncbiId}`,
    category: api.category,
  };
}

export function adaptMetaedge(api: ApiMetaedgeEntry): MetaedgeEntry {
  // The static UI displays "<code> · <label>" as the option name and the
  // API doesn't carry a directed flag yet, so derive a reasonable default.
  return {
    name: `${api.code} · ${api.label}`,
    description: api.label,
    edges: api.edgeCount,
    directed: false,
  };
}

function pathFromFamily(family: ApiAlgorithmEntry["family"]): AlgoPathKind {
  return family;
}

export function adaptAlgorithmsToGroups(
  items: readonly ApiAlgorithmEntry[],
): CatalogGroup[] {
  const byGroup = new Map<string, CatalogRow[]>();
  for (const it of items) {
    const row: CatalogRow = {
      name: it.name,
      mech: it.mech,
      path: pathFromFamily(it.family),
      params: it.params,
      runtime: it.runtime,
      status: it.status,
    };
    const list = byGroup.get(it.group);
    if (list) list.push(row);
    else byGroup.set(it.group, [row]);
  }
  return Array.from(byGroup.entries()).map(([name, rows]) => ({ name, rows }));
}

/**
 * Picks the "generalist" / recommended algorithm for a family. Rule:
 *   1. Prefer entries whose status is "live".
 *   2. Among those, prefer canonical default group orderings:
 *      - classical → "Classical baselines" → "Heuristic / metapath" → "KG embeddings"
 *      - hybrid    → "Hybrid quantum-classical" → "Quantum kernels" → "Variational quantum"
 *      - quantum   → "Variational quantum"
 *   3. Tiebreak by first-seen.
 *
 * Stable: same input always yields the same recommendation.
 */
export function pickGeneralist(
  family: AlgoPathKind,
  groups: readonly CatalogGroup[],
): CatalogRow | null {
  const groupOrder: Record<AlgoPathKind, string[]> = {
    classical: ["Classical baselines", "Heuristic / metapath", "KG embeddings"],
    hybrid: [
      "Hybrid quantum-classical",
      "Quantum kernels",
      "Variational quantum",
    ],
    quantum: ["Variational quantum"],
  };
  const preferred = groupOrder[family];
  // collect rows in this family across groups
  const inFamily: Array<{ row: CatalogRow; group: string }> = [];
  for (const g of groups) {
    for (const row of g.rows) {
      if (row.path === family) inFamily.push({ row, group: g.name });
    }
  }
  if (inFamily.length === 0) return null;

  // Prefer live, then matched group order, then first-seen.
  const score = (entry: { row: CatalogRow; group: string }): number => {
    const liveBoost = entry.row.status === "live" ? 1000 : 0;
    const groupIdx = preferred.indexOf(entry.group);
    const groupBoost = groupIdx === -1 ? 0 : (preferred.length - groupIdx) * 10;
    return liveBoost + groupBoost;
  };
  let best = inFamily[0]!;
  let bestScore = score(best);
  for (let i = 1; i < inFamily.length; i++) {
    const cand = inFamily[i]!;
    const s = score(cand);
    if (s > bestScore) {
      best = cand;
      bestScore = s;
    }
  }
  return best.row;
}
