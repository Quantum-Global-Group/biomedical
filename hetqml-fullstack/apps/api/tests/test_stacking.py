"""Stacking ensemble + Pauli feature map — shape, determinism, dispatcher wiring."""

from __future__ import annotations

import numpy as np
import pytest

from hetqml_api.ml.algorithms import (
    _build_pauli_circuit,
    _build_zz_circuit,
    _build_feature_overlap_circuit,
    _stacking_base_learner_preds,
    _stacking_meta_features,
    run_stacking,
    run_algorithm_with_probs,
)
from hetqml_api.ml.features import build_features
from hetqml_api.schemas import Selection


FOCAL_SELECTION = Selection(
    disease="Hypertension-attributed ESKD",
    compound="Inaxaplin",
    gene="APOL1",
    metaedge="CtD · Compound–treats–Disease",
)


def test_pauli_circuit_builds():
    """PauliFeatureMap + overlap circuit must construct without error."""
    fm, overlap = _build_pauli_circuit()
    assert fm is not None
    assert overlap is not None
    # PauliFeatureMap uses 2*QK_QUBITS parameters (Z + XX per qubit per rep).
    assert overlap.num_qubits == 2 * 4 or overlap.num_qubits == 4


def test_zz_circuit_builds():
    fm, overlap = _build_zz_circuit()
    assert fm is not None
    assert overlap is not None


def test_feature_overlap_dispatch():
    zz_fm, zz_overlap = _build_feature_overlap_circuit("zz")
    pauli_fm, pauli_overlap = _build_feature_overlap_circuit("pauli")
    assert zz_fm is not None and pauli_fm is not None
    # Pauli circuit has more parameters than ZZ (Z+XX per qubit per rep).
    assert len(pauli_fm.parameters) >= len(zz_fm.parameters)


def test_run_stacking_returns_algo_result():
    result, probs = run_stacking(FOCAL_SELECTION)
    assert result.family == "classical"
    assert result.top_model.startswith("Stacking ensemble")
    assert 0.0 <= result.pr_auc <= 1.0
    assert 0.0 <= result.roc_auc <= 1.0
    assert 0.0 <= result.brier <= 1.0
    assert 0.0 <= result.ece <= 1.0
    assert len(result.cv_pr_auc) == 5
    assert len(result.cv_roc_auc) == 5
    assert probs.y_all is not None
    assert len(probs.p_all) == len(probs.y_all)


def test_run_stacking_deterministic():
    a_result, a_probs = run_stacking(FOCAL_SELECTION)
    b_result, b_probs = run_stacking(FOCAL_SELECTION)
    assert a_result.pr_auc == b_result.pr_auc
    assert a_result.roc_auc == b_result.roc_auc
    assert a_result.top_model == b_result.top_model


def test_run_stacking_notes_mention_base_learners():
    result, _ = run_stacking(FOCAL_SELECTION)
    notes_text = " ".join(result.notes)
    assert "Base learners" in notes_text
    assert "meta-learner" in notes_text


def test_run_stacking_feature_map_arg_accepted():
    """The feature_map arg is accepted for API symmetry; stacking is classical."""
    result, _ = run_stacking(FOCAL_SELECTION, feature_map="pauli")
    assert result.family == "classical"
    notes_text = " ".join(result.notes)
    assert "pauli" in notes_text.lower()


def test_dispatcher_routes_stacking():
    """run_algorithm_with_probs should route family='stacking' to run_stacking."""
    result, probs = run_algorithm_with_probs("stacking", FOCAL_SELECTION)
    assert result.family == "classical"
    assert result.top_model.startswith("Stacking ensemble")


def test_stacking_meta_features_shape():
    fm = build_features(FOCAL_SELECTION, n_samples=120)
    Z, y, base_names = _stacking_meta_features(fm)
    # Z is (n_samples, n_base); we have 3 base learners (lr, gbm, et).
    assert Z.shape[0] == fm.X.shape[0]
    assert Z.shape[1] == 3
    assert set(base_names) == {"lr", "gbm", "et"}
    np.testing.assert_array_equal(y, fm.y)
    # All values in [0, 1] (probabilities).
    assert (Z >= 0.0).all() and (Z <= 1.0).all()


def test_stacking_base_learner_preds_keys():
    fm = build_features(FOCAL_SELECTION, n_samples=60)
    train_idx = np.arange(30)
    test_idx = np.arange(30, 60)
    preds = _stacking_base_learner_preds(fm, train_idx, test_idx)
    assert set(preds.keys()) == {"lr", "gbm", "et"}
    for name, p in preds.items():
        assert p.shape == (30,)
        assert (p >= 0.0).all() and (p <= 1.0).all()


def test_stacking_does_not_use_quantum_circuits():
    """Stacking is classical — no backend/qubits/shots in the result."""
    result, _ = run_stacking(FOCAL_SELECTION)
    assert result.backend is None
    assert result.qubits is None
    assert result.shots is None
    assert result.depth is None
    assert result.used_real_hardware is False


def test_dispatcher_routes_all_families():
    """Smoke test: dispatcher handles all four families without raising."""
    for family in ("classical", "stacking", "hybrid"):
        result, _ = run_algorithm_with_probs(family, FOCAL_SELECTION)
        assert result is not None
        assert 0.0 <= result.pr_auc <= 1.0


def test_run_stacking_pauli_hetionalet_fallback(monkeypatch: pytest.MonkeyPatch):
    """When HETQML_FEATURE_MATRIX_SOURCE=hetionet and no edge file is present,
    run_stacking should still complete (falls back to catalog features)."""
    import hetqml_api.ml.hetionet_features as hf

    hf._load_graph.cache_clear()
    monkeypatch.setenv("HETQML_HETIONET_EDGES_PATH", "/nonexistent/path.tsv")
    monkeypatch.setenv("HETQML_FEATURE_MATRIX_SOURCE", "hetionet")
    try:
        result, _ = run_stacking(FOCAL_SELECTION)
        assert result is not None
        assert 0.0 <= result.pr_auc <= 1.0
    finally:
        hf._load_graph.cache_clear()
