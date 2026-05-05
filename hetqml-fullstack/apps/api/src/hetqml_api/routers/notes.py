"""Skeptic-note endpoints (Validate page).

Per-pair freeform notes; one note per `compoundId::diseaseId` pair. PUT
replaces the body and re-stamps `updated_at`. GET on an unknown pair
returns 404 — the UI uses that to distinguish "never had a note" from an
empty note string.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from datetime import UTC, datetime

from hetqml_api.deps import get_note_store
from hetqml_api.persistence.protocols import NoteStore
from hetqml_api.schemas import SkepticNote, SkepticNoteUpsertRequest

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/{pair_key}", response_model=SkepticNote)
async def get_note(
    pair_key: str,
    store: NoteStore = Depends(get_note_store),
) -> SkepticNote:
    note = await store.get(pair_key)
    if note is None:
        raise HTTPException(status_code=404, detail=f"no note for pair {pair_key}")
    return note


@router.put("/{pair_key}", response_model=SkepticNote)
async def upsert_note(
    pair_key: str,
    payload: SkepticNoteUpsertRequest,
    store: NoteStore = Depends(get_note_store),
) -> SkepticNote:
    if payload.pair_key != pair_key:
        raise HTTPException(
            status_code=400,
            detail="pair_key in path and body must match",
        )
    note = SkepticNote(
        pair_key=pair_key,
        body=payload.body,
        updated_at=datetime.now(UTC),
    )
    return await store.upsert(note)
