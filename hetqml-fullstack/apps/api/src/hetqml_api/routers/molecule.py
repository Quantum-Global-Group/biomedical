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
import logging
import time
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse

from hetqml_api.settings import Settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/molecule", tags=["molecule"])


# Module-level lock guards parallel writes to the same cache file when two
# Visualize tabs request the same CID simultaneously. Keyed by CID; an
# in-process dict is sufficient since the API runs as a single process
# in this deployment.
_FETCH_LOCKS: dict[int, asyncio.Lock] = {}

# Throttle GC sweeps to once per `pubchem_cache_gc_interval_seconds`. The
# cache miss path schedules a fire-and-forget GC task when the throttle has
# expired — no extra infrastructure (cron / scheduled job) required.
_LAST_GC_AT: float = 0.0
_GC_LOCK = asyncio.Lock()


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
    # Outside the per-CID lock — schedule a sweep without blocking the
    # current response. `maybe_schedule_cache_gc` no-ops when the GC
    # interval has not elapsed.
    maybe_schedule_cache_gc(settings)
    return sdf


# --- Cache GC ------------------------------------------------------------


def maybe_schedule_cache_gc(settings: Settings) -> None:
    """Fire-and-forget a GC sweep if the throttle has elapsed.

    Safe to call from any async handler; uses the running loop's
    `create_task`. When called outside an async context (e.g. tests
    instantiating `_resolve_sdf` directly) it falls through silently.
    """

    global _LAST_GC_AT
    now = time.monotonic()
    interval = max(0, settings.pubchem_cache_gc_interval_seconds)
    if interval and now - _LAST_GC_AT < interval:
        return
    _LAST_GC_AT = now
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(_run_cache_gc(settings))


async def _run_cache_gc(settings: Settings) -> None:
    """Wrapper that serializes GC and offloads the disk walk to a thread."""
    if _GC_LOCK.locked():
        return
    async with _GC_LOCK:
        try:
            await asyncio.to_thread(prune_pubchem_cache, settings)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("PubChem cache GC failed: %s", exc)


def prune_pubchem_cache(settings: Settings) -> dict[str, int]:
    """Walk the PubChem SDF cache and prune by age then by total size.

    Returns a small dict suitable for log lines or test assertions:
      `{"checked": int, "evicted_age": int, "evicted_size": int,
        "bytes_after": int}`.

    Bounds with a value of ``0`` are treated as "no limit" — a fresh
    install with both knobs zero performs no eviction.
    """

    cache_dir = settings.molecule_cache_dir
    if not cache_dir.exists():
        return {"checked": 0, "evicted_age": 0, "evicted_size": 0, "bytes_after": 0}
    max_age_days = max(0, settings.pubchem_cache_max_age_days)
    max_size_bytes = max(0, settings.pubchem_cache_max_size_mb) * 1024 * 1024
    cutoff = time.time() - max_age_days * 86400 if max_age_days else 0

    entries: list[tuple[Path, float, int]] = []
    for path in cache_dir.glob("*.sdf"):
        try:
            stat = path.stat()
        except OSError:
            continue
        entries.append((path, stat.st_mtime, stat.st_size))

    evicted_age = 0
    if cutoff:
        keep: list[tuple[Path, float, int]] = []
        for entry in entries:
            path, mtime, _size = entry
            if mtime < cutoff:
                try:
                    path.unlink()
                    evicted_age += 1
                except OSError:
                    keep.append(entry)
            else:
                keep.append(entry)
        entries = keep

    evicted_size = 0
    total_bytes = sum(size for _, _, size in entries)
    if max_size_bytes and total_bytes > max_size_bytes:
        # Oldest-first eviction (LRU-by-mtime) until we drop under the cap.
        entries.sort(key=lambda e: e[1])
        for path, _mtime, size in entries:
            if total_bytes <= max_size_bytes:
                break
            try:
                path.unlink()
                evicted_size += 1
                total_bytes -= size
            except OSError:
                continue

    summary = {
        "checked": len(entries) + evicted_age,
        "evicted_age": evicted_age,
        "evicted_size": evicted_size,
        "bytes_after": max(0, total_bytes),
    }
    if evicted_age or evicted_size:
        logger.info(
            "PubChem cache GC: pruned %d by age, %d by size (now %d bytes)",
            evicted_age,
            evicted_size,
            summary["bytes_after"],
        )
    return summary


def reset_gc_throttle_for_tests() -> None:
    """Reset the module-level throttle so tests can trigger consecutive GCs."""
    global _LAST_GC_AT
    _LAST_GC_AT = 0.0


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
