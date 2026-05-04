from __future__ import annotations

import asyncio


SELECTION = {
    "disease": "Hypertension-attributed ESKD",
    "compound": "Inaxaplin",
    "gene": "APOL1",
    "metaedge": "CtD · Compound–treats–Disease",
}


async def test_health(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


async def test_run_returns_queued_job(client):
    res = await client.post(
        "/investigations/run",
        json={"selection": SELECTION, "run_path": {"mode": "quick", "family": "hybrid"}},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "queued"
    assert body["selection"] == SELECTION
    assert body["runPath"] == {"mode": "quick", "family": "hybrid"}
    assert body["metrics"] is None
    assert body["completedAt"] is None
    assert len(body["id"]) == 32


async def test_run_path_defaults_apply_when_omitted(client):
    res = await client.post("/investigations/run", json={"selection": SELECTION})
    assert res.status_code == 200
    assert res.json()["runPath"] == {"mode": "quick", "family": "hybrid"}


async def test_run_then_poll_completes_with_metrics(client):
    res = await client.post("/investigations/run", json={"selection": SELECTION})
    job_id = res.json()["id"]

    for _ in range(50):
        await asyncio.sleep(0.05)
        poll = await client.get(f"/jobs/{job_id}")
        assert poll.status_code == 200
        body = poll.json()
        if body["status"] == "completed":
            assert body["metrics"] is not None
            for key in ("prAuc", "rocAuc", "brier", "ece"):
                assert isinstance(body["metrics"][key], float)
            assert body["completedAt"] is not None
            return
    raise AssertionError("job never completed")


async def test_run_path_family_changes_metrics(client):
    res_a = await client.post(
        "/investigations/run",
        json={"selection": SELECTION, "run_path": {"family": "classical"}},
    )
    res_b = await client.post(
        "/investigations/run",
        json={"selection": SELECTION, "run_path": {"family": "quantum"}},
    )
    job_a, job_b = res_a.json()["id"], res_b.json()["id"]

    async def wait(jid: str) -> dict:
        for _ in range(50):
            await asyncio.sleep(0.05)
            r = await client.get(f"/jobs/{jid}")
            if r.json()["status"] == "completed":
                return r.json()
        raise AssertionError(f"job {jid} never completed")

    a = await wait(job_a)
    b = await wait(job_b)
    assert a["metrics"] != b["metrics"]
