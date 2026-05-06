import "server-only";

import {
  type AlgorithmCatalogResponse,
  type CompoundCatalogResponse,
  type DiseaseCatalogResponse,
  type GeneCatalogResponse,
  type MetaedgeCatalogResponse,
} from "@/lib/api/client";
import { ALGORITHM_CATALOG, type CatalogGroup } from "./algorithmCatalog";
import { COMPOUNDS, type CompoundEntry } from "./compounds";
import { DISEASES, type DiseaseEntry } from "./diseases";
import { GENES, type GeneEntry } from "./genes";
import { METAEDGES, type MetaedgeEntry } from "./metaedges";
import {
  adaptAlgorithmsToGroups,
  adaptCompound,
  adaptDisease,
  adaptGene,
  adaptMetaedge,
} from "./catalogAdapter";

export type CatalogSource = "seed" | "live";

export interface InitialCatalogs {
  source: {
    diseases: CatalogSource;
    compounds: CatalogSource;
    genes: CatalogSource;
    metaedges: CatalogSource;
    algorithms: CatalogSource;
  };
  counts: {
    diseases: number;
    compounds: number;
    genes: number;
    metaedges: number;
    algorithms: number;
  };
  diseases: readonly DiseaseEntry[];
  compounds: readonly CompoundEntry[];
  genes: readonly GeneEntry[];
  metaedges: readonly MetaedgeEntry[];
  algorithms: readonly CatalogGroup[];
  error: string | null;
}

const REVALIDATE_SECONDS = 60;
/** Per-feed ceiling so a dead/slow API cannot wedge `/initialize` RSC indefinitely. */
const CATALOG_FETCH_TIMEOUT_MS = 12_000;

function serverApiBase(): string {
  return process.env.API_INTERNAL_URL ?? "http://localhost:8000";
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${serverApiBase()}${path}`, {
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(CATALOG_FETCH_TIMEOUT_MS),
    next: { revalidate: REVALIDATE_SECONDS, tags: ["catalogs", `catalog:${path}`] },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

const SEED: InitialCatalogs = {
  source: {
    diseases: "seed",
    compounds: "seed",
    genes: "seed",
    metaedges: "seed",
    algorithms: "seed",
  },
  counts: {
    diseases: DISEASES.length,
    compounds: COMPOUNDS.length,
    genes: GENES.length,
    metaedges: METAEDGES.length,
    algorithms: ALGORITHM_CATALOG.reduce((n, g) => n + g.rows.length, 0),
  },
  diseases: DISEASES,
  compounds: COMPOUNDS,
  genes: GENES,
  metaedges: METAEDGES,
  algorithms: ALGORITHM_CATALOG,
  error: null,
};

/**
 * Fetch all five investigation catalogs on the server with a 60s revalidate
 * window. Each feed is independent: a partial failure keeps the seed entries
 * for that catalog and surfaces a hint via `error`. Pair with
 * `useCatalogs({ initial })` so the client tree never has to spin a 5-fan
 * fetch on mount.
 */
export async function fetchCatalogsForServerComponent(): Promise<InitialCatalogs> {
  const errs: string[] = [];

  const settle = <T,>(p: Promise<T>, label: string): Promise<T | null> =>
    p.catch((e: unknown) => {
      errs.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    });

  const [diseasesEnv, compoundsEnv, genesEnv, metaedgesEnv, algosEnv] =
    await Promise.all([
      settle(getJson<DiseaseCatalogResponse>("/catalog/diseases"), "diseases"),
      settle(
        getJson<CompoundCatalogResponse>("/catalog/compounds"),
        "compounds",
      ),
      settle(getJson<GeneCatalogResponse>("/catalog/genes"), "genes"),
      settle(
        getJson<MetaedgeCatalogResponse>("/catalog/metaedges"),
        "metaedges",
      ),
      settle(
        getJson<AlgorithmCatalogResponse>("/catalog/algorithms"),
        "algorithms",
      ),
    ]);

  return {
    source: {
      diseases: diseasesEnv ? "live" : "seed",
      compounds: compoundsEnv ? "live" : "seed",
      genes: genesEnv ? "live" : "seed",
      metaedges: metaedgesEnv ? "live" : "seed",
      algorithms: algosEnv ? "live" : "seed",
    },
    counts: {
      diseases: diseasesEnv?.count ?? SEED.counts.diseases,
      compounds: compoundsEnv?.count ?? SEED.counts.compounds,
      genes: genesEnv?.count ?? SEED.counts.genes,
      metaedges: metaedgesEnv?.count ?? SEED.counts.metaedges,
      algorithms: algosEnv?.count ?? SEED.counts.algorithms,
    },
    diseases: diseasesEnv ? diseasesEnv.items.map(adaptDisease) : DISEASES,
    compounds: compoundsEnv ? compoundsEnv.items.map(adaptCompound) : COMPOUNDS,
    genes: genesEnv ? genesEnv.items.map(adaptGene) : GENES,
    metaedges: metaedgesEnv
      ? metaedgesEnv.items.map(adaptMetaedge)
      : METAEDGES,
    algorithms: algosEnv
      ? adaptAlgorithmsToGroups(algosEnv.items)
      : ALGORITHM_CATALOG,
    error: errs.length ? errs.join("; ") : null,
  };
}
