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

export function useValidate(): ValidateState {
  const catalogs = useCatalogs();

  // --- Job resolution + polling -------------------------------------------
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ValidatePhase>("loading");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  // Override pair (e.g., user clicked a row in DecisionHistory) — no job
  // change, just swap which pairKey the panels read.
  const [overridePair, setOverridePair] = useState<{
    pairKey: string;
    seed?: DecisionRecord;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("jobId");
    const id = fromUrl ?? getLastJobId();
    setJobId(id);
    if (!id) setPhase("no-job");
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
    setPhase("loading");

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
    void tick();

    return () => {
      cancelled.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = null;
    };
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
      const guardsCompromised = result.integrityGuards.filter(
        (g) => g.critical && !g.passing,
      ).length;

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
    [job, pairKey, refreshDecisions],
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
