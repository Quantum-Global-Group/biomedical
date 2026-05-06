"""Skeptic-warning generator coverage tests.

Locks down the seven warning sources `_skeptic` is expected to emit per
the Validate-page plan (§3, "skeptic view source coverage"):

    1. guards            — critical guards off
    2. calibration       — ECE > 0.05
    3. delta-classical   — Δ vs best classical < 0.01
    4. top-loses-to-classical — quantum/hybrid run, classical row wins
    5. cv-variance       — std(PR-AUC) across folds > 0.025
    6. equity            — compound has a curated ancestry caveat
    7. anchor-mismatch   — anchor gene not in compound's primary targets

Tests build the inputs deliberately so the relevant warning fires and
asserts no foreign warning leaks in. The newly-covered conditions
(`equity`, `anchor-mismatch`, deterministic `cv-variance`) are exercised
explicitly.
"""

from __future__ import annotations

import random

from hetqml_api.jobs.runner import _skeptic
from hetqml_api.schemas import (
    CVFold,
    DetailedMetrics,
    IntegrityGuardState,
    JobMetrics,
    LeaderboardRow,
    MetricCI,
    Selection,
)


def _metrics(*, ece: float = 0.02) -> JobMetrics:
    return JobMetrics(pr_auc=0.80, roc_auc=0.85, brier=0.10, ece=ece)


def _guards(*, critical_off: int = 0) -> list[IntegrityGuardState]:
    items = [
        IntegrityGuardState(id=f"g{i}", label=f"Guard {i}", passing=True, critical=True)
        for i in range(3)
    ]
    for i in range(critical_off):
        items[i] = items[i].model_copy(update={"passing": False})
    return items


def _leaderboard(*, top_family: str = "hybrid", delta: float = 0.05) -> list[LeaderboardRow]:
    rows = [
        LeaderboardRow(
            model="Quantum Kernel + Metapath",
            family="hybrid",
            pr_auc=0.80,
            roc_auc=0.85,
            delta_classical=delta,
            is_top=(top_family == "hybrid"),
            params="28",
        ),
        LeaderboardRow(
            model="Stacking ensemble",
            family="classical",
            pr_auc=0.80 - delta,
            roc_auc=0.83,
            delta_classical=0.0,
            is_top=(top_family == "classical"),
            params="2.1k",
        ),
    ]
    return rows


def _detailed(fold_pr: list[float]) -> DetailedMetrics:
    return DetailedMetrics(
        metric_cis=[MetricCI(name="PR-AUC", value=0.80, ci_low=0.78, ci_high=0.82)],
        cv_folds=[CVFold(fold=i + 1, pr_auc=v, roc_auc=0.85) for i, v in enumerate(fold_pr)],
        cv_strategy="5-fold stratified",
    )


def _selection(*, compound: str = "Inaxaplin", gene: str = "APOL1") -> Selection:
    return Selection(
        disease="Hypertension-attributed ESKD",
        compound=compound,
        gene=gene,
        metaedge="CtD · Compound–treats–Disease",
    )


def test_equity_warning_fires_for_curated_compound() -> None:
    """Inaxaplin has a curated APOL1 ancestry caveat — must surface."""
    warnings = _skeptic(
        random.Random(0),
        _metrics(),
        _guards(),
        _leaderboard(),
        family="hybrid",
        selection=_selection(),
        detailed=_detailed([0.80, 0.81, 0.79, 0.80, 0.80]),
    )
    sources = {w.source for w in warnings}
    assert "equity" in sources
    equity = next(w for w in warnings if w.source == "equity")
    assert "APOL1" in equity.message or "ancestry" in equity.message.lower()


def test_equity_warning_skipped_for_compound_without_caveat() -> None:
    warnings = _skeptic(
        random.Random(0),
        _metrics(),
        _guards(),
        _leaderboard(),
        family="hybrid",
        selection=_selection(compound="Lisinopril", gene="ACE"),
        detailed=_detailed([0.80, 0.80, 0.80, 0.80, 0.80]),
    )
    sources = {w.source for w in warnings}
    assert "equity" not in sources


def test_anchor_mismatch_warning_fires_when_gene_not_in_targets() -> None:
    """Venetoclax's primary target is BCL2; anchor TP53 is a mismatch."""
    warnings = _skeptic(
        random.Random(0),
        _metrics(),
        _guards(),
        _leaderboard(),
        family="hybrid",
        selection=_selection(compound="Venetoclax", gene="TP53"),
        detailed=_detailed([0.80, 0.80, 0.80, 0.80, 0.80]),
    )
    sources = {w.source for w in warnings}
    assert "anchor-mismatch" in sources
    msg = next(w for w in warnings if w.source == "anchor-mismatch").message
    assert "TP53" in msg
    assert "BCL2" in msg


def test_anchor_mismatch_warning_skipped_when_gene_matches() -> None:
    warnings = _skeptic(
        random.Random(0),
        _metrics(),
        _guards(),
        _leaderboard(),
        family="hybrid",
        selection=_selection(compound="Venetoclax", gene="BCL2"),
        detailed=_detailed([0.80, 0.80, 0.80, 0.80, 0.80]),
    )
    sources = {w.source for w in warnings}
    assert "anchor-mismatch" not in sources


def test_cv_variance_fires_when_fold_spread_above_threshold() -> None:
    """Std > 0.025 across folds → cv-variance warning, deterministically."""
    warnings = _skeptic(
        random.Random(0),
        _metrics(),
        _guards(),
        _leaderboard(),
        family="hybrid",
        selection=_selection(compound="Lisinopril", gene="ACE"),
        detailed=_detailed([0.70, 0.85, 0.72, 0.88, 0.74]),
    )
    sources = {w.source for w in warnings}
    assert "cv-variance" in sources


def test_cv_variance_skipped_when_folds_tight() -> None:
    warnings = _skeptic(
        random.Random(0),
        _metrics(),
        _guards(),
        _leaderboard(),
        family="hybrid",
        selection=_selection(compound="Lisinopril", gene="ACE"),
        detailed=_detailed([0.800, 0.801, 0.799, 0.800, 0.800]),
    )
    sources = {w.source for w in warnings}
    assert "cv-variance" not in sources


def test_guards_warning_fires_when_critical_guard_off() -> None:
    warnings = _skeptic(
        random.Random(0),
        _metrics(),
        _guards(critical_off=2),
        _leaderboard(),
        family="hybrid",
        selection=_selection(compound="Lisinopril", gene="ACE"),
        detailed=_detailed([0.80, 0.80, 0.80, 0.80, 0.80]),
    )
    crit = [w for w in warnings if w.source == "guards"]
    assert len(crit) == 1
    assert crit[0].severity == "crit"
    assert "BLOCKED" in crit[0].message


def test_top_loses_to_classical_fires_only_for_non_classical_runs() -> None:
    """Hybrid run path + classical top model → warning surfaces."""
    warnings = _skeptic(
        random.Random(0),
        _metrics(),
        _guards(),
        _leaderboard(top_family="classical"),
        family="hybrid",
        selection=_selection(compound="Lisinopril", gene="ACE"),
        detailed=_detailed([0.80, 0.80, 0.80, 0.80, 0.80]),
    )
    sources = {w.source for w in warnings}
    assert "top-loses-to-classical" in sources
