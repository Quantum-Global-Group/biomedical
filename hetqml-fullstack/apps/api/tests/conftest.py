from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from hetqml_api.jobs.runner import Runner
from hetqml_api.jobs.store import InMemoryJobStore
from hetqml_api.main import create_app
from hetqml_api.settings import Settings


@pytest.fixture
def app():
    """Fresh app per test with a fast (sleep ~0) runner so polling tests stay quick."""
    settings = Settings(allowed_origins="http://localhost:3000")
    application = create_app(settings)
    store = InMemoryJobStore()
    application.state.job_store = store
    application.state.job_runner = Runner(store, runtime_seconds=0.01)
    return application


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
