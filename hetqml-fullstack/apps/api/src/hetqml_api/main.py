from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from hetqml_api.jobs.runner import Runner
from hetqml_api.jobs.store import InMemoryJobStore
from hetqml_api.routers import investigations, jobs
from hetqml_api.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or get_settings()
    app = FastAPI(title="hetqml-api", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["content-type"],
    )

    store = InMemoryJobStore()
    app.state.job_store = store
    app.state.job_runner = Runner(store)

    app.include_router(investigations.router)
    app.include_router(jobs.router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
