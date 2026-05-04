"""Stubbed async job runner.

Establishes the queued → running → completed lifecycle the real ML pipeline
will use. For v1 it sleeps and stamps deterministic canned metrics derived
from the selection so the UI exercises the full polling path.
"""

from __future__ import annotations

import asyncio
import hashlib
from datetime import UTC, datetime

from hetqml_api.jobs.store import JobStore
from hetqml_api.schemas import Job, JobMetrics


def simulate_run(job: Job) -> JobMetrics:
    """Deterministic pseudo-metrics derived from the selection.

    Two selections that differ only in run-path family produce slightly
    different metrics so the UI shows the family choice mattering.
    """
    seed_input = "|".join(
        [
            job.selection.disease,
            job.selection.compound,
            job.selection.gene,
            job.selection.metaedge,
            job.run_path.family,
        ]
    )
    digest = hashlib.sha256(seed_input.encode("utf-8")).digest()
    samples = [b / 255 for b in digest[:4]]
    pr, roc, brier, ece = samples
    return JobMetrics(
        pr_auc=round(0.55 + 0.40 * pr, 4),
        roc_auc=round(0.60 + 0.35 * roc, 4),
        brier=round(0.05 + 0.10 * brier, 4),
        ece=round(0.01 + 0.06 * ece, 4),
    )


class Runner:
    """Schedules background simulation of jobs against a JobStore."""

    def __init__(self, store: JobStore, *, runtime_seconds: float = 2.0) -> None:
        self._store = store
        self._runtime_seconds = runtime_seconds

    def schedule(self, job: Job) -> asyncio.Task[None]:
        return asyncio.create_task(self._run(job.id))

    async def _run(self, job_id: str) -> None:
        job = await self._store.get(job_id)
        if job is None:
            return
        running = job.model_copy(update={"status": "running"})
        await self._store.update(running)

        try:
            await asyncio.sleep(self._runtime_seconds)
            metrics = simulate_run(running)
            completed = running.model_copy(
                update={
                    "status": "completed",
                    "metrics": metrics,
                    "completed_at": datetime.now(UTC),
                }
            )
            await self._store.update(completed)
        except Exception as exc:  # pragma: no cover - defensive
            failed = running.model_copy(
                update={
                    "status": "failed",
                    "error": str(exc),
                    "completed_at": datetime.now(UTC),
                }
            )
            await self._store.update(failed)
