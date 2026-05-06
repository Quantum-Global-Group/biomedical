"""Decision audit log endpoints (Validate page).

The Validate page records keep/review/reject calls server-side now (sqlite),
not just localStorage, so the audit history survives across browsers and
team members. The router accepts the request shape the page already builds
(`DecisionCreateRequest`) and stamps id/timestamp server-side.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query

from hetqml_api.deps import get_decision_store
from hetqml_api.persistence.protocols import DecisionStore
from hetqml_api.schemas import DecisionCreateRequest, DecisionRecord

router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.post("", response_model=DecisionRecord)
async def create_decision(
    payload: DecisionCreateRequest,
    store: DecisionStore = Depends(get_decision_store),
) -> DecisionRecord:
    record = DecisionRecord(
        id=uuid.uuid4().hex,
        pair_key=payload.pair_key,
        verdict=payload.verdict,
        reviewer=payload.reviewer,
        session_id=payload.session_id,
        selection=payload.selection,
        run_path=payload.run_path,
        top_model=payload.top_model,
        model_score=payload.model_score,
        trust_score=payload.trust_score,
        trust_axes=payload.trust_axes,
        guards_compromised=payload.guards_compromised,
        integrity_guards=payload.integrity_guards,
        job_id=payload.job_id,
        cv_std=payload.cv_std,
        evidence_sources=payload.evidence_sources,
        timestamp=datetime.now(UTC),
        note=payload.note,
    )
    return await store.create(record)


@router.get("", response_model=list[DecisionRecord])
async def list_decisions(
    pair_key: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    store: DecisionStore = Depends(get_decision_store),
) -> list[DecisionRecord]:
    if pair_key:
        return await store.list_for_pair(pair_key)
    return await store.list(limit=limit)
