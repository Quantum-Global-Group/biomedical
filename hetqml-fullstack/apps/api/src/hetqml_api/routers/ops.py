"""Operations endpoints — eight panel feeds for the Operations dashboard.

The router is thin on purpose: each endpoint is one provider call. The
provider interface (`hetqml_api.ops.provider.OpsProvider`) is a Protocol
so the v1 canned implementation can be swapped for a real probe later
without touching the router or the wire format.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from hetqml_api.deps import get_ops_provider
from hetqml_api.ops.provider import OpsProvider
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

router = APIRouter(prefix="/ops", tags=["ops"])


@router.get("/health", response_model=OpsHealth)
async def get_ops_health(provider: OpsProvider = Depends(get_ops_provider)) -> OpsHealth:
    return provider.health()


@router.get("/ibm-workload", response_model=IbmWorkload)
async def get_ibm_workload(provider: OpsProvider = Depends(get_ops_provider)) -> IbmWorkload:
    return provider.ibm_workload()


@router.get("/backends", response_model=OpsBackends)
async def get_backends(provider: OpsProvider = Depends(get_ops_provider)) -> OpsBackends:
    return provider.backends()


@router.get("/jobs", response_model=OpsJobs)
async def get_ops_jobs(provider: OpsProvider = Depends(get_ops_provider)) -> OpsJobs:
    return provider.jobs()


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
