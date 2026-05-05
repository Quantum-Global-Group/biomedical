"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAlgorithmsCatalog,
  fetchCompoundsCatalog,
  fetchDiseasesCatalog,
  fetchGenesCatalog,
  fetchMetaedgesCatalog,
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
import type { InitialCatalogs } from "./fetchCatalogsServer";

export interface CatalogsState {
  loaded: boolean;
  /** Per-catalog source: "live" once we got the API payload, "seed" while
   * we have only the local fallback. Useful for telemetry/footers. */
  source: {
    diseases: "seed" | "live";
    compounds: "seed" | "live";
    genes: "seed" | "live";
    metaedges: "seed" | "live";
    algorithms: "seed" | "live";
  };
  /** Live counts as advertised by the API envelope (or seed length). */
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
  /** Set when one or more catalogs failed to load — UI can surface a hint. */
  error: string | null;
}

/**
 * Fetch all four selector catalogs plus the algorithm catalog from the
 * FastAPI service.
 *
 * Two modes:
 *  - **Hydrated** (`initial` provided by a Server Component): we render
 *    with the live data on the very first paint and skip the client fetch
 *    entirely. This is the default path from `/initialize`.
 *  - **Standalone** (no `initial`): renders with the local seed data, then
 *    triggers a five-fan client fetch to upgrade each catalog to live.
 *    Kept for any future client-only entrypoint.
 *
 * Either way, partial failures keep the previous data and surface a hint.
 */
export function useCatalogs(opts?: { initial?: InitialCatalogs }): CatalogsState {
  const initial = opts?.initial;
  const hasInitial = initial != null;

  const [diseases, setDiseases] = useState<readonly DiseaseEntry[]>(
    initial?.diseases ?? DISEASES,
  );
  const [compounds, setCompounds] = useState<readonly CompoundEntry[]>(
    initial?.compounds ?? COMPOUNDS,
  );
  const [genes, setGenes] = useState<readonly GeneEntry[]>(
    initial?.genes ?? GENES,
  );
  const [metaedges, setMetaedges] = useState<readonly MetaedgeEntry[]>(
    initial?.metaedges ?? METAEDGES,
  );
  const [algorithms, setAlgorithms] = useState<readonly CatalogGroup[]>(
    initial?.algorithms ?? ALGORITHM_CATALOG,
  );

  const [counts, setCounts] = useState(
    initial?.counts ?? {
      diseases: DISEASES.length,
      compounds: COMPOUNDS.length,
      genes: GENES.length,
      metaedges: METAEDGES.length,
      algorithms: ALGORITHM_CATALOG.reduce((n, g) => n + g.rows.length, 0),
    },
  );
  const [source, setSource] = useState<CatalogsState["source"]>(
    initial?.source ?? {
      diseases: "seed",
      compounds: "seed",
      genes: "seed",
      metaedges: "seed",
      algorithms: "seed",
    },
  );
  const [loaded, setLoaded] = useState(hasInitial);
  const [error, setError] = useState<string | null>(initial?.error ?? null);

  useEffect(() => {
    // Server already hydrated us — skip the five-fan client fetch.
    if (hasInitial) return;
    let cancelled = false;
    async function load() {
      const errs: string[] = [];
      await Promise.all([
        fetchDiseasesCatalog()
          .then((env) => {
            if (cancelled) return;
            setDiseases(env.items.map(adaptDisease));
            setSource((s) => ({ ...s, diseases: "live" }));
            setCounts((c) => ({ ...c, diseases: env.count }));
          })
          .catch((e: unknown) =>
            errs.push(`diseases: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchCompoundsCatalog()
          .then((env) => {
            if (cancelled) return;
            setCompounds(env.items.map(adaptCompound));
            setSource((s) => ({ ...s, compounds: "live" }));
            setCounts((c) => ({ ...c, compounds: env.count }));
          })
          .catch((e: unknown) =>
            errs.push(`compounds: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchGenesCatalog()
          .then((env) => {
            if (cancelled) return;
            setGenes(env.items.map(adaptGene));
            setSource((s) => ({ ...s, genes: "live" }));
            setCounts((c) => ({ ...c, genes: env.count }));
          })
          .catch((e: unknown) =>
            errs.push(`genes: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchMetaedgesCatalog()
          .then((env) => {
            if (cancelled) return;
            setMetaedges(env.items.map(adaptMetaedge));
            setSource((s) => ({ ...s, metaedges: "live" }));
            setCounts((c) => ({ ...c, metaedges: env.count }));
          })
          .catch((e: unknown) =>
            errs.push(`metaedges: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchAlgorithmsCatalog()
          .then((env) => {
            if (cancelled) return;
            setAlgorithms(adaptAlgorithmsToGroups(env.items));
            setSource((s) => ({ ...s, algorithms: "live" }));
            setCounts((c) => ({ ...c, algorithms: env.count }));
          })
          .catch((e: unknown) =>
            errs.push(`algorithms: ${e instanceof Error ? e.message : String(e)}`),
          ),
      ]);
      if (cancelled) return;
      setLoaded(true);
      setError(errs.length ? errs.join("; ") : null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      loaded,
      source,
      counts,
      diseases,
      compounds,
      genes,
      metaedges,
      algorithms,
      error,
    }),
    [loaded, source, counts, diseases, compounds, genes, metaedges, algorithms, error],
  );
}
