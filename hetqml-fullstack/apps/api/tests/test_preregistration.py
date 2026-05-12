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
    application.state.job_runner = Runner(store, synthetic_only=True)
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


# --- Real parsing ----------------------------------------------------------

# A realistic-but-tiny artifact the parser should round-trip. H1 has a
# conjunction (every baseline supports), H1b has one non-supporting row
# (GradientBoosting CI straddles zero).
_FULL_REPORT_MD = """\
# Bootstrap CI Analysis — H1 and H1b decision rules

**Run date:** 2026-05-04T12:00:00Z
**Git commit:** abc1234def

## H1 — QSVC alone vs classical baselines

- n_resamples: 10000
- confidence: 0.95
- seed: 20260504

| Baseline | Δ PR-AUC | CI low | CI high | Supports |
|---|---|---|---|---|
| RandomForest-Optimized | 0.034 | 0.012 | 0.056 | yes |
| LogisticRegression-L2  | 0.021 | 0.008 | 0.034 | yes |
| GradientBoosting-Tuned | 0.027 | 0.005 | 0.049 | yes |

## H1b — Stacking ensemble vs classical baselines

- n_resamples: 10000
- confidence: 0.95
- seed: 20260504

| Baseline | Δ PR-AUC | CI low | CI high | Supports |
|---|---|---|---|---|
| RandomForest-Optimized | 0.040 | 0.020 | 0.060 | yes |
| LogisticRegression-L2  | 0.025 | 0.005 | 0.045 | yes |
| GradientBoosting-Tuned | 0.018 | -0.002 | 0.038 | no |
"""


@pytest.fixture
def app_with_full_report(tmp_path):
    """Like `app_with_bootstrap_path` but writes the full realistic
    artifact above so we can assert on the parsed contents."""
    bootstrap_path = tmp_path / "bootstrap_ci_analysis.md"
    bootstrap_path.write_text(_FULL_REPORT_MD, encoding="utf-8")
    settings = Settings(
        allowed_origins="http://localhost:3000",
        data_dir=tmp_path,
        bootstrap_ci_path=bootstrap_path,
    )
    application = create_app(settings)
    store = InMemoryJobStore()
    application.state.job_store = store
    application.state.job_runner = Runner(store, synthetic_only=True)
    return application


@pytest.fixture
async def client_with_full_report(app_with_full_report):
    transport = ASGITransport(app=app_with_full_report)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_status_parses_h1_conjunction_supported(client_with_full_report):
    """H1's three baselines all support — conjunction should be supported."""
    res = await client_with_full_report.get("/preregistration/status")
    assert res.status_code == 200
    body = res.json()
    assert body["available"] is True
    assert body["gitCommit"] == "abc1234def"

    h1 = body["h1"]
    assert h1 is not None
    assert h1["subject"] == "QSVC alone"
    assert h1["nResamples"] == 10000
    assert h1["confidence"] == 0.95
    assert h1["seed"] == 20260504
    assert len(h1["baselines"]) == 3
    assert h1["nBaselinesSupporting"] == 3
    assert h1["nBaselinesTotal"] == 3
    assert h1["conjunctionSupported"] is True

    by_id = {h["id"]: h for h in body["hypotheses"]}
    assert by_id["H1"]["status"] == "supported"
    assert by_id["H1"]["supported"] is True
    # Headline numbers come from the narrowest CI (LogReg: 0.034 - 0.008 = 0.026).
    assert by_id["H1"]["point"] == 0.021
    assert by_id["H1"]["ciLow"] == 0.008
    assert by_id["H1"]["ciHigh"] == 0.034


async def test_status_parses_h1b_partial_failure(client_with_full_report):
    """H1b has one non-supporting baseline — conjunction must be False."""
    res = await client_with_full_report.get("/preregistration/status")
    body = res.json()

    h1b = body["h1b"]
    assert h1b is not None
    assert h1b["subject"] == "Stacking ensemble"
    assert h1b["nBaselinesSupporting"] == 2
    assert h1b["nBaselinesTotal"] == 3
    assert h1b["conjunctionSupported"] is False

    by_id = {h["id"]: h for h in body["hypotheses"]}
    assert by_id["H1b"]["status"] == "not_supported"
    assert by_id["H1b"]["supported"] is False
    # H2 / H3 always remain hardware-pending — only H1/H1b come from the
    # bootstrap report.
    assert by_id["H2"]["status"] == "pending_hardware"
    assert by_id["H3"]["status"] == "pending_hardware"
