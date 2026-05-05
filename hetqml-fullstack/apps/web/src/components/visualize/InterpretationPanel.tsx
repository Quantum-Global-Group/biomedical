import type { InterpretationPanel as InterpretationData } from "@/lib/api/client";

interface Props {
  interpretation: InterpretationData;
}

export function InterpretationPanel({ interpretation }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · INTERPRETATION</div>
          <div className="panel-title">What this evidence means</div>
        </div>
        <span className="badge">Skeptic-aware</span>
      </div>
      <p className="panel-purpose">
        Two columns. <strong>Plausible</strong> is what the evidence supports;{" "}
        <strong>Weak</strong> is what would be a stretch given what we have.
        Read both — never act on the left without acknowledging the right.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginTop: 4,
        }}
      >
        <Column
          title="Plausible"
          tone="var(--green)"
          bg="var(--green-bg)"
          glyph="✓"
          items={interpretation.plausible}
          empty="No plausible interpretation reported."
        />
        <Column
          title="Weak"
          tone="var(--amber)"
          bg="var(--amber-bg)"
          glyph="⚠"
          items={interpretation.weak}
          empty="No weakness flagged — be suspicious of zero-weakness runs."
        />
      </div>

      <div className="panel-footer" style={{ marginTop: 14 }}>
        <span>{interpretation.plausible.length + interpretation.weak.length} statements</span>
        <span>
          <em>cite this column when writing the decision rationale</em>
        </span>
      </div>
    </section>
  );
}

function Column({
  title,
  tone,
  bg,
  glyph,
  items,
  empty,
}: {
  title: string;
  tone: string;
  bg: string;
  glyph: string;
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          background: bg,
          border: `1px solid ${tone}`,
          borderRadius: "4px 4px 0 0",
          color: tone,
          fontWeight: 600,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span>{glyph}</span>
        {title}
      </div>
      <div
        style={{
          padding: 10,
          border: `1px solid var(--border)`,
          borderTop: "none",
          borderRadius: "0 0 4px 4px",
          minHeight: 80,
        }}
      >
        {items.length === 0 ? (
          <p
            style={{
              color: "var(--faint)",
              fontStyle: "italic",
              fontSize: 12,
              margin: 0,
            }}
          >
            {empty}
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {items.map((it, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12.5,
                  color: "var(--ink)",
                  lineHeight: 1.45,
                  paddingLeft: 14,
                  position: "relative",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 5,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: tone,
                  }}
                />
                {it}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
