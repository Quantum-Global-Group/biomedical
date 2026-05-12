"""Production parity: ``create_app`` wires SQLite-backed job persistence.

``conftest.py`` replaces ``app.state.job_store`` with ``InMemoryJobStore`` for
most HTTP tests so polling stays fast. This module asserts the **default**
factory wiring matches Fly/local prod (``SqliteJobStore`` on the shared
connection from ``open_connection`` / ``init_schema``).
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from hetqml_api.main import create_app
from hetqml_api.persistence.sqlite import SqliteJobStore
from hetqml_api.schemas import Job, RunPath, Selection
from hetqml_api.settings import Settings


def _minimal_job(job_id: str = "wiring-test-01") -> Job:
    return Job(
        id=job_id,
        status="queued",
        selection=Selection(
            disease="Hypertension",
            compound="Lisinopril",
            gene="ACE",
            metaedge="CtD · Compound–treats–Disease",
        ),
        run_path=RunPath(),
        created_at=datetime.now(UTC),
    )


def test_create_app_attaches_sqlite_job_store(tmp_path) -> None:
    app = create_app(
        Settings(allowed_origins="http://localhost:3000", data_dir=tmp_path)
    )
    assert isinstance(app.state.job_store, SqliteJobStore)


@pytest.mark.asyncio
async def test_sqlite_job_store_on_default_app_round_trips(tmp_path) -> None:
    app = create_app(
        Settings(allowed_origins="http://localhost:3000", data_dir=tmp_path)
    )
    store = app.state.job_store
    assert isinstance(store, SqliteJobStore)
    job = _minimal_job()
    await store.create(job)
    got = await store.get(job.id)
    assert got is not None
    assert got.selection.compound == "Lisinopril"
