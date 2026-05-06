/**
 * MoleculeSvgPanel — 2D molecular sketch as pure SVG.
 *
 * The full Visualize page renders an interactive 3D molecule via
 * three.js (~676 KB chunk). The lite (HF Space) build can't ship that;
 * this is a stylised 2D structural diagram that loads instantly and
 * scales cleanly to any size.
 *
 * The sketch is illustrative — accurate enough to read as a real
 * small-molecule drug candidate (rings, heteroatoms, side chain) but
 * not meant to be a chemically exact rendering of Inaxaplin. Atoms,
 * bonds, and a couple of property tags are drawn from a 320×220
 * viewBox. Colours pick up CSS variables so the panel re-themes
 * automatically under the lite light skin.
 */
import type { CSSProperties } from "react";

interface Atom {
  id: string;
  cx: number;
  cy: number;
  /** Heteroatom symbol — undefined for plain carbon backbone vertices. */
  symbol?: "N" | "O" | "F" | "S" | "Cl";
}

interface Bond {
  from: string;
  to: string;
  /** 1 = single, 2 = double, 3 = triple, "ar" = aromatic. */
  order: 1 | 2 | 3 | "ar";
}

// Two fused 6-rings + a 5-ring side chain + a CF3 group + a hydroxyl.
// Coordinates chosen so bonds keep ~24px ideal length and rings sit on
// a flat baseline — readable at the panel size, scales to any.
const ATOMS: Atom[] = [
  // Left aromatic ring (0..5)
  { id: "a0", cx: 60, cy: 110 },
  { id: "a1", cx: 80, cy: 96 },
  { id: "a2", cx: 100, cy: 110 },
  { id: "a3", cx: 100, cy: 134 },
  { id: "a4", cx: 80, cy: 148 },
  { id: "a5", cx: 60, cy: 134 },
  // Right aromatic ring (6..10), shares edge a2-a3 with left ring
  { id: "a6", cx: 120, cy: 96 },
  { id: "a7", cx: 140, cy: 110 },
  { id: "a8", cx: 140, cy: 134 },
  { id: "a9", cx: 120, cy: 148 },
  // Heteroatoms inside right ring
  { id: "n1", cx: 100, cy: 110, symbol: "N" }, // overlap with a2 conceptually — use a separate atom
  // Side chain to the right (11..14)
  { id: "c11", cx: 162, cy: 110 },
  { id: "n12", cx: 180, cy: 96, symbol: "N" },
  { id: "c13", cx: 200, cy: 110 },
  { id: "o14", cx: 218, cy: 96, symbol: "O" }, // hydroxyl
  // CF3 group on the bottom (lower side chain)
  { id: "c15", cx: 162, cy: 156 },
  { id: "f16", cx: 174, cy: 174, symbol: "F" },
  { id: "f17", cx: 156, cy: 178, symbol: "F" },
  { id: "f18", cx: 144, cy: 168, symbol: "F" },
  // Top label nitrogen — to imply an amide/sulphonamide handle
  { id: "n19", cx: 80, cy: 72, symbol: "N" },
];

const BONDS: Bond[] = [
  // Left ring (aromatic — show as alternating double bonds)
  { from: "a0", to: "a1", order: "ar" },
  { from: "a1", to: "a2", order: "ar" },
  { from: "a2", to: "a3", order: "ar" },
  { from: "a3", to: "a4", order: "ar" },
  { from: "a4", to: "a5", order: "ar" },
  { from: "a5", to: "a0", order: "ar" },
  // Right ring (aromatic)
  { from: "a2", to: "a6", order: "ar" },
  { from: "a6", to: "a7", order: "ar" },
  { from: "a7", to: "a8", order: "ar" },
  { from: "a8", to: "a9", order: "ar" },
  { from: "a9", to: "a3", order: "ar" },
  // N attached above left ring (top handle)
  { from: "a1", to: "n19", order: 1 },
  // Right side chain — amide to alcohol
  { from: "a7", to: "c11", order: 1 },
  { from: "c11", to: "n12", order: 2 },
  { from: "n12", to: "c13", order: 1 },
  { from: "c13", to: "o14", order: 1 },
  // CF3 below ring
  { from: "a8", to: "c15", order: 1 },
  { from: "c15", to: "f16", order: 1 },
  { from: "c15", to: "f17", order: 1 },
  { from: "c15", to: "f18", order: 1 },
];

function atomById(id: string): Atom | undefined {
  return ATOMS.find((a) => a.id === id);
}

const HETERO_FILL: Record<NonNullable<Atom["symbol"]>, string> = {
  N: "#3a4d8a",
  O: "#b04a3a",
  F: "#6b7d5f",
  S: "#b89243",
  Cl: "#6b7d5f",
};

interface Props {
  /** Display name shown above the diagram. Optional — defaults to a
   * generic "Lead candidate" label. */
  compoundName?: string;
  /** ChEMBL-style identifier shown in the panel pill. Optional. */
  identifier?: string;
  /** Quick property tags shown under the diagram. */
  tags?: ReadonlyArray<{ label: string; value: string }>;
}

