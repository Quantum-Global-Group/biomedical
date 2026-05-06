"use client";

import { useMemo, useState } from "react";
import {
  ALGORITHM_CATALOG,
  catalogStats,
  type AlgoPathKind,
  type CatalogGroup,
  type CatalogRow,
} from "@/lib/data/algorithmCatalog";
import type { RunFamilyId } from "@/lib/investigation/runPath";

type FilterId = "all" | "live" | "dev" | "running";

function rowVisible(
  row: CatalogRow,
  filter: FilterId,
  family: RunFamilyId,
): boolean {
  if (filter === "all") return true;
  if (filter === "live") return row.status === "live";
  if (filter === "dev") return row.status === "dev";
  if (filter === "running") return row.path === family;
  return true;
}

function pathPillClass(path: AlgoPathKind) {
  if (path === "hybrid") return "algo-path-pill hybrid";
  if (path === "quantum") return "algo-path-pill quantum";
  return "algo-path-pill classical";
}

function statusPillClass(status: CatalogRow["status"]) {
  if (status === "live") return "algo-status-pill live";
  if (status === "fallback") return "algo-status-pill fallback";
  return "algo-status-pill dev";
}

interface Props {
  selectedFamily: RunFamilyId;
  /** Live catalog groups from useCatalogs(). Falls back to local seed when undefined. */
  catalog?: readonly CatalogGroup[];
}

export function AlgorithmCatalog({ selectedFamily, catalog }: Props) {
  const groups = catalog ?? ALGORITHM_CATALOG;
  const [filter, setFilter] = useState<FilterId>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const stats = useMemo(() => catalogStats(groups), [groups]);

  const visibleGroups = useMemo(() => {
    const out: CatalogGroup[] = [];
    for (const g of groups) {
      const rows = g.rows.filter((r) => rowVisible(r, filter, selectedFamily));
      if (rows.length) out.push({ name: g.name, rows });
    }
    return out;
  }, [filter, selectedFamily, groups]);

  const visibleCount = useMemo(
    () => visibleGroups.reduce((n, g) => n + g.rows.length, 0),
    [visibleGroups],
  );

  return (
    <div className="algo-catalog">
      <div className="algo-catalog-divider">
        <span className="algo-catalog-divider-line" />
        <span className="algo-catalog-divider-label">
          ADVANCED · DRILL-DOWN
        </span>
        <span className="algo-catalog-divider-line" />
      </div>
      <div className="algo-catalog-head">
        <div className="algo-catalog-title">
          <span className="algo-catalog-eyebrow">ALGORITHM CATALOG</span>
          <span
            style={{
              fontSize: 11,
              color: "var(--muted)",
              fontWeight: "normal",
              marginLeft: 6,
            }}
          >
            — inspect algorithms wired in this port
          </span>
          <span className="algo-catalog-stats">
            {visibleCount} of {stats.rows} algorithms across {stats.groups}{" "}
            groups
          </span>
        </div>
        <div className="algo-filter-row">
          {(
            [
              ["all", "all"],
              ["live", "live"],
              ["dev", "dev"],
              ["running now", "running"],
            ] as const
          ).map(([label, id]) => (
            <span
              key={id}
              className={`algo-filter-pill${filter === id ? " active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => setFilter(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setFilter(id);
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div>
        {visibleGroups.map((group) => {
          const exp = expanded[group.name] ?? false;
          const total = groups.find((g) => g.name === group.name)?.rows.length;
          return (
            <div
              key={group.name}
              className={`algo-group${exp ? " expanded" : ""}`}
            >
              <div
                className="algo-group-head"
                role="button"
                tabIndex={0}
                onClick={() =>
                  setExpanded((s) => ({ ...s, [group.name]: !exp }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    setExpanded((s) => ({ ...s, [group.name]: !exp }));
                }}
              >
                <span className="algo-group-name">
                  <span className="algo-group-chev">▶</span>
                  {group.name}
                </span>
                <span className="algo-group-meta">
                  <span className="live-count">
                    {group.rows.length}
                        of {total ?? group.rows.length}
                  </span>
                </span>
              </div>
              <div className="algo-group-body">
                {group.rows.map((row) => {
                  const inPath = row.path === selectedFamily;
                  const pathCls = pathPillClass(row.path);
                  const stCls = statusPillClass(row.status);
                  return (
                    <div
                      key={row.name + row.mech}
                      className={`algo-row${inPath ? " in-path primary" : ""}`}
                      title={row.mech}
                    >
                      <div className="algo-name-col">
                        <div className="algo-name">
                          {row.name}
                          {inPath ? (
                            <span className="primary-mark">●</span>
                          ) : null}
                        </div>
                        <div className="algo-mech">{row.mech}</div>
                      </div>
                      <span className={pathCls}>{row.path}</span>
                      <span className="algo-params">{row.params}</span>
                      <span className="algo-runtime">{row.runtime}</span>
                      <span className={stCls}>{row.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
