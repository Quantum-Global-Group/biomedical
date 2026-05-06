"""Smoke test endpoint for persisted IBM Quantum credentials."""

from __future__ import annotations

from unittest.mock import patch

payload_ok = {
    "backend": "ibm_fake_sim",
    "runtime_job_id": "crt-smoke-job",
    "shots": 100,
    "elapsed_ms": 12,
    "simulator": True,
    "outcome_summary": "0:54% · 1:46%",
    "message": "ok",
}


async def test_ibm_smoke_400_when_no_credentials(client):
    res = await client.post("/settings/ibm/smoke-test")
    assert res.status_code == 400
    assert "token" in res.json()["detail"].lower() or "crn" in res.json()[
        "detail"
    ].lower()


async def test_ibm_smoke_returns_payload_when_executor_mocked(client):
    await client.put(
        "/settings",
        json={
            "ibmConnection": {
                "crn": "crn:v1:fake::",
                "apiToken": "fake-token-for-test",
                "validated": True,
                "planTier": None,
                "instanceName": "inst",
            },
        },
    )

    with patch(
        "hetqml_api.routers.settings.run_ibm_smoke_sync",
        return_value=payload_ok,
    ) as mocked_run:
        res = await client.post("/settings/ibm/smoke-test")
    assert res.status_code == 200
    body = res.json()
    assert body["backend"] == "ibm_fake_sim"
    assert body["runtimeJobId"] == "crt-smoke-job"
    assert body["elapsedMs"] == 12
    assert body["simulator"] is True
    assert body["outcomeSummary"] == "0:54% · 1:46%"
    mocked_run.assert_called_once_with(
        "fake-token-for-test",
        "crn:v1:fake::",
        preferred_backend="ibm_torino",
    )
