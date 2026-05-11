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
import { isLiteMode } from "@/lib/liteMode";
import type { LeaderboardRow } from "@/lib/api/client";

// Constant-folded so the lite-only branch DCEs out of the full build
// and the heavy demo path (poll → CompletedView) DCEs out of the lite
// trace when this resolves to true.
const IS_LITE = isLiteMode();

const POLL_BASE_MS = 1500;
const POLL_MAX_MS = 12_000;

interface ExperimentClientProps {
  /** jobId resolved from `?jobId=` on the server. localStorage fallback
   * still happens client-side when this is null. */
  jobIdFromUrl?: string | null;
  /** Job hydrated server-side when `jobIdFromUrl` was set. May be null if
   * the API was offline or the id was unknown — client will refetch. */
  initialJob?: Job | null;
}

export function ExperimentClient({
  jobIdFromUrl = null,
  initialJob = null,
}: ExperimentClientProps = {}) {
  // All hooks run unconditionally before any early return — Rules-of-Hooks.
  // The headline-mode short-circuit happens after, so a mid-run mode flip
  // can't change the hook count between renders.
  const { mode, hydrated } = useDashboardMode();
  const [jobId, setJobId] = useState<string | null>(jobIdFromUrl);
  const [job, setJob] = useState<Job | null>(initialJob);
  const [error, setError] = useState<string | null>(null);
  // Loading is true only when we have a jobId but no hydrated job yet —
  // i.e. the server fetch failed and we need a client retry.
  const [loading, setLoading] = useState(
    jobIdFromUrl != null && initialJob == null,
  );

  // localStorage fallback only runs if the URL didn't carry a jobId.
  useEffect(() => {
    if (jobIdFromUrl) return;
    if (typeof window === "undefined") return;
    const id = getLastJobId();
    setJobId(id);
    if (!id) setLoading(false);
  }, [jobIdFromUrl]);

  // First fetch — runs when we have a jobId but no hydrated job (server
  // fetch missed) or when localStorage resolved a fresh id post-hydration.
  useEffect(() => {
    if (!jobId) return;
    if (job?.id === jobId) return; // already hydrated
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

  // Headline mode is decoupled from any specific candidate / jobId — it
  // shows the project's preregistered methodology panel. Wait for the
  // mode to hydrate from localStorage before deciding so we don't flash
  // the demo flow first. NOTE: this branch must run after all hooks above.
  if (hydrated && mode === "headline") {
    return <HeadlineExperimentView />;
  }

  // Lite (HF Space) demo: there's no FastAPI to run jobs, so the
  // demo-mode flow can never reach a CompletedView. Show a focused
  // 3-element view (page-hero + leaderboard + detailed metrics)
  // mirroring the lite Visualize / Validate / Operations / Settings
  // pattern, with mock fixtures from the Inaxaplin → APOL1-MKD
  // walkthrough.
  if (IS_LITE && hydrated) {
    return <ExperimentLiteView />;
  }

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
            Top-line metrics and the path-aware leaderboard reflect this job&apos;s
            API execution path when the runner splices a real model result (
            <strong>RUN</strong> on that leaderboard row). Other leaderboard rows
            and benchmark-suite cells use deterministic simulated fills keyed off
            that headline — treat <strong>SIM</strong> as scaffolding, not separate
            live runs.
          </p>
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

      <div className="how-to">
        <div className="how-to-h">⊙ HOW TO READ THIS PAGE</div>
        <div className="how-to-title">
          What this view answers — and what to question
        </div>
        <p className="how-lede">
          The Experiment page is what your investigation produced. It pulls the
          configuration from <strong>Initialize</strong> and renders five
          tools: <strong>source check</strong> for provenance,{" "}
          <strong>model leaderboard</strong> for which algorithm won,{" "}
          <strong>detailed metrics</strong> for the top model&apos;s full
          diagnostic profile, <strong>candidate spotlight</strong> for the
          selected compound&apos;s prediction probability, and{" "}
          <strong>quality controls</strong> for whether the engineering passed
          the audit. Every section is reactive — change the candidate, run
          path, or any guard on Initialize and watch this page recompute.
        </p>
      </div>

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

/**
 * Lite (HF Space) demo-mode Experiment view.
 *
 * Static-fixture analog of the per-pair completed-job experience for
 * visitors with no backend to run a real investigation. Shows a focused
 * 3-element layout (page-hero + headline leaderboard + detailed-metrics
 * card) using mock data for the Inaxaplin → APOL1-MKD walkthrough,
 * mirroring the lite Visualize / Validate / Operations / Settings
 * pattern.
 *
 * The leaderboard reuses HeadlineLeaderboard with per-pair-flavoured
 * rows (different scores than the panel-wide methodology view); the
 * detailed-metrics card is custom-rendered from inline mock numbers
 * to avoid mocking the full DetailedMetricsPanel JobResult shape.
 */
const LITE_EXPERIMENT_LEADERBOARD: readonly LeaderboardRow[] = [
  {
    model: "Stacking ensemble (Pauli)",
    family: "hybrid",
    prAuc: 0.827,
    rocAuc: 0.811,
    deltaClassical: 0.018,
    isTop: true,
    params: "1.4k",
  },
  {
    model: "RandomForest-Optimized",
    family: "classical",
    prAuc: 0.812,
    rocAuc: 0.798,
    deltaClassical: 0.003,
    isTop: false,
    params: "612",
  },
  {
    model: "ExtraTrees-Optimized",
    family: "classical",
    prAuc: 0.804,
    rocAuc: 0.792,
    deltaClassical: -0.005,
    isTop: false,
    params: "624",
  },
  {
    model: "QSVC-Optimized (Pauli)",
    family: "quantum",
    prAuc: 0.781,
    rocAuc: 0.769,
    deltaClassical: -0.028,
    isTop: false,
    params: "n",
  },
  {
    model: "LogisticRegression",
    family: "classical",
    prAuc: 0.703,
    rocAuc: 0.691,
    deltaClassical: -0.106,
    isTop: false,
    params: "129",
  },
];

const LITE_EXPERIMENT_METRICS = {
  prAuc: 0.827,
  prAucCi: [0.798, 0.853] as const,
  rocAuc: 0.811,
  rocAucCi: [0.787, 0.834] as const,
  brier: 0.142,
  ece: 0.038,
  cvFolds: [0.812, 0.831, 0.836, 0.819, 0.836] as const,
};

function ExperimentLiteView() {
  const m = LITE_EXPERIMENT_METRICS;
  const cvMean = m.cvFolds.reduce((a, b) => a + b, 0) / m.cvFolds.length;
  const cvSpread = Math.max(...m.cvFolds) - Math.min(...m.cvFolds);

  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">02 · EXPERIMENT</div>
          <h1 className="h1">What this investigation produced</h1>
          <p className="lede">
            Inaxaplin → APOL1-mediated kidney disease, scored across five
            model families. The Stacking ensemble (Pauli feature map) is
            the top per-pair model at{" "}
            <strong style={{ color: "var(--ink)" }}>
              {m.prAuc.toFixed(3)}
            </strong>{" "}
            PR-AUC, with bootstrap 95% CI{" "}
            <strong style={{ color: "var(--ink)" }}>
              [{m.prAucCi[0].toFixed(3)}, {m.prAucCi[1].toFixed(3)}]
            </strong>
            . Headline mode shows the panel-wide preregistered comparison;
            this is the per-candidate view.
          </p>
        </div>
        <span
          className="pill"
          style={{ background: "var(--paper-alt)", color: "var(--gold)" }}
        >
          ● demo
        </span>
      </div>

      <HeadlineLeaderboard rows={LITE_EXPERIMENT_LEADERBOARD} />

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">TOOL · DETAILED METRICS</div>
            <div className="panel-title">
              Top model — full metric breakdown
            </div>
          </div>
          <span className="badge">Demo</span>
        </div>
        <p className="panel-purpose">
          Bootstrap confidence intervals, calibration error, and 5-fold
          cross-validation variance for the top model in this run. The
          full version pulls these from the live job result; the lite
          build serves the same structure with fixture numbers.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 14,
            margin: "12px 0 16px",
          }}
        >
          <MetricCell
            label="PR-AUC"
            value={m.prAuc.toFixed(3)}
            sub={`CI [${m.prAucCi[0].toFixed(3)}, ${m.prAucCi[1].toFixed(3)}]`}
          />
          <MetricCell
            label="ROC-AUC"
            value={m.rocAuc.toFixed(3)}
            sub={`CI [${m.rocAucCi[0].toFixed(3)}, ${m.rocAucCi[1].toFixed(3)}]`}
          />
          <MetricCell
            label="Brier"
            value={m.brier.toFixed(3)}
            sub="lower is better"
          />
          <MetricCell
            label="ECE"
            value={m.ece.toFixed(3)}
            sub="expected calibration error"
          />
          <MetricCell
            label="CV mean"
            value={cvMean.toFixed(3)}
            sub={`5-fold · spread ${cvSpread.toFixed(3)}`}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "flex-end",
            height: 56,
            marginBottom: 4,
          }}
          aria-label="Five-fold CV PR-AUC bars"
          role="img"
        >
          {m.cvFolds.map((v, i) => {
            const minH = 16;
            const maxH = 56;
            const lo = Math.min(...m.cvFolds);
            const hi = Math.max(...m.cvFolds);
            const span = Math.max(hi - lo, 0.001);
            const h = minH + ((v - lo) / span) * (maxH - minH);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: h,
                    background: "var(--gold)",
                    opacity: 0.85,
                    borderRadius: 2,
                  }}
                />
                <span
                  style={{
                    fontSize: 9.5,
                    color: "var(--muted)",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  f{i}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "var(--faint)",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          <span>5-fold CV · PR-AUC per fold</span>
          <span>
            min {Math.min(...m.cvFolds).toFixed(3)} · max{" "}
            {Math.max(...m.cvFolds).toFixed(3)}
          </span>
        </div>
      </section>

      <div className="footer-actions">
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/initialize">
            ⌥ Back to Initialize
          </Link>
        </div>
        <Link className="btn-primary" href="/validate">
          Validate this candidate →
        </Link>
      </div>
    </>
  );
}

function MetricCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      style={{
        background: "var(--paper-alt)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "var(--muted)",
          fontFamily: "var(--font-mono), monospace",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          color: "var(--ink)",
          fontWeight: 600,
          marginTop: 2,
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--faint)",
          marginTop: 2,
        }}
      >
        {sub}
      </div>
    </div>
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
