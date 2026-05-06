"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchIntegrityGuardsCatalog,
  type ApiIntegrityGuardEntry,
  type IntegrityGuardState as ResultGuardState,
} from "@/lib/api/client";
import {
  defaultToggleMap,
  GUARD_CATALOG_FALLBACK,
  GUARD_GROUP_ORDER,
  type GuardCatalogEntry,
} from "./guardCatalog";
import {
  GUARD_STATE_EVENT,
  GUARD_STATE_KEY,
  readGuardState,
  type PersistedGuardState,
} from "./guardState";

export interface IntegrityGuardsState {
  /** Canonical 23-guard catalog. Live from `/catalog/integrity-guards`
   * once it loads, otherwise the fallback list. */
  catalog: readonly GuardCatalogEntry[];
  /** Same catalog grouped + ordered by `GUARD_GROUP_ORDER` for rendering. */
  groups: ReadonlyArray<{ name: string; guards: readonly GuardCatalogEntry[] }>;
  /** Per-guard on/off, sourced from Initialize's persisted store with a
   * `defaultOn` fallback for guards the user has not toggled yet. */
  toggles: Record<string, boolean>;
  /** True once the live catalog has loaded — subscribers can wait on this
   * before treating `catalog` as authoritative if they need the full
   * 23-guard set guaranteed. The fallback list also has 23 guards, so most
   * callers can render immediately. */
  loaded: boolean;
  /** "live" once the API call succeeded, "fallback" while we are using the
   * hardcoded list. */
  source: "live" | "fallback";
  /** Last write timestamp from localStorage, ISO string, or null when no
   * Initialize toggle has happened yet. */
  updatedAt: string | null;
  /** Total count of critical guards currently off — the canonical
   * "guards compromised" number used by Validate's decision payload and
   * Experiment's audit-blocked footer. */
  criticalOffCount: number;
}

/**
 * Shared client hook bridging Initialize → Experiment + Validate.
 *
 * Reading order:
 *  1. **Catalog**: live API on first mount, fallback list (23 guards) until
 *     it resolves.
 *  2. **Toggles**: persisted Initialize state under
 *     {@link GUARD_STATE_KEY} when present, otherwise `defaultOn` per guard.
 *
 * Subscriptions:
 *  - Same-tab updates fire {@link GUARD_STATE_EVENT} (CustomEvent dispatched
 *    by `writeGuardState`) — picked up immediately so an Initialize toggle
 *    repaints the Experiment QC tile without a navigation.
 *  - Cross-tab updates use the standard `storage` event keyed on
 *    {@link GUARD_STATE_KEY}.
 *
 * SSR-safe: returns the fallback catalog with default toggles on the server
 * so the first paint hydrates without flicker.
 */
export function useIntegrityGuards(): IntegrityGuardsState {
  const [catalog, setCatalog] = useState<readonly GuardCatalogEntry[]>(
    GUARD_CATALOG_FALLBACK,
  );
  const [source, setSource] = useState<"live" | "fallback">("fallback");
  const [persisted, setPersisted] = useState<PersistedGuardState | null>(null);
  const [loaded, setLoaded] = useState(false);

  // --- Catalog: live or fallback ----------------------------------------
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const env = await fetchIntegrityGuardsCatalog();
        if (cancelled) return;
        const items = env.items.map(adapt);
        if (items.length > 0) {
          setCatalog(items);
          setSource("live");
        }
      } catch {
        // API offline — fallback list already in state, no-op.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Persisted toggles: hydrate + subscribe ---------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    setPersisted(readGuardState());

    const onChange = () => setPersisted(readGuardState());
    const onStorage = (e: StorageEvent) => {
      if (e.key === GUARD_STATE_KEY) onChange();
    };

    window.addEventListener(GUARD_STATE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(GUARD_STATE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // --- Derived ----------------------------------------------------------
  const toggles = useMemo<Record<string, boolean>>(() => {
    const base = defaultToggleMap(catalog);
    if (!persisted) return base;
    // Persisted toggles win, but we never trust ids that are not in the
    // canonical catalog (handles old localStorage from the 5-guard era).
    for (const id of Object.keys(base)) {
      if (id in persisted.toggles) base[id] = persisted.toggles[id]!;
    }
    return base;
  }, [catalog, persisted]);

  const groups = useMemo(() => {
    const byName = new Map<string, GuardCatalogEntry[]>();
    for (const g of catalog) {
      if (!byName.has(g.group)) byName.set(g.group, []);
      byName.get(g.group)!.push(g);
    }
    const ordered: { name: string; guards: readonly GuardCatalogEntry[] }[] = [];
    for (const name of GUARD_GROUP_ORDER) {
      const guards = byName.get(name);
      if (guards && guards.length > 0) ordered.push({ name, guards });
    }
    // Append any unexpected groups at the end (defensive against API drift).
    for (const [name, guards] of byName) {
      if (!GUARD_GROUP_ORDER.includes(name)) ordered.push({ name, guards });
    }
    return ordered;
  }, [catalog]);

  const criticalOffCount = useMemo(
    () => catalog.filter((g) => g.critical && !toggles[g.id]).length,
    [catalog, toggles],
  );

  return {
    catalog,
    groups,
    toggles,
    loaded,
    source,
    updatedAt: persisted?.updatedAt ?? null,
    criticalOffCount,
  };
}

function adapt(e: ApiIntegrityGuardEntry): GuardCatalogEntry {
  return {
    id: e.id,
    label: e.label,
    description: e.description,
    critical: e.critical,
    defaultOn: e.defaultOn,
    group: e.group,
  };
}

/**
 * Reconcile a `JobResult.integrityGuards` snapshot with the live Initialize
 * toggle state. Returns the same shape (`{id, label, passing, critical}`)
 * Experiment + Validate already consume, so existing components keep
 * working — they just see the user's Initialize toggles overlaid.
 *
 * Algorithm: for every guard in the live catalog,
 *  1. If the JobResult snapshot already has that id, take its `passing`
 *     state (server-truth — the run actually executed with that posture)
 *     **AND** with the user's current toggle (a guard the user just turned
 *     off should reflect as failing in downstream audits).
 *  2. If the JobResult snapshot does not include it, fall back to the
 *     user toggle as the passing state.
 *
 * This is what powers the "Initialize toggle cascades to Experiment QC and
 * Validate trust" behaviour.
 */
export function applyToggleOverlay(
  catalog: readonly GuardCatalogEntry[],
  toggles: Record<string, boolean>,
  resultGuards: readonly ResultGuardState[] | null | undefined,
): ResultGuardState[] {
  const byId = new Map(resultGuards?.map((g) => [g.id, g]) ?? []);
  return catalog.map((c) => {
    const fromResult = byId.get(c.id);
    const userOn = toggles[c.id] ?? c.defaultOn;
    const resultPassing = fromResult?.passing ?? c.defaultOn;
    return {
      id: c.id,
      label: fromResult?.label ?? c.label,
      // A guard "passes" iff the run executed it AND the user has it on.
      // Turning a guard off in Initialize must surface as failing
      // downstream — that is the cascade contract.
      passing: resultPassing && userOn,
      critical: c.critical,
    };
  });
}
