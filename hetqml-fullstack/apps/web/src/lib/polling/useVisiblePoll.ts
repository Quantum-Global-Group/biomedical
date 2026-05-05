"use client";

import { useEffect, useRef } from "react";

export interface VisiblePollOptions<T> {
  /** Polling fn. Return value is passed to `isDone`/`isProgress` to decide
   * cadence. May throw — errors do NOT stop the loop, but they do trigger
   * backoff so we don't hammer a sad endpoint. */
  fetcher: () => Promise<T>;
  /** Stop polling when this returns true (terminal state). */
  isDone: (value: T) => boolean;
  /** Reset backoff to baseMs when this returns true (real progress observed).
   * Default: every successful response counts as progress. */
  isProgress?: (prev: T | null, next: T) => boolean;
  /** Floor delay between ticks. */
  baseMs: number;
  /** Ceiling delay; we double on each "no progress" tick up to this value. */
  maxMs?: number;
  /** Treat the loop as paused when document.visibilityState !== "visible". */
  pauseWhenHidden?: boolean;
  /** Re-key to restart the loop. Falsy disables polling entirely. */
  enabled: unknown;
}

/**
 * Polling primitive used by Initialize/Experiment/Operations. Gates work on
 * tab visibility so a backgrounded tab doesn't burn CPU/network, and applies
 * exponential backoff when nothing changes between ticks (so a long-running
 * job doesn't hammer the API at full cadence). Errors keep the loop alive
 * but also trigger backoff.
 */
export function useVisiblePoll<T>({
  fetcher,
  isDone,
  isProgress,
  baseMs,
  maxMs = 15_000,
  pauseWhenHidden = true,
  enabled,
}: VisiblePollOptions<T>) {
  // Refs let the loop see the latest callbacks without resubscribing.
  const fetcherRef = useRef(fetcher);
  const isDoneRef = useRef(isDone);
  const isProgressRef = useRef(isProgress);
  fetcherRef.current = fetcher;
  isDoneRef.current = isDone;
  isProgressRef.current = isProgress;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = baseMs;
    let prev: T | null = null;

    const isVisible = () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible";

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(tick, ms);
    };

    const tick = async () => {
      if (cancelled) return;
      if (pauseWhenHidden && !isVisible()) {
        schedule(baseMs);
        return;
      }
      try {
        const next = await fetcherRef.current();
        if (cancelled) return;
        if (isDoneRef.current(next)) return;
        const progressed = isProgressRef.current
          ? isProgressRef.current(prev, next)
          : true;
        delay = progressed ? baseMs : Math.min(delay * 2, maxMs);
        prev = next;
      } catch {
        delay = Math.min(delay * 2, maxMs);
      }
      schedule(delay);
    };

    const onVisibility = () => {
      if (isVisible() && timer == null) {
        // Wake the loop immediately when the tab returns to foreground.
        delay = baseMs;
        tick();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    schedule(baseMs);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      timer = null;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [enabled, baseMs, maxMs, pauseWhenHidden]);
}
