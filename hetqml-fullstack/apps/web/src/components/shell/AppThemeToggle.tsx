"use client";

import { useAppTheme, type AppThemeName } from "@/lib/appTheme/AppThemeProvider";

const OPTIONS: { id: AppThemeName; label: string; glyph: string }[] = [
  { id: "light", label: "Light", glyph: "☼" },
  { id: "dark", label: "Dark", glyph: "☾" },
];

/** Full app only — lite builds use `LiteThemeToggle`. */
export function AppThemeToggle() {
  const { theme, setTheme, hydrated } = useAppTheme();

  return (
    <div
      className="theme-row app-theme-toggle-inner"
      role="group"
      aria-label="Color theme"
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={!hydrated}
            aria-pressed={active}
            onClick={() => setTheme(opt.id)}
            className={`theme-btn${active ? " active" : ""}`}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "5px 10px",
              border: "1px solid var(--border-soft)",
              borderRadius: 4,
              background: active ? "var(--card)" : "transparent",
              color: active ? "var(--ink)" : "var(--muted)",
              fontSize: 11,
              fontWeight: active ? 600 : 500,
              letterSpacing: "0.04em",
              cursor: hydrated ? "pointer" : "default",
              opacity: hydrated ? 1 : 0.6,
              fontFamily: "var(--font-sans), sans-serif",
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
            }}
          >
            <span aria-hidden style={{ fontSize: 12 }}>
              {opt.glyph}
            </span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
