from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from hetqml_api.deps import get_store
from hetqml_api.jobs.store import JobStore
from hetqml_api.schemas import Job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: str, store: JobStore = Depends(get_store)) -> Job:
    job = await store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"job {job_id} not found")
    return job


@router.get("", response_model=list[Job])
async def list_jobs(store: JobStore = Depends(get_store)) -> list[Job]:
    return await store.list()
