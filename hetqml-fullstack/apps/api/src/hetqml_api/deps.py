"""FastAPI dependency providers.

Singletons live on `app.state` so tests can override them per-app instance.
"""

from __future__ import annotations

from fastapi import Request

from hetqml_api.jobs.runner import Runner
from hetqml_api.jobs.store import JobStore
from hetqml_api.ops.provider import OpsProvider
from hetqml_api.persistence.protocols import DecisionStore, NoteStore, SettingsStore
from hetqml_api.settings import Settings


def get_store(request: Request) -> JobStore:
    return request.app.state.job_store  # type: ignore[no-any-return]


def get_runner(request: Request) -> Runner:
    return request.app.state.job_runner  # type: ignore[no-any-return]


def get_ops_provider(request: Request) -> OpsProvider:
    return request.app.state.ops_provider  # type: ignore[no-any-return]


def get_decision_store(request: Request) -> DecisionStore:
    return request.app.state.decision_store  # type: ignore[no-any-return]


def get_note_store(request: Request) -> NoteStore:
    return request.app.state.note_store  # type: ignore[no-any-return]


def get_settings_store(request: Request) -> SettingsStore:
    return request.app.state.settings_store  # type: ignore[no-any-return]


def get_app_settings(request: Request) -> Settings:
    """Return the per-app Settings instance (stashed on app.state by
    create_app). Tests override Settings per-app, so routers must NOT
    use the lru_cached `get_settings()` function from settings.py.
    """
    return request.app.state.settings  # type: ignore[no-any-return]
