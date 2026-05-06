"""sqlite-backed implementations of `DecisionStore`, `NoteStore`, `SettingsStore`.

stdlib `sqlite3` only — no extra dependencies. The connection is opened
once per app, configured for WAL + foreign keys, and shared via a single
`asyncio.Lock` so concurrent FastAPI requests serialize their writes.
For v1 traffic (a single reviewer) this is more than fast enough; if/when
the load profile changes the backend swaps via the Protocol in
`protocols.py` without touching routers.

Design notes:
- Schema is created on startup if missing (idempotent).
- All complex Pydantic objects (DecisionRecord, UserSettings) are stored
  as JSON blobs; only the indexed columns (pair_key, timestamp, owner)
  are normalized.  This keeps schema migrations cheap while the wire
  shape is still settling.
- All methods are `async` — sqlite calls happen under a `to_thread`
  shim so the asyncio loop is never blocked.
"""

from __future__ import annotations

import asyncio
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

from hetqml_api.schemas import DecisionRecord, Job, SkepticNote, UserSettings


def open_connection(path: Path) -> sqlite3.Connection:
    """Open (and prepare) the sqlite connection used by the stores.

    `check_same_thread=False` is safe because every call goes through
    `asyncio.to_thread` and is serialized by the per-store lock.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    """Create tables if missing.  Idempotent — safe to call on every boot."""
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS decisions (
            id          TEXT PRIMARY KEY,
            pair_key    TEXT NOT NULL,
            timestamp   TEXT NOT NULL,
            payload     TEXT NOT NULL  -- DecisionRecord serialized as JSON
        );
        CREATE INDEX IF NOT EXISTS idx_decisions_pair ON decisions(pair_key);
        CREATE INDEX IF NOT EXISTS idx_decisions_ts ON decisions(timestamp DESC);

        CREATE TABLE IF NOT EXISTS skeptic_notes (
            pair_key    TEXT PRIMARY KEY,
            body        TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            owner       TEXT PRIMARY KEY,
            payload     TEXT NOT NULL,  -- UserSettings as JSON
            updated_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id            TEXT PRIMARY KEY,
            status        TEXT NOT NULL,
            created_at    TEXT NOT NULL,
            completed_at  TEXT,
            payload       TEXT NOT NULL  -- Job model serialized as JSON
        );
        CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        """
    )
    conn.commit()


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


# --- Decision store --------------------------------------------------------


class SqliteDecisionStore:
    def __init__(self, conn: sqlite3.Connection, *, lock: asyncio.Lock | None = None) -> None:
        self._conn = conn
        self._lock = lock or asyncio.Lock()

    async def create(self, record: DecisionRecord) -> DecisionRecord:
        # Auto-fill id if the caller (router) hands us a sentinel.
        if not record.id:
            record = record.model_copy(update={"id": uuid.uuid4().hex})
        payload = record.model_dump_json(by_alias=True)

        def _write() -> None:
            self._conn.execute(
                "INSERT INTO decisions (id, pair_key, timestamp, payload) VALUES (?, ?, ?, ?)",
                (record.id, record.pair_key, record.timestamp.isoformat(), payload),
            )
            self._conn.commit()

        async with self._lock:
            await asyncio.to_thread(_write)
        return record

    async def list(self, *, limit: int = 50) -> list[DecisionRecord]:
        def _read() -> list[sqlite3.Row]:
            return list(
                self._conn.execute(
                    "SELECT payload FROM decisions ORDER BY timestamp DESC LIMIT ?",
                    (limit,),
                )
            )

        async with self._lock:
            rows = await asyncio.to_thread(_read)
        return [DecisionRecord.model_validate_json(r["payload"]) for r in rows]

    async def list_for_pair(self, pair_key: str) -> list[DecisionRecord]:
        def _read() -> list[sqlite3.Row]:
            return list(
                self._conn.execute(
                    "SELECT payload FROM decisions WHERE pair_key = ? ORDER BY timestamp DESC",
                    (pair_key,),
                )
            )

        async with self._lock:
            rows = await asyncio.to_thread(_read)
        return [DecisionRecord.model_validate_json(r["payload"]) for r in rows]


# --- Note store ------------------------------------------------------------


