"use client";

import Link from "next/link";
import { loadRecentJobs } from "@/lib/sessions/recentJobs";

interface Props {
  /** Route base without leading slash mismatch */
  route: "experiment" | "validate" | "visualize";
}

/**
 * When there is no jobId in the URL, surface local recent investigation ids
 * so classical / hybrid / quantum runs stay bookmarkable.
 */
export function RecentJobLinks({ route }: Props) {
  const entries =
    typeof window !== "undefined" ? loadRecentJobs() : [];
  if (entries.length === 0) return null;

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <div className="eyebrow">RECENT</div>
          <div className="panel-title">Investigations in this browser</div>
        </div>
      </div>
      <ul
        className="panel-purpose"
        style={{ listStyle: "none", padding: 0, margin: 0 }}
        data-testid="recent-job-links"
      >
        {entries.map((e) => (
          <li key={e.id} style={{ marginBottom: 8 }}>
            <Link
              href={`/${route}?jobId=${encodeURIComponent(e.id)}`}
              className="btn"
              style={{ display: "inline-block" }}
            >
              {e.label ?? e.id.slice(0, 8)}
              {e.runFamily ? (
                <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                  ({e.runFamily})
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
