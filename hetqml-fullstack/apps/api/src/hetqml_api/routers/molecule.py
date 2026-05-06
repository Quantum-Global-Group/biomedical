"""Molecule router — PubChem 3D conformer fetch with on-disk cache.

Visualize · 3D molecule viewer fetches an SDF from this endpoint which
proxies PubChem's REST PUG API and caches each CID's response on disk so
we don't hit PubChem on every page reload.

Wire shape is plain text (`Content-Type: chemical/x-mdl-sdfile`) rather
than JSON: 3Dmol.js's `addModel(text, "sdf")` consumes raw SDF directly.

Cache layout: ``<data_dir>/pubchem-sdf/<cid>.sdf`` (configurable via
``Settings.molecule_cache_subdir``). Cache hit is decided purely on file
presence — we don't currently expire entries because PubChem 3D
conformers don't change for a given CID.

PubChem upstream:
  GET https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{CID}/SDF?record_type=3d

A 404 from PubChem (no 3D record) propagates as 404 from this endpoint;
network or 5xx errors propagate as 502 with the PubChem status reflected
in the detail message.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse

from hetqml_api.settings import Settings

router = APIRouter(prefix="/molecule", tags=["molecule"])


# Module-level lock guards parallel writes to the same cache file when two
# Visualize tabs request the same CID simultaneously. Keyed by CID; an
# in-process dict is sufficient since the API runs as a single process
# in this deployment.
_FETCH_LOCKS: dict[int, asyncio.Lock] = {}


def _cache_path(cache_dir: Path, cid: int) -> Path:
    return cache_dir / f"{cid}.sdf"


async def _fetch_pubchem_sdf(
    base_url: str,
    cid: int,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str:
    """Fetch a 3D SDF for `cid` from PubChem.

    `transport` is the test seam — production passes None and httpx uses
    its default transport. Tests inject ``httpx.MockTransport`` to avoid
    hitting the real PubChem service.
    """
    url = f"{base_url}/compound/cid/{cid}/SDF"
    params = {"record_type": "3d"}
    async with httpx.AsyncClient(transport=transport, timeout=15.0) as client:
        response = await client.get(url, params=params)
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail=f"PubChem CID {cid} not found")
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"PubChem upstream {response.status_code} for CID {cid}",
        )
    return response.text


async def _resolve_sdf(
    cid: int,
    settings: Settings,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str:
    """Cache-aware SDF loader. Reads from disk on hit; fetches + writes on miss."""
    cache_dir = settings.molecule_cache_dir
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = _cache_path(cache_dir, cid)
    if target.exists():
        return target.read_text(encoding="utf-8")

    lock = _FETCH_LOCKS.setdefault(cid, asyncio.Lock())
    async with lock:
        # Double-check after acquiring the lock — a parallel request may
        # have populated the cache while we were waiting.
        if target.exists():
            return target.read_text(encoding="utf-8")
        sdf = await _fetch_pubchem_sdf(settings.pubchem_base_url, cid, transport)
        # Write atomically: dump to a tmp file then rename so a partial
        # write never serves a truncated SDF.
        tmp = target.with_suffix(".sdf.tmp")
        tmp.write_text(sdf, encoding="utf-8")
        tmp.replace(target)
        return sdf


@router.get("/{cid}", response_class=PlainTextResponse)
async def get_molecule_sdf(cid: int, request: Request) -> PlainTextResponse:
    """Return the 3D SDF text for a PubChem CID.

    Caches on disk under `Settings.molecule_cache_dir`. Returns 404 when
    PubChem has no 3D conformer for the CID.
    """
    if cid <= 0:
        raise HTTPException(status_code=400, detail="cid must be a positive integer")
    settings: Settings = request.app.state.settings
    # Optional test seam: app.state.pubchem_transport, when set, overrides
    # the default httpx transport. The conftest doesn't set it; tests that
    # need it (test_molecule.py) install the transport on their own app.
    transport = getattr(request.app.state, "pubchem_transport", None)
    sdf = await _resolve_sdf(cid, settings, transport)
    return PlainTextResponse(content=sdf, media_type="chemical/x-mdl-sdfile")
