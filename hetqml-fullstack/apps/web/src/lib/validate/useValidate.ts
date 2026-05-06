"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDecision,
  getJob,
  getNote,
  listDecisions,
  upsertNote,
  type DecisionCreateInput,
  type DecisionRecord,
  type Job,
  type SkepticNote,
} from "@/lib/api/client";
import { useCatalogs } from "@/lib/data/useCatalogs";
import {
  applyToggleOverlay,
  useIntegrityGuards,
} from "@/lib/integrity/useIntegrityGuards";
import { getLastJobId } from "@/lib/sessions/lastJob";
import {
  clearCachedNote,
  readCachedNote,
  writeCachedNote,
} from "./noteCache";
import { buildPairKey } from "./pairKey";

const JOB_POLL_MS = 1500;

export type ValidatePhase =
  | "no-job"
  | "loading"
  | "running"
  | "failed"
  | "ready";

export interface ValidateState {
  phase: ValidatePhase;
  jobId: string | null;
  job: Job | null;
  jobError: string | null;
  pairKey: string | null;

  /** Decisions for the current pair, server-truth, most recent first. */
  pairDecisions: DecisionRecord[];
  /** Recent global decisions (last 50), for the history panel. */
  recentDecisions: DecisionRecord[];
  decisionsError: string | null;
  decisionPending: boolean;

  /** Server-side note body (or cached fallback) for the current pair. */
  noteBody: string;
  /** Whether the note has been loaded at least once. */
  noteLoaded: boolean;
  /** "saved" | "saving" | "dirty" | "offline" | "idle". */
  noteState: NoteState;
  /** Last successful save time, for the "saved · HH:MM" pill. */
  noteSavedAt: Date | null;
  noteError: string | null;

  /** Submit a decision for the current pair. */
  submitDecision: (verdict: "keep" | "review" | "reject") => Promise<void>;
  /** Update the in-flight note body — debounced save runs internally. */
  setNoteBody: (body: string) => void;
  /** Switch to a different pair (used by DecisionHistory click-to-load). */
  selectPair: (record: DecisionRecord) => void;
}

export type NoteState =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "offline";

const NOTE_DEBOUNCE_MS = 600;

function defaultReviewer(): string {
  return "anonymous reviewer";
}

