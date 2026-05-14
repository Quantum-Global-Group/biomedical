from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from hetqml_api.jobs.runner import Runner
from hetqml_api.observability import RequestIdMiddleware
from hetqml_api.ops.provider import CannedOpsProvider
from hetqml_api.persistence.sqlite import (
    SqliteDecisionStore,
    SqliteJobStore,
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
    molecule,
    notes,
    ops,
    preregistration,
    settings as settings_router,
)
from hetqml_api.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if os.getenv("HETQML_SEED_DEMO_JOBS", "").strip().lower() in {
            "1",
            "true",
            "yes",
        }:
            from hetqml_api.jobs.demo_seed import ensure_demo_jobs_on_startup

            await ensure_demo_jobs_on_startup(app.state.job_store)
        try:
            yield
        finally:  # pragma: no cover - lifecycle
            app.state.sqlite_conn.close()

    app = FastAPI(title="hetqml-api", version="0.1.0", lifespan=lifespan)

    # Hugging Face Spaces: pages are served from *.hf.space; allow_origin_regex must
    # match the browser Origin header. Add explicit origins via ALLOWED_ORIGINS too.
    _local_origin_re = r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"
    _hf_space_re = (
        r"^https://[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.hf\.space$"
    )
    _hf_hub_re = r"^https://huggingface\.co$"

    # Request-id middleware runs *inside* CORS so the echoed `X-Request-ID`
    # header is part of the CORS-exposed response surface. Starlette applies
    # middleware in reverse-add order, so CORS goes on last to wrap everything.
    app.add_middleware(RequestIdMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        # Any port on localhost / 127.0.0.1 (e.g. Next on 3000, Cursor 52xxx).
        # Include IPv6 loopback — some dev setups open Next at http://[::1]:3000.
        allow_origin_regex=rf"{_local_origin_re}|{_hf_space_re}|{_hf_hub_re}",
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        # `X-Request-ID` must be in `expose_headers` for browser JS to read it
        # off `Response.headers` (CORS hides non-simple response headers by
        # default). Support tooling needs this to mirror the id back to users.
        expose_headers=["X-Request-ID"],
    )

    # Stash the resolved Settings on app.state so routers that need
    # per-instance config (e.g. preregistration.bootstrap_ci_path) can
    # read it via deps.get_app_settings rather than the lru_cached
    # module-level get_settings(), which can't be overridden per test.
    app.state.settings = cfg

    # sqlite-backed persistence (jobs, decisions, skeptic notes, user
    # settings). The connection is shared across stores; each store carries
    # its own asyncio.Lock so writes serialize without contending on reads.
    # Jobs went from InMemoryJobStore → SqliteJobStore so they survive
    # `uvicorn --reload` and process restarts.
    sqlite_conn = open_connection(cfg.sqlite_path)
    init_schema(sqlite_conn)
    app.state.sqlite_conn = sqlite_conn
    app.state.decision_store = SqliteDecisionStore(sqlite_conn)
    app.state.note_store = SqliteNoteStore(sqlite_conn)
    app.state.settings_store = SqliteSettingsStore(sqlite_conn)

    job_store = SqliteJobStore(sqlite_conn)
    app.state.job_store = job_store
    # The runner needs settings to resolve IBM credentials per-job for the
    # quantum/hybrid families; we pass the settings_store rather than a
    # snapshot so credential rotations take effect on the next job.
    app.state.job_runner = Runner(job_store, settings_store=app.state.settings_store)
    app.state.ops_provider = CannedOpsProvider(ibm_crn=cfg.ibm_crn or None)

    app.include_router(investigations.router)
    app.include_router(jobs.router)
    app.include_router(catalog.router)
    app.include_router(ops.router)
    app.include_router(decisions.router)
    app.include_router(notes.router)
    app.include_router(settings_router.router)
    app.include_router(preregistration.router)
    app.include_router(molecule.router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
