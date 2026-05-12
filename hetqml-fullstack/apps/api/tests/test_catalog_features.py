"""Catalog-backed feature matrix — determinism, resolution, env fallback."""

from __future__ import annotations

import numpy as np
import pytest

from hetqml_api.ml.algorithms import score_feature_rows_classical
from hetqml_api.ml.catalog_features import (
    catalog_feature_row,
    catalog_negatives_exclude_focal_pair,
    max_abs_pearson_feature_target_correlation,
    metaedge_code_from_selection,
    try_build_catalog_feature_matrix,
)
from hetqml_api.ml.features import build_features, build_features_for_candidates
from hetqml_api.schemas import Selection


def test_metaedge_code_strips_label() -> None:
    assert metaedge_code_from_selection("CtD · Compound–treats–Disease") == "CtD"
    assert metaedge_code_from_selection("DaG") == "DaG"


def test_catalog_row_shape_and_determinism() -> None:
    from hetqml_api.catalog import compounds_catalog, diseases_catalog, genes_catalog, metaedges_catalog

    c = compounds_catalog().items[0]
    d = diseases_catalog().items[0]
    g = genes_catalog().items[0]
    edge_by = {m.code: m.edge_count for m in metaedges_catalog().items}
    a = catalog_feature_row(c, d, g, "CtD", edge_by)
    b = catalog_feature_row(c, d, g, "CtD", edge_by)
    assert a.shape == (8,)
    np.testing.assert_array_equal(a, b)


def test_try_build_catalog_matrix_stable() -> None:
    sel = Selection(
        disease="Hypertension-attributed ESKD",
        compound="Inaxaplin",
        gene="APOL1",
        metaedge="CtD · Compound–treats–Disease",
    )
    seed = 42
    a = try_build_catalog_feature_matrix(sel, n_samples=80, seed=seed)
    b = try_build_catalog_feature_matrix(sel, n_samples=80, seed=seed)
    assert a is not None and b is not None
    xa, ya, na = a
    xb, yb, nb = b
    np.testing.assert_array_equal(xa, xb)
    np.testing.assert_array_equal(ya, yb)
    assert na == nb
    assert ya.sum() == 40  # balanced


def test_build_features_default_is_catalog() -> None:
    sel = Selection(
        disease="Hypertension-attributed ESKD",
        compound="Inaxaplin",
        gene="APOL1",
        metaedge="CtD · Compound–treats–Disease",
    )
    fm = build_features(sel, n_samples=100)
    assert fm.source == "catalog"
    assert fm.X.shape == (100, 8)
    assert fm.feature_names[0] == "log1p_edges_selected_metaedge"


def test_build_features_synthetic_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HETQML_FEATURE_MATRIX_SOURCE", "synthetic")
    sel = Selection(
        disease="Hypertension-attributed ESKD",
        compound="Inaxaplin",
        gene="APOL1",
        metaedge="CtD · Compound–treats–Disease",
    )
    fm = build_features(sel, n_samples=60)
    assert fm.source == "synthetic"
    assert fm.feature_names[0] == "metapath_CbGaD"


def test_score_feature_rows_classical_matches_width() -> None:
    sel = Selection(
        disease="Hypertension-attributed ESKD",
        compound="Inaxaplin",
        gene="APOL1",
        metaedge="CtD · Compound–treats–Disease",
    )
    fm = build_features(sel, n_samples=80)
    pairs = [
        ("Inaxaplin", "Hypertension-attributed ESKD"),
        ("Venetoclax", "Multiple myeloma"),
    ]
    x_c = build_features_for_candidates(sel, pairs)
    p, d = score_feature_rows_classical(fm, x_c)
    assert p.shape == (2,) and d.shape == (2,)


def test_build_features_for_candidates_catalog() -> None:
    sel = Selection(
        disease="Hypertension-attributed ESKD",
        compound="Inaxaplin",
        gene="APOL1",
        metaedge="CtD · Compound–treats–Disease",
    )
    pairs = [
        ("Inaxaplin", "Hypertension-attributed ESKD"),
        ("Venetoclax", "Multiple myeloma"),
    ]
    x = build_features_for_candidates(sel, pairs)
    assert x.shape == (2, 8)


def test_catalog_negatives_exclude_focal_pair_many_seeds() -> None:
    sel = Selection(
        disease="Hypertension-attributed ESKD",
        compound="Inaxaplin",
        gene="APOL1",
        metaedge="CtD · Compound–treats–Disease",
    )
    for seed in range(0, 50):
        ok = catalog_negatives_exclude_focal_pair(sel, n_samples=200, seed=seed)
        assert ok is True


def test_max_abs_pearson_feature_target_correlation() -> None:
    x = np.array([[0.0, 1.0], [1.0, 0.0], [0.5, 0.5]], dtype=np.float64)
    y = np.array([0, 1, 0], dtype=np.int64)
    r = max_abs_pearson_feature_target_correlation(x, y)
    assert 0.0 <= r <= 1.0
    fm = build_features(
        Selection(
            disease="Hypertension-attributed ESKD",
            compound="Inaxaplin",
            gene="APOL1",
            metaedge="CtD · Compound–treats–Disease",
        ),
        n_samples=200,
    )
    if fm.source == "catalog":
        r2 = max_abs_pearson_feature_target_correlation(fm.X, fm.y)
        assert r2 < 0.999