class SqliteNoteStore:
    def __init__(self, conn: sqlite3.Connection, *, lock: asyncio.Lock | None = None) -> None:
        self._conn = conn
        self._lock = lock or asyncio.Lock()

    async def get(self, pair_key: str) -> SkepticNote | None:
        def _read() -> sqlite3.Row | None:
            cur = self._conn.execute(
                "SELECT pair_key, body, updated_at FROM skeptic_notes WHERE pair_key = ?",
                (pair_key,),
            )
            return cur.fetchone()

        async with self._lock:
            row = await asyncio.to_thread(_read)
        if row is None:
            return None
        return SkepticNote(
            pair_key=row["pair_key"],
            body=row["body"],
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    async def upsert(self, note: SkepticNote) -> SkepticNote:
        # Always re-stamp `updated_at` server-side on write.
        stamped = note.model_copy(update={"updated_at": datetime.now(UTC)})

        def _write() -> None:
            self._conn.execute(
                """
                INSERT INTO skeptic_notes (pair_key, body, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(pair_key) DO UPDATE SET
                    body = excluded.body,
                    updated_at = excluded.updated_at
                """,
                (stamped.pair_key, stamped.body, stamped.updated_at.isoformat()),
            )
            self._conn.commit()

        async with self._lock:
            await asyncio.to_thread(_write)
        return stamped


# --- Settings store --------------------------------------------------------


class SqliteSettingsStore:
    def __init__(self, conn: sqlite3.Connection, *, lock: asyncio.Lock | None = None) -> None:
        self._conn = conn
        self._lock = lock or asyncio.Lock()

    async def get(self, owner: str) -> UserSettings:
        def _read() -> sqlite3.Row | None:
            cur = self._conn.execute(
                "SELECT payload FROM settings WHERE owner = ?",
                (owner,),
            )
            return cur.fetchone()

        async with self._lock:
            row = await asyncio.to_thread(_read)
        if row is None:
            return UserSettings()
        return UserSettings.model_validate_json(row["payload"])

    async def put(self, owner: str, settings: UserSettings) -> UserSettings:
        payload = settings.model_dump_json(by_alias=True)
        ts = _now_iso()

        def _write() -> None:
            self._conn.execute(
                """
                INSERT INTO settings (owner, payload, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(owner) DO UPDATE SET
                    payload = excluded.payload,
                    updated_at = excluded.updated_at
                """,
                (owner, payload, ts),
            )
            self._conn.commit()

        async with self._lock:
            await asyncio.to_thread(_write)
        return settings


# --- Job store -------------------------------------------------------------


class SqliteJobStore:
    """File-backed job store.

    Implements the `JobStore` protocol from `jobs/store.py`.  Persists each
    job as a JSON blob keyed by id; status + created_at are normalized so
    queries (e.g. listing recent runs) don't have to scan-and-parse every
    row.  Survives `uvicorn --reload` and process restarts.

    Concurrency model mirrors the other sqlite stores: a single connection
    serialized via the per-store `asyncio.Lock`, with the actual sqlite
    calls dispatched to a worker thread so the loop never blocks.
    """

    def __init__(
        self, conn: sqlite3.Connection, *, lock: asyncio.Lock | None = None
    ) -> None:
        self._conn = conn
        self._lock = lock or asyncio.Lock()

    async def create(self, job: Job) -> Job:
        payload = job.model_dump_json(by_alias=True)
        completed = job.completed_at.isoformat() if job.completed_at else None

        def _write() -> None:
            self._conn.execute(
                """
                INSERT INTO jobs (id, status, created_at, completed_at, payload)
                VALUES (?, ?, ?, ?, ?)
                """,
                (job.id, job.status, job.created_at.isoformat(), completed, payload),
            )
            self._conn.commit()

        async with self._lock:
            await asyncio.to_thread(_write)
        return job

    async def get(self, job_id: str) -> Job | None:
        def _read() -> sqlite3.Row | None:
            cur = self._conn.execute(
                "SELECT payload FROM jobs WHERE id = ?",
                (job_id,),
            )
            return cur.fetchone()

        async with self._lock:
            row = await asyncio.to_thread(_read)
        if row is None:
            return None
        return Job.model_validate_json(row["payload"])

    async def update(self, job: Job) -> Job:
        # Upsert — runner often calls update before create has flushed in
        # certain race conditions during shutdown; ON CONFLICT keeps the
        # call site simple.
        payload = job.model_dump_json(by_alias=True)
        completed = job.completed_at.isoformat() if job.completed_at else None

        def _write() -> None:
            self._conn.execute(
                """
                INSERT INTO jobs (id, status, created_at, completed_at, payload)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status = excluded.status,
                    completed_at = excluded.completed_at,
                    payload = excluded.payload
                """,
                (job.id, job.status, job.created_at.isoformat(), completed, payload),
            )
            self._conn.commit()

        async with self._lock:
            await asyncio.to_thread(_write)
        return job

    async def list(self) -> list[Job]:
        def _read() -> list[sqlite3.Row]:
            return list(
                self._conn.execute(
                    "SELECT payload FROM jobs ORDER BY created_at DESC"
                )
            )

        async with self._lock:
            rows = await asyncio.to_thread(_read)
        return [Job.model_validate_json(r["payload"]) for r in rows]
