"""Permissive parser for ``bootstrap_ci_analysis.md``.

Reads the GPU bootstrap-CI run's markdown artifact and produces typed
:class:`BootstrapCIReport` payloads for H1 (QSVC alone vs classical
baselines) and H1b (Stacking ensemble vs classical baselines). The parser
is *permissive* on purpose: the GPU notebook owners may iterate on the
markdown layout between runs, and a malformed section should degrade to
``None`` for that hypothesis rather than poisoning the whole endpoint.

Expected layout (only the shape needs to match; whitespace and casing are
forgiving)::

    # Bootstrap CI Analysis — H1 and H1b decision rules
    **Git commit:** abc1234

    ## H1 — QSVC alone vs classical baselines
    - n_resamples: 10000
    - confidence: 0.95
    - seed: 20260504

    | Baseline | Δ PR-AUC | CI low | CI high | Supports |
    |---|---|---|---|---|
    | RandomForest-Optimized | 0.034 | 0.012 | 0.056 | yes |
    | LogisticRegression-L2  | 0.021 | 0.008 | 0.034 | yes |
    | GradientBoosting-Tuned | 0.018 | -0.002| 0.038 | no  |

    ## H1b — Stacking ensemble vs classical baselines
    ...

The conjunction-supported decision (preregistration §8.1) is derived
client-side from the row-level ``Supports`` flags so the typed report is
self-contained.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from hetqml_api.schemas import (
    BootstrapCIReport,
    PairedBootstrapBaseline,
)

logger = logging.getLogger(__name__)


# --- Tunables ------------------------------------------------------------

# Header tokens; we accept ``H1`` and ``H1b`` in either ## or # form. Case
# is normalized.
_H1_HEADER_RE = re.compile(
    r"^\s{0,3}#{1,3}\s+H1\b(?!b)\s*[—\-–:]?\s*(?P<rest>.*)$",
    re.IGNORECASE | re.MULTILINE,
)
_H1B_HEADER_RE = re.compile(
    r"^\s{0,3}#{1,3}\s+H1b\b\s*[—\-–:]?\s*(?P<rest>.*)$",
    re.IGNORECASE | re.MULTILINE,
)
_NEXT_SECTION_RE = re.compile(r"^\s{0,3}#{1,3}\s+\S", re.MULTILINE)

_GIT_COMMIT_RE = re.compile(
    r"\*\*\s*Git\s+commit\s*:?\s*\*\*\s*[`]?([0-9a-fA-F]{7,40})[`]?",
    re.IGNORECASE,
)

# `**Run date:** 2026-05-04`. We surface this if the file's mtime is wrong
# (e.g. the artifact was copied after a re-archive).
_RUN_DATE_RE = re.compile(
    r"\*\*\s*Run\s+date\s*:?\s*\*\*\s*(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z?)?)",
    re.IGNORECASE,
)

# Key:value bullet lines such as ``- n_resamples: 10000`` or
# ``* confidence = 0.95`` and bracketed ``[seed] = 20260504``.
_KV_RE = re.compile(
    r"^\s*[-*+]?\s*(?P<key>[A-Za-z_][A-Za-z0-9_ ]*)\s*[:=]\s*(?P<value>\S.*?)\s*$",
    re.MULTILINE,
)

_NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?")
_SUPPORTS_TRUE = {"yes", "y", "true", "✓", "supported", "supports", "1"}
_SUPPORTS_FALSE = {"no", "n", "false", "✗", "not_supported", "0", "—", "-"}


@dataclass(frozen=True)
class BootstrapParseResult:
    """Output of :func:`parse_bootstrap_ci_report`."""

    h1: BootstrapCIReport | None
    h1b: BootstrapCIReport | None
    git_commit: str | None
    run_date: str | None


def parse_bootstrap_ci_report(text: str) -> BootstrapParseResult:
    """Parse a `bootstrap_ci_analysis.md` document.

    Returns a :class:`BootstrapParseResult`. Each hypothesis report is
    ``None`` when its section is missing or could not be parsed into a
    coherent table — partial files don't poison the result.
    """

    git_commit = _extract_first(_GIT_COMMIT_RE, text)
    run_date = _extract_first(_RUN_DATE_RE, text)

    h1_section = _slice_section(text, _H1_HEADER_RE)
    h1b_section = _slice_section(text, _H1B_HEADER_RE)
    h1_report = _parse_section("H1", h1_section)
    h1b_report = _parse_section("H1b", h1b_section)

    return BootstrapParseResult(
        h1=h1_report,
        h1b=h1b_report,
        git_commit=git_commit,
        run_date=run_date,
    )


# --- Section slicing -----------------------------------------------------


def _slice_section(text: str, header_re: re.Pattern[str]) -> str | None:
    """Return the body of the first matching ``# Hx`` section, or ``None``
    when the header is absent."""

    match = header_re.search(text)
    if match is None:
        return None
    start = match.end()
    # End at the next header of equal-or-shallower depth — we just stop at
    # the next ``# `` / ``## `` / ``### `` line after `start`.
    tail = text[start:]
    next_section = _NEXT_SECTION_RE.search(tail)
    body = tail if next_section is None else tail[: next_section.start()]
    # Prepend the header line itself so the subject extractor can read the
    # `Hx — <subject>` segment.
    return text[match.start() : start] + body


# --- Per-section parsing -------------------------------------------------


def _parse_section(
    hypothesis_id: str,
    section: str | None,
) -> BootstrapCIReport | None:
    if not section:
        return None
    subject = _extract_subject(section)
    kv = _extract_key_values(section)
    baselines = _extract_baseline_rows(section)
    if not baselines:
        # Without per-baseline rows we can't produce a meaningful report.
        # The router falls back to the pending placeholder.
        return None
    n_total = len(baselines)
    n_support = sum(1 for b in baselines if b.supports)
    try:
        return BootstrapCIReport(
            hypothesis=hypothesis_id,  # type: ignore[arg-type]
            subject=subject or _default_subject(hypothesis_id),
            n_resamples=_int_or_default(kv.get("n_resamples"), default=10000),
            confidence=_float_or_default(kv.get("confidence"), default=0.95),
            seed=_int_or_default(kv.get("seed"), default=0),
            baselines=baselines,
            conjunction_supported=n_support == n_total and n_total > 0,
            n_baselines_supporting=n_support,
            n_baselines_total=n_total,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(
            "Failed to assemble BootstrapCIReport for %s: %s",
            hypothesis_id,
            exc,
        )
        return None


_SUBJECT_RE = re.compile(
    r"^\s{0,3}#{1,3}\s+H1b?\b\s*[—\-–:]?\s*(?P<rest>.+?)\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def _extract_subject(section: str) -> str | None:
    """Pull the subject-of-comparison out of the header line.

    For ``## H1 — QSVC alone vs classical baselines`` we want
    ``QSVC alone``. Anything after the first ``vs`` is treated as the
    baseline-set descriptor and discarded.
    """

    match = _SUBJECT_RE.search(section)
    if match is None:
        return None
    rest = match.group("rest").strip()
    if not rest:
        return None
    # Split on `vs` (case-insensitive, word boundary) to keep only the
    # subject side.
    parts = re.split(r"\bvs\.?\b", rest, maxsplit=1, flags=re.IGNORECASE)
    subject = parts[0].strip(" -—:") if parts else rest
    return subject or None


def _default_subject(hypothesis_id: str) -> str:
    return {
        "H1": "QSVC alone",
        "H1b": "Stacking ensemble",
    }.get(hypothesis_id, hypothesis_id)


def _extract_key_values(section: str) -> dict[str, str]:
    """Read ``key: value`` and ``- key = value`` lines until the first
    table row (``|`` line) — table rows look like key/value pairs to the
    naive regex otherwise."""

    table_start = section.find("\n|")
    scope = section if table_start == -1 else section[:table_start]
    out: dict[str, str] = {}
    for match in _KV_RE.finditer(scope):
        key = match.group("key").strip().lower().replace(" ", "_")
        value = match.group("value").strip().rstrip(",;")
        if key and key not in out:
            out[key] = value
    return out


# --- Baseline-table parsing ----------------------------------------------


_TABLE_ROW_RE = re.compile(r"^\s*\|(?P<row>.*)\|\s*$", re.MULTILINE)
_TABLE_SEPARATOR_RE = re.compile(r"^[\s|:\-]+$")


def _extract_baseline_rows(section: str) -> list[PairedBootstrapBaseline]:
    """Locate the per-baseline markdown table and return one
    :class:`PairedBootstrapBaseline` per data row.

    We tolerate column-order variation by detecting which column holds
    each field in the header row: ``Baseline``, ``Δ`` / ``delta`` /
    ``point``, ``CI low``, ``CI high``, ``Supports``.
    """

    rows = _TABLE_ROW_RE.findall(section)
    if len(rows) < 2:  # need header + at least one data row
        return []

    header_cells = [_cell(c) for c in rows[0].split("|")]
    idx = _column_indices(header_cells)
    if idx is None:
        return []

    baselines: list[PairedBootstrapBaseline] = []
    for raw in rows[1:]:
        if _TABLE_SEPARATOR_RE.match(raw):
            continue
        cells = [_cell(c) for c in raw.split("|")]
        if max(idx.values()) >= len(cells):
            continue
        name = cells[idx["name"]].strip()
        if not name or name.startswith(":-"):
            continue
        point = _safe_float(cells[idx["point"]])
        ci_low = _safe_float(cells[idx["ci_low"]])
        ci_high = _safe_float(cells[idx["ci_high"]])
        if point is None or ci_low is None or ci_high is None:
            continue
        supports_raw = cells[idx["supports"]].strip().lower()
        if supports_raw in _SUPPORTS_TRUE:
            supports = True
        elif supports_raw in _SUPPORTS_FALSE:
            supports = False
        else:
            # Fallback: support if the CI excludes zero on the favorable
            # side (lower bound > 0).
            supports = ci_low > 0
        baselines.append(
            PairedBootstrapBaseline(
                name=name,
                point=point,
                ci_low=ci_low,
                ci_high=ci_high,
                supports=supports,
            )
        )
    return baselines


def _column_indices(header: list[str]) -> dict[str, int] | None:
    """Map our canonical field names to header column positions."""

    out: dict[str, int] = {}
    for i, cell in enumerate(header):
        normal = cell.strip().lower()
        if "baseline" in normal or normal in {"model", "name"}:
            out.setdefault("name", i)
        elif normal.startswith("δ") or "delta" in normal or normal in {"point", "pr-auc", "δ pr-auc"}:
            out.setdefault("point", i)
        elif "ci low" in normal or normal in {"low", "lower"}:
            out.setdefault("ci_low", i)
        elif "ci high" in normal or normal in {"high", "upper"}:
            out.setdefault("ci_high", i)
        elif "support" in normal or normal in {"verdict"}:
            out.setdefault("supports", i)
    needed = {"name", "point", "ci_low", "ci_high", "supports"}
    return out if needed.issubset(out.keys()) else None


def _cell(raw: str) -> str:
    return raw.strip()


# --- Coercion helpers ----------------------------------------------------


def _safe_float(raw: str) -> float | None:
    raw = raw.strip()
    if not raw:
        return None
    match = _NUMBER_RE.search(raw)
    if match is None:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def _int_or_default(raw: str | None, *, default: int) -> int:
    if raw is None:
        return default
    match = _NUMBER_RE.search(raw)
    if match is None:
        return default
    try:
        return int(float(match.group(0)))
    except ValueError:
        return default


def _float_or_default(raw: str | None, *, default: float) -> float:
    if raw is None:
        return default
    match = _NUMBER_RE.search(raw)
    if match is None:
        return default
    try:
        return float(match.group(0))
    except ValueError:
        return default


def _extract_first(pattern: re.Pattern[str], text: str) -> str | None:
    match = pattern.search(text)
    return match.group(1).strip() if match else None
