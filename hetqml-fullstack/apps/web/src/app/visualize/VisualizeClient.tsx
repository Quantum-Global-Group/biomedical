"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { getJob, listDecisions, type DecisionRecord, type Job } from "@/lib/api/client";
import { TraceId } from "@/components/common/TraceId";
import { getLastJobId } from "@/lib/sessions/lastJob";
import { RecentJobLinks } from "@/components/sessions/RecentJobLinks";
import { useVisiblePoll } from "@/lib/polling/useVisiblePoll";
import { useCatalogs } from "@/lib/data/useCatalogs";
import { findCompoundEntryByName } from "@/lib/data/compoundLookup";
import { buildPairKey, lookupCompoundId } from "@/lib/validate/pairKey";
import {
  SHORTCUT_EVENT,
  type ShortcutEventDetail,
} from "@/lib/shortcuts/useKeyboardShortcuts";
import { ClinicalSupportStrip } from "@/components/visualize/ClinicalSupportStrip";
import { EvidenceMatrixPanel } from "@/components/visualize/EvidenceMatrixPanel";
import { EvidenceOverlaysPanel } from "@/components/visualize/EvidenceOverlaysPanel";
import { InterpretationPanel } from "@/components/visualize/InterpretationPanel";
import { KgViewer3DPanel } from "@/components/visualize/KgViewer3DPanel";
import { MetricStrip } from "@/components/visualize/MetricStrip";
import { ModelAgreementPanel } from "@/components/visualize/ModelAgreementPanel";
import { PathDiagramPanel } from "@/components/visualize/PathDiagramPanel";
import { ProvenanceTimelinePanel } from "@/components/visualize/ProvenanceTimelinePanel";
import { QualityFlagsPanel } from "@/components/visualize/QualityFlagsPanel";
import { QuantumCircuitPanel } from "@/components/visualize/QuantumCircuitPanel";
import { UmapScatterPanel } from "@/components/visualize/UmapScatterPanel";
import {
  VIZ_SYNC_EVENT,
  type VizSyncDetail,
} from "@/lib/visualize/syncBus";

const MoleculeViewerPanel = dynamic(
  () =>
    import("@/components/visualize/MoleculeViewerPanel").then((m) => ({
      default: m.MoleculeViewerPanel,
    })),
  { ssr: false },
);

const POLL_BASE_MS = 1500;
const POLL_MAX_MS = 12_000;

/** Filesystem-safe, sortable timestamp: 2026-05-05T14-32-08. */
function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

interface VisualizeClientProps {
  /** jobId resolved from `?jobId=` on the server. localStorage fallback
   * still happens client-side when this is null. */
  jobIdFromUrl: string | null;
  /** Job hydrated server-side when `jobIdFromUrl` was set. May be null if
   * the API was offline or the id was unknown — client will refetch. */
  initialJob: Job | null;
}

