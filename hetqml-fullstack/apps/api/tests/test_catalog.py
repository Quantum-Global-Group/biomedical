from __future__ import annotations


async def test_diseases_catalog_hits_137(client):
    res = await client.get("/catalog/diseases")
    assert res.status_code == 200
    body = res.json()
    assert body["synthetic"] is True
    assert body["count"] == 137
    assert len(body["items"]) == 137
    # Curated entries preserved at the top.
    assert body["items"][0]["name"] == "Hypertension-attributed ESKD"
    assert body["items"][0]["doid"] == "DOID:2451"


async def test_compounds_catalog_hits_1552(client):
    res = await client.get("/catalog/compounds")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 1552
    assert len(body["items"]) == 1552
    # Camel-cased keys round-trip.
    sample = body["items"][0]
    assert "drugbankId" in sample
    assert "fdaApproved" in sample


async def test_genes_catalog_hits_20945(client):
    res = await client.get("/catalog/genes")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 20945
    assert len(body["items"]) == 20945


async def test_metaedges_catalog_hits_24(client):
    res = await client.get("/catalog/metaedges")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 24
    assert len(body["items"]) == 24
    codes = {item["code"] for item in body["items"]}
    # Spot-check a few canonical Hetionet metaedges.
    assert {"CtD", "CbG", "DaG", "GiG"}.issubset(codes)


async def test_algorithms_catalog_hits_32(client):
    res = await client.get("/catalog/algorithms")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 32
    assert len(body["items"]) == 32
    families = {item["family"] for item in body["items"]}
    assert families == {"classical", "hybrid", "quantum"}


async def test_integrity_guards_catalog_hits_23(client):
    res = await client.get("/catalog/integrity-guards")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 23
    assert len(body["items"]) == 23
    critical_count = sum(1 for g in body["items"] if g["critical"])
    assert critical_count >= 5  # several critical guards exist


async def test_catalogs_are_deterministic(client):
    res_a = await client.get("/catalog/diseases")
    res_b = await client.get("/catalog/diseases")
    assert res_a.json() == res_b.json()
