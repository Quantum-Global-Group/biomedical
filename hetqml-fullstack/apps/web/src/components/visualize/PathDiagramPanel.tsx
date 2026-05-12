import type { EvidencePath } from "@/lib/api/client";

interface Props {
  path: EvidencePath;
}

/** Compound → Gene → Pathway → Disease style horizontal flow. Each step
 * is a node; the edge between steps shows metaedge code + weight. */
export function PathDiagramPanel({ path }: Props) {
  const passing = path.plausibility >= path.threshold;
  const cleared = ((path.plausibility / Math.max(path.threshold, 0.0001)) * 100).toFixed(0);

  // Build node list from steps (each step's `from` then the final `to`).
  const nodes: string[] = [];
  for (const s of path.steps) {
    if (nodes.length === 0) nodes.push(s.from);
    nodes.push(s.to);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · PATH DIAGRAM</div>
          <div className="panel-title">
            How the model reaches the candidate
          </div>
        </div>
        <span
          className="pill"
          style={{
            background: passing ? "var(--green-bg)" : "var(--sienna-bg)",
            color: passing ? "var(--green)" : "var(--sienna)",
          }}
        >
          {passing ? "● path clears threshold" : "▽ path below threshold"}
        </span>
      </div>
      <p className="panel-purpose">
        A walk through Hetionet — compound, target, pathway, disease — with
        weights from the trained model. The path must aggregate to at least
        the threshold ({path.threshold.toFixed(2)}) to count as
        mechanistic support.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: path.steps.length <= 4 ? "center" : "flex-start",
          gap: 6,
          flexWrap: "nowrap",
          padding: "16px 4px 12px",
          overflowX: "auto",
          scrollbarWidth: "thin",
        }}
      >
        {path.steps.length === 0 ? (
          <p
            style={{
              color: "var(--faint)",
              fontStyle: "italic",
              padding: "12px 0",
            }}
          >
            No path steps reported.
          </p>
        ) : (
          path.steps.map((step, i) => (
            <div
              key={`${step.from}-${step.to}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flex: "0 0 auto",
              }}
            >
              {i === 0 && <PathNode label={step.from} kind="entity" />}
              <PathEdge
                metaedge={step.metaedge}
                weight={step.weight}
                sources={step.sources}
              />
              <PathNode label={step.to} kind="entity" />
            </div>
          ))
        )}
      </div>

      {nodes.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
            padding: "10px 12px",
            background: "var(--paper-alt)",
            border: "1px solid var(--border-soft)",
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>
              {path.steps.length}-hop path
            </span>{" "}
            · plausibility {path.plausibility.toFixed(3)} vs threshold{" "}
            {path.threshold.toFixed(3)}
          </div>
          <div
            style={{
              minWidth: 140,
              height: 8,
              background: "var(--border-soft)",
              borderRadius: 4,
              overflow: "hidden",
            }}
            aria-label={`${cleared}% of threshold`}
          >
            <div
              style={{
                width: `${Math.min(100, Number(cleared))}%`,
                height: "100%",
                background: passing ? "var(--green)" : "var(--sienna)",
              }}
            />
          </div>
        </div>
      )}

      <div className="panel-footer" style={{ marginTop: 14 }}>
        <span>hetionet-v1.0/edges.tsv · path-aggregated weights</span>
        <span>
          <em>{passing ? "supports the candidate" : "weakens the candidate"}</em>
        </span>
      </div>
    </section>
  );
}

function PathNode({ label, kind }: { label: string; kind: "entity" }) {
  return (
    <div
      title={label}
      style={{
        padding: "10px 14px",
        width: 140,
        minWidth: 140,
        maxWidth: 140,
        flex: "0 0 140px",
        background: "var(--card)",
        border: "1px solid var(--teal)",
        borderRadius: 6,
        textAlign: "center",
        boxShadow: "0 0 14px rgba(107,181,181,0.18)",
      }}
      data-kind={kind}
    >
      <div
        style={{
          fontSize: 9.5,
          color: "var(--faint)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        node
      </div>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function PathEdge({
  metaedge,
  weight,
  sources,
}: {
  metaedge: string;
  weight: number;
  sources: string[];
}) {
  const strong = weight > 0.6;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 80,
        minWidth: 80,
        maxWidth: 80,
        flex: "0 0 80px",
        gap: 2,
      }}
      title={`Sources: ${sources.join(", ")}`}
    >
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 10.5,
          color: "var(--gold)",
          letterSpacing: "0.04em",
        }}
      >
        {metaedge}
      </div>
      <div
        style={{
          width: 64,
          height: 2,
          background: strong ? "var(--gold)" : "var(--border)",
          borderRadius: 2,
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            right: -6,
            top: -4,
            fontSize: 10,
            color: strong ? "var(--gold)" : "var(--faint)",
          }}
        >
          ▶
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--muted)",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        w={weight.toFixed(2)}
      </div>
    </div>
  );
}
