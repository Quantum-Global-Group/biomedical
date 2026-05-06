"use client";

import { COMPOUNDS } from "@/lib/data/compounds";
import {
  getCompoundContext,
  type ApprovalState,
} from "@/lib/data/compoundContext";
import type { Selection } from "@/lib/investigation/recommendations";
import { getRunPathSelection, type RunPathChoice } from "@/lib/investigation/runPath";

interface Props {
  selection: Selection;
  runPath: RunPathChoice;
}

function approvalClass(a: ApprovalState): string {
  if (a.kind === "approved") return "approval-trial approved";
  if (a.kind === "investigational") return "approval-trial";
  return "approval-trial experimental";
}

export function CandidateContextPanel({ selection, runPath }: Props) {
  const compound = COMPOUNDS.find((c) => c.name === selection.compound);
  const ctx = getCompoundContext(selection.compound);
  const title = selection.compound || "— choose a compound —";
  const path = getRunPathSelection(runPath).family.id;

  // Placeholder copy when no compound has been picked yet.
  const placeholderBlurb =
    "Select a compound in the investigation parameters to populate mechanism, anchor target, and clinical evidence backdrop.";
  // Derived (non-curated) compounds get a generic copy keyed on the
  // base Hetionet record fields rather than a hand-written blurb.
  const derivedBlurb = compound
    ? `${compound.name} is a ${compound.category} compound (DrugBank ${compound.drugbank}). Curated mechanism, indications, and equity notes are not yet available — fields below derive from the Hetionet base record.`
    : placeholderBlurb;
  const blurb = ctx?.description ?? derivedBlurb;
  const origin = ctx?.origin ?? "derived";

  return (
    <section className="panel" id="candidatePanel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · CANDIDATE CONTEXT</div>
          <div className="panel-title" id="ctx-title">
            {title}
          </div>
          <div className="ctx-tags" id="ctx-tags">
            {compound ? (
              <>
                <span className="ctx-tag id">{compound.drugbank}</span>
                <span className="ctx-tag cat">{compound.category}</span>
              </>
            ) : null}
            {ctx ? (
              <span className="ctx-tag mech">{ctx.mechanism}</span>
            ) : selection.gene ? (
              <span className="ctx-tag mech">anchor: {selection.gene}</span>
            ) : null}
          </div>
        </div>
        <span className="badge">Reference</span>
      </div>
      <p className="panel-purpose">
        Why this compound is on the table — mechanism, anchor target, and
        clinical evidence backdrop. Switch the candidate to refresh.
      </p>
      <div className="ctx-content">
        <div className="ctx-section">
          <div className="ctx-section-h">DESCRIPTION</div>
          <p className="ctx-description">{blurb}</p>
        </div>

        {ctx ? (
          <div className="ctx-section">
            <div className="ctx-section-h">KEY PROPERTIES</div>
            <div className="ctx-row-rich">
              <span className="label">Primary target</span>
              <span className="val">
                <span className="pill target">{ctx.primaryTarget}</span>
              </span>
            </div>
            <div className="ctx-row-rich">
              <span className="label">Approval</span>
              <span className="val">
                <span className={approvalClass(ctx.approval)}>
                  {ctx.approval.label}
                </span>
              </span>
            </div>
            <div className="ctx-row-rich">
              <span className="label">Indications</span>
              <span className="val">
                {ctx.indications.map((ind) => (
                  <span key={ind} className="pill" style={{ marginRight: 6 }}>
                    {ind}
                  </span>
                ))}
              </span>
            </div>
            <div className="ctx-row-rich">
              <span className="label">Active trials</span>
              <span className="val">
                {ctx.activeTrials.map((t) => (
                  <span key={t} className="pill" style={{ marginRight: 6 }}>
                    {t}
                  </span>
                ))}
              </span>
            </div>
            <div className="ctx-row-rich">
              <span className="label">Repurposing</span>
              <span className="val">{ctx.repurposing}</span>
            </div>
          </div>
        ) : null}

        <div className="ctx-section">
          <div className="ctx-section-h">ANCHOR &amp; TASK</div>
          <div className="ctx-row-rich">
            <span className="label">disease</span>
            <span className="val">
              {selection.disease || (
                <span className="empty">not set</span>
              )}
            </span>
          </div>
          <div className="ctx-row-rich">
            <span className="label">metaedge</span>
            <span className="val">
              {selection.metaedge || (
                <span className="empty">not set</span>
              )}
            </span>
          </div>
          <div className="ctx-row-rich">
            <span className="label">run path</span>
            <span className="val">
              <span className="pill path">{path}</span>
            </span>
          </div>
        </div>

        {ctx?.equityNote ? (
          <div className="ctx-section ctx-equity-section" id="ctx-equity-section">
            <div className="ctx-section-h sienna">EQUITY / ANCESTRY NOTE</div>
            <p className="ctx-equity" id="ctx-equity">
              {ctx.equityNote}
            </p>
          </div>
        ) : null}
      </div>

      <div className="panel-footer ctx-footer">
        <span>{ctx?.sources ?? "hetionet base record"}</span>
        <span id="ctx-source-note">
          <em>{origin}</em>
        </span>
      </div>
    </section>
  );
}
