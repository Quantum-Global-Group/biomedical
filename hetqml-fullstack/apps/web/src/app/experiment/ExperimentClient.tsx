"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getJob, type Job } from "@/lib/api/client";
import { useDashboardMode } from "@/lib/dashboardMode/DashboardModeProvider";
import {
  HEADLINE_CONFIG,
  HEADLINE_DECISION_STATUS,
} from "@/lib/data/headlineMetrics";
import { buildHeadlineLeaderboardRows } from "@/lib/experiment/headlineRows";
import { deriveLede } from "@/lib/experiment/selectors";
import { getLastJobId } from "@/lib/sessions/lastJob";
import { HeadlineLeaderboard } from "@/components/experiment/HeadlineLeaderboard";
import { MetricStrip } from "@/components/experiment/MetricStrip";
import { SourceCheckPanel } from "@/components/experiment/SourceCheckPanel";
import { LeaderboardPanel } from "@/components/experiment/LeaderboardPanel";
import { DetailedMetricsPanel } from "@/components/experiment/DetailedMetricsPanel";
import { CandidateSpotlightPanel } from "@/components/experiment/CandidateSpotlightPanel";
import { QualityControlsPanel } from "@/components/experiment/QualityControlsPanel";
import { BenchmarkSuitePanel } from "@/components/experiment/BenchmarkSuitePanel";
import { useVisiblePoll } from "@/lib/polling/useVisiblePoll";

const POLL_BASE_MS = 1500;
const POLL_MAX_MS = 12_000;

export function ExperimentClient() {
  const { mode, hydrated } = useDashboardMode();
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Headline mode is decoupled from any specific candidate / jobId — it
  // shows the project's preregistered methodology panel. Wait for the
  // mode to hydrate from localStorage before deciding so we don't flash
  // the demo flow first.
  if (hydrated && mode === "headline") {
    return <HeadlineExperimentView />;
  }

  // Resolve job id from URL ?jobId=, then localStorage fallback. Runs once
  // on mount; the polling effect picks up the resolved id.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("jobId");
    const id = fromUrl ?? getLastJobId();
    setJobId(id);
    if (!id) setLoading(false);
  }, []);

  // First fetch — runs once per resolved jobId. Sets initial loading=false.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const j = await getJob(jobId);
        if (cancelled) return;
        setJob(j);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

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

  if (!jobId) {
    return <EmptyState />;
  }

  if (loading && !job) {
    return (
      <div className="panel">
        <p className="panel-purpose">Loading job {jobId.slice(0, 8)}…</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="panel">
        <div className="skeptic-warning">{error}</div>
        <Link className="btn" href="/initialize" style={{ marginTop: 16 }}>
          ← Back to Initialize
        </Link>
      </div>
    );
  }

  if (!job) return <EmptyState />;

  if (job.status === "queued" || job.status === "running") {
    return (
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">JOB {job.id.slice(0, 8)}</div>
            <div className="panel-title">Running…</div>
          </div>
          <span className="pill">{job.status}</span>
        </div>
        <p className="panel-purpose">
          The investigation is still running. This page will populate once
          the job completes (typically a few seconds for the synthetic
          pipeline).
        </p>
      </div>
    );
  }

  if (job.status === "failed" || !job.result) {
    return (
      <div className="panel">
        <div className="skeptic-warning">
          {job.error ?? "Job did not complete successfully."}
        </div>
        <Link className="btn" href="/initialize" style={{ marginTop: 16 }}>
          ← Back to Initialize
        </Link>
      </div>
    );
  }

  return <CompletedView job={job} />;
}

function CompletedView({ job }: { job: Job }) {
  const result = job.result!;
  const family = job.runPath.family;
  const lede = deriveLede(result, job.selection, family);

  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">02 · EXPERIMENT</div>
          <h1 className="h1">What this investigation produced</h1>
          <p className="lede">{lede}</p>
        </div>
        <span
          className="pill"
          style={{ background: "var(--green-bg)", color: "var(--green)" }}
        >
          ● run completed · job {job.id.slice(0, 8)}
        </span>
      </div>

      <MetricStrip job={job} />
      <SourceCheckPanel job={job} />
      <LeaderboardPanel result={result} family={family} />
      <BenchmarkSuitePanel result={result} />
      <DetailedMetricsPanel result={result} />
      <CandidateSpotlightPanel
        result={result}
        selectedCompound={job.selection.compound}
      />
      <QualityControlsPanel result={result} />

      <div className="footer-actions">
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/initialize">
            ← Re-Initialize
          </Link>
          <Link className="btn" href="/visualize">
            ⌥ Visualize evidence
          </Link>
        </div>
        <Link className="btn-primary" href="/validate">
          Send to Validate →
        </Link>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">02 · EXPERIMENT</div>
          <h1 className="h1">No active investigation</h1>
          <p className="lede">
            The Experiment page renders the evidence produced by a run. Start
            an investigation on Initialize to populate the leaderboard,
            benchmark suite, detailed metrics, candidate spotlight, and
            quality controls.
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
    </>
  );
}

