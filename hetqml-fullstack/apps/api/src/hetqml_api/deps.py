"""FastAPI dependency providers.

Singletons live on `app.state` so tests can override them per-app instance.
"""

from __future__ import annotations

from fastapi import Request

from hetqml_api.jobs.runner import Runner
from hetqml_api.jobs.store import JobStore


def get_store(request: Request) -> JobStore:
    return request.app.state.job_store  # type: ignore[no-any-return]


def get_runner(request: Request) -> Runner:
    return request.app.state.job_runner  # type: ignore[no-any-return]
