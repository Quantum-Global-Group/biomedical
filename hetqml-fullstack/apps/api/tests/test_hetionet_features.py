"""Real Hetionet metapath feature loader — DWPC, hard negatives, PCA, fidelity."""

from __future__ import annotations

import csv
import os
import tempfile

import numpy as np
import pytest

from hetqml_api.ml.hetionet_features import (
    FEATURE_DIM,
    HARD_NEGATIVE_RATIO,
    HETIONET_FEATURE_NAMES,
    HetionetGraph,
    hetionet_feature_row,
    hetionet_negatives_exclude_focal_pair,
    hetionet_feature_rows_for_pairs,
    try_build_hetionet_feature_matrix,
)
from hetqml_api.schemas import CompoundEntry, DiseaseEntry, GeneEntry, Selection


def _make_test_graph() -> HetionetGraph:
    """Small synthetic Hetionet-like graph for unit tests."""
    g = HetionetGraph()
    # Compound -> Gene (CbG)
    g.add_edge("Compound::DB17789", "CbG", "Gene::8542")  # Inaxaplin -> APOL1
    g.add_edge("Compound::DB17789", "CbG", "Gene::596")   # Inaxaplin -> BCL2
    g.add_edge("Compound::DB11581", "CbG", "Gene::596")   # Venetoclax -> BCL2
    # Gene -> Disease (DaG)
    g.add_edge("Gene::8542", "DaG", "Disease::DOID:2451")  # APOL1 -> ESKD
    g.add_edge("Gene::596", "DaG", "Disease::DOID:9538")   # BCL2 -> Multiple myeloma
    # Compound -> Disease (CtD)
    g.add_edge("Compound::DB17789", "CtD", "Disease::DOID:2451")  # Inaxaplin -> ESKD
    return g


def _write_test_edges_tsv(path: str) -> None:
    edges = [
        ("Compound::DB17789", "CbG", "Gene::8542"),
        ("Compound::DB17789", "CbG", "Gene::596"),
        ("Compound::DB11581", "CbG", "Gene::596"),
        ("Gene::8542", "DaG", "Disease::DOID:2451"),
        ("Gene::596", "DaG", "Disease::DOID:9538"),
        ("Compound::DB17789", "CtD", "Disease::DOID:2451"),
    ]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, delimiter="\t")
        writer.writerow(["source", "metaedge", "target"])
        for s, m, t in edges:
            writer.writerow([s, m, t])


def _focal_selection() -> Selection:
    return Selection(
        disease="Hypertension-attributed ESKD",
        compound="Inaxaplin",
        gene="APOL1",
        metaedge="CtD · Compound–treats–Disease",
    )


def _focal_compound() -> CompoundEntry:
    return CompoundEntry(
        name="Inaxaplin",
        drugbank_id="DB17789",
        therapeutic_class="small-molecule",
        fda_approved=False,
    )


def _focal_disease() -> DiseaseEntry:
    return DiseaseEntry(name="Hypertension-attributed ESKD", doid="DOID:2451", category="renal")


def _focal_gene() -> GeneEntry:
    return GeneEntry(symbol="APOL1", ncbi_id="8542", category="immune")


def test_graph_adjacency():
    g = _make_test_graph()
    assert "Gene::8542" in g.neighbors("Compound::DB17789", "CbG")
    assert "Compound::DB17789" in g.reverse_neighbors("Gene::8542", "CbG")
    assert g.degree("Compound::DB17789") == 3  # 2 CbG + 1 CtD


def test_feature_dim_matches():
    assert FEATURE_DIM == 8
    assert len(HETIONET_FEATURE_NAMES) == FEATURE_DIM


def test_hard_negative_ratio_is_5():
    assert HARD_NEGATIVE_RATIO == 5


def test_hetionet_feature_row_shape():
    g = _make_test_graph()
    row = hetionet_feature_row(g, _focal_compound(), _focal_disease(), _focal_gene())
    assert row.shape == (FEATURE_DIM,)
    assert np.all(np.isfinite(row))
    # log1p(0) = 0 for metapaths with no path; log1p(positive) > 0 for hits.
    assert np.any(row >= 0.0)


def test_hetionet_feature_row_deterministic():
    g = _make_test_graph()
    a = hetionet_feature_row(g, _focal_compound(), _focal_disease(), _focal_gene())
    b = hetionet_feature_row(g, _focal_compound(), _focal_disease(), _focal_gene())
    np.testing.assert_array_equal(a, b)


def test_try_build_hetionet_matrix_no_graph(monkeypatch: pytest.MonkeyPatch):
    # Clear the lru_cache and set a non-existent path
    import hetqml_api.ml.hetionet_features as mod

    mod._load_graph.cache_clear()
    monkeypatch.setenv("HETQML_HETIONET_EDGES_PATH", "/nonexistent/path.tsv")
    sel = _focal_selection()
    result = try_build_hetionet_feature_matrix(sel, n_samples=60, seed=42)
    assert result is None


