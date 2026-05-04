"use client";

import { useMemo, useState } from "react";

type GuardLevel = "critical" | "recommended" | "optional";

interface GuardDef {
  id: string;
  name: string;
  level: GuardLevel;
  description: string;
  impact: string;
  source: string;
}

interface GuardGroupDef {
  id: string;
  name: string;
  guards: GuardDef[];
}

const GROUPS: GuardGroupDef[] = [
  {
    id: "bias",
    name: "Bias / equity",
    guards: [
      {
        id: "ancestry",
        name: "Ancestry parity gate",
        level: "critical",
        description:
          "Requires balanced representation checks before reporting effect sizes.",
        impact: "Downstream calibration plots may read optimistic if disabled.",
        source: "policy/equity-v1",
      },
      {
        id: "label",
        name: "Label leakage sweep",
        level: "recommended",
        description:
          "Scans compound-disease pairs for temporal leakage in labels.",
        impact: "May flag historically contaminated negatives.",
        source: "feat/label-audit",
      },
    ],
  },
  {
    id: "quantum",
    name: "Quantum integrity",
    guards: [
      {
        id: "shots",
        name: "Shots accounting",
        level: "critical",
        description: "Persists IBM job ids + shot budgets per model call.",
        impact: "Hardware claims become unauditable if turned off.",
        source: "ibm/shots-v2",
      },
      {
        id: "transpile",
        name: "Transpile fidelity floor",
        level: "optional",
        description: "Blocks runs when transpile error exceeds threshold.",
        impact: "May prevent marginal circuits from executing.",
        source: "transpile/guard",
      },
    ],
  },
  {
    id: "kg",
    name: "KG provenance",
    guards: [
      {
        id: "version",
        name: "Hetionet version pin",
        level: "critical",
        description: "Freezes KG build id used for DWPC and embeddings.",
        impact: "Reproducibility hash changes if disabled.",
        source: "data/hetionet-v1.0",
      },
    ],
  },
];

function levelPill(level: GuardLevel) {
  return `guard-level-pill ${level}`;
}

type PostureFilter = "all" | "critical" | "recommended" | "optional" | "off";

export function EvidencePosturePanel() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const e: Record<string, boolean> = {};
    for (const g of GROUPS) e[g.id] = true;
    return e;
  });
  const [on, setOn] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const g of GROUPS) {
      for (const x of g.guards) {
        m[x.id] = x.level !== "optional";
      }
    }
    return m;
  });
  const [postureFilter, setPostureFilter] = useState<PostureFilter>("all");

  const stats = useMemo(() => {
    const all = GROUPS.flatMap((g) => g.guards);
    const total = all.length;
    const enabled = all.filter((g) => on[g.id]).length;
    const critical = all.filter((g) => g.level === "critical");
    const critOn = critical.filter((g) => on[g.id]).length;
    const critOff = critical.length - critOn;
    return {
      total,
      enabled,
      criticalOn: critOn,
      criticalOff: critOff,
      passing: critOff === 0,
    };
  }, [on]);

  const filterGuards = (g: GuardDef) => {
    const isOn = on[g.id];
    if (postureFilter === "all") return true;
    if (postureFilter === "critical") return g.level === "critical";
    if (postureFilter === "recommended") return g.level === "recommended";
    if (postureFilter === "optional") return g.level === "optional";
    if (postureFilter === "off") return !isOn;
    return true;
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · EVIDENCE POSTURE</div>
          <div className="panel-title">Integrity guards</div>
        </div>
        <span className="badge">Reference</span>
      </div>
      <p className="panel-purpose">
        Every switch that governs an evidence claim downstream. State is
        inspectable — running with any critical guard off produces a different
        kind of result and must be visible to anyone reading a report.
      </p>

      <div className="posture-summary">
        <div className="posture-stat">
          <div className="posture-stat-num green">
            {stats.enabled}/{stats.total}
          </div>
          <div className="posture-stat-label">guards enabled</div>
        </div>
        <div className="posture-stat">
          <div className="posture-stat-num green">
            {stats.criticalOn}/{GROUPS.flatMap((g) => g.guards).filter((x) => x.level === "critical").length}
          </div>
          <div className="posture-stat-label">critical on</div>
        </div>
        <div className="posture-stat">
          <div
            className={`posture-stat-num${stats.criticalOff ? " sienna" : ""}`}
          >
            {stats.criticalOff}
          </div>
          <div className="posture-stat-label">critical off</div>
        </div>
        <div className="posture-stat">
          <div
            className="posture-stat-num green"
            style={{ fontFamily: "inherit", fontSize: 14, paddingTop: 6 }}
          >
            {stats.passing ? "PASSING" : "REVIEW"}
          </div>
          <div className="posture-stat-label">posture status</div>
        </div>
      </div>

      <div className="posture-filter-row">
        {(
          [
            "all",
            "critical",
            "recommended",
            "optional",
            "off",
          ] as PostureFilter[]
        ).map((p) => (
          <span
            key={p}
            className={`posture-filter-pill${postureFilter === p ? " active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => setPostureFilter(p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setPostureFilter(p);
            }}
          >
            {p}
          </span>
        ))}
      </div>

      {GROUPS.map((group) => (
        <div
          key={group.id}
          className={`guard-group${expanded[group.id] ? " expanded" : ""}`}
        >
          <div
            className="guard-group-head"
            role="button"
            tabIndex={0}
            onClick={() =>
              setExpanded((s) => ({ ...s, [group.id]: !s[group.id] }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                setExpanded((s) => ({ ...s, [group.id]: !s[group.id] }));
            }}
          >
            <div className="guard-group-name">
              <span className="guard-group-chev">▶</span>
              {group.name}
            </div>
            <div className="guard-group-meta">
              <span className="on-count">
                {group.guards.filter((g) => on[g.id]).length} on
              </span>
              <span className="off-count">
                {group.guards.filter((g) => !on[g.id]).length} off
              </span>
            </div>
          </div>
          <div className="guard-group-body">
            {group.guards.filter(filterGuards).map((g) => {
              const rowOn = on[g.id];
              const rowClass = `guard-row${rowOn ? " on" : " off"}${g.level === "critical" && !rowOn ? " off-critical" : ""}`;
              return (
                <div key={g.id} className={rowClass}>
                  <button
                    type="button"
                    className="guard-toggle"
                    aria-label={`toggle ${g.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOn((m) => ({ ...m, [g.id]: !m[g.id] }));
                    }}
                  />
                  <div className="guard-content">
                    <div className="guard-name-row">
                      <span className="guard-name">{g.name}</span>
                      <span className={levelPill(g.level)}>{g.level}</span>
                    </div>
                    <div className="guard-desc">{g.description}</div>
                    <div className="guard-impact">{g.impact}</div>
                  </div>
                  <span className="guard-source">{g.source}</span>
                  <span className={`guard-status-text${rowOn ? " on" : " off"}`}>
                    {rowOn ? "on" : "off"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
