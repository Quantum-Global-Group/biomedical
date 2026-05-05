"""Storage Protocols for review-time persistence.

The Operations dashboard, Validate page (decisions + skeptic notes), and
Settings page all need persisted state. They share a single sqlite file
in v1, but the routers depend on these Protocols rather than the concrete
sqlite class so a Postgres backend (or test double) can swap in later.

Mirrors the `JobStore`-style Protocol pattern already used for jobs.
"""

from __future__ import annotations

from typing import Protocol

from hetqml_api.schemas import (
    DecisionRecord,
    SkepticNote,
    UserSettings,
)


class DecisionStore(Protocol):
    async def create(self, record: DecisionRecord) -> DecisionRecord: ...
    async def list(self, *, limit: int = 50) -> list[DecisionRecord]: ...
    async def list_for_pair(self, pair_key: str) -> list[DecisionRecord]: ...


class NoteStore(Protocol):
    async def get(self, pair_key: str) -> SkepticNote | None: ...
    async def upsert(self, note: SkepticNote) -> SkepticNote: ...


class SettingsStore(Protocol):
    async def get(self, owner: str) -> UserSettings: ...
    async def put(self, owner: str, settings: UserSettings) -> UserSettings: ...
