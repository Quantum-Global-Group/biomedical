import type { QuantumCircuitInfo } from "@/lib/api/client";

interface Props {
  circuit: QuantumCircuitInfo;
}

/**
 * SVG rendering of a ZZFeatureMap-style circuit. We draw N qubit lanes,
 * a Hadamard layer per encoding rep, and pairwise ZZ entanglement gates
 * between adjacent qubits. Depth is informative: it sets how many reps
 * we draw (capped at 3 for legibility).
 */
export function QuantumCircuitPanel({ circuit }: Props) {
  const qubits = circuit.qubits ?? 0;
  const depth = circuit.depth ?? 0;
  const reps = qubits > 0 ? Math.min(3, Math.max(1, Math.floor(depth / 4))) : 0;
  const hasCircuit = qubits > 0;

  // SVG layout
  const padX = 56;
  const padY = 24;
  const laneGap = 36;
  const repWidth = 130;
  const totalLanes = Math.max(qubits, 1);
  const svgH = padY * 2 + laneGap * Math.max(totalLanes - 1, 0) + 24;
  const svgW = padX * 2 + repWidth * Math.max(reps, 1) + 32;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · QUANTUM KERNEL CIRCUIT</div>
          <div className="panel-title">{circuit.title || "ZZ feature map"}</div>
        </div>
        <span
          className="pill"
          style={{
            background: circuit.zneEnabled ? "var(--green-bg)" : "var(--paper-alt)",
            color: circuit.zneEnabled ? "var(--green)" : "var(--muted)",
          }}
        >
          {circuit.zneEnabled ? "● ZNE on" : "○ ZNE off"}
        </span>
      </div>

      <p className="panel-purpose">
        {hasCircuit ? (
          <>
            Encoding circuit run on{" "}
            <strong>{circuit.backend ?? "unknown backend"}</strong> with{" "}
            <strong>{circuit.qubits} qubits</strong>,{" "}
            <strong>{circuit.shots?.toLocaleString() ?? "?"} shots</strong>.
            Depth ≈ {circuit.depth ?? "?"} two-qubit ops.
          </>
        ) : (
          "No quantum circuit was used in this run (classical-only family)."
        )}
      </p>

      {hasCircuit && (
        <div
          style={{
            border: "1px solid var(--border-soft)",
            borderRadius: 6,
            background:
              "radial-gradient(ellipse at center, #1a1612 0%, #0f0c09 80%)",
            padding: 8,
            overflowX: "auto",
          }}
        >
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            role="img"
            aria-label={`Quantum kernel circuit with ${qubits} qubits and ${reps} repetitions`}
          >
            {/* Qubit lane lines */}
            {Array.from({ length: qubits }).map((_, q) => {
              const y = padY + q * laneGap;
              return (
                <g key={`lane-${q}`}>
                  <text
                    x={12}
                    y={y + 4}
                    fontSize="11"
                    fontFamily="var(--font-mono), monospace"
                    fill="#857d75"
                  >
                    q[{q}]
                  </text>
                  <line
                    x1={padX - 8}
                    x2={svgW - 16}
                    y1={y}
                    y2={y}
                    stroke="#332d27"
                    strokeWidth={1}
                  />
                </g>
              );
            })}

            {/* Repetitions: H per qubit + pairwise ZZ entanglement */}
            {Array.from({ length: reps }).map((_, r) => {
              const xH = padX + r * repWidth + 8;
              const xZZ = padX + r * repWidth + 56;
              return (
                <g key={`rep-${r}`}>
                  {/* Repetition bracket */}
                  <text
                    x={padX + r * repWidth + repWidth / 2 - 14}
                    y={padY - 8}
                    fontSize="10"
                    fontFamily="var(--font-mono), monospace"
                    fill="#857d75"
                    letterSpacing="0.05em"
                  >
                    rep {r + 1}
                  </text>

                  {/* Hadamard gates */}
                  {Array.from({ length: qubits }).map((_, q) => {
                    const y = padY + q * laneGap;
                    return (
                      <g key={`h-${r}-${q}`}>
                        <rect
                          x={xH - 11}
                          y={y - 11}
                          width={22}
                          height={22}
                          rx={3}
                          fill="#1f3838"
                          stroke="#6bb5b5"
                        />
                        <text
                          x={xH}
                          y={y + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight={700}
                          fontFamily="var(--font-mono), monospace"
                          fill="#6bb5b5"
                        >
                          H
                        </text>
                      </g>
                    );
                  })}

                  {/* Pairwise ZZ gates between adjacent qubits */}
                  {Array.from({ length: Math.max(qubits - 1, 0) }).map((_, q) => {
                    const yA = padY + q * laneGap;
                    const yB = padY + (q + 1) * laneGap;
                    return (
                      <g key={`zz-${r}-${q}`}>
                        <line
                          x1={xZZ}
                          x2={xZZ}
                          y1={yA}
                          y2={yB}
                          stroke="#d4a574"
                          strokeWidth={1.5}
                        />
                        <circle cx={xZZ} cy={yA} r={3.5} fill="#d4a574" />
                        <circle cx={xZZ} cy={yB} r={3.5} fill="#d4a574" />
                        <rect
                          x={xZZ + 8}
                          y={(yA + yB) / 2 - 9}
                          width={36}
                          height={18}
                          rx={3}
                          fill="#2d2317"
                          stroke="#d4a574"
                        />
                        <text
                          x={xZZ + 26}
                          y={(yA + yB) / 2 + 4}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight={700}
                          fontFamily="var(--font-mono), monospace"
                          fill="#e0a062"
                        >
                          ZZ
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        <Stat label="backend" value={circuit.backend ?? "—"} mono />
        <Stat label="qubits" value={circuit.qubits?.toString() ?? "—"} />
        <Stat
          label="shots"
          value={circuit.shots?.toLocaleString() ?? "—"}
        />
        <Stat label="depth" value={circuit.depth?.toString() ?? "—"} />
        <Stat
          label="fidelity"
          value={
            circuit.fidelity != null ? circuit.fidelity.toFixed(3) : "—"
          }
        />
      </div>

      {circuit.note && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: "var(--paper-alt)",
            border: "1px solid var(--border-soft)",
            borderRadius: 4,
            fontSize: 12,
            color: "var(--muted)",
            fontStyle: "italic",
          }}
        >
          {circuit.note}
        </div>
      )}

      <div className="panel-footer" style={{ marginTop: 14 }}>
        <span>
          ZZ feature map · {reps} encoding rep
          {reps === 1 ? "" : "s"}
        </span>
        <span>
          <em>kernel inner product on {qubits || "—"} qubits</em>
        </span>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "var(--paper-alt)",
        border: "1px solid var(--border-soft)",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--faint)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink)",
          marginTop: 2,
          fontFamily: mono ? "var(--font-mono), monospace" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
