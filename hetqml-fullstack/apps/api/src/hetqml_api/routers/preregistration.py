"""Preregistration / bootstrap-CI status router.

`GET /preregistration/status` returns the four hypothesis decision-rule
states (H1, H1b, H2, H3) from
`hybrid-qml-kg-poc/preregistration/osf_preregistration_v1.md` §1.3 + §8.1.
The headline-mode Experiment view in the dashboard consumes this.

Until the GPU bootstrap-CI run produces `bootstrap_ci_analysis.md`, the
endpoint returns `available=False` with the four hypotheses marked
`pending_bootstrap` (H1/H1b) or `pending_hardware` (H2/H3). When the
file exists on disk, the v1 stub returns metadata + still-pending
states (full markdown parsing is intentionally deferred — the format
will be re-checked once a real report file lands).

Configure the source path via `BOOTSTRAP_CI_PATH` env var (Settings
field `bootstrap_ci_path`).
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends

from hetqml_api.deps import get_app_settings
from hetqml_api.schemas import (
    HypothesisStatus,
    PreregistrationStatus,
)
from hetqml_api.settings import Settings

router = APIRouter(prefix="/preregistration", tags=["preregistration"])


# Hardcoded hypothesis definitions — kept in code (not in a config file)
# because they're locked by the OSF preregistration; any change here
# requires a §12 amendment in the source repo.
_H1_LABEL = (
    "QSVC alone vs each classical baseline (paired-bootstrap, conjunction)"
)
_H1B_LABEL = (
    "Stacking ensemble vs each classical baseline (headline; same rule as H1)"
)
_H2_LABEL = (
    "Hardware-evaluated QSVC + Pauli Path ZNE within ±5pp of simulator"
)
_H3_LABEL = (
    "Sub-quadratic scaling on IBM Torino across 10/15/20 qubit dims"
)

_DECISION_RULE_BOOTSTRAP = (
    "95% paired-bootstrap CI on per-fold PR-AUC differences excludes zero "
    "in the favorable direction for ALL classical baselines simultaneously "
    "(preregistration §8.1, 10000 resamples, seed 20260504)"
)
_DECISION_RULE_H2 = (
    "95% bootstrap CI on PR-AUC difference (hardware-ZNE − simulator) "
    "lies within ±5pp of zero or favors hardware (preregistration §8.2)"
)
_DECISION_RULE_H3 = (
    "Linear regression on log(compute time) vs log(problem size) yields "
    "slope coefficient with 95% CI upper bound below 2.0 (preregistration §8.3)"
)


def _pending_hypotheses() -> list[HypothesisStatus]:
    """The four hypotheses with their current pending statuses.

    H1 and H1b are pending the GPU bootstrap CI run. H2 and H3 are pending
    the IBM Torino hardware experiments.
    """
    return [
        HypothesisStatus(
            id="H1",
            label=_H1_LABEL,
            decision_rule=_DECISION_RULE_BOOTSTRAP,
            status="pending_bootstrap",
        ),
        HypothesisStatus(
            id="H1b",
            label=_H1B_LABEL,
            decision_rule=_DECISION_RULE_BOOTSTRAP,
            status="pending_bootstrap",
        ),
        HypothesisStatus(
            id="H2",
            label=_H2_LABEL,
            decision_rule=_DECISION_RULE_H2,
            status="pending_hardware",
        ),
        HypothesisStatus(
            id="H3",
            label=_H3_LABEL,
            decision_rule=_DECISION_RULE_H3,
            status="pending_hardware",
        ),
    ]


def _resolve_source_path(settings: Settings) -> Path:
    """Resolve `bootstrap_ci_path` to an absolute path.

    A relative path is resolved against the current working directory
    (which is the API process's cwd — typically the repo root or a
    well-known mount point on Fly).
    """
    path = settings.bootstrap_ci_path
    return path if path.is_absolute() else path.resolve()


@router.get("/status", response_model=PreregistrationStatus)
async def get_preregistration_status(
    settings: Settings = Depends(get_app_settings),
) -> PreregistrationStatus:
    """Return the current preregistration / bootstrap-CI status.

    v1 stub: when the source file exists, returns metadata + the same
    pending statuses (parsing is deferred until a real
    bootstrap_ci_analysis.md lands and the format stabilizes). When the
    file does not exist, returns `available=False`.
    """
    source = _resolve_source_path(settings)
    available = source.is_file()
    captured_utc: str | None = None
    if available:
        try:
            mtime = source.stat().st_mtime
            captured_utc = (
                datetime.fromtimestamp(mtime, tz=timezone.utc)
                .strftime("%Y-%m-%dT%H:%M:%SZ")
            )
        except OSError:
            captured_utc = None

    return PreregistrationStatus(
        available=available,
        source_path=str(source) if available else str(settings.bootstrap_ci_path),
        captured_utc=captured_utc,
        hypotheses=_pending_hypotheses(),
        # h1 / h1b stay None until parsing lands. The headline UI knows to
        # render "pending bootstrap CI run" until both go non-null.
        h1=None,
        h1b=None,
    )
