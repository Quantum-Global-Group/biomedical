/**
 * Completed investigation handoff: keep a short ring buffer of job ids so
 * Compare classical / hybrid / quantum does not lose older runs when only
 * hetqml.lastJobId is updated.
 */
export const RECENT_JOBS_KEY = "hetqml.recentJobs";
const MAX_RECENT = 10;

export interface RecentJobEntry {
  id: string;
  createdAt?: string;
  /** run_path.family from wire payload */
  runFamily?: string;
  label?: string;
}

export function pushRecentJob(entry: RecentJobEntry): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadRecentJobs();
    const next = prev.filter((j) => j.id !== entry.id);
    next.unshift(entry);
    const trimmed = next.slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_JOBS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore — non-critical
  }
}

export function loadRecentJobs(): RecentJobEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_JOBS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentJobEntry =>
        typeof x === "object" &&
        x !== null &&
        "id" in x &&
        typeof (x as RecentJobEntry).id === "string",
    );
  } catch {
    return [];
  }
}
