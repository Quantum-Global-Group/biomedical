/**
 * Offline cache for skeptic notes.
 *
 * Server is the source of truth (PUT /notes/{pair_key}). When a save fails
 * (network error, API offline) we stash the body in localStorage so the
 * editor can retry on next mount or save attempt without losing the user's
 * draft. Successful saves clear the cached entry.
 *
 * Key: `hetqml.skeptic-note:${pairKey}`
 */

const PREFIX = "hetqml.skeptic-note:";

export function noteCacheKey(pairKey: string): string {
  return `${PREFIX}${pairKey}`;
}

export function readCachedNote(pairKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(noteCacheKey(pairKey));
  } catch {
    return null;
  }
}

export function writeCachedNote(pairKey: string, body: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(noteCacheKey(pairKey), body);
  } catch {
    // ignore — non-critical
  }
}

export function clearCachedNote(pairKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(noteCacheKey(pairKey));
  } catch {
    // ignore
  }
}