const DEFAULT_TAGS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "MW", value: "410.4" },
  { label: "logP", value: "2.7" },
  { label: "HBD/HBA", value: "1 / 6" },
  { label: "TPSA", value: "84.3" },
  { label: "Lipinski", value: "✓ pass" },
];

export function MoleculeSvgPanel({
  compoundName = "Inaxaplin (illustrative)",
  identifier = "DEMO · ChEMBL_INX-1",
  tags = DEFAULT_TAGS,
}: Props) {
  const headStyle: CSSProperties = { color: "var(--ink)" };
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">PREVIEW · MOLECULE</div>
          <div className="panel-title" style={headStyle}>
            {compoundName}
          </div>
        </div>
        <span className="pill">{identifier}</span>
      </div>
      <p className="panel-purpose" style={{ marginBottom: 6 }}>
        Stylised 2D structural sketch — fused aromatic system + amide
        side chain + CF₃ group + hydroxyl handle. The full version
        renders an interactive 3D conformation via WebGL; this lite
        view is a static SVG that ships zero extra JS.
      </p>
      <svg
        viewBox="0 0 320 220"
        width="100%"
        height={240}
        role="img"
        aria-label={`2D structure sketch of ${compoundName}`}
        style={{ display: "block", color: "var(--ink)" }}
      >
        {/* Bonds */}
        {BONDS.map((b, i) => {
          const a = atomById(b.from);
          const z = atomById(b.to);
          if (!a || !z) return null;
          const dx = z.cx - a.cx;
          const dy = z.cy - a.cy;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len; // perpendicular for double-bond offset
          const ny = dx / len;
          const stroke = "var(--ink)";
          if (b.order === 1) {
            return (
              <line
                key={i}
                x1={a.cx}
                y1={a.cy}
                x2={z.cx}
                y2={z.cy}
                strokeWidth={1.6}
                style={{ stroke }}
              />
            );
          }
          if (b.order === 2 || b.order === "ar") {
            const off = b.order === "ar" ? 2.6 : 3.2;
            return (
              <g key={i}>
                <line
                  x1={a.cx}
                  y1={a.cy}
                  x2={z.cx}
                  y2={z.cy}
                  strokeWidth={1.6}
                  style={{ stroke }}
                />
                <line
                  x1={a.cx + nx * off}
                  y1={a.cy + ny * off}
                  x2={z.cx + nx * off}
                  y2={z.cy + ny * off}
                  strokeWidth={1.2}
                  style={{ stroke, opacity: b.order === "ar" ? 0.5 : 0.85 }}
                  strokeDasharray={b.order === "ar" ? "3 2" : undefined}
                />
              </g>
            );
          }
          // triple
          return (
            <g key={i}>
              <line
                x1={a.cx + nx * 3}
                y1={a.cy + ny * 3}
                x2={z.cx + nx * 3}
                y2={z.cy + ny * 3}
                strokeWidth={1.4}
                style={{ stroke }}
              />
              <line
                x1={a.cx}
                y1={a.cy}
                x2={z.cx}
                y2={z.cy}
                strokeWidth={1.4}
                style={{ stroke }}
              />
              <line
                x1={a.cx - nx * 3}
                y1={a.cy - ny * 3}
                x2={z.cx - nx * 3}
                y2={z.cy - ny * 3}
                strokeWidth={1.4}
                style={{ stroke }}
              />
            </g>
          );
        })}
        {/* Atoms — only labelled heteroatoms get filled disks; carbons stay implicit */}
        {ATOMS.filter((a) => a.symbol).map((a) => (
          <g key={a.id}>
            <circle
              cx={a.cx}
              cy={a.cy}
              r={9}
              style={{
                fill: "var(--card)",
                stroke: HETERO_FILL[a.symbol!],
              }}
              strokeWidth={1.6}
            />
            <text
              x={a.cx}
              y={a.cy + 3.8}
              fontSize={11}
              fontWeight={700}
              textAnchor="middle"
              style={{ fill: HETERO_FILL[a.symbol!] }}
            >
              {a.symbol}
            </text>
          </g>
        ))}
        {/* "CF₃" composite label near c15 to read the trifluoromethyl */}
        <text
          x={162}
          y={195}
          fontSize={10}
          fontWeight={600}
          textAnchor="middle"
          style={{ fill: "var(--muted)" }}
        >
          CF₃
        </text>
        {/* Top "NH" label near n19 */}
        <text
          x={80}
          y={62}
          fontSize={10}
          fontWeight={600}
          textAnchor="middle"
          style={{ fill: "var(--muted)" }}
        >
          NH
        </text>
      </svg>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          marginTop: 8,
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        {tags.map((t) => (
          <span key={t.label}>
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
              {t.label}
            </strong>{" "}
            {t.value}
          </span>
        ))}
      </div>
    </section>
  );
}
