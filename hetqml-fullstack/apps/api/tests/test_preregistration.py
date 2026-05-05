"""Tests for the /preregistration/status router.

Two cases:
  1. The configured `bootstrap_ci_path` does not exist on disk → endpoint
     returns `available=False` with the four hypotheses pre-populated as
     pending. This is the current state (the GPU run hasn't happened yet).
  2. The path exists → endpoint returns `available=True` with the four
     hypotheses still pending (markdown parsing is a v2 deliverable).

The test fixture from conftest.py builds an app rooted in a per-test
tmp_path; we override `bootstrap_ci_path` directly on Settings so each
case gets a fresh state.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from hetqml_api.jobs.runner import Runner
from hetqml_api.jobs.store import InMemoryJobStore
from hetqml_api.main import create_app
from hetqml_api.settings import Settings


@pytest.fixture
def app_with_bootstrap_path(tmp_path, request):
    """Build a fresh FastAPI app with a chosen bootstrap_ci_path.

    Param: tuple `(create_file: bool,)` — if True, write a stub markdown
    file at the configured path before the app starts.
    """
    create_file = request.param
    bootstrap_path = tmp_path / "bootstrap_ci_analysis.md"
    if create_file:
        bootstrap_path.write_text(
            "# Bootstrap CI Analysis — H1 and H1b decision rules\n\n"
            "**Run date:** 2026-05-04\n",
            encoding="utf-8",
        )
    settings = Settings(
        allowed_origins="http://localhost:3000",
        data_dir=tmp_path,
        bootstrap_ci_path=bootstrap_path,
    )
    application = create_app(settings)
    store = InMemoryJobStore()
    application.state.job_store = store
    application.state.job_runner = Runner(store, runtime_seconds=0.01)
    return application


@pytest.fixture
async def client_with_bootstrap_path(app_with_bootstrap_path):
    transport = ASGITransport(app=app_with_bootstrap_path)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.parametrize("app_with_bootstrap_path", [False], indirect=True)
async def test_status_when_file_missing(client_with_bootstrap_path):
    """File doesn't exist → available=False, four pending hypotheses."""
    res = await client_with_bootstrap_path.get("/preregistration/status")
    assert res.status_code == 200
    body = res.json()
    assert body["available"] is False
    assert body["sourcePath"]  # echoed back so users see what was probed
    assert body["h1"] is None
    assert body["h1b"] is None

    hypotheses = body["hypotheses"]
    assert len(hypotheses) == 4
    by_id = {h["id"]: h for h in hypotheses}
    assert set(by_id.keys()) == {"H1", "H1b", "H2", "H3"}

    # H1 / H1b are pending the GPU bootstrap CI run.
    assert by_id["H1"]["status"] == "pending_bootstrap"
    assert by_id["H1b"]["status"] == "pending_bootstrap"
    # H2 / H3 are pending IBM Torino hardware experiments.
    assert by_id["H2"]["status"] == "pending_hardware"
    assert by_id["H3"]["status"] == "pending_hardware"

    # No CI numbers populated yet (status is pending).
    for h in hypotheses:
        assert h["point"] is None
        assert h["ciLow"] is None
        assert h["ciHigh"] is None
        assert h["supported"] is None


@pytest.mark.parametrize("app_with_bootstrap_path", [True], indirect=True)
async def test_status_when_file_exists(client_with_bootstrap_path):
    """File exists → available=True with capturedUtc populated; H1/H1b
    still pending until v2 markdown parsing lands."""
    res = await client_with_bootstrap_path.get("/preregistration/status")
    assert res.status_code == 200
    body = res.json()
    assert body["available"] is True
    assert body["sourcePath"]
    assert body["capturedUtc"]  # mtime of the stub file
    # v1 stub still returns pending — markdown parsing is a v2 deliverable.
    assert body["h1"] is None
    assert body["h1b"] is None
    by_id = {h["id"]: h for h in body["hypotheses"]}
    assert by_id["H1"]["status"] == "pending_bootstrap"


@pytest.mark.parametrize("app_with_bootstrap_path", [False], indirect=True)
async def test_decision_rule_text_references_preregistration(
    client_with_bootstrap_path,
):
    """Sanity check: the decision-rule text references the correct §
    anchors so reviewers can cross-check the methodology."""
    res = await client_with_bootstrap_path.get("/preregistration/status")
    body = res.json()
    by_id = {h["id"]: h for h in body["hypotheses"]}
    assert "§8.1" in by_id["H1"]["decisionRule"]
    assert "§8.1" in by_id["H1b"]["decisionRule"]
    assert "§8.2" in by_id["H2"]["decisionRule"]
    assert "§8.3" in by_id["H3"]["decisionRule"]
