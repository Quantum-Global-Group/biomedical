from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from hetqml_api.jobs.runner import Runner
from hetqml_api.jobs.store import InMemoryJobStore
from hetqml_api.ops.provider import CannedOpsProvider
from hetqml_api.persistence.sqlite import (
    SqliteDecisionStore,
    SqliteNoteStore,
    SqliteSettingsStore,
    init_schema,
    open_connection,
)
from hetqml_api.routers import (
    catalog,
    decisions,
    investigations,
    jobs,
    notes,
    ops,
    settings as settings_router,
)
from hetqml_api.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Connection is opened in create_app() before the app starts
        # serving traffic; lifespan owns shutdown.
        try:
            yield
        finally:  # pragma: no cover - lifecycle
            app.state.sqlite_conn.close()

    app = FastAPI(title="hetqml-api", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["content-type"],
    )

    store = InMemoryJobStore()
    app.state.job_store = store
    app.state.job_runner = Runner(store)
    app.state.ops_provider = CannedOpsProvider(ibm_crn=cfg.ibm_crn or None)

    # sqlite-backed persistence (decisions, skeptic notes, user settings).
    # The connection is shared across stores; each store carries its own
    # asyncio.Lock so writes serialize without contending on reads.
    sqlite_conn = open_connection(cfg.sqlite_path)
    init_schema(sqlite_conn)
    app.state.sqlite_conn = sqlite_conn
    app.state.decision_store = SqliteDecisionStore(sqlite_conn)
    app.state.note_store = SqliteNoteStore(sqlite_conn)
    app.state.settings_store = SqliteSettingsStore(sqlite_conn)

    app.include_router(investigations.router)
    app.include_router(jobs.router)
    app.include_router(catalog.router)
    app.include_router(ops.router)
    app.include_router(decisions.router)
    app.include_router(notes.router)
    app.include_router(settings_router.router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
