"""Optional startup seed of canned demo jobs into JobStore."""

from __future__ import annotations

import asyncio

from hetqml_api.jobs.demo_jobs import DEMO_JOB_SPECS, materialize_demo_job
from hetqml_api.jobs.store import JobStore


async def ensure_demo_jobs_on_startup(store: JobStore) -> None:
    """Upsert completed demos when operators set ``HETQML_SEED_DEMO_JOBS=1``."""

    for job_id, family in DEMO_JOB_SPECS:
        existing = await store.get(job_id)
        if existing and existing.status == "completed" and existing.result:
            continue
        job = await asyncio.to_thread(materialize_demo_job, job_id, family)
        await store.update(job)
