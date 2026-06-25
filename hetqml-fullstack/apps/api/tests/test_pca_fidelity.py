"""PCA feature reduction and backend fidelity helpers in algorithms.py."""

from __future__ import annotations

import numpy as np

from hetqml_api.ml.algorithms import _pca_reduce, _backend_fidelity


def test_pca_reduce_shape():
    X = np.random.default_rng(42).normal(0, 1, size=(60, 8))
    Xq = _pca_reduce(X, n_components=4, seed=42)
    assert Xq.shape == (60, 4)


def test_pca_reduce_preserves_variance_order():
    """PCA should capture more variance than random truncation."""
    rng = np.random.default_rng(42)
    # Create data where first 4 dims have high variance, last 4 low.
    X = np.hstack([
        rng.normal(0, 5, size=(100, 4)),
        rng.normal(0, 0.1, size=(100, 4)),
    ])
    Xq_pca = _pca_reduce(X, n_components=4, seed=42)
    Xq_trunc = X[:, :4]
    pca_var = np.sum(np.var(Xq_pca, axis=0))
    trunc_var = np.sum(np.var(Xq_trunc, axis=0))
    # PCA should capture at least as much variance as truncation.
    assert pca_var >= trunc_var - 1e-10


def test_pca_reduce_deterministic():
    X = np.random.default_rng(42).normal(0, 1, size=(60, 8))
    a = _pca_reduce(X, n_components=4, seed=42)
    b = _pca_reduce(X, n_components=4, seed=42)
    np.testing.assert_array_equal(a, b)


def test_pca_reduce_passthrough_when_small():
    X = np.random.default_rng(42).normal(0, 1, size=(60, 3))
    Xq = _pca_reduce(X, n_components=4, seed=42)
    # When features <= n_components, return X unchanged.
    assert Xq.shape == (60, 3)


def test_backend_fidelity_returns_none_for_missing_props():
    class FakeBackend:
        def properties(self):
            return None

    assert _backend_fidelity(FakeBackend()) is None


def test_backend_fidelity_returns_float_for_valid_props():
    class FakeProp:
        n_qubits = 2

        def t1(self, q):
            return 200.0  # microseconds

        def t2(self, q):
            return 100.0

        @property
        def gates(self):
            class FakeParam:
                def __init__(self, name, value):
                    self.name = name
                    self.value = value

            class FakeGate:
                def __init__(self, gate, parameters):
                    self.gate = gate
                    self.parameters = parameters

            return [
                FakeGate("cx", [FakeParam("gate_error", 0.005)]),
                FakeGate("cx", [FakeParam("gate_error", 0.003)]),
            ]

    class FakeBackend:
        def properties(self):
            return FakeProp()

    fid = _backend_fidelity(FakeBackend())
    assert fid is not None
    assert 0.0 <= fid <= 1.0


def test_backend_fidelity_handles_exception():
    class FakeBackend:
        def properties(self):
            raise RuntimeError("no props")

    assert _backend_fidelity(FakeBackend()) is None
