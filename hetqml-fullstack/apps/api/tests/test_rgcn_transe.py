"""R-GCN and TransE classical baselines — shape, determinism, leaderboard integration."""

from __future__ import annotations

import numpy as np
import pytest

from hetqml_api.ml.algorithms import (
    _build_rgcn_adjacency,
    _rgcn_propagate,
    _transe_score,
    _transe_fit_predict,
    _rgcn_fit_predict,
    run_rgcn,
    run_transe,
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


def test_rgcn_adjacency_shape():
    fm = build_features(FOCAL_SELECTION, n_samples=60)
    A = _build_rgcn_adjacency(fm)
    assert A.shape == (60, 60)
    # Symmetric.
    np.testing.assert_array_almost_equal(A, A.T)
    # Zero diagonal (no self-loops).
    np.testing.assert_array_equal(np.diag(A), np.zeros(60))


def test_rgcn_propagate_shape():
    fm = build_features(FOCAL_SELECTION, n_samples=60)
    A = _build_rgcn_adjacency(fm)
    Xp = _rgcn_propagate(fm.X, A, n_hops=1)
    assert Xp.shape == fm.X.shape


def test_rgcn_fit_predict():
    fm = build_features(FOCAL_SELECTION, n_samples=60)
    train_idx = np.arange(30)
    test_idx = np.arange(30, 60)
    y_te, prob = _rgcn_fit_predict(fm, train_idx, test_idx)
    assert y_te.shape == (30,)
    assert prob.shape == (30,)
    assert (prob >= 0.0).all() and (prob <= 1.0).all()


def test_run_rgcn_returns_algo_result():
    result, probs = run_rgcn(FOCAL_SELECTION)
    assert result.family == "classical"
    assert result.top_model.startswith("R-GCN")
    assert 0.0 <= result.pr_auc <= 1.0
    assert 0.0 <= result.roc_auc <= 1.0
    assert len(result.cv_pr_auc) == 5
    assert len(result.cv_roc_auc) == 5
    assert probs.y_all is not None


def test_run_rgcn_deterministic():
    a, _ = run_rgcn(FOCAL_SELECTION)
    b, _ = run_rgcn(FOCAL_SELECTION)
    assert a.pr_auc == b.pr_auc
    assert a.roc_auc == b.roc_auc


def test_run_rgcn_notes_mention_propagation():
    result, _ = run_rgcn(FOCAL_SELECTION)
    notes_text = " ".join(result.notes)
    assert "message passing" in notes_text
    assert "LogReg" in notes_text


def test_transe_score_shape():
    fm = build_features(FOCAL_SELECTION, n_samples=60)
    p = _transe_score(fm.X, embedding_dim=4, seed=fm.selection_seed)
    assert p.shape == (60,)
    assert (p >= 0.0).all() and (p <= 1.0).all()


def test_transe_fit_predict():
    fm = build_features(FOCAL_SELECTION, n_samples=60)
    train_idx = np.arange(30)
    test_idx = np.arange(30, 60)
    y_te, prob = _transe_fit_predict(fm, train_idx, test_idx)
    assert y_te.shape == (30,)
    assert prob.shape == (30,)
    assert (prob >= 0.0).all() and (prob <= 1.0).all()


def test_run_transe_returns_algo_result():
    result, probs = run_transe(FOCAL_SELECTION)
    assert result.family == "classical"
    assert result.top_model.startswith("TransE")
    assert 0.0 <= result.pr_auc <= 1.0
    assert 0.0 <= result.roc_auc <= 1.0
    assert len(result.cv_pr_auc) == 5
    assert len(result.cv_roc_auc) == 5
    assert probs.y_all is not None


def test_run_transe_deterministic():
    a, _ = run_transe(FOCAL_SELECTION)
    b, _ = run_transe(FOCAL_SELECTION)
    assert a.pr_auc == b.pr_auc
    assert a.roc_auc == b.roc_auc


def test_run_transe_notes_mention_relation_translation():
    result, _ = run_transe(FOCAL_SELECTION)
    notes_text = " ".join(result.notes)
    assert "translation" in notes_text.lower()
    assert "LogReg" in notes_text


def test_dispatcher_does_not_handle_rgcn_transe():
    """R-GCN and TransE are not dispatcher families — they're leaderboard
    baselines that run via the classical headline path. The dispatcher
    should raise for unknown families."""
    with pytest.raises(ValueError, match="Unknown family"):
        run_algorithm_with_probs("rgcn", FOCAL_SELECTION)
    with pytest.raises(ValueError, match="Unknown family"):
        run_algorithm_with_probs("transe", FOCAL_SELECTION)


def test_rgcn_transe_no_quantum_metadata():
    """Both baselines are classical — no backend/qubits/shots."""
    rgcn_result, _ = run_rgcn(FOCAL_SELECTION)
    assert rgcn_result.backend is None
    assert rgcn_result.qubits is None
    assert rgcn_result.shots is None
    assert rgcn_result.used_real_hardware is False

    transe_result, _ = run_transe(FOCAL_SELECTION)
    assert transe_result.backend is None
    assert transe_result.qubits is None
    assert transe_result.shots is None
    assert transe_result.used_real_hardware is False


def test_leaderboard_contains_rgcn_transe():
    """The canonical 15-row leaderboard must include both R-GCN and TransE
    as classical baselines."""
    from hetqml_api.jobs.runner import _CANONICAL_LEADERBOARD, _FAMILY_BY_NAME

    names = [name for name, _params in _CANONICAL_LEADERBOARD]
    assert "R-GCN" in names
    assert "TransE" in names
    assert _FAMILY_BY_NAME["R-GCN"] == "classical"
    assert _FAMILY_BY_NAME["TransE"] == "classical"
    assert len(_CANONICAL_LEADERBOARD) == 15
