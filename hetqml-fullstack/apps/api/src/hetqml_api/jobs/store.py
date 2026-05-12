"""Job storage abstraction.

``JobStore`` is a Protocol so tests can swap implementations. Production uses
``SqliteJobStore`` in ``hetqml_api.persistence.sqlite`` (wired from
``create_app`` in ``main.py``). ``InMemoryJobStore`` here is for fast unit tests
and fixtures that override ``app.state.job_store``.
"""

from __future__ import annotations

import asyncio
from typing import Protocol

from hetqml_api.schemas import Job


class JobStore(Protocol):
    async def create(self, job: Job) -> Job: ...
    async def get(self, job_id: str) -> Job | None: ...
    async def update(self, job: Job) -> Job: ...
    async def list(self) -> list[Job]: ...


class InMemoryJobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = asyncio.Lock()

    async def create(self, job: Job) -> Job:
        async with self._lock:
            self._jobs[job.id] = job
            return job

    async def get(self, job_id: str) -> Job | None:
        async with self._lock:
            return self._jobs.get(job_id)

    async def update(self, job: Job) -> Job:
        async with self._lock:
            self._jobs[job.id] = job
            return job

    async def list(self) -> list[Job]:
        async with self._lock:
            return list(self._jobs.values())
