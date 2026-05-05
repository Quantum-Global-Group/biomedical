/** Formatting helpers for the Operations dashboard. */

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  if (m < 60) return s ? `${m}m ${s.toString().padStart(2, "0")}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m - h * 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

export function formatAgo(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  if (seconds < 3600) return `~${Math.floor(seconds / 60)}m`;
  return `~${Math.floor(seconds / 3600)}h`;
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

export function formatPct(ratio: number, digits: number = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Bar-fill colour class for a 0-100 utilization percentage. */
export function utilizationClass(pctOfCap: number): "" | "amber" | "crit" {
  if (pctOfCap > 85) return "crit";
  if (pctOfCap > 65) return "amber";
  return "";
}
