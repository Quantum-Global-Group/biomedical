"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global keyboard shortcuts for the dashboard.
 *
 * Mirrors the bindings advertised in
 * `app/settings/SettingsClient.tsx#KeyboardShortcutsPanel`. Hook is mounted
 * once at the layout level so every page inherits it.
 *
 * Page-local shortcuts (K/V/X log a Validate decision; ⌘E exports evidence
 * on Visualize) cannot be wired here because the active pair and job live
 * in page state. Instead we dispatch a `hetqml:shortcut` CustomEvent that
 * the relevant page can subscribe to via `addEventListener` — see
 * `EXPORTABLE_ACTIONS` below for the contract.
 *
 * Ignores keystrokes whose target is an editable surface (input, textarea,
 * contenteditable, select) so the shortcuts never steal a user's typing.
 */

const NAV_KEYS: Record<string, string> = {
  "1": "/initialize",
  "2": "/experiment",
  "3": "/validate",
  "4": "/visualize",
  "5": "/operations",
  "6": "/settings",
};

export type ShortcutAction =
  | "save-session"
  | "resume-session"
  | "focus-compound"
  | "decision-keep"
  | "decision-review"
  | "decision-reject"
  | "export-evidence";

export const SHORTCUT_EVENT = "hetqml:shortcut" as const;

export interface ShortcutEventDetail {
  action: ShortcutAction;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function dispatchShortcut(action: ShortcutAction) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ShortcutEventDetail>(SHORTCUT_EVENT, {
      detail: { action },
    }),
  );
}

export function useKeyboardShortcuts(): void {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (isEditableTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key;

      // Cmd/Ctrl combos -------------------------------------------------
      if (mod && !e.altKey) {
        const lower = key.toLowerCase();
        if (lower === "s") {
          e.preventDefault();
          dispatchShortcut("save-session");
          return;
        }
        if (lower === "r") {
          // Don't hijack hard-reload (Cmd+Shift+R / Ctrl+Shift+R).
          if (e.shiftKey) return;
          e.preventDefault();
          dispatchShortcut("resume-session");
          return;
        }
        if (lower === "e") {
          e.preventDefault();
          dispatchShortcut("export-evidence");
          return;
        }
        return;
      }

      // Plain keys ------------------------------------------------------
      if (e.altKey || e.shiftKey) return;

      const navTarget = NAV_KEYS[key];
      if (navTarget) {
        e.preventDefault();
        router.push(navTarget);
        return;
      }

      if (key === "/") {
        e.preventDefault();
        dispatchShortcut("focus-compound");
        return;
      }

      const lower = key.toLowerCase();
      if (lower === "k") {
        e.preventDefault();
        dispatchShortcut("decision-keep");
        return;
      }
      if (lower === "v") {
        e.preventDefault();
        dispatchShortcut("decision-review");
        return;
      }
      if (lower === "x") {
        e.preventDefault();
        dispatchShortcut("decision-reject");
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}
