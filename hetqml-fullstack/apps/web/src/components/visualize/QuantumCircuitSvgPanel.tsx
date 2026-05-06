/**
 * QuantumCircuitSvgPanel — quantum-circuit diagram as pure SVG.
 *
 * Renders the project's signature Pauli feature map (reps=2) on a small
 * qubit register, with H gates, single-qubit rotations, and entangling
 * CNOTs laid out left-to-right by gate column. Pure SVG, ships zero
 * extra JS, scales to any size, picks up CSS variables for the theme.
 *
 * The circuit shown is a faithful schematic of the Pauli feature map
 * Qiskit emits at reps=2 — H * (RZ * Z⊗Z * RZ)^reps — but compressed
 * to four qubits and one rep with the second rep represented as a
 * trailing barrier so the figure reads cleanly at panel width. Same
 * gate kinds, same entangling pattern, just dialled down for clarity.
 */
import type { CSSProperties } from "react";

interface Gate {
  /** Column index (0-based) where the gate sits. */
  col: number;
  /** Qubit lane the gate operates on (0-based). For 2q gates this is
   * the control; `target` is the data qubit. */
  qubit: number;
  /** Single-qubit gate label (H, RZ, RX, …) or "cx" for CNOT. */
  kind: "H" | "RZ" | "RX" | "RY" | "cx" | "barrier";
  /** Target qubit for `cx`. Ignored otherwise. */
  target?: number;
  /** Optional rotation parameter shown as a small subscript. */
  param?: string;
}

const NUM_QUBITS = 4;

// Pauli feature map (reps=1 sketch) — Hadamard column, Z-rotations,
// pairwise CNOTs to entangle, second rotation column, then a barrier
// indicating the second rep continues. The data-encoding angles are
// shown as φ(x_i) on the rotations.
const GATES: Gate[] = [
  // Column 0 — Hadamards (state preparation)
  { col: 0, qubit: 0, kind: "H" },
  { col: 0, qubit: 1, kind: "H" },
  { col: 0, qubit: 2, kind: "H" },
  { col: 0, qubit: 3, kind: "H" },
  // Column 1 — first RZ rotations (single-qubit data encoding)
  { col: 1, qubit: 0, kind: "RZ", param: "φ(x₀)" },
  { col: 1, qubit: 1, kind: "RZ", param: "φ(x₁)" },
  { col: 1, qubit: 2, kind: "RZ", param: "φ(x₂)" },
  { col: 1, qubit: 3, kind: "RZ", param: "φ(x₃)" },
  // Column 2 — entangling CNOTs (linear chain)
  { col: 2, qubit: 0, kind: "cx", target: 1 },
  { col: 3, qubit: 1, kind: "cx", target: 2 },
  { col: 4, qubit: 2, kind: "cx", target: 3 },
  // Column 5 — RZ encoding pair-wise products (the `Z⊗Z` term)
  { col: 5, qubit: 0, kind: "RZ", param: "φ(x₀,x₁)" },
  { col: 5, qubit: 2, kind: "RZ", param: "φ(x₂,x₃)" },
  // Column 6 — uncompute CNOTs
  { col: 6, qubit: 0, kind: "cx", target: 1 },
  { col: 7, qubit: 2, kind: "cx", target: 3 },
  // Column 8 — second-rep barrier
  { col: 8, qubit: 0, kind: "barrier" },
];

const GATE_COLOR: Record<Gate["kind"], string> = {
  H: "var(--gold)",
  RZ: "var(--purple)",
  RX: "var(--purple)",
  RY: "var(--purple)",
  cx: "var(--ink)",
  barrier: "var(--faint)",
};

const COL_W = 38;
const LANE_H = 36;
const LEFT_PAD = 64;
const TOP_PAD = 28;

interface Props {
  backend?: string;
  shots?: number;
  reps?: number;
}

