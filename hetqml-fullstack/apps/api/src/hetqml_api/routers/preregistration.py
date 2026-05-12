"""Preregistration / bootstrap-CI status router.

`GET /preregistration/status` returns the four hypothesis decision-rule
states (H1, H1b, H2, H3) from
`hybrid-qml-kg-poc/preregistration/osf_preregistration_v1.md` §1.3 + §8.1.
The headline-mode Experiment view in the dashboard consumes this.

When `bootstrap_ci_analysis.md` does not exist the endpoint returns
`available=False` with the four hypotheses marked `pending_bootstrap`
(H1/H1b) or `pending_hardware` (H2/H3).

When the file exists, the markdown is parsed (see
`hetqml_api.preregistration.parser`) and:
  * H1 / H1b switch to `supported` / `not_supported` reflecting their
    paired-bootstrap conjunction status, with `point` / `ci_low` /
    `ci_high` populated from the parsed table (the headline CI is taken
    from the *narrowest* baseline window so the dashboard surfaces a
    conservative effect estimate).
  * H2 / H3 stay `pending_hardware` — those depend on the IBM Torino
    runbook, not the GPU bootstrap report.

When a section is present but malformed (no baseline table, missing
columns, etc.) the parser returns `None` for that hypothesis and the
endpoint falls back to the pending placeholder — partial files don't
poison the response.

Configure the source path via `BOOTSTRAP_CI_PATH` env var (Settings
field `bootstrap_ci_path`).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends

from hetqml_api.deps import get_app_settings
from hetqml_api.preregistration import (
    BootstrapParseResult,
    parse_bootstrap_ci_report,
)
from hetqml_api.schemas import (
    BootstrapCIReport,
    HypothesisStatus,
    PreregistrationStatus,
)
from hetqml_api.settings import Settings

logger = logging.getLogger(__name__)

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


def _hypothesis_from_report(
    base: HypothesisStatus,
    report: BootstrapCIReport | None,
) -> HypothesisStatus:
    """Promote a pending hypothesis to supported/not_supported when the
    parser produced a real :class:`BootstrapCIReport` for it.

    Headline `point`/`ci_low`/`ci_high` come from the *narrowest*
    baseline window so the dashboard reads conservative. A
    "narrowest window" tie-break by absolute `point` keeps the choice
    deterministic across re-renders.
    """

    if report is None:
        return base
    if not report.baselines:
        return base
    narrowest = min(
        report.baselines,
        key=lambda b: (b.ci_high - b.ci_low, -abs(b.point)),
    )
    status = "supported" if report.conjunction_supported else "not_supported"
    return base.model_copy(
        update={
            "status": status,
            "point": round(narrowest.point, 4),
            "ci_low": round(narrowest.ci_low, 4),
            "ci_high": round(narrowest.ci_high, 4),
            "supported": report.conjunction_supported,
        }
    )


def _parse_or_empty(source: Path) -> BootstrapParseResult:
    """Read + parse the artifact; defensive on IO so a transient permission
    error never surfaces as a 500."""

    try:
        text = source.read_text(encoding="utf-8")
    except OSError as exc:
        logger.warning("bootstrap_ci read failed (%s): %s", source, exc)
        return BootstrapParseResult(h1=None, h1b=None, git_commit=None, run_date=None)
    return parse_bootstrap_ci_report(text)


@router.get("/status", response_model=PreregistrationStatus)
async def get_preregistration_status(
    settings: Settings = Depends(get_app_settings),
) -> PreregistrationStatus:
    """Return the current preregistration / bootstrap-CI status.

    Parses ``bootstrap_ci_analysis.md`` when it exists; otherwise returns
    ``available=False`` with all four hypotheses pending. A present-but-
    unparseable file is treated like a present-but-not-yet-tabulated file:
    ``available=True`` with H1/H1b still pending.
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

    parsed = _parse_or_empty(source) if available else BootstrapParseResult(
        h1=None, h1b=None, git_commit=None, run_date=None
    )

    pending = _pending_hypotheses()
    promoted: list[HypothesisStatus] = []
    for hypothesis in pending:
        if hypothesis.id == "H1":
            promoted.append(_hypothesis_from_report(hypothesis, parsed.h1))
        elif hypothesis.id == "H1b":
            promoted.append(_hypothesis_from_report(hypothesis, parsed.h1b))
        else:
            promoted.append(hypothesis)

    return PreregistrationStatus(
        available=available,
        source_path=str(source) if available else str(settings.bootstrap_ci_path),
        git_commit=parsed.git_commit,
        captured_utc=captured_utc,
        hypotheses=promoted,
        h1=parsed.h1,
        h1b=parsed.h1b,
    )
