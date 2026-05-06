"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchIbmWorkload,
  fetchOpsAlerts,
  fetchOpsBackends,
  fetchOpsCost,
  fetchOpsHealth,
  fetchOpsJobs,
  fetchOpsResources,
  fetchOpsSources,
  type IbmWorkloadResponse,
  type OpsAlertsResponse,
  type OpsBackendsResponse,
  type OpsCostResponse,
  type OpsHealthResponse,
  type OpsJobsResponse,
  type OpsResourcesResponse,
  type OpsSourcesResponse,
} from "@/lib/api/client";
import {
  SEED_ALERTS,
  SEED_BACKENDS,
  SEED_COST,
  SEED_HEALTH,
  SEED_HEALTH_LITE,
  SEED_IBM,
  SEED_IBM_LITE,
  SEED_JOBS,
  SEED_RESOURCES,
  SEED_SOURCES,
} from "./seed";
import { isLiteMode } from "@/lib/liteMode";

const POLL_INTERVAL_MS = 5_000;
// Build-time-folded so the lite branch DCEs the polling effect entirely.
const IS_LITE = isLiteMode();

type OpsSource = "seed" | "live";

export interface OpsState {
  loaded: boolean;
  source: {
    health: OpsSource;
    ibm: OpsSource;
    backends: OpsSource;
    jobs: OpsSource;
    resources: OpsSource;
    cost: OpsSource;
    sources: OpsSource;
    alerts: OpsSource;
  };
  health: OpsHealthResponse;
  ibm: IbmWorkloadResponse;
  backends: OpsBackendsResponse;
  jobs: OpsJobsResponse;
  resources: OpsResourcesResponse;
  cost: OpsCostResponse;
  sources: OpsSourcesResponse;
  alerts: OpsAlertsResponse;
  /** Set when at least one feed failed on the latest poll. */
  error: string | null;
  /** Timestamp of the most recent successful refresh (any feed). */
  lastUpdated: Date | null;
  /** True during a manual or tab-visibility-triggered bulk refetch (full build only). */
  refreshing: boolean;
  /** Re-fetch all `/ops/*` feeds now (queues, ETAs, health, etc.). No-op in lite mode. */
  refresh: () => Promise<void>;
}

/**
 * Polls the eight `/ops/*` endpoints in parallel every ~5s.
 *
 * Pattern mirrors `useCatalogs()` — initial render uses the seed fallback,
 * the first round-trip swaps each panel to live data, and subsequent
 * intervals refresh each panel independently. Per-feed `source` flags lets
 * the UI surface a "live" vs "fallback" hint.
 */