def test_try_build_hetionet_matrix_with_graph(monkeypatch: pytest.MonkeyPatch):
    import hetqml_api.ml.hetionet_features as mod

    mod._load_graph.cache_clear()
    with tempfile.TemporaryDirectory() as tmpdir:
        edges_path = os.path.join(tmpdir, "edges.tsv")
        _write_test_edges_tsv(edges_path)
        monkeypatch.setenv("HETQML_HETIONET_EDGES_PATH", edges_path)

        sel = _focal_selection()
        result = try_build_hetionet_feature_matrix(sel, n_samples=60, seed=42)
        assert result is not None
        x, y, names = result
        assert x.shape[1] == FEATURE_DIM
        assert len(y) == 60
        assert set(np.unique(y)) == {0, 1}
        assert names == HETIONET_FEATURE_NAMES

    mod._load_graph.cache_clear()


def test_try_build_hetionet_matrix_deterministic(monkeypatch: pytest.MonkeyPatch):
    import hetqml_api.ml.hetionet_features as mod

    mod._load_graph.cache_clear()
    with tempfile.TemporaryDirectory() as tmpdir:
        edges_path = os.path.join(tmpdir, "edges.tsv")
        _write_test_edges_tsv(edges_path)
        monkeypatch.setenv("HETQML_HETIONET_EDGES_PATH", edges_path)

        sel = _focal_selection()
        a = try_build_hetionet_feature_matrix(sel, n_samples=60, seed=42)
        b = try_build_hetionet_feature_matrix(sel, n_samples=60, seed=42)
        assert a is not None and b is not None
        np.testing.assert_array_equal(a[0], b[0])
        np.testing.assert_array_equal(a[1], b[1])

    mod._load_graph.cache_clear()


def test_hetionet_negatives_exclude_focal_pair(monkeypatch: pytest.MonkeyPatch):
    import hetqml_api.ml.hetionet_features as mod

    mod._load_graph.cache_clear()
    with tempfile.TemporaryDirectory() as tmpdir:
        edges_path = os.path.join(tmpdir, "edges.tsv")
        _write_test_edges_tsv(edges_path)
        monkeypatch.setenv("HETQML_HETIONET_EDGES_PATH", edges_path)

        sel = _focal_selection()
        for seed in range(10):
            ok = hetionet_negatives_exclude_focal_pair(sel, n_samples=60, seed=seed)
            assert ok is True

    mod._load_graph.cache_clear()


def test_hetionet_feature_rows_for_pairs(monkeypatch: pytest.MonkeyPatch):
    import hetqml_api.ml.hetionet_features as mod

    mod._load_graph.cache_clear()
    with tempfile.TemporaryDirectory() as tmpdir:
        edges_path = os.path.join(tmpdir, "edges.tsv")
        _write_test_edges_tsv(edges_path)
        monkeypatch.setenv("HETQML_HETIONET_EDGES_PATH", edges_path)

        sel = _focal_selection()
        pairs = [
            ("Inaxaplin", "Hypertension-attributed ESKD"),
            ("Venetoclax", "Multiple myeloma"),
        ]
        rows = hetionet_feature_rows_for_pairs(sel, pairs)
        assert rows is not None
        assert rows.shape == (2, FEATURE_DIM)

    mod._load_graph.cache_clear()


def test_build_features_hetionet_env(monkeypatch: pytest.MonkeyPatch):
    """When HETQML_FEATURE_MATRIX_SOURCE=hetionet and a graph is loaded,
    build_features returns source='hetionet'."""
    import hetqml_api.ml.hetionet_features as mod

    mod._load_graph.cache_clear()
    with tempfile.TemporaryDirectory() as tmpdir:
        edges_path = os.path.join(tmpdir, "edges.tsv")
        _write_test_edges_tsv(edges_path)
        monkeypatch.setenv("HETQML_HETIONET_EDGES_PATH", edges_path)
        monkeypatch.setenv("HETQML_FEATURE_MATRIX_SOURCE", "hetionet")

        from hetqml_api.ml.features import build_features

        fm = build_features(_focal_selection(), n_samples=60)
        assert fm.source == "hetionet"
        assert fm.X.shape[1] == FEATURE_DIM

    mod._load_graph.cache_clear()


def test_build_features_hetionet_falls_back_to_catalog(monkeypatch: pytest.MonkeyPatch):
    """When HETQML_FEATURE_MATRIX_SOURCE=hetionet but no edge file is present,
    build_features falls back to catalog."""
    import hetqml_api.ml.hetionet_features as mod

    mod._load_graph.cache_clear()
    monkeypatch.setenv("HETQML_HETIONET_EDGES_PATH", "/nonexistent/path.tsv")
    monkeypatch.setenv("HETQML_FEATURE_MATRIX_SOURCE", "hetionet")

    from hetqml_api.ml.features import build_features

    fm = build_features(_focal_selection(), n_samples=60)
    assert fm.source == "catalog"

    mod._load_graph.cache_clear()
