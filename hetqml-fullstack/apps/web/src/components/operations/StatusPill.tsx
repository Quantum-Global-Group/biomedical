"use client";

import type { OpsHealthResponse } from "@/lib/api/client";

interface Props {
  health: OpsHealthResponse;
}

/** Page-hero status pill — green when everything healthy, amber for degraded,
 * sienna when any service is down. The label mirrors the static export
 * ("● 1 service(s) degraded"). */
export function StatusPill({ health }: Props) {
  const downCount = health.services.filter((s) => s.state === "down").length;
  const degradedCount = health.services.filter(
    (s) => s.state === "degraded",
  ).length;

  if (downCount > 0) {
    return (
      <span
        className="pill"
        style={{ background: "var(--sienna-bg)", color: "var(--sienna)" }}
      >
        ● {downCount} service(s) down
      </span>
    );
  }
  if (degradedCount > 0) {
    return (
      <span
        className="pill"
        style={{ background: "var(--amber-bg)", color: "var(--amber)" }}
      >
        ● {degradedCount} service(s) degraded
      </span>
    );
  }
  return (
    <span
      className="pill"
      style={{ background: "var(--green-bg)", color: "var(--green)" }}
    >
      ● all systems operational
    </span>
  );
}
