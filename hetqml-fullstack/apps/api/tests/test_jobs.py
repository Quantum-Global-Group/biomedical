from __future__ import annotations


async def test_get_unknown_job_returns_404(client):
    res = await client.get("/jobs/does-not-exist")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"]


async def test_list_starts_empty(client):
    res = await client.get("/jobs")
    assert res.status_code == 200
    assert res.json() == []


async def test_list_includes_created_jobs(client):
    selection = {
        "disease": "Multiple myeloma",
        "compound": "Venetoclax",
        "gene": "BCL2",
        "metaedge": "CtD · Compound–treats–Disease",
    }
    await client.post("/investigations/run", json={"selection": selection})
    res = await client.get("/jobs")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["selection"] == selection
