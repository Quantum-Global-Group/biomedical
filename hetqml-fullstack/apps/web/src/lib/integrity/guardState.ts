/**
 * Canonical client-side store for Initialize-page integrity guard toggles.
 *
 * The Initialize page is the **source of truth** for guard state — each
 * toggle in `EvidencePosturePanel` writes through to localStorage under
 * the key {@link GUARD_STATE_KEY}. Downstream pages (Experiment QC tiles,
 * Validate trust) read from this same key (see punch-list item #8).
 *
 * The shape is intentionally minimal — `id` keys are the EvidencePosture
 * guard ids, values are the on/off booleans. Extra metadata (level,
 * group) is not persisted; consumers should resolve those from the
 * `/catalog/integrity-guards` envelope or the EvidencePosture catalog
 * if they need them.
 */

export const GUARD_STATE_KEY = "hetqml.initialize.guards.v1";

export interface PersistedGuardState {
  /** Schema version — bump when the on/off semantics change. */
  v: 1;
  /** Wall-clock ISO of last write — for staleness checks downstream. */
  updatedAt: string;
  /** Per-guard on flag, keyed by guard id. */
  toggles: Record<string, boolean>;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Read the persisted snapshot. Returns null when the slot is empty,
 * malformed, or running on the server. */
export function readGuardState(): PersistedGuardState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(GUARD_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedGuardState>;
    if (parsed.v !== 1 || typeof parsed.toggles !== "object" || parsed.toggles === null) {
      return null;
    }
    return {
      v: 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      toggles: parsed.toggles as Record<string, boolean>,
    };
  } catch {
    return null;
  }
}

/** Persist the full toggle map. Silent no-op on server / quota error.
 *
 * Also dispatches a same-tab event so downstream subscribers
 * (`useIntegrityGuards()`) update without waiting for a `storage` event,
 * which only fires across tabs. */
export function writeGuardState(toggles: Record<string, boolean>): void {
  if (!isBrowser()) return;
  const payload: PersistedGuardState = {
    v: 1,
    updatedAt: new Date().toISOString(),
    toggles,
  };
  try {
    window.localStorage.setItem(GUARD_STATE_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage full / disabled — drop silently */
  }
  try {
    window.dispatchEvent(
      new CustomEvent<PersistedGuardState>(GUARD_STATE_EVENT, { detail: payload }),
    );
  } catch {
    /* CustomEvent unsupported — cross-tab `storage` listener still works */
  }
}

/** Custom event name dispatched on every {@link writeGuardState} call so
 * components in the same tab can subscribe without polling. */
export const GUARD_STATE_EVENT = "hetqml:guards:changed";
