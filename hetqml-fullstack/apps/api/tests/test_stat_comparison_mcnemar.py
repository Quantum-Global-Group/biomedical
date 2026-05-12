"""Integration: ``_stat_comparison`` uses McNemar when OOF probs are present."""

from __future__ import annotations

import random

import numpy as np

from hetqml_api.jobs.runner import _stat_comparison
from hetqml_api.ml.algorithms import AlgoProbs, AlgoResult


def _minimal_algo(*, family: str = "hybrid") -> AlgoResult:
    return AlgoResult(
        family=family,
        pr_auc=0.75,
        roc_auc=0.70,
        brier=0.1,
        ece=0.05,
        cv_pr_auc=[0.74, 0.75, 0.76, 0.75, 0.74],
        cv_roc_auc=[0.69, 0.70, 0.71, 0.70, 0.69],
        top_model="fixture",
        runtime_seconds=1.0,
        n_samples=8,
        n_features=8,
        backend="aer",
        qubits=4,
        shots=100,
        depth=10,
        fidelity=0.99,
        used_real_hardware=False,
    )


def _minimal_probs(*, with_classical: bool) -> AlgoProbs:
    y = np.array([0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0])
    # Headline: strong correct side of threshold
    p_top = np.array([0.1, 0.9, 0.2, 0.85, 0.88, 0.15, 0.82, 0.2])
    # Classical OOF: deliberately weaker / flipped on several points
    p_cls = np.array([0.55, 0.45, 0.55, 0.45, 0.48, 0.52, 0.40, 0.60])
    oof = p_cls.tolist() if with_classical else None
    return AlgoProbs(
        y_all=y.tolist(),
        p_all=p_top.tolist(),
        bin_observed=[0.1] * 10,
        bin_predicted=[0.2] * 10,
        bin_count=[1] * 10,
        mce=0.05,
        real_log_loss=0.4,
        prevalence=float(y.mean()),
        bootstrap_cis=None,
        oof_probs_classical=oof,
    )


def test_stat_comparison_hybrid_uses_mcnemar_for_classical_and_naive_rows() -> None:
    rng = random.Random(42)
    rows = _stat_comparison(
        rng, 0.80, algo=_minimal_algo(family="hybrid"), probs=_minimal_probs(with_classical=True)
    )
    assert len(rows) == 5
    classical_row = rows[0]
    assert classical_row.label == "vs best classical"
    assert 0.0 < classical_row.p_value <= 1.0
    assert classical_row.p_value < 0.9999
    assert classical_row.delta != 0.0 or classical_row.effect_size != 0.0

    naive_row = rows[4]
    assert naive_row.label == "vs random predictor"
    assert 0.0 <= naive_row.p_value <= 1.0


def test_stat_comparison_classical_headline_skips_mcnemar_vs_self() -> None:
    rng = random.Random(0)
    rows = _stat_comparison(
        rng, 0.71, algo=_minimal_algo(family="classical"), probs=_minimal_probs(with_classical=False)
    )
    r0 = rows[0]
    assert r0.p_value == 1.0
    assert r0.effect_size == 0.0
