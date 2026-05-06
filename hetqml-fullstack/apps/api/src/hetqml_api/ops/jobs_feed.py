"""Map persisted `Job` rows (Initialize / investigations runs) to `OpsJobs`."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from hetqml_api.schemas import (
    Job,
    JobHistoryEntry,
    JobQueueEntry,
    OpsJobs,
)

_ACTIVE_QUEUE_STATUS = {"queued", "running"}


def investigation_jobs_to_ops(
    jobs: list[Job],
    *,
    now: datetime | None = None,
    history_limit: int = 30,
) -> OpsJobs:
    """Build the Operations job queue + history from sqlite-backed runs.

    Active rows are jobs still `queued` or `running`. Completed / failed
    rows land in history (newest first).
    """
    clock = now or datetime.now(UTC)

    active_jobs = [j for j in jobs if j.status in _ACTIVE_QUEUE_STATUS]
    active_jobs.sort(key=lambda j: j.created_at)

    history_jobs = [j for j in jobs if j.status in {"completed", "failed"}]
    history_jobs.sort(key=lambda j: j.created_at, reverse=True)
    history_jobs = history_jobs[:history_limit]

    queue: list[JobQueueEntry] = []
    for j in active_jobs:
        st: Literal["queued", "running"] = (
            "queued" if j.status == "queued" else "running"
        )
        progress = 5 if j.status == "queued" else min(
            92, 40 + int(clock.timestamp()) % 50
        )
        queue.append(
            JobQueueEntry(
                id=j.id,
                type=_job_type_label(j),
                candidate=f"{j.selection.compound} → {j.selection.disease}",
                backend=_backend_label(j),
                status=st,
                progress_pct=progress,
                eta_seconds=180 if j.status == "queued" else 45,
            )
        )

    history: list[JobHistoryEntry] = []
    for j in history_jobs:
        duration = 0.0
        if j.completed_at is not None:
            duration = max(
                0.0,
                (j.completed_at - j.created_at).total_seconds(),
            )
        started_ago = 0
        if j.completed_at is not None:
            started_ago = max(0, int((clock - j.completed_at).total_seconds()))

        top = _top_model(j)
        history.append(
            JobHistoryEntry(
                id=j.id,
                candidate=j.selection.compound[:80],
                disease=j.selection.disease[:80],
                top_model=top,
                family=j.run_path.family,
                status="failed" if j.status == "failed" else "completed",
                duration_seconds=round(duration, 2),
                cost_usd=0.0,
                started_ago_seconds=started_ago,
            )
        )

    return OpsJobs(queue=queue, history=history)


def _job_type_label(job: Job) -> str:
    fam = job.run_path.family
    if fam == "classical":
        return "Classical"
    if fam == "hybrid":
        return "Hybrid QSVC"
    return "Quantum"


def _backend_label(job: Job) -> str:
    if job.result is not None and job.result.quantum_circuit.backend:
        return str(job.result.quantum_circuit.backend)
    fam = job.run_path.family
    if fam == "classical":
        return "cpu-pool"
    return "aer_simulator (local)"


def _top_model(job: Job) -> str:
    if job.result is None:
        return "—"
    rows = job.result.leaderboard
    if not rows:
        return "—"
    for row in rows:
        if row.is_top:
            return row.model
    return rows[0].model