/**
 * Headline-mode view for the Experiment page. No specific candidate/disease
 * pair — this is the project's preregistered panel-wide methodology study
 * (Hetionet CtD, 5-fold CV, paired-bootstrap CIs across the 5-row panel).
 *
 * The page-hero, leaderboard, and configuration / decision-status panels
 * are all sourced from `lib/data/headlineMetrics.ts`. Demo-mode-only
 * sections (CandidateSpotlight, BenchmarkSuite, MetricStrip) are
 * intentionally omitted — they assume a per-pair score that doesn't
 * apply at the methodology level.
 */
function HeadlineExperimentView() {
  const rows = buildHeadlineLeaderboardRows();
  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">02 · EXPERIMENT (HEADLINE)</div>
          <h1 className="h1">Hetionet CtD methodology study</h1>
          <p className="lede">
            Preregistered five-row panel — QSVC alone (H1) and the hybrid
            stacking ensemble (H1b) versus the classical baselines on the
            Compound-treats-Disease subgraph. Paired-bootstrap confidence
            intervals land once the headline GPU run on the DGX produces{" "}
            <code>docs/results/bootstrap_ci_analysis.md</code>.
          </p>
        </div>
        <span className="pill" style={{ background: "var(--paper-alt)", color: "var(--gold)" }}>
          ● locked methodology · CIs pending
        </span>
      </div>

      <HeadlineLeaderboard rows={rows} />

      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">CONFIG · LOCKED</div>
            <div className="panel-title">Preregistered configuration (§4 · §5.1)</div>
          </div>
          <span className="badge">Reference</span>
        </div>
        <p className="panel-purpose">
          Every value below is locked by{" "}
          <code>utils/preregistered_constants.py</code> in the sibling
          <code>hybrid-qml-kg-poc</code> repo. Deviating from any of these
          requires a §12 amendment to the OSF preregistration.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            rowGap: 6,
            columnGap: 24,
            marginTop: 12,
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--muted, #B8AFA5)",
          }}
        >
          <ConfigRow label="Knowledge graph" value={HEADLINE_CONFIG.graph} />
          <ConfigRow label="Embedding" value={HEADLINE_CONFIG.embedding} />
          <ConfigRow label="Pair feature ops" value={HEADLINE_CONFIG.pairOps} />
          <ConfigRow label="Pre-PCA" value={`${HEADLINE_CONFIG.prePca}D`} />
          <ConfigRow label="Quantum kernel dim" value={`${HEADLINE_CONFIG.qmlDim} qubits`} />
          <ConfigRow label="Feature map" value={HEADLINE_CONFIG.featureMap} />
          <ConfigRow label="QSVC C" value={String(HEADLINE_CONFIG.qsvcC)} />
          <ConfigRow label="Negatives" value={HEADLINE_CONFIG.negativeSampling} />
          <ConfigRow label="Bootstrap" value={HEADLINE_CONFIG.bootstrap} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">DECISION · §1.3 · §8.1</div>
            <div className="panel-title">Hypothesis decision-rule status</div>
          </div>
          <span className="badge">Pending</span>
        </div>
        <p className="panel-purpose">
          Each row shows the §1.3 hypothesis and its current decision-rule
          status. H1 / H1b need the GPU bootstrap-CI run; H2 / H3 need the
          IBM Torino + Pauli Path ZNE hardware experiments.
        </p>
        <div style={{ marginTop: 12 }}>
          <DecisionRow id="H1" status={HEADLINE_DECISION_STATUS.h1} />
          <DecisionRow id="H1b" status={HEADLINE_DECISION_STATUS.h1b} />
          <DecisionRow id="H2" status={HEADLINE_DECISION_STATUS.h2} />
          <DecisionRow id="H3" status={HEADLINE_DECISION_STATUS.h3} />
        </div>
        <div className="panel-footer">
          <span>preregistration §10 timeline · OSF Q3 2026 · submission Q1 2027</span>
        </div>
      </div>

      <div className="footer-actions">
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/initialize">
            ← Re-Initialize (demo)
          </Link>
        </div>
        <Link className="btn-primary" href="/validate">
          Send to Validate →
        </Link>
      </div>
    </>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span style={{ color: "var(--faint, #857D75)" }}>{label}</span>
      <span style={{ color: "var(--ink, #E8E0D6)", fontFamily: "var(--font-mono, monospace)" }}>
        {value}
      </span>
    </>
  );
}

function DecisionRow({ id, status }: { id: string; status: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "60px 1fr",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--border-soft, #332D27)",
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          color: "var(--gold, #C8A45A)",
          fontFamily: "var(--font-mono, monospace)",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {id}
      </span>
      <span style={{ color: "var(--muted, #B8AFA5)", fontSize: 12 }}>{status}</span>
    </div>
  );
}