export function useOps(intervalMs: number = POLL_INTERVAL_MS): OpsState {
  const [health, setHealth] = useState<OpsHealthResponse>(
    IS_LITE ? SEED_HEALTH_LITE : SEED_HEALTH,
  );
  const [ibm, setIbm] = useState<IbmWorkloadResponse>(
    IS_LITE ? SEED_IBM_LITE : SEED_IBM,
  );
  const [backends, setBackends] = useState<OpsBackendsResponse>(SEED_BACKENDS);
  const [jobs, setJobs] = useState<OpsJobsResponse>(SEED_JOBS);
  const [resources, setResources] =
    useState<OpsResourcesResponse>(SEED_RESOURCES);
  const [cost, setCost] = useState<OpsCostResponse>(SEED_COST);
  const [sources, setSources] = useState<OpsSourcesResponse>(SEED_SOURCES);
  const [alerts, setAlerts] = useState<OpsAlertsResponse>(SEED_ALERTS);

  const [source, setSourceState] = useState<OpsState["source"]>({
    health: "seed",
    ibm: "seed",
    backends: "seed",
    jobs: "seed",
    resources: "seed",
    cost: "seed",
    sources: "seed",
    alerts: "seed",
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cancelled = useRef(false);
  const tickRef = useRef<(() => Promise<void>) | null>(null);

  const refresh = useCallback(async () => {
    if (IS_LITE) return;
    const fn = tickRef.current;
    if (!fn) return;
    setRefreshing(true);
    try {
      await fn();
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Lite (HF Space) build — no backend to poll. Mark loaded so the
  // page shows the seed fixtures as the canonical view; the per-feed
  // `source` flags stay "seed" so the panel footers read "demo data"
  // and the page banner can branch on isLiteMode().
  useEffect(() => {
    if (!IS_LITE) return;
    setLoaded(true);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (IS_LITE) return;
    cancelled.current = false;

    const tick = async () => {
      const errs: string[] = [];
      let anyOk = false;

      await Promise.all([
        fetchOpsHealth()
          .then((r) => {
            if (cancelled.current) return;
            setHealth(r);
            setSourceState((s) => ({ ...s, health: "live" }));
            anyOk = true;
          })
          .catch((e: unknown) =>
            errs.push(`health: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchIbmWorkload()
          .then((r) => {
            if (cancelled.current) return;
            setIbm(r);
            setSourceState((s) => ({ ...s, ibm: "live" }));
            anyOk = true;
          })
          .catch((e: unknown) =>
            errs.push(`ibm: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchOpsBackends()
          .then((r) => {
            if (cancelled.current) return;
            setBackends(r);
            setSourceState((s) => ({ ...s, backends: "live" }));
            anyOk = true;
          })
          .catch((e: unknown) =>
            errs.push(`backends: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchOpsJobs()
          .then((r) => {
            if (cancelled.current) return;
            setJobs(r);
            setSourceState((s) => ({ ...s, jobs: "live" }));
            anyOk = true;
          })
          .catch((e: unknown) =>
            errs.push(`jobs: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchOpsResources()
          .then((r) => {
            if (cancelled.current) return;
            setResources(r);
            setSourceState((s) => ({ ...s, resources: "live" }));
            anyOk = true;
          })
          .catch((e: unknown) =>
            errs.push(`resources: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchOpsCost()
          .then((r) => {
            if (cancelled.current) return;
            setCost(r);
            setSourceState((s) => ({ ...s, cost: "live" }));
            anyOk = true;
          })
          .catch((e: unknown) =>
            errs.push(`cost: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchOpsSources()
          .then((r) => {
            if (cancelled.current) return;
            setSources(r);
            setSourceState((s) => ({ ...s, sources: "live" }));
            anyOk = true;
          })
          .catch((e: unknown) =>
            errs.push(`sources: ${e instanceof Error ? e.message : String(e)}`),
          ),
        fetchOpsAlerts()
          .then((r) => {
            if (cancelled.current) return;
            setAlerts(r);
            setSourceState((s) => ({ ...s, alerts: "live" }));
            anyOk = true;
          })
          .catch((e: unknown) =>
            errs.push(`alerts: ${e instanceof Error ? e.message : String(e)}`),
          ),
      ]);

      if (cancelled.current) return;
      setLoaded(true);
      setError(errs.length ? errs.join("; ") : null);
      if (anyOk) setLastUpdated(new Date());
    };

    tickRef.current = tick;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = intervalMs;
    const MAX_DELAY = 60_000;

    const isVisible = () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible";

    const schedule = () => {
      if (cancelled.current) return;
      timer = setTimeout(loop, delay);
    };

    const loop = async () => {
      if (cancelled.current) return;
      if (!isVisible()) {
        // Hidden tab: park at base cadence and bail without burning a request.
        delay = intervalMs;
        schedule();
        return;
      }
      const beforeError = error;
      await tick();
      if (cancelled.current) return;
      // Soft backoff when every feed fails; reset on any success.
      delay =
        beforeError && error ? Math.min(delay * 2, MAX_DELAY) : intervalMs;
      schedule();
    };

    const onVisibility = () => {
      if (isVisible() && timer == null) {
        delay = intervalMs;
        void loop();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    void tick(); // immediate first refresh; loop schedules the next.
    schedule();

    return () => {
      cancelled.current = true;
      tickRef.current = null;
      if (timer) clearTimeout(timer);
      timer = null;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return useMemo(
    () => ({
      loaded,
      source,
      health,
      ibm,
      backends,
      jobs,
      resources,
      cost,
      sources,
      alerts,
      error,
      lastUpdated,
      refreshing,
      refresh,
    }),
    [
      loaded,
      source,
      health,
      ibm,
      backends,
      jobs,
      resources,
      cost,
      sources,
      alerts,
      error,
      lastUpdated,
      refreshing,
      refresh,
    ],
  );
}
