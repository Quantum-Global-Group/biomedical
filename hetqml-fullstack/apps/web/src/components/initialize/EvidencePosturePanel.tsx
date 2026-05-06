"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type GuardCatalogEntry,
  type GuardLevel,
  levelFor,
} from "@/lib/integrity/guardCatalog";
import {
  togglesContentFingerprint,
  writeGuardState,
} from "@/lib/integrity/guardState";
import { useIntegrityGuards } from "@/lib/integrity/useIntegrityGuards";

function levelPill(level: GuardLevel) {
  return `guard-level-pill ${level}`;
}

/** Deep boolean equality across key union — used when syncing `liveToggles`
 * into local state without forcing a new object when values match. */
function guardToggleRecordsEqual(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

type PostureFilter = "all" | "critical" | "recommended" | "optional" | "off";

interface EvidencePosturePanelProps {
  /** Lite (HF Space) layout — keeps the summary stats and a flat list
   * of just the critical guards (read-only), drops the filter row,
   * group accordions, and the rest of the per-guard toggles. The full
   * version stays the source of truth for integrity-guard state. */
  lite?: boolean;
}

/**
 * Initialize · Evidence posture — the source of truth for integrity-guard
 * state. Every toggle persists to localStorage via `writeGuardState`, which
 * cascades to Experiment QC + Validate trust through the
 * `useIntegrityGuards()` hook (see punch-list item #8).
 *
 * Catalog comes from `/catalog/integrity-guards` when the API is up,
 * otherwise the hardcoded fallback (same 23 guards / six groups, mirrored
 * from `hetqml-pages/initialize/index.html`).
 */
export function EvidencePosturePanel({
  lite = false,
}: EvidencePosturePanelProps = {}) {
  const { catalog, groups, toggles: liveToggles, loaded } = useIntegrityGuards();

  // Local mirror so toggles update synchronously while the user clicks.
  // Initial state honours whatever the hook handed us — defaults if there
  // is no persisted state, persisted toggles otherwise.
  const [on, setOn] = useState<Record<string, boolean>>(liveToggles);

  const liveTogglesRef = useRef(liveToggles);
  liveTogglesRef.current = liveToggles;

  const liveTogglesFingerprint = togglesContentFingerprint(liveToggles);

  // Re-sync local state when the catalog or remote toggles change (e.g.
  // catalog upgrades from fallback to live, or another tab toggled).
  useEffect(() => {
    const live = liveTogglesRef.current;
    setOn((prev) => {
      // Preserve in-flight unsynced edits but pick up new keys.
      const next = { ...live };
      for (const id of Object.keys(prev)) {
        if (id in live) next[id] = prev[id]!;
      }
      return guardToggleRecordsEqual(prev, next) ? prev : next;
    });
  }, [liveTogglesFingerprint]);

  const onRef = useRef(on);
  onRef.current = on;

  // Group expansion state — keyed by group name.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setExpanded((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const g of groups) {
        if (!(g.name in next)) {
          next[g.name] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [groups]);

  const onFingerprint = togglesContentFingerprint(on);

  useEffect(() => {
    writeGuardState(onRef.current);
  }, [onFingerprint]);

  const [postureFilter, setPostureFilter] = useState<PostureFilter>("all");

  const stats = useMemo(() => {
    const total = catalog.length;
    const enabled = catalog.filter((g) => on[g.id]).length;
    const critical = catalog.filter((g) => g.critical);
    const critOn = critical.filter((g) => on[g.id]).length;
    const critOff = critical.length - critOn;
    return {
      total,
      enabled,
      criticalOn: critOn,
      criticalOff: critOff,
      criticalTotal: critical.length,
      passing: critOff === 0,
    };
  }, [catalog, on]);

  const filterGuards = (g: GuardCatalogEntry) => {
    const level = levelFor(g);
    const isOn = on[g.id];
    if (postureFilter === "all") return true;
    if (postureFilter === "critical") return level === "critical";
    if (postureFilter === "recommended") return level === "recommended";
    if (postureFilter === "optional") return level === "optional";
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
        <span className="badge">{loaded ? "Reference" : "Reference · seed"}</span>
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
            {stats.criticalOn}/{stats.criticalTotal}
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

      {lite ? (
        // Flat read-only list of just the critical guards. Tight summary
        // for the lite (HF Space) build — no filters, no accordions, no
        // toggling. The full posture surface is in the standalone build.
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "var(--muted)",
              fontFamily: "var(--font-mono), monospace",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            CRITICAL GUARDS
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 6,
            }}
          >
            {catalog
              .filter((g) => g.critical)
              .slice(0, 6)
              .map((g) => {
                const rowOn = on[g.id];
                return (
                  <li
                    key={g.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "10px 1fr auto",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 10px",
                      background: rowOn
                        ? "var(--green-bg)"
                        : "var(--sienna-bg)",
                      border: `1px solid ${rowOn ? "var(--green)" : "var(--sienna)"}`,
                      borderRadius: 4,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: rowOn
                          ? "var(--green)"
                          : "var(--sienna)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12.5,
                        color: "var(--ink)",
                        fontWeight: 500,
                      }}
                    >
                      {g.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono), monospace",
                        color: rowOn ? "var(--green)" : "var(--sienna)",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {rowOn ? "ON" : "OFF"}
                    </span>
                  </li>
                );
              })}
          </ul>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "var(--faint)",
            }}
          >
            Full posture surface ({stats.total} guards across{" "}
            {groups.length} groups, with per-guard toggles and audit-blocking
            criticality) lives in the standalone build.
          </div>
        </div>
      ) : null}

      {lite ? null : (
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
      )}

      {lite ? null : groups.map((group) => (
        <div
          key={group.name}
          className={`guard-group${expanded[group.name] ? " expanded" : ""}`}
        >
          <div
            className="guard-group-head"
            role="button"
            tabIndex={0}
            onClick={() =>
              setExpanded((s) => ({ ...s, [group.name]: !s[group.name] }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                setExpanded((s) => ({ ...s, [group.name]: !s[group.name] }));
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
              const level = levelFor(g);
              const rowClass = `guard-row${rowOn ? " on" : " off"}${level === "critical" && !rowOn ? " off-critical" : ""}`;
              return (
                <div key={g.id} className={rowClass}>
                  <button
                    type="button"
                    className="guard-toggle"
                    role="switch"
                    aria-checked={rowOn}
                    aria-label={`toggle ${g.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOn((m) => ({ ...m, [g.id]: !m[g.id] }));
                    }}
                  >
                    <span className="guard-toggle-thumb" aria-hidden="true" />
                  </button>
                  <div className="guard-content">
                    <div className="guard-name-row">
                      <span className="guard-name">{g.label}</span>
                      <span className={levelPill(level)}>{level}</span>
                    </div>
                    <div className="guard-desc">{g.description}</div>
                    <div className="guard-impact">
                      {g.critical
                        ? "Failing critical guards halt the audit pipeline."
                        : g.defaultOn
                          ? "Recommended guards surface a warning when off."
                          : "Optional — informational; off does not gate audit."}
                    </div>
                  </div>
                  <span
                    className="guard-source"
                    title="config/integrity.yaml"
                  >
                    config/integrity.yaml
                  </span>
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
