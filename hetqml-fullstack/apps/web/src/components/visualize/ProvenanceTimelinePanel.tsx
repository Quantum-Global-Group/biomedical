import type { ProvenanceEvent } from "@/lib/api/client";

interface Props {
  events: ProvenanceEvent[];
}

export function ProvenanceTimelinePanel({ events }: Props) {
  const fallbackCount = events.filter((e) => e.fallback).length;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · PROVENANCE TIMELINE</div>
          <div className="panel-title">Where the numbers came from</div>
        </div>
        <span
          className="pill"
          style={{
            background: fallbackCount > 0 ? "var(--amber-bg)" : "var(--green-bg)",
            color: fallbackCount > 0 ? "var(--amber)" : "var(--green)",
          }}
        >
          {fallbackCount === 0
            ? "● all live"
            : `◐ ${fallbackCount} fallback${fallbackCount > 1 ? "s" : ""}`}
        </span>
      </div>
      <p className="panel-purpose">
        Each timestamped step shows which source produced an input to the run.
        A <strong>fallback</strong> means the live source was unavailable and a
        synthetic stand-in was used — the model still ran, but the resulting
        score should be discounted accordingly.
      </p>

      {events.length === 0 ? (
        <p
          style={{
            color: "var(--faint)",
            fontStyle: "italic",
            padding: "16px 0",
          }}
        >
          No provenance events recorded.
        </p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: "8px 0 0 0",
            position: "relative",
          }}
        >
          {/* The vertical rail */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 7,
              top: 8,
              bottom: 8,
              width: 1,
              background: "var(--border-soft)",
            }}
          />
          {events.map((e, i) => (
            <li
              key={`${e.timestamp}-${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: "16px 1fr",
                columnGap: 12,
                rowGap: 0,
                padding: "8px 0",
                position: "relative",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  marginTop: 6,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: e.fallback ? "var(--amber)" : "var(--teal)",
                  border: `2px solid ${e.fallback ? "var(--amber-bg)" : "var(--teal-light)"}`,
                  boxShadow: e.fallback
                    ? "0 0 8px var(--amber)"
                    : "0 0 8px var(--teal)",
                }}
              />
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    {e.label}
                  </div>
                  <time
                    dateTime={e.timestamp}
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 10.5,
                      color: "var(--faint)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatTime(e.timestamp)}
                  </time>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginTop: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontFamily: "var(--font-mono), monospace",
                      color: "var(--gold)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {e.source}
                  </span>
                  {e.fallback && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--amber)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 600,
                      }}
                    >
                      fallback
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="panel-footer" style={{ marginTop: 12 }}>
        <span>
          {events.length} event{events.length === 1 ? "" : "s"} · FastAPI
          run-log
        </span>
        <span>
          <em>amber dot = synthetic stand-in</em>
        </span>
      </div>
    </section>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
