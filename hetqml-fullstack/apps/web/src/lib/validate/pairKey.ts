/**
 * Canonical `pair_key` is `${compoundDrugbankId}::${diseaseDoid}` (per
 * `apps/api/src/hetqml_api/schemas.py` and the persistence tests).
 *
 * The `Job.selection` payload only carries human-readable names, so we
 * resolve those names against the loaded catalogs to recover the IDs. If
 * the catalog isn't available (offline / seed-only), we fall back to the
 * names themselves — both endpoints accept any string and the fallback
 * key still uniquely identifies a pair.
 */

import type { CompoundEntry } from "@/lib/data/compounds";
import type { DiseaseEntry } from "@/lib/data/diseases";
import type { Selection } from "@/lib/investigation/recommendations";

export interface PairKeyCatalogs {
  compounds: readonly CompoundEntry[];
  diseases: readonly DiseaseEntry[];
}

/** Build the `${drugbankId}::${doid}` pair key, falling back to names. */
export function buildPairKey(
  selection: Pick<Selection, "compound" | "disease">,
  catalogs: PairKeyCatalogs,
): string {
  const compoundId = lookupCompoundId(selection.compound, catalogs.compounds);
  const diseaseId = lookupDiseaseId(selection.disease, catalogs.diseases);
  return `${compoundId}::${diseaseId}`;
}

export function lookupCompoundId(
  name: string,
  compounds: readonly CompoundEntry[],
): string {
  const hit = compounds.find((c) => c.name === name);
  return hit?.drugbank ?? name;
}

export function lookupDiseaseId(
  name: string,
  diseases: readonly DiseaseEntry[],
): string {
  const hit = diseases.find((d) => d.name === name);
  return hit?.doid ?? name;
}
