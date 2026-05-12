"""Paired classifier tests on identical out-of-fold samples.

Used by ``jobs.runner`` for statistical-comparison rows: exact McNemar
(two-sided binomial on discordant pairs) for headline vs classical OOF
probabilities and vs a naive prevalence-only baseline.
"""

from __future__ import annotations

import math
from typing import Literal

import numpy as np
from sklearn.metrics import average_precision_score


def average_precision_stack(y: np.ndarray, p: np.ndarray) -> float:
    """Global average precision on stacked OOF predictions."""
    y = np.asarray(y, dtype=float)
    p = np.asarray(p, dtype=float)
    if len(y) == 0:
        return 0.0
    if len(np.unique(y)) < 2:
        return float(np.mean(y))
    return float(average_precision_score(y, p))


def binomial_two_sided_pvalue(k: int, n: int, *, p_null: float = 0.5) -> float:
    """Two-sided exact binomial test for H0: Binomial(n, p_null), observe k."""
    if n <= 0:
        return 1.0
    if k < 0 or k > n:
        raise ValueError("k must be in [0, n]")

    def pmf(i: int) -> float:
        return math.comb(n, i) * (p_null**i) * ((1.0 - p_null) ** (n - i))

    ref = pmf(k)
    total = 0.0
    for i in range(n + 1):
        pi = pmf(i)
        if pi <= ref + 1e-15:
            total += pi
    return float(min(1.0, total))


def mcnemar_p_value(
    y_true: np.ndarray,
    prob_a: np.ndarray,
    prob_b: np.ndarray,
    *,
    threshold: float = 0.5,
) -> float:
    """McNemar exact two-sided p-value for paired binary decisions at ``threshold``.

    ``b`` = A wrong & B correct; ``c`` = A correct & B wrong; condition on
    ``b+c`` and use ``Binomial(b+c, 0.5)`` under the null of equal error rates.
    """
    y_true = np.asarray(y_true, dtype=int)
    prob_a = np.asarray(prob_a, dtype=float)
    prob_b = np.asarray(prob_b, dtype=float)
    za = (prob_a >= threshold).astype(int)
    zb = (prob_b >= threshold).astype(int)
    correct_a = za == y_true
    correct_b = zb == y_true
    b = int(np.sum(~correct_a & correct_b))
    c = int(np.sum(correct_a & ~correct_b))
    return binomial_two_sided_pvalue(b, b + c, p_null=0.5)


def mcnemar_richardson_effect(
    y_true: np.ndarray,
    prob_a: np.ndarray,
    prob_b: np.ndarray,
    *,
    threshold: float = 0.5,
) -> float:
    """Richardson effect size ``(b - c) / (b + c)`` for discordant pairs."""
    y_true = np.asarray(y_true, dtype=int)
    prob_a = np.asarray(prob_a, dtype=float)
    prob_b = np.asarray(prob_b, dtype=float)
    za = (prob_a >= threshold).astype(int)
    zb = (prob_b >= threshold).astype(int)
    correct_a = za == y_true
    correct_b = zb == y_true
    b = int(np.sum(~correct_a & correct_b))
    c = int(np.sum(correct_a & ~correct_b))
    denom = b + c
    if denom == 0:
        return 0.0
    return (b - c) / denom


def significance_from_p(
    p: float,
) -> Literal["ns", "marginal", "significant", "highly-significant"]:
    if p < 0.001:
        return "highly-significant"
    if p < 0.05:
        return "significant"
    if p < 0.1:
        return "marginal"
    return "ns"