function ensureSessionId(): string {
  if (typeof window === "undefined") return "sess_ssr";
  const KEY = "hetqml.sessionId";
  try {
    let sid = window.localStorage.getItem(KEY);
    if (!sid) {
      sid = `sess_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(KEY, sid);
    }
    return sid;
  } catch {
    return `sess_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export interface UseValidateOptions {
  /** jobId pre-resolved on the server (`?jobId=` in the URL). When set,
   * the localStorage fallback is skipped. */
  initialJobId?: string | null;
  /** Job hydrated server-side. When provided, the first client fetch is
   * skipped and the phase boots as "loading"/"ready" depending on status. */
  initialJob?: Job | null;
}

export function useValidate(options: UseValidateOptions = {}): ValidateState {
  const { initialJobId = null, initialJob = null } = options;
  const catalogs = useCatalogs();
  // Subscribe to the global integrity-guard store so the decision payload's
  // `guardsCompromised` and `integrityGuards` snapshot reflects the user's
  // current Initialize toggles, not just what the server ran with.
  const integrityGuardsLive = useIntegrityGuards();

  // --- Job resolution + polling -------------------------------------------
  // Seed from server-hydrated values so SSR renders the right phase
  // directly. localStorage fallback still runs client-side when the URL
  // didn't carry a jobId.
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [job, setJob] = useState<Job | null>(initialJob);
  const [jobError, setJobError] = useState<string | null>(null);
  // Initial phase derives from what we already have. If the server gave us
  // a completed job, boot straight into "ready". If we have a jobId but
  // no job, we'll be in "loading" until the first client fetch resolves.
  // Otherwise default to "no-job" so SSR renders EmptyState.
  const [phase, setPhase] = useState<ValidatePhase>(() => {
    if (initialJob) {
      if (initialJob.status === "queued" || initialJob.status === "running")
        return "running";
      if (initialJob.status === "failed") return "failed";
      return "ready";
    }
    if (initialJobId) return "loading";
    return "no-job";
  });
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  // Override pair (e.g., user clicked a row in DecisionHistory) — no job
  // change, just swap which pairKey the panels read.
  const [overridePair, setOverridePair] = useState<{
    pairKey: string;
    seed?: DecisionRecord;
  } | null>(null);

  useEffect(() => {
    // Server already resolved the jobId from the URL — skip the
    // localStorage fallback so we don't churn state.
    if (initialJobId) return;
    if (typeof window === "undefined") return;
    const id = getLastJobId();
    setJobId(id);
    if (id) setPhase("loading");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchJobOnce = useCallback(async (id: string) => {
    try {
      const j = await getJob(id);
      if (cancelled.current) return j;
      setJob(j);
      setJobError(null);
      return j;
    } catch (err) {
      if (cancelled.current) return null;
      setJobError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;
    cancelled.current = false;

    // If the server already hydrated us with this exact job, skip the
    // first fetch. Still arm the poll loop in case the job is in flight.
    const skipFirstFetch = initialJob != null && initialJob.id === jobId;
    if (!skipFirstFetch) {
      setPhase("loading");
    }

    const tick = async () => {
      const j = await fetchJobOnce(jobId);
      if (cancelled.current) return;
      if (!j) {
        setPhase("failed");
        return;
      }
      if (j.status === "queued" || j.status === "running") {
        setPhase("running");
        pollTimer.current = setTimeout(tick, JOB_POLL_MS);
      } else if (j.status === "failed" || !j.result) {
        setPhase("failed");
      } else {
        setPhase("ready");
      }
    };
    // If the server already hydrated a terminal job (completed/failed),
    // skip the redundant first fetch — the panels can render directly.
    // For in-flight jobs we still tick so the user sees progress.
    const initialIsTerminal =
      skipFirstFetch &&
      initialJob != null &&
      initialJob.status !== "queued" &&
      initialJob.status !== "running";
    if (initialIsTerminal) {
      // Set the phase to match the hydrated job and skip the poll loop.
      if (initialJob!.status === "failed" || !initialJob!.result) {
        setPhase("failed");
      } else {
        setPhase("ready");
      }
    } else {
      void tick();
    }

    return () => {
      cancelled.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, fetchJobOnce]);

  // --- Pair key derivation -----------------------------------------------
  const derivedPairKey = useMemo(() => {
    if (!job) return null;
    return buildPairKey(
      { compound: job.selection.compound, disease: job.selection.disease },
      { compounds: catalogs.compounds, diseases: catalogs.diseases },
    );
  }, [job, catalogs.compounds, catalogs.diseases]);

  const pairKey = overridePair?.pairKey ?? derivedPairKey;

  // --- Decisions ---------------------------------------------------------
  const [pairDecisions, setPairDecisions] = useState<DecisionRecord[]>([]);
  const [recentDecisions, setRecentDecisions] = useState<DecisionRecord[]>([]);
  const [decisionsError, setDecisionsError] = useState<string | null>(null);
  const [decisionPending, setDecisionPending] = useState(false);

  const refreshDecisions = useCallback(async () => {
    try {
      const recent = await listDecisions({ limit: 50 });
      setRecentDecisions(recent);
      setDecisionsError(null);
      if (pairKey) {
        const forPair = await listDecisions({ pairKey });
        setPairDecisions(forPair);
      } else {
        setPairDecisions([]);
      }
    } catch (err) {
      setDecisionsError(err instanceof Error ? err.message : String(err));
    }
  }, [pairKey]);

  useEffect(() => {
    void refreshDecisions();
  }, [refreshDecisions]);

  const submitDecision = useCallback(
    async (verdict: "keep" | "review" | "reject") => {
      if (!job || !pairKey || !job.result) return;
      const result = job.result;
      const trustAxes = result.trustScorecard.axes.map((a) => ({
        axis: a.axis,
        value: a.value,
        passing: a.passing,
      }));
      const topRow = result.leaderboard.find((r) => r.isTop);
      const topModel = topRow?.model ?? "—";
      const modelScore = topRow?.prAuc ?? result.metrics.prAuc;
      // Overlay the JobResult guard snapshot with the user's live
      // Initialize toggles so `guardsCompromised` reflects the cascade
      // (item #8). Critical guards toggled off after the run shows up here
      // as failing, which is what an audit log needs to record.
      const overlaid = applyToggleOverlay(
        integrityGuardsLive.catalog,
        integrityGuardsLive.toggles,
        result.integrityGuards,
      );
      const guardsCompromised = overlaid.filter(
        (g) => g.critical && !g.passing,
      ).length;

      // Field-parity additions (per plan §3.4 decision_log contract):
      // full integrity-guard snapshot, jobId, CV-fold std, and the
      // evidence-source paths surfaced on Visualize. These ride in the
      // existing JSON payload column so no SQLite migration is needed.
      // Snapshot is the canonical 23-guard set (post-overlay) — older
      // 5-guard subsets are no longer written.
      const integrityGuards = overlaid.map((g) => ({
        id: g.id,
        label: g.label,
        passing: g.passing,
        critical: g.critical,
      }));
      const folds = result.detailedMetrics?.cvFolds ?? [];
      let cvStd: number | undefined;
      if (folds.length > 0) {
        const mean = folds.reduce((s, f) => s + f.prAuc, 0) / folds.length;
        const variance =
          folds.reduce((s, f) => s + (f.prAuc - mean) ** 2, 0) / folds.length;
        cvStd = Number(Math.sqrt(variance).toFixed(4));
      }
      const evidenceSources = (result.provenance ?? [])
        .map((p) => p.source)
        .filter((s): s is string => Boolean(s));

      const input: DecisionCreateInput = {
        pairKey,
        verdict,
        reviewer: defaultReviewer(),
        sessionId: ensureSessionId(),
        selection: {
          disease: job.selection.disease,
          compound: job.selection.compound,
          gene: job.selection.gene,
          metaedge: job.selection.metaedge,
        },
        runPath: {
          mode: (job.runPath.mode as "quick" | "custom") ?? "quick",
          family: job.runPath.family,
        },
        topModel,
        modelScore,
        trustScore: result.trustScorecard.composite,
        trustAxes,
        guardsCompromised,
        integrityGuards,
        jobId: job.id,
        cvStd,
        evidenceSources,
      };

      setDecisionPending(true);
      try {
        await createDecision(input);
        await refreshDecisions();
        setDecisionsError(null);
      } catch (err) {
        setDecisionsError(err instanceof Error ? err.message : String(err));
      } finally {
        setDecisionPending(false);
      }
    },
    [job, pairKey, refreshDecisions, integrityGuardsLive.catalog, integrityGuardsLive.toggles],
  );

  // --- Notes -------------------------------------------------------------
  const [noteBody, setNoteBodyState] = useState<string>("");
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [noteState, setNoteState] = useState<NoteState>("idle");
  const [noteSavedAt, setNoteSavedAt] = useState<Date | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const noteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  // Hydrate note from server (with localStorage fallback) when pair changes.
  useEffect(() => {
    let aborted = false;
    if (!pairKey) {
      setNoteBodyState("");
      setNoteLoaded(false);
      setNoteState("idle");
      setNoteSavedAt(null);
      lastSavedRef.current = "";
      return;
    }

    const cached = readCachedNote(pairKey);

    setNoteState("idle");
    setNoteLoaded(false);
    setNoteError(null);

    void (async () => {
      try {
        const fetched: SkepticNote = await getNote(pairKey);
        if (aborted) return;
        // If the local cache holds an unsynced body that's newer than the
        // server, keep the cache and mark dirty. Otherwise prefer server.
        if (cached !== null && cached !== fetched.body) {
          setNoteBodyState(cached);
          lastSavedRef.current = fetched.body;
          setNoteState("dirty");
        } else {
          setNoteBodyState(fetched.body);
          lastSavedRef.current = fetched.body;
          setNoteState("saved");
          setNoteSavedAt(new Date(fetched.updatedAt));
          clearCachedNote(pairKey);
        }
      } catch (err) {
        if (aborted) return;
        // 404 is expected for fresh pairs.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("404")) {
          setNoteBodyState(cached ?? "");
          lastSavedRef.current = "";
          setNoteState(cached ? "dirty" : "idle");
          setNoteError(null);
        } else {
          setNoteBodyState(cached ?? "");
          lastSavedRef.current = "";
          setNoteState(cached ? "offline" : "offline");
          setNoteError(msg);
        }
      } finally {
        if (!aborted) setNoteLoaded(true);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [pairKey]);

  // Debounced autosave when the body changes.
  const setNoteBody = useCallback(
    (body: string) => {
      setNoteBodyState(body);
      if (!pairKey) return;
      writeCachedNote(pairKey, body);

      if (body === lastSavedRef.current) {
        setNoteState("saved");
        return;
      }
      setNoteState("dirty");

      if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current);
      noteDebounceRef.current = setTimeout(async () => {
        setNoteState("saving");
        try {
          const saved = await upsertNote(pairKey, { pairKey, body });
          lastSavedRef.current = saved.body;
          setNoteSavedAt(new Date(saved.updatedAt));
          setNoteState("saved");
          setNoteError(null);
          clearCachedNote(pairKey);
        } catch (err) {
          // Save failed — keep the cached body, surface offline state.
          setNoteState("offline");
          setNoteError(err instanceof Error ? err.message : String(err));
        }
      }, NOTE_DEBOUNCE_MS);
    },
    [pairKey],
  );

  // Cleanup pending debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current);
    };
  }, []);

  // --- DecisionHistory click-to-load -------------------------------------
  const selectPair = useCallback((record: DecisionRecord) => {
    setOverridePair({ pairKey: record.pairKey, seed: record });
  }, []);

  return {
    phase,
    jobId,
    job,
    jobError,
    pairKey,

    pairDecisions,
    recentDecisions,
    decisionsError,
    decisionPending,

    noteBody,
    noteLoaded,
    noteState,
    noteSavedAt,
    noteError,

    submitDecision,
    setNoteBody,
    selectPair,
  };
}
