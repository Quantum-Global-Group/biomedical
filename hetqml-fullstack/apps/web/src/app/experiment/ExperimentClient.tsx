"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getJob, type Job } from "@/lib/api/client";
import { deriveLede } from "@/lib/experiment/selectors";
import { getLastJobId } from "@/lib/sessions/lastJob";
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
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
