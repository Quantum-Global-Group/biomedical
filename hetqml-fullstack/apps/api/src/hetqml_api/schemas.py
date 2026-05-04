from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(part.capitalize() for part in rest)


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_to_camel)


class Selection(BaseModel):
    disease: str
    compound: str
    gene: str
    metaedge: str


class RunPath(BaseModel):
    mode: Literal["quick", "custom"] = "quick"
    family: Literal["classical", "hybrid", "quantum"] = "hybrid"


class RunInvestigationRequest(BaseModel):
    selection: Selection
    run_path: RunPath = Field(default_factory=RunPath)


JobStatus = Literal["queued", "running", "completed", "failed"]


class JobMetrics(CamelModel):
    pr_auc: float
    roc_auc: float
    brier: float
    ece: float


class Job(CamelModel):
    id: str
    status: JobStatus
    selection: Selection
    run_path: RunPath
    created_at: datetime
    completed_at: datetime | None = None
    metrics: JobMetrics | None = None
    error: str | None = None
