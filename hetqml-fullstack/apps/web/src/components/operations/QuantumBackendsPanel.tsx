"use client";

import type { OpsBackendsResponse } from "@/lib/api/client";
import { formatAgo } from "@/lib/operations/format";

interface Props {
  backends: OpsBackendsResponse;
}

/** Per-backend cards with calibration + queue + qubit details. */
export function QuantumBackendsPanel({ backends }: Props) {
  const onlineCount = backends.backends.filter((b) => b.queue >= 0).length;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · QUANTUM BACKENDS</div>
          <div className="panel-title">IBM hardware availability</div>
        </div>
        <span className="badge">Live</span>
      </div>
      <p className="panel-purpose">
        Per-backend status, calibration, and queue. Pre-job hardware checks
        gate every quantum / hybrid run.
      </p>

      <div>
        {backends.backends.map((b) => {
          const calMs = Date.parse(b.lastCalibration);
          const calAgo = Number.isFinite(calMs)
            ? formatAgo(Math.max(0, Math.round((Date.now() - calMs) / 1000)))
            : "—";
          return (
            <div key={b.id} className="ops-backend-card">
              <div className="ops-backend-head">
                <div className="ops-backend-name">
                  {b.id}
                  <span className="processor">{b.processor}</span>
                </div>
                <div className="ops-health-status healthy">online</div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  lineHeight: 1.4,
                }}
              >
                {b.qubits} qubits · queue {b.queue} · last cal {calAgo}
              </div>
              <div className="ops-backend-grid">
                <Stat v={`${b.t1Us.toFixed(0)}μs`} l="median T1" />
                <Stat v={`${b.t2Us.toFixed(0)}μs`} l="median T2" />
                <Stat v={b.readoutFidelity.toFixed(3)} l="readout fid" />
                <Stat v={b.twoQGateError.toFixed(3)} l="2Q error" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel-footer">
        <span>ibm_runtime/backends</span>
        <span>
          <em>
            {onlineCount}/{backends.backends.length} backends online
          </em>
        </span>
      </div>
    </section>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="ops-backend-stat">
      <div className="ops-backend-stat-v">{v}</div>
      <div className="ops-backend-stat-l">{l}</div>
    </div>
  );
}
