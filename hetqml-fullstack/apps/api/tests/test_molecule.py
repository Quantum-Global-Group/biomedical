"""Molecule SDF endpoint — PubChem proxy + on-disk cache.

Uses ``httpx.MockTransport`` to avoid hitting the real PubChem service.
The transport is installed on `app.state.pubchem_transport` (a documented
test seam in the molecule router) so each test controls exactly what
PubChem is "allowed" to return.
"""

from __future__ import annotations

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from hetqml_api.main import create_app
from hetqml_api.settings import Settings


SDF_FIXTURE = """\
ExampleSDF
  -OEChem-12345

  3  2  0     0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.0000    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    1.0000    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  1  3  1  0  0  0  0
M  END
$$$$
"""


def _build_app(tmp_path, *, status_code: int, body: str = ""):
    """Wire an app whose pubchem transport returns a fixed status/body."""
    settings = Settings(allowed_origins="http://localhost:3000", data_dir=tmp_path)
    app = create_app(settings)

    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if status_code == 200:
            return httpx.Response(200, text=body)
        return httpx.Response(status_code, text="")

    app.state.pubchem_transport = httpx.MockTransport(handler)
    return app, calls


@pytest.mark.asyncio
async def test_get_molecule_sdf_caches_on_disk(tmp_path):
    """First call hits PubChem; second call serves from disk (no transport call)."""
    app, calls = _build_app(tmp_path, status_code=200, body=SDF_FIXTURE)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        r1 = await client.get("/molecule/145953829")
        r2 = await client.get("/molecule/145953829")

    assert r1.status_code == 200
    assert r1.text == SDF_FIXTURE
    assert r1.headers["content-type"].startswith("chemical/x-mdl-sdfile")
    assert r2.status_code == 200
    assert r2.text == SDF_FIXTURE
    # Cache hit on the second call — PubChem should be touched only once.
    assert calls["count"] == 1

    cache_file = tmp_path / "pubchem-sdf" / "145953829.sdf"
    assert cache_file.exists()
    assert cache_file.read_text() == SDF_FIXTURE


@pytest.mark.asyncio
async def test_get_molecule_sdf_404_when_pubchem_404(tmp_path):
    """PubChem 404 (no 3D record) propagates as 404 from our endpoint."""
    app, calls = _build_app(tmp_path, status_code=404)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/molecule/9999999999")

    assert response.status_code == 404
    assert calls["count"] == 1
    # 404s are NOT cached — a later upstream that returns SDF would be served.
    assert not (tmp_path / "pubchem-sdf" / "9999999999.sdf").exists()


@pytest.mark.asyncio
async def test_get_molecule_sdf_rejects_non_positive_cid(tmp_path):
    app, _ = _build_app(tmp_path, status_code=200, body=SDF_FIXTURE)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/molecule/0")
    assert response.status_code == 400
