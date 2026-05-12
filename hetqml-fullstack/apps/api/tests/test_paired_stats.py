"""Unit tests for McNemar / AP helpers used in statistical comparison rows."""

from __future__ import annotations

import numpy as np
import pytest

from hetqml_api.ml.paired_stats import (
    average_precision_stack,
    binomial_two_sided_pvalue,
    mcnemar_p_value,
    mcnemar_richardson_effect,
    significance_from_p,
)


def test_binomial_two_sided_perfect_symmetry() -> None:
    assert binomial_two_sided_pvalue(5, 10) == 1.0


def test_mcnemar_identical_classifiers_p_one() -> None:
    y = np.array([0, 1, 0, 1, 1, 0], dtype=int)
    p = np.array([0.2, 0.8, 0.3, 0.7, 0.6, 0.4], dtype=float)
    assert mcnemar_p_value(y, p, p) == 1.0
    assert mcnemar_richardson_effect(y, p, p) == 0.0


def test_mcnemar_clear_discordance_small_p() -> None:
    y = np.array([1, 1, 1, 1, 0, 0, 0, 0], dtype=int)
    # A always wrong, B always correct on positives (B predicts high on pos)
    p_a = np.array([0.1, 0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.9])
    p_b = np.array([0.9, 0.9, 0.9, 0.9, 0.1, 0.1, 0.1, 0.1])
    p = mcnemar_p_value(y, p_a, p_b)
    assert p < 0.05
    assert significance_from_p(p) in ("significant", "highly-significant")


def test_average_precision_stack_balanced_labels() -> None:
    y = np.array([0, 0, 1, 1], dtype=float)
    p = np.array([0.1, 0.2, 0.8, 0.9])
    ap = average_precision_stack(y, p)
    assert 0.9 <= ap <= 1.0


@pytest.mark.parametrize(
    ("p", "expected"),
    [
        (0.0005, "highly-significant"),
        (0.01, "significant"),
        (0.07, "marginal"),
        (0.5, "ns"),
    ],
)
def test_significance_bands(p: float, expected: str) -> None:
    assert significance_from_p(p) == expected
