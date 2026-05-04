"use client";

import { COMPOUNDS } from "@/lib/data/compounds";
import type { Selection } from "@/lib/investigation/recommendations";
import { getRunPathSelection, type RunPathChoice } from "@/lib/investigation/runPath";

const COMPOUND_BLURBS: Record<string, string> = {
  Inaxaplin:
    "First-in-class APOL1 inhibitor in Phase III for APOL1-mediated kidney disease. Connects HTN-attributed ESKD, lupus nephritis, and sickle cell nephropathy via the APOL1 G1/G2 risk genotype enriched in African ancestry.",
};

interface Props {
  selection: Selection;
  runPath: RunPathChoice;
}

export function CandidateContextPanel({ selection, runPath }: Props) {
  const compound = COMPOUNDS.find((c) => c.name === selection.compound);
  const title = selection.compound || "— choose a compound —";
  const blurb =
    (selection.compound && COMPOUND_BLURBS[selection.compound]) ||
    "Select a compound in the investigation parameters to populate mechanism, anchor target, and clinical evidence backdrop.";
  const path = getRunPathSelection(runPath).family.id;

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
            {selection.gene ? (
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
      </div>
    </section>
  );
}
