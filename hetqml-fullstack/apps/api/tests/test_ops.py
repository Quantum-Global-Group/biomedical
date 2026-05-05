"""Operations endpoint smoke tests.

These verify wire-shape and that the daily-seeded canned provider returns
stable output within a request window. They do not assert exact numerical
values — those drift day-over-day on purpose.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from hetqml_api.main import create_app
from hetqml_api.ops.provider import CannedOpsProvider
from hetqml_api.settings import Settings


@pytest.fixture
def app_with_ibm():
    """Override the default app to wire in a configured IBM CRN."""
    settings = Settings(allowed_origins="http://localhost:3000", ibm_crn="crn:test:ibm-quantum")
    application = create_app(settings)
    application.state.ops_provider = CannedOpsProvider(ibm_crn=settings.ibm_crn)
    return application


@pytest.fixture
async def client_ibm(app_with_ibm):
    transport = ASGITransport(app=app_with_ibm)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_ops_health_shape(client):
    res = await client.get("/ops/health")
    assert res.status_code == 200
    body = res.json()
    assert body["totalCount"] == 9
    assert 0 <= body["healthyCount"] <= 9
    assert body["overall"] in {"healthy", "degraded", "down"}
    ids = {s["id"] for s in body["services"]}
    assert {"ibm-torino", "ibm-brisbane", "api-gateway"}.issubset(ids)
    for svc in body["services"]:
        assert svc["state"] in {"healthy", "degraded", "down"}
        assert svc["latencyMs"] >= 0
        assert 0.98 <= svc["uptime30d"] <= 1.0


async def test_ops_ibm_workload_unconfigured(client):
    """No CRN configured by default → endpoint returns the empty-state shape."""
    res = await client.get("/ops/ibm-workload")
    assert res.status_code == 200
    body = res.json()
    assert body["configured"] is False
    assert body["validated"] is False
    assert body["usage"] is None


async def test_ops_ibm_workload_configured(client_ibm):
    res = await client_ibm.get("/ops/ibm-workload")
    assert res.status_code == 200
    body = res.json()
    assert body["configured"] is True
    assert body["validated"] is True
    assert body["plan"] == "Premium"
    assert body["usage"]["quantumSecondsAllocated"] == 900.0
    assert len(body["recentJobs"]) == 5
    assert len(body["backendAccess"]) == 4


async def test_ops_backends_shape(client):
    res = await client.get("/ops/backends")
    assert res.status_code == 200
    body = res.json()
    assert len(body["backends"]) == 3
    ids = {b["id"] for b in body["backends"]}
    assert "ibm_torino" in ids
    for b in body["backends"]:
        assert b["qubits"] > 100
        assert 0.95 < b["readoutFidelity"] < 1.0


async def test_ops_jobs_shape(client):
    res = await client.get("/ops/jobs")
    assert res.status_code == 200
    body = res.json()
    assert len(body["queue"]) == 5
    assert len(body["history"]) == 11
    for q in body["queue"]:
        assert q["status"] in {"queued", "running", "transpiling", "measuring"}
        assert 0 <= q["progressPct"] <= 100
    for h in body["history"]:
        assert h["family"] in {"classical", "hybrid", "quantum"}
        assert h["status"] in {"completed", "failed"}


async def test_ops_resources_shape(client):
    res = await client.get("/ops/resources")
    assert res.status_code == 200
    body = res.json()
    assert len(body["counters"]) == 6
    labels = {c["label"] for c in body["counters"]}
    assert {"CPU-hours", "Quantum-seconds", "Cache hit rate"}.issubset(labels)


async def test_ops_cost_shape(client):
    res = await client.get("/ops/cost")
    assert res.status_code == 200
    body = res.json()
    assert body["monthlyBudget"] == 1500.0
    assert body["mtdSpend"] >= 0
    assert len(body["buckets"]) == 6
    for b in body["buckets"]:
        assert b["pace"] in {"under", "on-pace", "over"}


async def test_ops_sources_shape(client):
    res = await client.get("/ops/sources")
    assert res.status_code == 200
    body = res.json()
    assert len(body["sources"]) == 6
    for s in body["sources"]:
        assert len(s["sha256"]) == 64
        assert s["slaHours"] > 0


async def test_ops_alerts_shape(client):
    res = await client.get("/ops/alerts")
    assert res.status_code == 200
    body = res.json()
    assert "active" in body
    assert "recentResolved" in body
    for entry in body["active"]:
        assert entry["resolved"] is False
        assert entry["severity"] in {"warn", "crit"}
    for entry in body["recentResolved"]:
        assert entry["resolved"] is True


async def test_ops_health_is_stable_within_window(client):
    """Two back-to-back calls return identical bodies (daily seed)."""
    res_a = await client.get("/ops/health")
    res_b = await client.get("/ops/health")
    # `lastProbe` uses datetime.now(); compare everything else for stability.
    a, b = res_a.json(), res_b.json()
    for s in (a, b):
        for svc in s["services"]:
            svc.pop("lastProbe", None)
    assert a == b