export function QuantumCircuitSvgPanel({
  backend = "ibm_torino · cuStateVec sim",
  shots = 16384,
  reps = 2,
}: Props) {
  const cols = Math.max(...GATES.map((g) => g.col)) + 1;
  const width = LEFT_PAD + cols * COL_W + 24;
  const height = TOP_PAD + NUM_QUBITS * LANE_H + 24;

  const headStyle: CSSProperties = { color: "var(--ink)" };

  // Lane y for a qubit index.
  const yFor = (q: number) => TOP_PAD + q * LANE_H;
  const xFor = (col: number) => LEFT_PAD + col * COL_W + COL_W / 2;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">PREVIEW · QUANTUM CIRCUIT</div>
          <div className="panel-title" style={headStyle}>
            Pauli feature map (reps={reps})
          </div>
        </div>
        <span className="pill">{NUM_QUBITS} qubits · {shots} shots</span>
      </div>
      <p className="panel-purpose" style={{ marginBottom: 6 }}>
        The headline encoding circuit. Hadamards prepare uniform
        superposition, single-qubit RZ rotations encode one data feature
        each, then pairwise CNOTs entangle adjacent qubits and a second
        RZ layer encodes pair-wise feature products. Two repetitions
        deepen the Hilbert-space embedding before measurement.
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height + 4}
        role="img"
        aria-label={`Pauli feature map quantum circuit, ${NUM_QUBITS} qubits, reps=${reps}`}
        style={{ display: "block" }}
      >
        {/* Lane wires */}
        {Array.from({ length: NUM_QUBITS }).map((_, q) => (
          <g key={`lane-${q}`}>
            <line
              x1={LEFT_PAD - 12}
              y1={yFor(q)}
              x2={width - 12}
              y2={yFor(q)}
              strokeWidth={1}
              style={{ stroke: "var(--border)" }}
            />
            <text
              x={LEFT_PAD - 18}
              y={yFor(q) + 4}
              fontSize={11}
              fontWeight={600}
              textAnchor="end"
              style={{
                fill: "var(--muted)",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              q{q}
            </text>
          </g>
        ))}

        {/* Gates */}
        {GATES.map((g, i) => {
          const x = xFor(g.col);
          const y = yFor(g.qubit);
          if (g.kind === "cx") {
            const yt = yFor(g.target!);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={y}
                  x2={x}
                  y2={yt}
                  strokeWidth={1.4}
                  style={{ stroke: "var(--ink)" }}
                />
                {/* Control dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={4}
                  style={{ fill: "var(--ink)" }}
                />
                {/* Target ⊕ */}
                <circle
                  cx={x}
                  cy={yt}
                  r={9}
                  style={{ fill: "var(--card)", stroke: "var(--ink)" }}
                  strokeWidth={1.4}
                />
                <line
                  x1={x - 7}
                  y1={yt}
                  x2={x + 7}
                  y2={yt}
                  strokeWidth={1.2}
                  style={{ stroke: "var(--ink)" }}
                />
                <line
                  x1={x}
                  y1={yt - 7}
                  x2={x}
                  y2={yt + 7}
                  strokeWidth={1.2}
                  style={{ stroke: "var(--ink)" }}
                />
              </g>
            );
          }
          if (g.kind === "barrier") {
            return (
              <line
                key={i}
                x1={x}
                y1={TOP_PAD - 8}
                x2={x}
                y2={TOP_PAD + NUM_QUBITS * LANE_H - LANE_H + 8}
                strokeWidth={1}
                strokeDasharray="3 3"
                style={{ stroke: GATE_COLOR.barrier, opacity: 0.7 }}
              />
            );
          }
          // Single-qubit gate box
          const w = 26;
          const h = 22;
          return (
            <g key={i}>
              <rect
                x={x - w / 2}
                y={y - h / 2}
                width={w}
                height={h}
                rx={3}
                ry={3}
                style={{
                  fill: "var(--card)",
                  stroke: GATE_COLOR[g.kind],
                }}
                strokeWidth={1.4}
              />
              <text
                x={x}
                y={y + 3.6}
                fontSize={10.5}
                fontWeight={700}
                textAnchor="middle"
                style={{
                  fill: GATE_COLOR[g.kind],
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {g.kind}
              </text>
              {g.param ? (
                <text
                  x={x}
                  y={y + h / 2 + 11}
                  fontSize={9}
                  textAnchor="middle"
                  style={{
                    fill: "var(--muted)",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  {g.param}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* "× 2 reps" label after the barrier */}
        <text
          x={xFor(8) + 14}
          y={TOP_PAD + (NUM_QUBITS * LANE_H) / 2}
          fontSize={10}
          fontWeight={700}
          textAnchor="start"
          style={{
            fill: "var(--gold)",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          × {reps} reps
        </text>
      </svg>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          marginTop: 4,
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        <span>
          <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
            backend
          </strong>{" "}
          {backend}
        </span>
        <span>
          <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
            depth
          </strong>{" "}
          {2 + reps * 4}
        </span>
        <span>
          <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
            entangler
          </strong>{" "}
          linear chain
        </span>
        <span>
          <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
            ZNE
          </strong>{" "}
          1× / 3× / 5× (Pauli Path)
        </span>
      </div>
    </section>
  );
}
