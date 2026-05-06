import type { CompoundEntry } from "@/lib/data/compounds";

/**
 * Resolve a compound row from catalogs by exact `name`, then case-insensitive
 * trimmed fallback (handles minor casing drift from URL/localStorage/session).
 */
export function findCompoundEntryByName(
  compounds: readonly CompoundEntry[],
  name: string | null | undefined,
): CompoundEntry | null {
  if (name == null) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const hit = compounds.find((c) => c.name === trimmed);
  if (hit) return hit;
  const lower = trimmed.toLowerCase();
  return compounds.find((c) => c.name.trim().toLowerCase() === lower) ?? null;
}
