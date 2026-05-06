"use client";

import { useKeyboardShortcuts } from "@/lib/shortcuts/useKeyboardShortcuts";

/**
 * Mount-once client component that activates the global keyboard-shortcut
 * hook. Renders nothing — purely an effect host so the layout stays a
 * server component.
 */
export function KeyboardShortcuts() {
  useKeyboardShortcuts();
  return null;
}
