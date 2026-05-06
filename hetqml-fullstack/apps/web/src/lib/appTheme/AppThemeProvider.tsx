"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type AppThemeName = "light" | "dark";

const DEFAULT_THEME: AppThemeName = "dark";
const PERSIST_KEY = "hetqml.appTheme";

interface AppThemeContextValue {
  theme: AppThemeName;
  setTheme: (next: AppThemeName) => void;
  hydrated: boolean;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function readPersisted(): AppThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = window.localStorage.getItem(PERSIST_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

/** Full-stack app (non-lite): drives `data-app-theme` on `<html>` for CSS variables. */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppThemeName>(DEFAULT_THEME);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persisted = readPersisted();
    if (persisted !== theme) setThemeState(persisted);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-app-theme", theme);
  }, [theme]);

  const setTheme = useCallback((next: AppThemeName) => {
    setThemeState(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(PERSIST_KEY, next);
      } catch {
        /* ignore */
      }
    }
  }, []);

  return (
    <AppThemeContext.Provider value={{ theme, setTheme, hydrated }}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error(
      "useAppTheme must be used inside <AppThemeProvider>.",
    );
  }
  return ctx;
}
