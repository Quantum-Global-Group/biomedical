"""Assemble Operations → IBM Workload from persisted Settings (BYOK) and IBM APIs.

`/ops/ibm-workload` must reflect SQLite ``UserSettings.ibm_connection`` so the
dashboard matches Settings → IBM Quantum Connection. Process ``IBM_CRN`` env is
still supported as a fallback CRN for env-only/demo deployments (canned body).
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from threading import Lock

from hetqml_api.ops.provider import OpsProvider
from hetqml_api.persistence.protocols import SettingsStore
from hetqml_api.schemas import (
    IbmBackendAccess,
    IbmRecentJob,
    IbmWorkload,
    UserSettings,
)
from hetqml_api.settings import Settings

logger = logging.getLogger(__name__)

# Matches routers/settings.py single-owner semantics.
SETTINGS_DEFAULT_OWNER = "default"


def _cache_ttl_seconds() -> float:
    raw = os.environ.get("IBM_WORKLOAD_CACHE_SECONDS", "45").strip()
    try:
        v = float(raw)
    except ValueError:
        return 45.0
    return max(0.0, v)


_CACHE_LOCK = Lock()
_CACHE: dict[str, tuple[float, IbmWorkload]] = {}


def _cache_key(*, crn: str, api_token: str) -> str:
    return hashlib.sha256(f"{crn}\0{api_token}".encode()).hexdigest()


def _cache_get(*, crn: str, api_token: str) -> IbmWorkload | None:
    ttl = _cache_ttl_seconds()
    if ttl <= 0:
        return None
    key = _cache_key(crn=crn, api_token=api_token)
    now = time.monotonic()
    with _CACHE_LOCK:
        entry = _CACHE.get(key)
        if entry is None:
            return None
        ts, workload = entry
        if now - ts > ttl:
            del _CACHE[key]
            return None
        return workload


def _cache_put(*, crn: str, api_token: str, workload: IbmWorkload) -> None:
    ttl = _cache_ttl_seconds()
    if ttl <= 0:
        return
    key = _cache_key(crn=crn, api_token=api_token)
    with _CACHE_LOCK:
        _CACHE[key] = (time.monotonic(), workload)


def _crn_tail(crn: str) -> str:
    parts = [p for p in crn.strip().split(":") if p]
    if not parts:
        return ""
    tail = parts[-1].strip("/")
    return tail[:128] if tail else ""


def _map_runtime_job_status(raw: object) -> str:
    """Map Qiskit runtime job status literals to lowercase UI tokens."""
    name = raw if isinstance(raw, str) else str(raw)
    name_u = name.upper()
    lut: dict[str, str] = {
        "DONE": "completed",
        "COMPLETED": "completed",
        "ERROR": "failed",
        "FAILED": "failed",
        "CANCELLED": "failed",
        "RUNNING": "running",
        "QUEUED": "queued",
        "INITIALIZING": "queued",
    }
    return lut.get(name_u, name.lower() if name else "unknown")


def _job_backend_name(job: object) -> str:
    backend = getattr(job, "_backend", None)
    if backend is None:
        return ""
    name = getattr(backend, "name", None)
    return str(name) if name else ""


def _job_duration_seconds(job: object) -> float:
    """Best-effort duration; avoids blocking ``result()`` / ``metrics()``."""
    try:
        est = job.usage_estimation  # type: ignore[union-attr]
        qs = est.get("quantum_seconds") if isinstance(est, dict) else None
        if qs is None and isinstance(est, dict):
            qs = est.get("estimated_running_time_seconds")
        if qs is not None:
            return float(qs)
    except Exception:
        pass
    return 0.0


def _fetch_live_ibm_workload(
    *,
    api_token: str,
    crn: str,
    instance_display: str,
    plan_tier: str | None,
) -> IbmWorkload:
    from qiskit_ibm_runtime import QiskitRuntimeService

    service = QiskitRuntimeService(
        channel="ibm_quantum_platform",
        token=api_token,
        instance=crn,
    )

    jobs = service.jobs(limit=5, descending=True)
    recent: list[IbmRecentJob] = []
    for j in jobs:
        try:
            jid = j.job_id()  # type: ignore[union-attr]
        except Exception:
            jid = str(j)
        st = _map_runtime_job_status(j.status())  # type: ignore[union-attr]
        recent.append(
            IbmRecentJob(
                id=jid,
                backend=_job_backend_name(j) or "—",
                status=st,
                duration_seconds=_job_duration_seconds(j),
            )
        )

    access: list[IbmBackendAccess] = []
    for be in service.backends():
        nm = getattr(be, "name", None)
        backend_name = str(nm) if nm else ""
        if not backend_name:
            continue
        is_sim = bool(getattr(be, "simulator", False))
        access.append(
            IbmBackendAccess(
                backend=backend_name,
                access="sim" if is_sim else "allowed",
            )
        )
        if len(access) >= 32:
            break

    return IbmWorkload(
        configured=True,
        validated=True,
        account=None,
        instance=instance_display or None,
        region=None,
        plan=plan_tier,
        usage=None,
        backend_access=access,
        recent_jobs=recent,
    )


def _instance_display_name(*, ibm: UserSettings, crn_effective: str) -> str:
    label = ibm.ibm_connection.instance_name or ""
    if label.strip():
        return label.strip()
    return _crn_tail(crn_effective)


async def build_ibm_workload(
    *,
    provider: OpsProvider,
    settings_store: SettingsStore,
    app_settings: Settings,
) -> IbmWorkload:
    doc = await settings_store.get(SETTINGS_DEFAULT_OWNER)
    ibm = doc.ibm_connection
    sqlite_crn = ibm.crn.strip()
    env_crn = (app_settings.ibm_crn or "").strip()
    crn_effective = sqlite_crn or env_crn

    if not crn_effective:
        return IbmWorkload(configured=False, validated=False)

    validated_flag = ibm.validated if sqlite_crn else True

    instance_display = _instance_display_name(ibm=doc, crn_effective=crn_effective)

    if not validated_flag:
        return IbmWorkload(
            configured=True,
            validated=False,
            account=None,
            instance=instance_display or None,
            region=None,
            plan=None,
            usage=None,
            backend_access=[],
            recent_jobs=[],
        )

    # --- Validated ------------------------------------------------------------

    sqlite_validated_connected = sqlite_crn and ibm.validated

    # Live probe: persisted CRN + API token when CRN lives in SQLite.
    if sqlite_crn and ibm.api_token.strip():
        cached = _cache_get(crn=sqlite_crn, api_token=ibm.api_token.strip())
        if cached is not None:
            return cached
        try:
            live = await asyncio.to_thread(
                _fetch_live_ibm_workload,
                api_token=ibm.api_token.strip(),
                crn=sqlite_crn,
                instance_display=instance_display,
                plan_tier=ibm.plan_tier,
            )
            _cache_put(crn=sqlite_crn, api_token=ibm.api_token.strip(), workload=live)
            return live
        except Exception as exc:
            logger.info("ibm-workload live fetch failed; sparse payload: %s", exc)
            sparse = IbmWorkload(
                configured=True,
                validated=True,
                account=None,
                instance=instance_display or None,
                region=None,
                plan=ibm.plan_tier,
                usage=None,
                backend_access=[],
                recent_jobs=[],
            )
            _cache_put(crn=sqlite_crn, api_token=ibm.api_token.strip(), workload=sparse)
            return sparse

    # Persisted CRN validated without token → field-only path; honest sparse UI.
    if sqlite_validated_connected and not ibm.api_token.strip():
        return IbmWorkload(
            configured=True,
            validated=True,
            account=None,
            instance=instance_display or None,
            region=None,
            plan=ibm.plan_tier,
            usage=None,
            backend_access=[],
            recent_jobs=[],
        )

    # Env CRN only: preserve canned deterministic feed (tests / demo).
    canned = provider.ibm_workload()
    return canned.model_copy(
        update={
            "configured": True,
            "validated": True,
            "instance": instance_display or canned.instance,
        },
    )
