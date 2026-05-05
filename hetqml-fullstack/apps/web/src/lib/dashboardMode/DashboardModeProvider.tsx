"use client";

/**
 * DashboardModeProvider
 *
 * React context that exposes the current dashboard narrative mode and a
 * setter. Persists to localStorage via `PERSIST_KEY`. Reads the persisted
 * value on mount (after first paint) so SSR sees the default mode and the
 * client hydrates with whatever the user previously chose.
 *
 * Avoids a flash of incorrect content for the *toggle UI* by exposing
 * `hydrated: false` until the localStorage read completes; consumers that
 * render mode-dependent content can either render the default during the
 * pre-hydration window (acceptable for prose tweaks) or skip rendering
 * until `hydrated` is true (for content that visibly differs).
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { DEFAULT_MODE, type DashboardMode, PERSIST_KEY } from "./types";

interface DashboardModeContextValue {
  mode: DashboardMode;
  setMode: (next: DashboardMode) => void;
  hydrated: boolean;
}

const DashboardModeContext = createContext<DashboardModeContextValue | null>(null);

function readPersisted(): DashboardMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const v = window.localStorage.getItem(PERSIST_KEY);
    if (v === "demo" || v === "headline") return v;
  } catch {
    // localStorage may be disabled (private browsing, etc.); ignore.
  }
  return DEFAULT_MODE;
}

export function DashboardModeProvider({ children }: { children: React.ReactNode }) {
  // Server render with the default; client hydrates with persisted value.
  const [mode, setModeState] = useState<DashboardMode>(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persisted = readPersisted();
    if (persisted !== mode) setModeState(persisted);
    setHydrated(true);
    // Mode is intentionally not in the dep array — we only want to read
    // localStorage on mount, not when mode changes from a toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMode = useCallback((next: DashboardMode) => {
    setModeState(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(PERSIST_KEY, next);
      } catch {
        // ignore quota / disabled localStorage
      }
    }
  }, []);

  return (
    <DashboardModeContext.Provider value={{ mode, setMode, hydrated }}>
      {children}
    </DashboardModeContext.Provider>
  );
}

export function useDashboardMode(): DashboardModeContextValue {
  const ctx = useContext(DashboardModeContext);
  if (!ctx) {
    throw new Error(
      "useDashboardMode must be used inside <DashboardModeProvider>. " +
        "Wrap the layout (or the relevant subtree) in the provider.",
    );
  }
  return ctx;
}
