/**
 * Tiny localStorage handoff so the Initialize page can publish a job ID and
 * the Experiment page can pick it up without prop-drilling or a query param.
 * Falls back gracefully when localStorage is unavailable (SSR, private mode).
 */
export const LAST_JOB_ID_KEY = "hetqml.lastJobId";

export function setLastJobId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_JOB_ID_KEY, id);
  } catch {
    // ignore — non-critical
  }
}

export function getLastJobId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_JOB_ID_KEY);
  } catch {
    return null;
  }
}

export function clearLastJobId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_JOB_ID_KEY);
  } catch {
    // ignore
  }
}
