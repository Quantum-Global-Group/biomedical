"""Operations endpoints — eight panel feeds for the Operations dashboard.

The router stays thin: most endpoints delegate to ``OpsProvider`` or focused
feed modules. ``GET /ops/ibm-workload`` merges persisted Settings BYOK and
optional IBM probing via ``ibm_workload_feed``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from hetqml_api.deps import get_app_settings, get_ops_provider, get_settings_store, get_store
from hetqml_api.jobs.store import JobStore
from hetqml_api.ops.ibm_workload_feed import build_ibm_workload
from hetqml_api.ops.jobs_feed import investigation_jobs_to_ops
from hetqml_api.ops.provider import OpsProvider
from hetqml_api.persistence.protocols import SettingsStore
from hetqml_api.schemas import (
    CostSummary,
    IbmWorkload,
    OpsAlerts,
    OpsBackends,
    OpsHealth,
    OpsJobs,
    OpsResources,
    OpsSources,
)
from hetqml_api.settings import Settings

router = APIRouter(prefix="/ops", tags=["ops"])


@router.get("/health", response_model=OpsHealth)
async def get_ops_health(provider: OpsProvider = Depends(get_ops_provider)) -> OpsHealth:
    return provider.health()


@router.get("/ibm-workload", response_model=IbmWorkload)
async def get_ibm_workload(
    provider: OpsProvider = Depends(get_ops_provider),
    settings_store: SettingsStore = Depends(get_settings_store),
    app_settings: Settings = Depends(get_app_settings),
) -> IbmWorkload:
    return await build_ibm_workload(
        provider=provider,
        settings_store=settings_store,
        app_settings=app_settings,
    )


@router.get("/backends", response_model=OpsBackends)
async def get_backends(provider: OpsProvider = Depends(get_ops_provider)) -> OpsBackends:
    return provider.backends()


@router.get("/jobs", response_model=OpsJobs)
async def get_ops_jobs(store: JobStore = Depends(get_store)) -> OpsJobs:
    jobs = await store.list()
    return investigation_jobs_to_ops(jobs)


@router.get("/resources", response_model=OpsResources)
async def get_resources(provider: OpsProvider = Depends(get_ops_provider)) -> OpsResources:
    return provider.resources()


@router.get("/cost", response_model=CostSummary)
async def get_cost(provider: OpsProvider = Depends(get_ops_provider)) -> CostSummary:
    return provider.cost()


@router.get("/sources", response_model=OpsSources)
async def get_sources(provider: OpsProvider = Depends(get_ops_provider)) -> OpsSources:
    return provider.sources()


@router.get("/alerts", response_model=OpsAlerts)
async def get_alerts(provider: OpsProvider = Depends(get_ops_provider)) -> OpsAlerts:
    return provider.alerts()
