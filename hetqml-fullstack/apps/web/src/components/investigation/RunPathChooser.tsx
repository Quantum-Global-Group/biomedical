"use client";

import {
  RUN_PATH_FAMILIES,
  getRunPathSelection,
  type RunFamilyId,
  type RunPathChoice,
} from "@/lib/investigation/runPath";
import { AlgorithmCatalog } from "@/components/initialize/AlgorithmCatalog";

interface Props {
  choice: RunPathChoice;
  onChange: (next: RunPathChoice) => void;
}

const CARD_UI: Record<
  RunFamilyId,
  { icon: string; sub: string; algo: string; time: string; detail: string }
> = {
  classical: {
    icon: "▢",
    sub: "Stacking · GBDT · KGE",
    algo: "8 algorithms",
    time: "~50s · CPU",
    detail: "straightforward baseline run",
  },
  hybrid: {
    icon: "⌥",
    sub: "QSVC · VQC + baselines",
    algo: "3 + 8 baselines",
    time: "~2m · mixed",
    detail: "straightforward parameter-efficient run",
  },
  quantum: {
    icon: "⊗",
    sub: "QAOA · VQE + baselines",
    algo: "2 + 8 baselines",
    time: "~4m · 18k shots",
    detail: "straightforward hardware-validated run",
  },
};

function cardTitle(id: RunFamilyId, label: string) {
  if (id === "quantum") return "Quantum HW";
  return label;
}

export function RunPathChooser({ choice, onChange }: Props) {
  const sel = getRunPathSelection(choice);
  const activeFamily = sel.family.id;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · RUN PATH</div>
          <div className="panel-title">How the investigation runs</div>
        </div>
        <span className="badge">Selector</span>
      </div>
      <p className="panel-purpose">
        <strong>Pick a preset bundle below.</strong> Each card runs the canonical
        set of algorithms for its category — click and the run is configured.
        Classical baselines always run alongside quantum / hybrid for direct
        comparison. For drill-down or per-algorithm customization, use the{" "}
        <em>Algorithm Catalog</em> below.
      </p>

      <div className="run-path-grid">
        {RUN_PATH_FAMILIES.map((fam) => {
          const ui = CARD_UI[fam.id];
          const isActive = activeFamily === fam.id;
          return (
            <div
              key={fam.id}
              className={`run-path${isActive ? " active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() =>
                onChange({
                  ...choice,
                  mode: choice.mode ?? "quick",
                  family: fam.id,
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  onChange({
                    ...choice,
                    mode: choice.mode ?? "quick",
                    family: fam.id,
                  });
              }}
            >
              <div className="run-path-icon">{ui.icon}</div>
              <div className="run-path-title">
                {cardTitle(fam.id, fam.label)}
              </div>
              <div className="run-path-sub">{ui.sub}</div>
              <div className="run-path-stats">
                <span className="run-path-algo-count">{ui.algo}</span>
                <span>{ui.time}</span>
              </div>
              <div className="run-path-detail">{ui.detail}</div>
            </div>
          );
        })}
      </div>

      <AlgorithmCatalog selectedFamily={activeFamily} />

      <div className="panel-footer">
        <span>
          compute_router :: {activeFamily}
        </span>
        <span>
          <em>cost shown is estimated</em>
        </span>
      </div>
    </section>
  );
}
