from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from hetqml_api.jobs.runner import Runner
from hetqml_api.jobs.store import InMemoryJobStore
from hetqml_api.main import create_app
from hetqml_api.settings import Settings


@pytest.fixture
def app(tmp_path):
    """Fresh app per test with:
    - **Job store override:** ``create_app`` normally wires ``SqliteJobStore``
      (same DB as decisions/settings — see ``main.py``). We replace
      ``app.state.job_store`` with ``InMemoryJobStore`` so HTTP polling tests
      stay fast and don't contend on one sqlite file across parallel cases.
      ``tests/test_app_job_store_wiring.py`` locks the default Sqlite wiring.
    - synthetic-only runner that skips the (slow) real ML dispatcher so
      job-lifecycle tests still complete in milliseconds. Tests that
      exercise real algorithms instantiate their own Runner.
    - sqlite db rooted in a per-test tmp_path so persistence tests don't
      bleed across each other.
    """
    settings = Settings(
        allowed_origins="http://localhost:3000",
        data_dir=tmp_path,
    )
    application = create_app(settings)
    store = InMemoryJobStore()
    application.state.job_store = store
    application.state.job_runner = Runner(store, synthetic_only=True)
    return application


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
