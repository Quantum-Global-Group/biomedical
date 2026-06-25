"""Stable demo investigations (materialized offline for booth / seeded API).

Stable ids reserved for upsert seeding (`HETQML_SEED_DEMO_JOBS=1`).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from hetqml_api.jobs.runner import simulate_run
from hetqml_api.ml.algorithms import run_algorithm_with_probs
from hetqml_api.schemas import Job, RunPath, Selection

DEMO_SELECTION = Selection(
    disease="Hypertension-attributed ESKD",
    compound="Inaxaplin",
    gene="APOL1",
    metaedge="CtD · Compound–treats–Disease",
)

DEMO_JOB_SPECS: tuple[tuple[str, Literal["classical", "hybrid", "quantum", "stacking"]], ...] = (
    ("hetqml-demo-classical-v1", "classical"),
    ("hetqml-demo-hybrid-v1", "hybrid"),
    ("hetqml-demo-quantum-aer-v1", "quantum"),
    ("hetqml-demo-stacking-v1", "stacking"),
)


def materialize_demo_job(
    job_id: str,
    family: Literal["classical", "hybrid", "quantum", "stacking"],
) -> Job:
    """Run real dispatcher + simulate_run synchronously — matches production envelopes."""
    t0 = datetime(2026, 1, 15, 12, 0, 0, tzinfo=UTC)
    t1 = datetime(2026, 1, 15, 12, 0, 45, tzinfo=UTC)
    shell = Job(
        id=job_id,
        status="running",
        selection=DEMO_SELECTION,
        run_path=RunPath(mode="quick", family=family),
        created_at=t0,
    )
    algo, probs = run_algorithm_with_probs(family, DEMO_SELECTION)
    result = simulate_run(shell, algo=algo, probs=probs)
    return shell.model_copy(
        update={
            "status": "completed",
            "metrics": result.metrics,
            "result": result,
            "completed_at": t1,
        }
    )