export function VisualizeClient({
  jobIdFromUrl,
  initialJob,
}: VisualizeClientProps) {
  // Seed from the server-hydrated values so SSR renders the actual content,
  // not a loading flash. localStorage fallback runs in the effect below.
  const [jobId, setJobId] = useState<string | null>(jobIdFromUrl);
  const [job, setJob] = useState<Job | null>(initialJob);
  const [error, setError] = useState<string | null>(null);
  const [errorObj, setErrorObj] = useState<unknown>(null);
  // Loading is true only when we have a jobId but no job hydrated yet —
  // i.e. the server fetch failed and we need a client retry.
  const [loading, setLoading] = useState(
    jobIdFromUrl != null && initialJob == null,
  );
  // resolved tracks whether jobId resolution finished: true server-side
  // when URL had a jobId, otherwise flips true after the localStorage
  // check runs in the effect below.
  const [resolved, setResolved] = useState(jobIdFromUrl != null);

  // localStorage fallback only runs if the URL didn't carry a jobId.
  useEffect(() => {
    if (jobIdFromUrl) return;
    const id = getLastJobId();
    setJobId(id);
    setResolved(true);
    if (!id) setLoading(false);
  }, [jobIdFromUrl]);

  // First fetch — runs when we have a jobId but no hydrated job (server
  // fetch missed) or when localStorage resolved a fresh id post-hydration.
  useEffect(() => {
    if (!jobId) return;
    if (job?.id === jobId) return; // already hydrated by the server
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const j = await getJob(jobId);
        if (cancelled) return;
        setJob(j);
        setError(null);
        setErrorObj(null);
      } catch (err) {
        if (cancelled) return;
        setErrorObj(err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, job?.id]);

  // Subsequent ticks — only while the job is still in flight.
  const pollableId =
    jobId && job && (job.status === "queued" || job.status === "running")
      ? jobId
      : null;
  useVisiblePoll<Job>({
    enabled: pollableId,
    baseMs: POLL_BASE_MS,
    maxMs: POLL_MAX_MS,
    fetcher: async () => {
      const j = await getJob(pollableId!);
      setJob(j);
      setError(null);
      return j;
    },
    isDone: (j) => j.status !== "queued" && j.status !== "running",
    isProgress: (prev, next) => !prev || prev.status !== next.status,
  });

  // Catalog lookup so the metric strip can show DrugBank ID + therapeutic
  // class for the active compound, and the export bundle can include a
  // canonical pair key.
  const catalogs = useCatalogs();
  const compoundEntry = job
    ? findCompoundEntryByName(catalogs.compounds, job.selection.compound)
    : null;

  // Pair-scoped decision history — pulled lazily so the export bundle can
  // include them without forcing a fetch on idle visits. Refreshes when
  // the active pair changes.
  const [pairDecisions, setPairDecisions] = useState<DecisionRecord[]>([]);
  useEffect(() => {
    if (!job || job.status !== "completed") return;
    let cancelled = false;
    const pairKey = buildPairKey(job.selection, {
      compounds: catalogs.compounds,
      diseases: catalogs.diseases,
    });
    (async () => {
      try {
        const records = await listDecisions({ pairKey, limit: 50 });
        if (!cancelled) setPairDecisions(records);
      } catch {
        // Decision history is supplementary — silently degrade if the
        // endpoint is unreachable; the export bundle still ships.
        if (!cancelled) setPairDecisions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job, catalogs.compounds, catalogs.diseases]);

  // Export Evidence — bundle whatever the page already has loaded into a
  // JSON file. No new endpoints, no fabricated fields: this is a snapshot
  // of `Job` + the catalog-derived pair key + any decisions/notes the
  // reviewer has already pulled in this session.
  const jobRef = useRef(job);
  const decisionsRef = useRef(pairDecisions);
  const compoundEntryRef = useRef(compoundEntry);
  const catalogsRef = useRef(catalogs);
  useEffect(() => {
    jobRef.current = job;
    decisionsRef.current = pairDecisions;
    compoundEntryRef.current = compoundEntry;
    catalogsRef.current = catalogs;
  });

  const onExportEvidence = useCallback(() => {
    const j = jobRef.current;
    if (!j || !j.result) return;
    const drugbankId = compoundEntryRef.current?.drugbank ?? null;
    const therapeuticClass = compoundEntryRef.current?.category ?? null;
    const pairKey = buildPairKey(j.selection, {
      compounds: catalogsRef.current.compounds,
      diseases: catalogsRef.current.diseases,
    });
    const compoundId = lookupCompoundId(
      j.selection.compound,
      catalogsRef.current.compounds,
    );
    const topRow =
      j.result.leaderboard.find((r) => r.isTop) ??
      j.result.leaderboard[0] ??
      null;
    const bundle = {
      schema: "hetqml.evidence.v1",
      exportedAt: new Date().toISOString(),
      job: {
        id: j.id,
        status: j.status,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
        runPath: j.runPath,
        selection: j.selection,
      },
      pair: {
        pairKey,
        compoundId,
        compoundName: j.selection.compound,
        drugbankId,
        therapeuticClass,
        diseaseName: j.selection.disease,
      },
      topModel: topRow,
      metrics: j.result.metrics,
      detailedMetrics: j.result.detailedMetrics,
      leaderboard: j.result.leaderboard,
      trustScorecard: j.result.trustScorecard,
      integrityGuards: j.result.integrityGuards,
      evidenceMatrix: j.result.evidenceMatrix,
      evidencePath: j.result.evidencePath,
      modelAgreement: j.result.modelAgreement,
      qualityFlags: j.result.qualityFlags,
      evidenceOverlays: j.result.evidenceOverlays,
      interpretation: j.result.interpretation,
      provenance: j.result.provenance,
      quantumCircuit: j.result.quantumCircuit,
      decisions: decisionsRef.current,
    };
    try {
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hetqml-evidence-${j.id.slice(0, 8)}-${timestampForFilename()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      // Non-fatal — surface in the console but don't crash the page.
      console.error("Export Evidence failed", err);
    }
  }, []);

  // ⌘/Ctrl+E from useKeyboardShortcuts dispatches `hetqml:shortcut` with
  // action "export-evidence". Visualize is the page that owns that action.
  useEffect(() => {
    function onShortcut(event: Event) {
      const ce = event as CustomEvent<ShortcutEventDetail>;
      if (ce.detail?.action === "export-evidence") {
        onExportEvidence();
      }
    }
    window.addEventListener(SHORTCUT_EVENT, onShortcut);
    return () => window.removeEventListener(SHORTCUT_EVENT, onShortcut);
  }, [onExportEvidence]);

  // --- Cross-panel auto-sync --------------------------------------------
  // Auto-sync keeps the molecule viewer, embedding scatter, and KG panel
  // pointed at the same pair. Default is ON; the controls bar lets the
  // user disable it (some reviewers prefer manual exploration). Sync
  // selection seeds from the investigation pair, but a click in any
  // panel updates `selectedPair` and re-broadcasts so siblings track.
  const [autoSync, setAutoSync] = useState(true);
  const [selectedPair, setSelectedPair] = useState<{
    compound: string;
    disease: string;
  } | null>(null);

  // Reset selection when the underlying job changes (re-investigations
  // shouldn't carry stale pair state across).
  useEffect(() => {
    if (job?.selection) {
      setSelectedPair({
        compound: job.selection.compound,
        disease: job.selection.disease,
      });
    } else {
      setSelectedPair(null);
    }
  }, [job?.id, job?.selection]);

  useEffect(() => {
    function onSync(event: Event) {
      if (!autoSync) return;
      const ce = event as CustomEvent<VizSyncDetail>;
      const detail = ce.detail;
      if (!detail) return;
      setSelectedPair({
        compound: detail.compound,
        disease: detail.disease,
      });
    }
    window.addEventListener(VIZ_SYNC_EVENT, onSync);
    return () => window.removeEventListener(VIZ_SYNC_EVENT, onSync);
  }, [autoSync]);

  const onSyncToInvestigation = useCallback(() => {
    if (!job?.selection) return;
    setSelectedPair({
      compound: job.selection.compound,
      disease: job.selection.disease,
    });
  }, [job?.selection]);

  // SSR: no jobId resolved yet → render EmptyState (matches what the user
  // sees post-hydration when there's no recent investigation).
  if (!resolved && !jobId) return <EmptyState />;
  if (resolved && !jobId) return <EmptyState />;

  if (loading && !job) {
    return (
      <Header step="04 · VISUALIZE" title="Loading evidence layers…">
        <div className="panel">
          <p className="panel-purpose">
            Loading job {jobId ? jobId.slice(0, 8) : "…"}…
          </p>
        </div>
      </Header>
    );
  }

  if (error && !job) {
    return (
      <Header step="04 · VISUALIZE" title="Could not load job">
        <div className="panel">
          <div className="skeptic-warning">
            {error}
            <TraceId err={errorObj} />
          </div>
          <Link className="btn" href="/initialize" style={{ marginTop: 16 }}>
            ← Back to Initialize
          </Link>
        </div>
      </Header>
    );
  }

  if (!job) return <EmptyState />;

  if (job.status === "queued" || job.status === "running") {
    return (
      <Header step="04 · VISUALIZE" title="Run is still in progress">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">JOB {job.id.slice(0, 8)}</div>
              <div className="panel-title">{job.status}</div>
            </div>
            <span className="pill">{job.status}</span>
          </div>
          <p className="panel-purpose">
            Visualize will populate once the job completes (typically a few
            seconds for the synthetic pipeline). This view is polling at the
            same cadence as Experiment.
          </p>
        </div>
      </Header>
    );
  }

  if (job.status === "failed" || !job.result) {
    return (
      <Header step="04 · VISUALIZE" title="Job did not complete">
        <div className="panel">
          <div className="skeptic-warning">
            {job.error ?? "Job did not complete successfully."}
          </div>
          <Link className="btn" href="/initialize" style={{ marginTop: 16 }}>
            ← Back to Initialize
          </Link>
        </div>
      </Header>
    );
  }

  // --- Completed view ----------------------------------------------------
  const result = job.result;

  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">04 · VISUALIZE</div>
          <h1 className="h1">Inspect every layer of evidence</h1>
          <p className="lede">
            Six panels — molecule, knowledge graph, embedding scatter,
            quantum kernel circuit, evidence overlays, interpretation. Each
            cites a different source. Cross-panel reinforcement is what turns
            a model score into something defensible.
          </p>
          <p
            className="panel-purpose"
            style={{
              marginTop: 14,
              marginBottom: 0,
              maxWidth: 720,
              color: "var(--muted)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: "var(--ink)" }}>Data fidelity.</strong>{" "}
            Headline job metrics and the path-aware leaderboard row marked{" "}
            <strong>RUN</strong> come from the API run when the runner splices a
            real model result; many panels still attach deterministic simulated
            narrative fields for UX scaffolding — check{" "}
            <strong>SIM</strong> labels (suite rows and most leaderboard rows)
            rather than treating every cell as an independent empirical
            measurement.
          </p>
        </div>
        <span
          className="pill"
          style={{ background: "var(--green-bg)", color: "var(--green)" }}
        >
          ● run completed · job {job.id.slice(0, 8)}
        </span>
      </div>

      <MetricStrip
        job={job}
        result={result}
        drugbankId={compoundEntry?.drugbank ?? null}
        therapeuticClass={compoundEntry?.category ?? null}
      />

      <ClinicalSupportStrip job={job} result={result} />

      {/* Auto-sync controls — keeps the molecule, embedding scatter, and KG panels
        * focused on the same pair. On by default; reviewers can turn it off to
        * explore panels independently. */}
      <div
        className="panel"
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
        data-panel="viz-controls"
      >
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          <strong style={{ color: "var(--ink)" }}>Auto-sync</strong> ·
          click a candidate in any 3D panel to re-focus the others.
        </div>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
          />
          {autoSync ? "on" : "off"}
        </label>
        <span
          className="pill"
          style={{
            background: "var(--paper-alt)",
            color: "var(--muted)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10.5,
          }}
        >
          focus :: {selectedPair?.compound ?? "—"} →{" "}
          {selectedPair?.disease ?? "—"}
        </span>
        <button
          type="button"
          className="btn"
          onClick={onSyncToInvestigation}
          style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 11 }}
          title="Re-focus the panels on the original investigation pair"
        >
          ↻ Sync to investigation
        </button>
      </div>

      {/* Row 1: 3D layers — molecule, KG, embedding */}
      <div className="grid-7-5">
        <KgViewer3DPanel
          selection={{
            ...job.selection,
            compound: selectedPair?.compound ?? job.selection.compound,
            disease: selectedPair?.disease ?? job.selection.disease,
          }}
          anchorGene={job.selection.gene}
        />
        <MoleculeViewerPanel
          compound={selectedPair?.compound ?? job.selection.compound}
          disease={selectedPair?.disease ?? job.selection.disease}
          autoSync={autoSync}
        />
      </div>

      <div className="grid-7-5">
        <UmapScatterPanel
          result={result}
          selectedCompound={selectedPair?.compound ?? null}
          selectedDisease={selectedPair?.disease ?? null}
          autoSync={autoSync}
        />
        <QuantumCircuitPanel circuit={result.quantumCircuit} />
      </div>

      {/* Row 2: evidence */}
      <EvidenceMatrixPanel matrix={result.evidenceMatrix} />
      <PathDiagramPanel path={result.evidencePath} />

      {/* Row 3: model agreement + quality */}
      <div className="grid-7-5">
        <ModelAgreementPanel agreement={result.modelAgreement} />
        <QualityFlagsPanel flags={result.qualityFlags} />
      </div>

      {/* Row 4: overlays + interpretation */}
      <EvidenceOverlaysPanel overlays={result.evidenceOverlays} />
      <InterpretationPanel interpretation={result.interpretation} />

      {/* Row 5: provenance */}
      <ProvenanceTimelinePanel events={result.provenance} />

      <div className="how-to">
        <div className="how-to-h">⊙ HOW TO READ THIS PAGE</div>
        <div className="how-to-title">
          What this view answers — and what to question
        </div>
        <p className="how-lede">
          Visualize is the evidence room. The numbers from{" "}
          <strong>Experiment</strong> earned the candidate a place here; this
          page asks <em>why</em> the model said yes. Read the{" "}
          <strong>clinical support strip</strong> and{" "}
          <strong>evidence matrix</strong> for whether independent layers agree,
          the <strong>path diagram</strong> and{" "}
          <strong>3D knowledge graph</strong> for the literal compound → anchor
          → disease route, the <strong>model agreement</strong> gauge for
          ensemble consensus, and the <strong>quality flags</strong> +{" "}
          <strong>provenance timeline</strong> for what to caveat. If any panel
          contradicts the headline, that is the signal — pass it to{" "}
          <strong>Validate</strong>.
        </p>
      </div>

      <div className="footer-actions">
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/initialize">
            ← Re-Initialize
          </Link>
          <Link className="btn" href={`/experiment?jobId=${job.id}`}>
            ← Back to Experiment
          </Link>
          <button
            type="button"
            className="btn"
            onClick={onExportEvidence}
            title="Download a JSON snapshot of this investigation (⌘/Ctrl+E)"
          >
            ↓ Export Evidence (JSON)
          </button>
        </div>
        <Link className="btn-primary" href={`/validate?jobId=${job.id}`}>
          Send to Validate →
        </Link>
      </div>
    </>
  );
}

function Header({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">{step}</div>
          <h1 className="h1">{title}</h1>
        </div>
        <span className="pill">○ idle</span>
      </div>
      {children}
    </>
  );
}

function EmptyState() {
  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">04 · VISUALIZE</div>
          <h1 className="h1">No active investigation</h1>
          <p className="lede">
            Visualize renders the layered evidence (molecule, knowledge graph,
            embedding, quantum circuit, model agreement, provenance) for a
            completed run. Start an investigation on Initialize to populate
            the panels.
          </p>
        </div>
        <span className="pill">○ idle</span>
      </div>
      <div className="panel">
        <p className="panel-purpose">
          No <code>jobId</code> in the URL and no recent investigation in
          local storage. Head to Initialize, fill the four parameters, pick a
          run path, and press <strong>Run investigation</strong>.
        </p>
        <div className="footer-actions">
          <div />
          <Link className="btn-primary" href="/initialize">
            Open Initialize →
          </Link>
        </div>
      </div>
      <RecentJobLinks route="visualize" />
    </>
  );
}
