"""Tests for the expanded `JobResult` payload.

Verifies every panel field is populated, top-line `metrics` mirrors the
nested `result.metrics`, and changing the run-path family produces a
different `result`.
"""

from __future__ import annotations

import asyncio


SELECTION = {
    "disease": "Hypertension-attributed ESKD",
    "compound": "Inaxaplin",
    "gene": "APOL1",
    "metaedge": "CtD · Compound–treats–Disease",
}


async def _wait(client, job_id: str) -> dict:
    for _ in range(80):
        await asyncio.sleep(0.05)
        r = await client.get(f"/jobs/{job_id}")
        body = r.json()
        if body["status"] == "completed":
            return body
    raise AssertionError(f"job {job_id} never completed")


async def test_completed_job_emits_full_result(client):
    res = await client.post("/investigations/run", json={"selection": SELECTION})
    job_id = res.json()["id"]
    body = await _wait(client, job_id)

    assert body["result"] is not None
    result = body["result"]

    # top-line metrics still present and mirror result.metrics
    assert body["metrics"] == result["metrics"]
    for k in ("prAuc", "rocAuc", "brier", "ece"):
        assert k in result["metrics"]

    # detailed metrics
    dm = result["detailedMetrics"]
    assert len(dm["metricCis"]) == 5
    assert len(dm["cvFolds"]) == 5
    for ci in dm["metricCis"]:
        assert ci["ciLow"] <= ci["value"] <= ci["ciHigh"]

    # leaderboard
    assert len(result["leaderboard"]) == 13
    assert sum(1 for r in result["leaderboard"] if r["isTop"]) == 1

    # benchmark rows mirror leaderboard length and carry every tab's cells
    assert len(result["benchmarkRows"]) == 13
    cells = result["benchmarkRows"][0]["cells"]
    for key in (
        "prAuc",
        "rocAuc",
        "f1",
        "mcc",
        "ndcg10",
        "brier",
        "ece",
        "runtime",
        "params",
        "backend",
        "shots",
        "depth",
        "folds",
    ):
        assert key in cells

    # statistical comparison
    assert len(result["statComparison"]) == 5

    # candidate spotlight
    spotlight = result["candidateSpotlight"]
    assert len(spotlight["ranking"]) == 6
    assert len(spotlight["reasons"]) >= 2

    # integrity guards (matches catalog count)
    assert len(result["integrityGuards"]) == 23

    # trust scorecard: 5 axes, composite present
    assert len(result["trustScorecard"]["axes"]) == 5
    assert 0.0 <= result["trustScorecard"]["composite"] <= 1.0
    axes = {a["axis"] for a in result["trustScorecard"]["axes"]}
    assert axes == {"clinical", "mechanism", "model", "baseline", "artifact"}

    # reliability: 10 bins
    assert len(result["reliability"]["bins"]) == 10

    # evidence matrix: 6 layers
    assert len(result["evidenceMatrix"]["cells"]) == 6

    # model agreement: 3 bars + verdict
    agreement = result["modelAgreement"]
    assert len(agreement["bars"]) == 3
    assert agreement["verdict"] in {
        "STRONG_AGREEMENT",
        "PARTIAL_DIVERGENCE",
        "BRANCH_DIVERGENCE",
    }

    # provenance: 8 events
    assert len(result["provenance"]) == 8
    for ev in result["provenance"]:
        assert ev["timestamp"].endswith("UTC")

    # quality flags: 6 flags
    assert len(result["qualityFlags"]) == 6
    for f in result["qualityFlags"]:
        assert f["state"] in {"pass", "warn", "fail"}

    # evidence overlays: 3 columns
    assert len(result["evidenceOverlays"]) == 3

    # interpretation panel
    assert len(result["interpretation"]["plausible"]) == 4
    assert len(result["interpretation"]["weak"]) == 4

    # quantum circuit (default family=hybrid → backend present)
    qc = result["quantumCircuit"]
    assert qc["title"]
    assert qc["backend"] == "ibm_torino"

    # evidence path: 3 hops
    path = result["evidencePath"]
    assert len(path["steps"]) == 3
    assert path["threshold"] == 0.40


async def test_classical_family_yields_no_quantum_circuit_backend(client):
    res = await client.post(
        "/investigations/run",
        json={"selection": SELECTION, "run_path": {"family": "classical"}},
    )
    body = await _wait(client, res.json()["id"])
    qc = body["result"]["quantumCircuit"]
    assert qc["backend"] is None
    assert "classical" in qc["title"].lower()


async def test_run_path_family_changes_result_payload(client):
    a = await client.post(
        "/investigations/run",
        json={"selection": SELECTION, "run_path": {"family": "classical"}},
    )
    b = await client.post(
        "/investigations/run",
        json={"selection": SELECTION, "run_path": {"family": "quantum"}},
    )
    body_a = await _wait(client, a.json()["id"])
    body_b = await _wait(client, b.json()["id"])
    assert body_a["result"] != body_b["result"]


async def test_simulate_run_is_deterministic(client):
    a = await client.post("/investigations/run", json={"selection": SELECTION})
    b = await client.post("/investigations/run", json={"selection": SELECTION})
    body_a = await _wait(client, a.json()["id"])
    body_b = await _wait(client, b.json()["id"])
    # Same selection → same ML payload (ignore the per-job id/timestamps)
    for key in (
        "metrics",
        "leaderboard",
        "benchmarkRows",
        "statComparison",
        "candidateSpotlight",
        "integrityGuards",
        "trustScorecard",
        "reliability",
        "evidenceMatrix",
        "modelAgreement",
        "qualityFlags",
        "evidenceOverlays",
        "interpretation",
        "quantumCircuit",
        "evidencePath",
    ):
        assert body_a["result"][key] == body_b["result"][key], f"{key} not deterministic"
