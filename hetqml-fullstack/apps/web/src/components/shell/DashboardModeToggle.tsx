"use client";

/**
 * DashboardModeToggle — sidebar UI for switching between demo and
 * headline narratives. Replaces the non-functional Appearance theme
 * row in the existing sidebar.
 *
 * Until the DashboardModeProvider hydrates from localStorage, the
 * default mode renders. The toggle disables itself for that brief
 * window so a user click doesn't race the hydration.
 */

import { MODE_DESCRIPTIONS, MODE_LABELS, type DashboardMode } from "@/lib/dashboardMode/types";
import { useDashboardMode } from "@/lib/dashboardMode/DashboardModeProvider";

const MODES: readonly DashboardMode[] = ["demo", "headline"] as const;

export function DashboardModeToggle() {
  const { mode, setMode, hydrated } = useDashboardMode();
  return (
    <>
      <div className="section-label">Dashboard mode</div>
      <div
        className="mode-row"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          padding: "0 12px 6px",
        }}
      >
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              className={`theme-btn${active ? " active" : ""}`}
              onClick={() => setMode(m)}
              disabled={!hydrated}
              title={MODE_DESCRIPTIONS[m]}
              aria-pressed={active}
              style={{ cursor: hydrated ? "pointer" : "default" }}
            >
              {MODE_LABELS[m]}
            </button>
          );
        })}
      </div>
      <div
        style={{
          padding: "0 12px 12px",
          fontSize: 10,
          color: "var(--faint, #857D75)",
          lineHeight: 1.4,
        }}
      >
        {MODE_DESCRIPTIONS[mode]}
      </div>
    </>
  );
}
