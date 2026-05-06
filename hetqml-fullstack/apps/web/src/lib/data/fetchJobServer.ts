import "server-only";

import type { Job } from "@/lib/api/client";

function serverApiBase(): string {
  return process.env.API_INTERNAL_URL ?? "http://localhost:8000";
}

/**
 * Server-side job fetch with a short revalidate window. Used by the
 * Visualize and Experiment server pages to hydrate the initial state so
 * SSR can render the actual panels rather than a loading skeleton.
 *
 * Returns null on any error (404, network, or parse) — the client will
 * retry as part of its normal polling, and the EmptyState/error branches
 * still kick in on the client side.
 */
export async function fetchJobForServerComponent(
  jobId: string,
): Promise<Job | null> {
  try {
    const res = await fetch(
      `${serverApiBase()}/jobs/${encodeURIComponent(jobId)}`,
      {
        headers: { "content-type": "application/json" },
        // Jobs change while running, so keep the revalidate window short.
        // Tag-based invalidation lets the server bust this on /jobs PUTs
        // if/when those exist.
        next: { revalidate: 5, tags: [`job:${jobId}`] },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as Job;
  } catch {
    return null;
  }
}
