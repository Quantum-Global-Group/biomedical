from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from hetqml_api.deps import get_runner, get_store
from hetqml_api.jobs.runner import Runner
from hetqml_api.jobs.store import JobStore
from hetqml_api.schemas import Job, RunInvestigationRequest

router = APIRouter(prefix="/investigations", tags=["investigations"])


@router.post("/run", response_model=Job)
async def run_investigation(
    payload: RunInvestigationRequest,
    store: JobStore = Depends(get_store),
    runner: Runner = Depends(get_runner),
) -> Job:
    job = Job(
        id=uuid.uuid4().hex,
        status="queued",
        selection=payload.selection,
        run_path=payload.run_path,
        created_at=datetime.now(UTC),
    )
    await store.create(job)
    runner.schedule(job)
    return job
