"""Tests for the IBM connection stub validator.

``POST /settings/ibm/validate`` checks persisted ``IbmConnectionSettings``:
missing crn/instanceName (when no api token) → 400; stub path or live IBM
probe flips ``validated=True`` as appropriate.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch


async def test_validate_ibm_400_when_unconfigured(client):
    """Default settings have empty crn + null instanceName → 400."""
    res = await client.post("/settings/ibm/validate")
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert "crn" in detail
    assert "instanceName" in detail


async def test_validate_ibm_400_when_only_crn_set(client):
    await client.put(
        "/settings",
        json={
            "ibmConnection": {
                "crn": "crn:v1:bluemix:public:quantum:us-east:a/abc::",
                "validated": False,
                "planTier": None,
                "instanceName": None,
            },
        },
    )
    res = await client.post("/settings/ibm/validate")
    assert res.status_code == 400
    assert "instanceName" in res.json()["detail"]


async def test_validate_ibm_flips_validated_when_complete(client):
    await client.put(
        "/settings",
        json={
            "ibmConnection": {
                "crn": "crn:v1:bluemix:public:quantum:us-east:a/abc::",
                "validated": False,
                "planTier": "Premium",
                "instanceName": "hetqml/main",
            },
        },
    )
    res = await client.post("/settings/ibm/validate")
    assert res.status_code == 200
    body = res.json()
    assert body["ibmConnection"]["validated"] is True
    # Other fields untouched
    assert body["ibmConnection"]["instanceName"] == "hetqml/main"
    assert body["ibmConnection"]["planTier"] == "Premium"


async def test_validate_ibm_persists_validated_flag(client):
    await client.put(
        "/settings",
        json={
            "ibmConnection": {
                "crn": "crn:v1:bluemix:public:quantum:us-east:a/abc::",
                "validated": False,
                "planTier": "Premium",
                "instanceName": "hetqml/main",
            },
        },
    )
    await client.post("/settings/ibm/validate")
    got = await client.get("/settings")
    assert got.status_code == 200
    assert got.json()["ibmConnection"]["validated"] is True


async def test_validate_ibm_live_path_allows_missing_instance_when_token_mocked(
    client,
):
    await client.put(
        "/settings",
        json={
            "ibmConnection": {
                "crn": "crn:v1:bluemix:public:quantum:us-east:a/abc::",
                "apiToken": "ibm-test-token",
                "validated": False,
                "planTier": None,
                "instanceName": None,
            },
        },
    )
    mock_backend = MagicMock()
    mock_backend.name = "ibm_fake_torino"
    mock_service = MagicMock()
    mock_service.least_busy = MagicMock(return_value=mock_backend)
    with patch(
        "qiskit_ibm_runtime.QiskitRuntimeService",
        return_value=mock_service,
    ):
        res = await client.post("/settings/ibm/validate")
    assert res.status_code == 200
    body = res.json()
    assert body["ibmConnection"]["validated"] is True
    assert body["ibmConnection"]["instanceName"] == "ibm_fake_torino"
