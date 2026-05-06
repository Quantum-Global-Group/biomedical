"use client";

/**
 * LiteThemeProvider
 *
 * Drives the `data-lite-theme="light"|"dark"` attribute on <html> for
 * the lite (HF Space) build only. The full app's skin is unchanged.
 * `lite-theme.css` defines two palette blocks under
 * `html[data-lite="true"][data-lite-theme="light"]` and `... [="dark"]`,
 * so this provider just toggles which one is active and persists the
 * choice to localStorage.
 *
 * Mirrors DashboardModeProvider: server renders with the default, the
 * client hydrates with whatever the user previously chose, and a
 * `hydrated` flag is exposed so consumer toggles can disable themselves
 * until the localStorage read completes (avoids a flash of wrong state).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type LiteThemeName = "light" | "dark";
const DEFAULT_THEME: LiteThemeName = "light";
const PERSIST_KEY = "hetqml.liteTheme";

interface LiteThemeContextValue {
  theme: LiteThemeName;
  setTheme: (next: LiteThemeName) => void;
  hydrated: boolean;
}

const LiteThemeContext = createContext<LiteThemeContextValue | null>(null);

function readPersisted(): LiteThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = window.localStorage.getItem(PERSIST_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function LiteThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<LiteThemeName>(DEFAULT_THEME);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persisted = readPersisted();
    if (persisted !== theme) setThemeState(persisted);
    setHydrated(true);
    // Only react on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror to <html data-lite-theme=...> so the CSS selectors light up.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-lite-theme", theme);
  }, [theme]);

  const setTheme = useCallback((next: LiteThemeName) => {
    setThemeState(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(PERSIST_KEY, next);
      } catch {
        /* quota / disabled — ignore */
      }
    }
  }, []);

  return (
    <LiteThemeContext.Provider value={{ theme, setTheme, hydrated }}>
      {children}
    </LiteThemeContext.Provider>
  );
}

export function useLiteTheme(): LiteThemeContextValue {
  const ctx = useContext(LiteThemeContext);
  if (!ctx) {
    throw new Error(
      "useLiteTheme must be used inside <LiteThemeProvider>. " +
        "Wrap the layout (or the relevant subtree) in the provider.",
    );
  }
  return ctx;
}
