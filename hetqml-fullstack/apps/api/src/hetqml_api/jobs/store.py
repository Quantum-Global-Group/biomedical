"""Job storage abstraction.

The interface keeps job state behind a Protocol so swapping the in-memory
implementation for Postgres later is a single-file change. v1 deliberately
ships only the in-memory variant.
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
