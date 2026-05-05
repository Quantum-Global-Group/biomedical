"use client";

import Link from "next/link";
import { DecisionHistory } from "@/components/validate/DecisionHistory";
import { HeadlineTrustScorecard } from "@/components/validate/HeadlineTrustScorecard";
import { MetricStrip } from "@/components/validate/MetricStrip";
import { ReliabilityDiagram } from "@/components/validate/ReliabilityDiagram";
import { ReviewerDecisionPanel } from "@/components/validate/ReviewerDecisionPanel";
import { SkepticNotesEditor } from "@/components/validate/SkepticNotesEditor";
import { SkepticView } from "@/components/validate/SkepticView";
import { TrustRadar } from "@/components/validate/TrustRadar";
import { useDashboardMode } from "@/lib/dashboardMode/DashboardModeProvider";
import { useValidate } from "@/lib/validate/useValidate";
import type { Job } from "@/lib/api/client";

interface ValidateClientProps {
  /** jobId resolved from `?jobId=` on the server. localStorage fallback
   * still happens client-side when this is null. */
  jobIdFromUrl?: string | null;
  /** Job hydrated server-side when `jobIdFromUrl` was set. */
  initialJob?: Job | null;
}

/**
 * Validate-page orchestrator. Mirrors `ExperimentClient` for job
 * resolution + polling, then forks into the validate-specific panels:
 *
 *   - MetricStrip: candidate · model · trust · decision
 *   - TrustRadar: 5-axis polygon vs threshold
 *   - ReliabilityDiagram: 10-bin calibration + summary
 *   - ReviewerDecisionPanel + SkepticNotesEditor + SkepticView (grid-2)
 *   - DecisionHistory: last 50 decisions, click-to-focus pair
 */
