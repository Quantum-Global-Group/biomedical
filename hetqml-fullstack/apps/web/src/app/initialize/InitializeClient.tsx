"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CASCADE_ORDER,
  emptySelection,
  type FieldName,
  type Selection,
} from "@/lib/investigation/recommendations";
import { type RunPathChoice } from "@/lib/investigation/runPath";
import {
  ParameterCombobox,
  type ComboOption,
} from "@/components/investigation/ParameterCombobox";
import { RecommendationCard } from "@/components/investigation/RecommendationCard";
import { RunPathChooser } from "@/components/investigation/RunPathChooser";
import { CandidateContextPanel } from "@/components/initialize/CandidateContextPanel";
import { EvidencePosturePanel } from "@/components/initialize/EvidencePosturePanel";
import { HetionetStatsBadge } from "@/components/initialize/HetionetStatsBadge";
import { MiniKgPreview } from "@/components/initialize/MiniKgPreview";
import { SessionPanel } from "@/components/initialize/SessionPanel";
import { useCatalogs } from "@/lib/data/useCatalogs";
import { HETIONET_TOTALS } from "@/lib/data/hetionetTotals";
import type { InitialCatalogs } from "@/lib/data/fetchCatalogsServer";
import { getJob, startInvestigation, type Job } from "@/lib/api/client";
import type { StoredSession } from "@/lib/sessions/storage";
import { setLastJobId } from "@/lib/sessions/lastJob";
import { useVisiblePoll } from "@/lib/polling/useVisiblePoll";
import { isLiteMode } from "@/lib/liteMode";

const IS_LITE = isLiteMode();

const POLL_BASE_MS = 1000;
const POLL_MAX_MS = 8000;

