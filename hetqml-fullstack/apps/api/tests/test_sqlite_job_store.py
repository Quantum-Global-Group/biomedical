"""SqliteJobStore round-trip + restart-survives test."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from hetqml_api.persistence.sqlite import (
    SqliteJobStore,
    init_schema,
    open_connection,
)
from hetqml_api.schemas import Job, RunPath, Selection


def _job(jid: str = "abc123") -> Job:
    return Job(
        id=jid,
        status="queued",
        selection=Selection(
            disease="Alzheimer disease",
            compound="Donepezil",
            gene="APOE",
            metaedge="CtD",
        ),
        run_path=RunPath(mode="quick", family="hybrid"),
        created_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_create_and_get_round_trips(tmp_path):
    db = tmp_path / "jobs.sqlite"
    conn = open_connection(db)
    init_schema(conn)
    store = SqliteJobStore(conn)

    job = _job()
    await store.create(job)
    got = await store.get(job.id)
    assert got is not None
    assert got.id == job.id
    assert got.selection.compound == "Donepezil"
    assert got.run_path.family == "hybrid"


@pytest.mark.asyncio
async def test_update_overwrites_payload(tmp_path):
    db = tmp_path / "jobs.sqlite"
    conn = open_connection(db)
    init_schema(conn)
    store = SqliteJobStore(conn)

    job = _job()
    await store.create(job)
    completed = job.model_copy(
        update={"status": "completed", "completed_at": datetime.now(UTC)}
    )
    await store.update(completed)

    got = await store.get(job.id)
    assert got is not None
    assert got.status == "completed"
    assert got.completed_at is not None


@pytest.mark.asyncio
async def test_jobs_survive_reconnect(tmp_path):
    """The whole point of moving off InMemoryJobStore: state must persist
    across "process restarts" (modeled here as closing + reopening the
    connection)."""
    db = tmp_path / "jobs.sqlite"

    conn = open_connection(db)
    init_schema(conn)
    store = SqliteJobStore(conn)
    await store.create(_job("persist-1"))
    await store.create(_job("persist-2"))
    conn.close()

    # Simulate uvicorn --reload bouncing the process.
    conn2 = open_connection(db)
    init_schema(conn2)
    store2 = SqliteJobStore(conn2)

    rows = await store2.list()
    assert {j.id for j in rows} == {"persist-1", "persist-2"}


@pytest.mark.asyncio
async def test_get_unknown_job_returns_none(tmp_path):
    db = tmp_path / "jobs.sqlite"
    conn = open_connection(db)
    init_schema(conn)
    store = SqliteJobStore(conn)

    assert await store.get("does-not-exist") is None