export function ValidateClient({
  jobIdFromUrl = null,
  initialJob = null,
}: ValidateClientProps = {}) {
  // All hooks run unconditionally before any early return — Rules-of-Hooks.
  // Same pattern as ExperimentClient: hydrate-aware mode-switch happens
  // after the hook calls so a mid-session toggle can't change the hook
  // count between renders.
  const { mode, hydrated } = useDashboardMode();
  const v = useValidate({ initialJobId: jobIdFromUrl, initialJob });

  // Headline mode is decoupled from any specific candidate / job — render
  // the methodology view (preregistered Trust Scorecard with § citations)
  // regardless of jobId. Wait for hydration so we don't flash demo first.
  if (hydrated && mode === "headline") {
    return <HeadlineValidateView />;
  }

  if (v.phase === "no-job") return <EmptyState />;

  if (v.phase === "loading" && !v.job) {
    return (
      <div className="panel">
        <p className="panel-purpose">
          Loading job {v.jobId ? v.jobId.slice(0, 8) : "…"}…
        </p>
      </div>
    );
  }

  if (v.phase === "failed" && !v.job) {
    return (
      <div className="panel">
        <div className="skeptic-warning">
          <span style={{ color: "var(--sienna)" }}>⚠</span>
          <span>{v.jobError ?? "Job did not complete successfully."}</span>
        </div>
        <Link className="btn" href="/initialize" style={{ marginTop: 16 }}>
          ← Back to Initialize
        </Link>
      </div>
    );
  }

  if (!v.job) return <EmptyState />;

  if (v.phase === "running") {
    return (
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">JOB {v.job.id.slice(0, 8)}</div>
            <div className="panel-title">Running…</div>
          </div>
          <span className="pill">{v.job.status}</span>
        </div>
        <p className="panel-purpose">
          The investigation is still running. Validate populates once the job
          finishes (typically a few seconds for the synthetic pipeline).
        </p>
      </div>
    );
  }

  if (v.phase === "failed" || !v.job.result) {
    return (
      <div className="panel">
        <div className="skeptic-warning">
          <span style={{ color: "var(--sienna)" }}>⚠</span>
          <span>{v.job.error ?? "Job did not complete successfully."}</span>
        </div>
        <Link className="btn" href="/initialize" style={{ marginTop: 16 }}>
          ← Back to Initialize
        </Link>
      </div>
    );
  }

  const job = v.job;
  const result = job.result;
  if (!result) return <EmptyState />;
  const pairKey = v.pairKey ?? `${job.selection.compound}::${job.selection.disease}`;
  const latestDecisionForPair = v.pairDecisions[0] ?? null;
  const trustPct = Math.round(result.trustScorecard.composite * 100);
  const heroPillStyle = latestDecisionForPair
    ? latestDecisionForPair.verdict === "keep"
      ? { background: "var(--green-bg)", color: "var(--green)" }
      : latestDecisionForPair.verdict === "reject"
        ? { background: "var(--sienna-bg)", color: "var(--sienna)" }
        : { background: "var(--amber-bg)", color: "var(--amber)" }
    : { background: "var(--amber-bg)", color: "var(--amber)" };
  const heroPillLabel = latestDecisionForPair
    ? `● ${latestDecisionForPair.verdict} logged`
    : "● awaiting reviewer decision";

  const topRow = result.leaderboard.find((r) => r.isTop);
  const topModel = topRow?.model ?? "—";
  const modelScore = topRow?.prAuc ?? result.metrics.prAuc;

  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">03 · VALIDATE</div>
          <h1 className="h1">Decide whether to trust this candidate</h1>
          <p className="lede">
            A high model score is not evidence. The selected candidate{" "}
            <strong style={{ color: "var(--ink)" }}>
              {job.selection.compound}
            </strong>{" "}
            against{" "}
            <strong style={{ color: "var(--ink)" }}>
              {job.selection.disease}
            </strong>{" "}
            earned{" "}
            <strong style={{ color: "var(--ink)" }}>
              {modelScore.toFixed(3)}
            </strong>{" "}
            from{" "}
            <strong style={{ color: "var(--ink)" }}>{topModel}</strong>; this
            page splits that score into five independently-sourced axes,
            surfaces what could weaken the candidate, and logs your decision.
            Composite trust:{" "}
            <strong style={{ color: "var(--ink)" }}>{trustPct}/100</strong>.
          </p>
        </div>
        <span className="pill" style={heroPillStyle}>
          {heroPillLabel}
        </span>
      </div>

      <MetricStrip job={job} latestDecision={latestDecisionForPair} />

      <TrustRadar scorecard={result.trustScorecard} />

      <ReliabilityDiagram reliability={result.reliability} />

      <div className="grid-2">
        <ReviewerDecisionPanel
          pairKey={pairKey}
          pending={v.decisionPending}
          latestDecision={latestDecisionForPair}
          error={v.decisionsError}
          onSubmit={(verdict) => void v.submitDecision(verdict)}
        />

        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">TOOL · SKEPTIC VIEW</div>
              <div className="panel-title">
                What could weaken this candidate
              </div>
            </div>
            <span className="badge">Critique</span>
          </div>
          <div className="panel-purpose">
            The points here exist to be argued against. If you can answer all
            three with new evidence, your case is stronger than the score alone
            suggests.
          </div>
          <SkepticView warnings={result.skepticWarnings} />
          <SkepticNotesEditor
            pairKey={pairKey}
            body={v.noteBody}
            state={v.noteState}
            loaded={v.noteLoaded}
            savedAt={v.noteSavedAt}
            error={v.noteError}
            onChange={v.setNoteBody}
          />
        </section>
      </div>

      <DecisionHistory
        decisions={v.recentDecisions}
        activePairKey={v.pairKey}
        onSelect={v.selectPair}
        error={v.decisionsError}
      />

      <div className="how-to">
        <div className="how-to-h">⊙ HOW TO READ THIS PAGE</div>
        <div className="how-to-title">
          What this view answers — and what to question
        </div>
        <p className="how-lede">
          Validate splits the model score into{" "}
          <strong>five independently-sourced axes</strong> and asks you to
          commit. The radar lets you see at a glance which axis is the weakest;
          the skeptic view writes the counter-argument; the decision panel logs
          your call with full provenance for audit.
        </p>
      </div>

      <div className="footer-actions">
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/experiment">
            ⌥ Back to Experiment
          </Link>
        </div>
        <Link className="btn-primary" href="/visualize">
          Visualize evidence →
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
          <div className="step">03 · VALIDATE</div>
          <h1 className="h1">No active investigation</h1>
          <p className="lede">
            Validate splits a candidate&apos;s model score into five axes, asks
            you to question each one, and logs your keep/review/reject call for
            audit. Start an investigation on Initialize to populate this page.
          </p>
        </div>
        <span className="pill">○ idle</span>
      </div>
      <div className="panel">
        <p className="panel-purpose">
          No <code>jobId</code> in the URL and no recent investigation in local
          storage. Head to Initialize, fill the four parameters, pick a run
          path, and press <strong>Run investigation</strong>.
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
 * Headline-mode Validate view. No specific candidate — this is the
 * methodology Trust Scorecard with preregistration § citations on every
 * axis, plus a status panel pointing reviewers at the locked
 * preregistration / reproducibility artifacts.
 *
 * Demo-only sections (per-pair MetricStrip, ReliabilityDiagram,
 * ReviewerDecisionPanel, SkepticNotesEditor, DecisionHistory) are
 * intentionally omitted — they assume a per-candidate score and decision.
 */
function HeadlineValidateView() {
  return (
    <>
      <div className="page-hero">
        <div>
          <div className="step">03 · VALIDATE (HEADLINE)</div>
          <h1 className="h1">Trust the methodology, not (yet) any one pair</h1>
          <p className="lede">
            Headline mode replaces the per-pair Keep/Review/Reject ritual with
            a citation-grounded view of the methodology itself — five axes, the
            three that apply to a panel-wide study (Model, Baseline, Artifact)
            anchored to specific OSF preregistration sections. Per-candidate
            decisions resume in demo mode or once the GPU bootstrap-CI run
            populates{" "}
            <code>docs/results/bootstrap_ci_analysis.md</code>.
          </p>
        </div>
        <span
          className="pill"
          style={{ background: "var(--paper-alt)", color: "var(--gold)" }}
        >
          ● locked methodology · CIs pending
        </span>
      </div>

      <HeadlineTrustScorecard />

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">REPRODUCIBILITY · §3.1 · §9.4</div>
            <div className="panel-title">Locked artifacts pointing at this view</div>
          </div>
          <span className="badge">Reference</span>
        </div>
        <p className="panel-purpose">
          Every claim in headline mode resolves to a versioned artifact in
          the sibling <code>hybrid-qml-kg-poc</code> repo. Reviewers can
          cross-check the methodology without trusting the dashboard&rsquo;s
          rendering of it.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, max-content) 1fr",
            rowGap: 6,
            columnGap: 24,
            marginTop: 12,
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--muted, #B8AFA5)",
          }}
        >
          <ArtifactRow
            label="Preregistration"
            value="preregistration/osf_preregistration_v1.md §1.3 · §8.1"
          />
          <ArtifactRow
            label="Locked constants"
            value="utils/preregistered_constants.py (BOOTSTRAP_SEED 20260504, PauliFeatureMap reps=2, ...)"
          />
          <ArtifactRow
            label="Hetionet snapshot"
            value="docs/reproducibility/hetionet_snapshot.md (SHA-256, mtime, file sizes)"
          />
          <ArtifactRow
            label="Bootstrap CI helper"
            value="utils/bootstrap_ci.py (paired_bootstrap_pr_auc_difference, conjunction_across_baselines)"
          />
          <ArtifactRow
            label="Driver"
            value="scripts/run_bootstrap_ci.py (locked headline config — RotatE 128D, hard negatives, 5-fold CV)"
          />
          <ArtifactRow
            label="Headline output (pending)"
            value="docs/results/bootstrap_ci_analysis.md (emitted by the GPU run)"
          />
        </div>
        <div className="panel-footer">
          <span>preregistration/osf_preregistration_v1.md §9</span>
          <span>
            <em>open-source release at submission · MIT licensed</em>
          </span>
        </div>
      </section>

      <div className="footer-actions">
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/initialize">
            ← Re-Initialize (demo)
          </Link>
          <Link className="btn" href="/experiment">
            ⌥ Back to Experiment
          </Link>
        </div>
        <Link className="btn-primary" href="/visualize">
          Visualize evidence →
        </Link>
      </div>
    </>
  );
}

function ArtifactRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span style={{ color: "var(--faint, #857D75)" }}>{label}</span>
      <code
        style={{
          color: "var(--ink, #E8E0D6)",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 12,
        }}
      >
        {value}
      </code>
    </>
  );
}
