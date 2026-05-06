"use client";

/**
 * LiteThemeToggle
 *
 * Two-button segmented control for the lite skin: light vs dark. Only
 * rendered in lite builds (the full app has its own theme system).
 * Persistence + DOM mirroring is handled by `LiteThemeProvider`.
 */
import { useLiteTheme, type LiteThemeName } from "@/lib/liteTheme/LiteThemeProvider";

const OPTIONS: { id: LiteThemeName; label: string; glyph: string }[] = [
  { id: "light", label: "Light", glyph: "☼" },
  { id: "dark", label: "Dark", glyph: "☾" },
];

export function LiteThemeToggle() {
  const { theme, setTheme, hydrated } = useLiteTheme();

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--paper-alt)",
      }}
      role="group"
      aria-label="Theme"
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
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "5px 10px",
              border: "none",
              borderRadius: 4,
              background: active ? "var(--card)" : "transparent",
              color: active ? "var(--ink)" : "var(--muted)",
              fontSize: 11,
              fontWeight: active ? 600 : 500,
              letterSpacing: "0.04em",
              cursor: hydrated ? "pointer" : "default",
              opacity: hydrated ? 1 : 0.6,
              fontFamily: "var(--font-sans)",
              transition: "background 0.15s, color 0.15s",
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