export function InitializeClient({
  initialCatalogs,
}: {
  initialCatalogs?: InitialCatalogs;
}) {
  const [selection, setSelection] = useState<Selection>(emptySelection());
  const [runPath, setRunPath] = useState<RunPathChoice>({
    mode: "quick",
    family: "hybrid",
  });
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const catalogs = useCatalogs({ initial: initialCatalogs });

  const pollableJobId =
    job && (job.status === "queued" || job.status === "running")
      ? job.id
      : null;

  useVisiblePoll<Job>({
    enabled: pollableJobId,
    baseMs: POLL_BASE_MS,
    maxMs: POLL_MAX_MS,
    fetcher: async () => {
      const next = await getJob(pollableJobId!);
      setJob(next);
      return next;
    },
    isDone: (j) => j.status !== "queued" && j.status !== "running",
    isProgress: (prev, next) => !prev || prev.status !== next.status,
  });

  const diseaseOptions = useMemo<ComboOption[]>(
    () =>
      catalogs.diseases.map((d) => ({
        name: d.name,
        meta: { id: d.doid, category: d.category },
      })),
    [catalogs.diseases],
  );
  const compoundOptions = useMemo<ComboOption[]>(
    () =>
      catalogs.compounds.map((c) => ({
        name: c.name,
        meta: { id: c.drugbank, category: c.category },
      })),
    [catalogs.compounds],
  );
  const geneOptions = useMemo<ComboOption[]>(
    () =>
      catalogs.genes.map((g) => ({
        name: g.name,
        meta: { id: g.ncbi, category: g.category },
      })),
    [catalogs.genes],
  );
  const metaedgeOptions = useMemo<ComboOption[]>(
    () =>
      catalogs.metaedges.map((m) => ({
        name: m.name,
        meta: {
          id: `${m.edges.toLocaleString()} edges`,
          category: m.directed ? "directed" : "undirected",
        },
      })),
    [catalogs.metaedges],
  );

  const updateField = (field: FieldName, value: string) => {
    setSelection((prev) => {
      const idx = CASCADE_ORDER.indexOf(field);
      const next: Selection = { ...prev, [field]: value };
      if (idx >= 0) {
        for (let i = idx + 1; i < CASCADE_ORDER.length; i++) {
          const f = CASCADE_ORDER[i]!;
          next[f] = "";
        }
      }
      return next;
    });
  };

  const restoreSession = (snap: Pick<StoredSession, "selection" | "runPath">) => {
    setSelection(snap.selection);
    setRunPath(snap.runPath);
  };

  const allFilled = Object.values(selection).every((v) => v.length > 0);

  const handleRun = async () => {
    setSubmitting(true);
    setError(null);
    setJob(null);
    try {
      const created = await startInvestigation({ selection, runPath });
      setJob(created);
      setLastJobId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid-7-5">
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">TOOL · INVESTIGATION PARAMETERS</div>
              <div className="panel-title">What you&apos;re investigating</div>
            </div>
            <span className="badge">Form</span>
          </div>
          <p className="panel-purpose">
            The disease, compound, anchor target, and Hetionet relation. These
            four selections define the prediction task and what evidence will
            count.
          </p>
          <div className="field-grid">
            <ParameterCombobox
              field="disease"
              label="Disease"
              placeholder="Search diseases (DOID)…"
              options={diseaseOptions}
              value={selection.disease}
              selection={selection}
              onChange={(v) => updateField("disease", v)}
              totalInHetionet={HETIONET_TOTALS.diseases}
            />
            <ParameterCombobox
              field="compound"
              label="Compound"
              placeholder="Search compounds (DrugBank)…"
              lockedPlaceholder="Select a disease first…"
              options={compoundOptions}
              value={selection.compound}
              selection={selection}
              onChange={(v) => updateField("compound", v)}
              totalInHetionet={HETIONET_TOTALS.compounds}
            />
            <ParameterCombobox
              field="gene"
              label="Anchor target (gene)"
              placeholder="Search genes (NCBI / HGNC)…"
              lockedPlaceholder="Select disease and compound first…"
              options={geneOptions}
              value={selection.gene}
              selection={selection}
              onChange={(v) => updateField("gene", v)}
              totalInHetionet={HETIONET_TOTALS.genes}
            />
            <ParameterCombobox
              field="metaedge"
              label="Hetionet metaedge"
              placeholder="Choose a Hetionet metaedge type…"
              lockedPlaceholder="Select disease, compound, and gene first…"
              options={metaedgeOptions}
              value={selection.metaedge}
              selection={selection}
              onChange={(v) => updateField("metaedge", v)}
              totalInHetionet={HETIONET_TOTALS.metaedges}
            />
          </div>
          <HetionetStatsBadge state={catalogs} />
          <RecommendationCard
            embedded
            selection={selection}
            onApplyField={(field, value) => updateField(field, value)}
          />
        </section>
        <CandidateContextPanel selection={selection} runPath={runPath} />
      </div>

      <div className="grid-7-5">
        <RunPathChooser
          choice={runPath}
          onChange={setRunPath}
          catalog={catalogs.algorithms}
        />
        <MiniKgPreview selection={selection} />
      </div>

      <div className="grid-7-5">
        <EvidencePosturePanel lite={IS_LITE} />
        <SessionPanel
          selection={selection}
          runPath={runPath}
          onRestore={restoreSession}
        />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">
              {IS_LITE ? "RUN · DEMO" : "RUN · FASTAPI"}
            </div>
            <div className="panel-title">
              {IS_LITE ? "Walk to Experiment" : "Execute investigation job"}
            </div>
          </div>
          <span className="badge">{IS_LITE ? "Demo" : "API"}</span>
        </div>
        <p className="panel-purpose">
          {IS_LITE ? (
            <>
              This static demo doesn&apos;t run real jobs — there&apos;s no
              FastAPI behind it. The full version posts your selections to{" "}
              <code>/investigations/run</code> and polls{" "}
              <code>/jobs/&lt;id&gt;</code> until completion. To see what
              an experiment readout looks like, jump straight to the{" "}
              <strong>Experiment</strong> page.
            </>
          ) : (
            <>
              Posts to <code>/investigations/run</code> on the FastAPI service
              and polls <code>/jobs/&lt;id&gt;</code> until the job completes.
            </>
          )}
        </p>
        <div className="footer-actions" style={{ marginTop: 0, paddingTop: 0, border: "none" }}>
          <div />
          {IS_LITE ? (
            <Link className="btn-primary" href="/experiment">
              Open demo experiment →
            </Link>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={!allFilled || submitting}
              onClick={handleRun}
            >
              {submitting ? "Submitting…" : "Run investigation"}
            </button>
          )}
        </div>
        {error ? (
          <div className="skeptic-warning" style={{ marginTop: 14 }}>
            {error}
          </div>
        ) : null}
        {job ? <JobView job={job} /> : null}
      </section>

      {IS_LITE ? null : <div className="how-to">
        <div className="how-to-h">⊙ HOW TO READ THIS PAGE</div>
        <div className="how-to-title">What this view answers — and what to question</div>
        <p className="how-lede">
          The Initialize page is six tools stacked into a contract. Read top-to-bottom:{" "}
          <strong>investigation parameters</strong> define what you&apos;re asking,{" "}
          <strong>candidate context</strong> says why this compound is worth asking about,{" "}
          <strong>run path</strong> determines which algorithms execute,{" "}
          <strong>live KG preview</strong> shows what the model will see before compute,{" "}
          <strong>evidence posture</strong> guarantees the integrity guards are on, and{" "}
          <strong>session</strong> persists the snapshot so the contract is reproducible.
        </p>
        <div className="how-quick-stats">
          <div className="how-quick-stat">
            <div className="how-quick-stat-num">22,634</div>
            <div className="how-quick-stat-label">hetionet entities</div>
          </div>
          <div className="how-quick-stat">
            <div className="how-quick-stat-num">24</div>
            <div className="how-quick-stat-label">metaedges</div>
          </div>
          <div className="how-quick-stat">
            <div className="how-quick-stat-num">32</div>
            <div className="how-quick-stat-label">algorithms (catalog)</div>
          </div>
          <div className="how-quick-stat">
            <div className="how-quick-stat-num">3</div>
            <div className="how-quick-stat-label">run presets</div>
          </div>
          <div className="how-quick-stat">
            <div className="how-quick-stat-num">7</div>
            <div className="how-quick-stat-label">algo groups</div>
          </div>
          <div className="how-quick-stat">
            <div className="how-quick-stat-num">6</div>
            <div className="how-quick-stat-label">tools on page</div>
          </div>
        </div>
      </div>}

      <div className="footer-actions">
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/visualize">
            ⌥ Visualize evidence
          </Link>
          <Link className="btn" href="/operations">
            ⌥ Check operations
          </Link>
        </div>
        <Link className="btn-primary" href="/experiment">
          Open Experiment →
        </Link>
      </div>
    </>
  );
}

function JobView({ job }: { job: Job }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div className="eyebrow">JOB {job.id.slice(0, 8)}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Created {new Date(job.createdAt).toLocaleTimeString()}
          </div>
        </div>
        <span className="pill" style={{ textTransform: "lowercase" }}>
          {job.status}
        </span>
      </div>

      {job.metrics ? (
        <div className="metrics" style={{ marginTop: 12 }}>
          <div className="metric">
            <div className="metric-label">PR-AUC</div>
            <div className="metric-value teal">
              {job.metrics.prAuc.toFixed(3)}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">ROC-AUC</div>
            <div className="metric-value teal">
              {job.metrics.rocAuc.toFixed(3)}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Brier</div>
            <div className="metric-value">{job.metrics.brier.toFixed(3)}</div>
          </div>
          <div className="metric">
            <div className="metric-label">ECE</div>
            <div className="metric-value">{job.metrics.ece.toFixed(3)}</div>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--muted)", marginTop: 10 }}>
          {job.status === "queued" ? "Queued…" : "Running…"}
        </p>
      )}

      {job.error ? (
        <div style={{ marginTop: 10, color: "var(--sienna)" }}>{job.error}</div>
      ) : null}
    </div>
  );
}
