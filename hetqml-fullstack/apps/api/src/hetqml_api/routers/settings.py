"""User settings endpoints (Settings page).

Settings are scoped by `owner` — for v1 there's exactly one reviewer per
deployment, so we use the literal `"default"`.  The future shape (per-user
settings, multi-tenant) only needs the owner string to switch.

GET on a never-set owner returns the default `UserSettings` (never 404).
PUT replaces the whole document; the page already round-trips the full
shape, so this matches the UX.

`POST /settings/ibm/validate`: without an API token it checks field
completeness (crn + instance label). With a token + crn it probes IBM via
``qiskit-ibm-runtime``, flips ``validated``, and on success may overwrite
``instance_name`` with a detected backend id so downstream panels
(Operations → IBM Workload) can move past "awaiting validation".

`POST /settings/ibm/smoke-test` submits a minimal sampler circuit using
persisted credentials (does not change validation flags).
"""

from __future__ import annotations

import asyncio
import functools

from fastapi import APIRouter, Depends, HTTPException

from hetqml_api.deps import get_settings_store
from hetqml_api.persistence.protocols import SettingsStore
from hetqml_api.schemas import IbmSmokeTestResult, UserSettings
from hetqml_api.settings_ibm_smoke import run_ibm_smoke_sync

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_OWNER = "default"


@router.get("", response_model=UserSettings)
async def get_settings(
    store: SettingsStore = Depends(get_settings_store),
) -> UserSettings:
    return await store.get(DEFAULT_OWNER)


@router.put("", response_model=UserSettings)
async def put_settings(
    payload: UserSettings,
    store: SettingsStore = Depends(get_settings_store),
) -> UserSettings:
    return await store.put(DEFAULT_OWNER, payload)


@router.post("/ibm/validate", response_model=UserSettings)
async def validate_ibm_connection(
    store: SettingsStore = Depends(get_settings_store),
) -> UserSettings:
    """Validate the persisted IBM Quantum connection.

    Two modes:

      - **Field check** (no api_token persisted): require ``crn`` and
        ``instanceName`` to be non-empty. Flips ``validated`` to True when
        both are present. 400 lists the missing fields.
      - **Live check** (api_token + crn persisted): ``instanceName`` may
        be empty; instantiates a
        ``QiskitRuntimeService`` against IBM Cloud and pulls the backend
        list. A successful call flips ``validated`` to True; a connection
        failure returns 400 with the upstream error so the UI can surface
        a precise message.

    Returns the updated `UserSettings` document so the client can
    overwrite local state without an extra GET.
    """
    settings = await store.get(DEFAULT_OWNER)
    ibm = settings.ibm_connection

    missing: list[str] = []
    if not ibm.crn.strip():
        missing.append("crn")
    # Instance label is optional when validating with a real API token: the live
    # IBM probe overwrites instance_name with a backend identifier on success.
    # Without a token we only do field completeness and keep requiring a label.
    if not ibm.api_token.strip():
        if ibm.instance_name is None or not ibm.instance_name.strip():
            missing.append("instanceName")
    if missing:
        raise HTTPException(
            status_code=400,
            detail=(
                "IBM connection incomplete; missing field(s): "
                + ", ".join(missing)
            ),
        )

    # Live check when the operator has provided an api token.
    if ibm.api_token.strip():
        try:
            # The qiskit-ibm-runtime call is synchronous — push to a worker
            # thread so the asyncio loop isn't blocked by the network RTT.
            from qiskit_ibm_runtime import QiskitRuntimeService

            def _probe() -> str:
                service = QiskitRuntimeService(
                    channel="ibm_quantum_platform",
                    token=ibm.api_token,
                    instance=ibm.crn,
                )
                # Trigger the auth round-trip; least_busy is cheap and
                # exercises the same auth path as the runner's job
                # submission, so success here means the runner will work.
                backend = service.least_busy(operational=True)
                return str(backend.name)

            backend_name = await asyncio.to_thread(_probe)
            updated = settings.model_copy(
                update={
                    "ibm_connection": ibm.model_copy(
                        update={"validated": True, "instance_name": backend_name},
                    ),
                }
            )
            return await store.put(DEFAULT_OWNER, updated)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"IBM Cloud authentication failed: {exc}",
            ) from exc

    # No api_token → field-only validation passes through.
    updated = settings.model_copy(
        update={
            "ibm_connection": ibm.model_copy(update={"validated": True}),
        }
    )
    return await store.put(DEFAULT_OWNER, updated)


@router.post("/ibm/smoke-test", response_model=IbmSmokeTestResult)
async def ibm_smoke_test(store: SettingsStore = Depends(get_settings_store)) -> IbmSmokeTestResult:
    """Run a minimal Runtime sampler job using **persisted** IBM credentials.

    Does not modify settings. Requires a stored API token and CRN (save the
    form first if needed). Prefer a cloud simulator when available; otherwise
    tries ``quantum.default_backend``, then IBM least-busy.
    """
    settings = await store.get(DEFAULT_OWNER)
    ibm = settings.ibm_connection
    if not ibm.crn.strip() or not ibm.api_token.strip():
        raise HTTPException(
            status_code=400,
            detail="IBM smoke test needs a saved API token and CRN.",
        )
    preferred_backend = (settings.quantum.default_backend or "").strip()
    try:
        payload = await asyncio.to_thread(
            functools.partial(
                run_ibm_smoke_sync,
                ibm.api_token.strip(),
                ibm.crn.strip(),
                preferred_backend=preferred_backend,
            ),
        )
        return IbmSmokeTestResult.model_validate(payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"IBM smoke test failed: {exc}",
        ) from exc
