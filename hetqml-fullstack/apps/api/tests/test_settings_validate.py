"""Tests for the IBM connection stub validator.

`POST /settings/ibm/validate` is a stub: it inspects the persisted
`IbmConnectionSettings` and flips `validated=True` when the required
fields (crn + instanceName) are non-empty. Anything missing → 400 with
the missing-field list. Real IBM Cloud round-trips ship later.
"""

from __future__ import annotations


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
