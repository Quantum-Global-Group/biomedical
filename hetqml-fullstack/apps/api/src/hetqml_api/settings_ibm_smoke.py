"""Minimal IBM Quantum Runtime smoke test (sampler on a 1-qubit circuit).

Used by ``POST /settings/ibm/smoke-test``. Prefers cloud simulators for speed;
falls back to the user's default backend when set (may queue on hardware).
"""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

SMOKE_SHOTS = 100
SMOKE_RESULT_TIMEOUT_SEC = 300.0


def _outcome_summary(counts: dict[Any, int], shots: int) -> str:
    if not counts or shots <= 0:
        return "∅"
    pairs = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)

    def _fmt(kv: tuple[Any, int]) -> str:
        bit, ct = kv
        pct = 100.0 * ct / shots
        return f"{bit}:{pct:.0f}%"

    return " · ".join(_fmt(kv) for kv in pairs[:3])


def _pick_backend(service: Any, *, instance: str, preferred: str) -> Any:
    preferred = preferred.strip()
    if preferred:
        try:
            return service.backend(preferred, instance=instance)
        except Exception as exc:
            logger.info(
                "IBM smoke test: backend %r unavailable (%s); falling back.",
                preferred,
                exc,
            )

    try:
        sims = sorted(
            [
                b
                for b in service.backends()
                if getattr(b, "simulator", False)
                and int(getattr(b, "num_qubits", 0) or 0) >= 1
            ],
            key=lambda b: int(getattr(b, "num_qubits", 999)),
        )
    except Exception as exc:
        logger.info("IBM smoke test: backends() simulator scan failed (%s)", exc)
        sims = []

    if sims:
        return sims[0]

    try:
        return service.least_busy(operational=True, simulator=True)
    except Exception:
        pass
    return service.least_busy(operational=True)


def _pub_counts(pub: Any) -> dict[str, int]:
    data = pub.data
    if hasattr(data, "c") and data.c is not None:
        raw = data.c.get_counts()
    elif hasattr(data, "meas") and data.meas is not None:
        raw = data.meas.get_counts()
    else:
        raw = {}
    return {str(k): int(v) for k, v in raw.items()}


def run_ibm_smoke_sync(
    api_token: str,
    crn: str,
    *,
    preferred_backend: str = "",
) -> dict[str, Any]:
    """Execute one sampler job; returns a dict for ``IbmSmokeTestResult``.

    Raises ``ValueError`` with a user-facing message on failure.
    """
    from qiskit import QuantumCircuit, transpile
    from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2

    t0 = time.perf_counter()
    service = QiskitRuntimeService(
        channel="ibm_quantum_platform",
        token=api_token,
        instance=crn,
    )
    backend = _pick_backend(service, instance=crn, preferred=preferred_backend)
    backend_name = str(getattr(backend, "name", backend))
    simulator = bool(getattr(backend, "simulator", False))

    qc = QuantumCircuit(1)
    qc.h(0)
    qc.measure_all()
    tqc = transpile(qc, backend, optimization_level=1)
    sampler = SamplerV2(mode=backend)
    hw_job = sampler.run([tqc], shots=SMOKE_SHOTS)
    primitive_result = hw_job.result(timeout=SMOKE_RESULT_TIMEOUT_SEC)

    runtime_job_id = ""
    try:
        runtime_job_id = str(hw_job.job_id())
    except Exception:
        pass

    try:
        pubs = list(iter(primitive_result))
        pub = pubs[0]
        counts = _pub_counts(pub)
    except Exception as exc:
        raise ValueError(f"Unexpected sampler result shape: {exc}") from exc

    summary = _outcome_summary(counts, SMOKE_SHOTS)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    tail = ""
    try:
        tail = (" · " + runtime_job_id[:10] + "…") if len(runtime_job_id) > 12 else (
            (" · " + runtime_job_id) if runtime_job_id else ""
        )
    except Exception:
        tail = ""
    msg = (
        f"Ran {SMOKE_SHOTS}-shot sampler on {backend_name}"
        f"{' (simulator)' if simulator else ''}{tail}"
    )

    logger.info(
        "IBM smoke test ok backend=%s simulator=%s job_id=%s elapsed_ms=%s",
        backend_name,
        simulator,
        runtime_job_id or "?",
        elapsed_ms,
    )

    return {
        "backend": backend_name,
        "runtime_job_id": runtime_job_id,
        "shots": SMOKE_SHOTS,
        "elapsed_ms": elapsed_ms,
        "simulator": simulator,
        "outcome_summary": summary,
        "message": msg,
    }
