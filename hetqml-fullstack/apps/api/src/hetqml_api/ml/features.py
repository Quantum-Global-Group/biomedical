"""Feature matrix construction for the HetQML binary-classification pipeline.

Three backends (select with ``HETQML_FEATURE_MATRIX_SOURCE``):

1. **hetionet** — Real DWPC (Degree-Weighted Path Count) metapath features
   computed from a Hetionet edge export (path via
   ``HETQML_HETIONET_EDGES_PATH``). Hard negatives sampled at the
   preregistered 1:5 ratio (§5.1). Falls back to ``catalog`` when no edge
   file is available.

2. **catalog** (default) — Hetionet-informed rows built from bundled catalog
   entries plus published Hetionet v1.0 metaedge edge totals (see
   ``ml.catalog_features``). Labels encode whether a row is the focal
   compound–disease pair vs a random catalog pair.

3. **synthetic** — Legacy Gaussian demo matrix (deterministic per selection).
   Use for A/B debugging or when you explicitly want the old behaviour.

Downstream classical / hybrid / quantum scorers only require ``X``, ``y``,
and ``feature_names``; they are agnostic to which backend produced them.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from typing import Literal

import numpy as np

from hetqml_api.schemas import Selection

from . import catalog_features as _catalog_features
from . import hetionet_features as _hetionet_features

# Number of features the classical/hybrid/quantum pipelines all see. Kept
# small (8) so the quantum kernel cost stays tractable. Must match
# ``FEATURE_DIM`` in ``catalog_features.py`` and ``hetionet_features.py``.
N_FEATURES = 8

assert _catalog_features.FEATURE_DIM == N_FEATURES
assert _hetionet_features.FEATURE_DIM == N_FEATURES


@dataclass(frozen=True)
class FeatureMatrix:
    X: np.ndarray  # shape (n_samples, n_features)
    y: np.ndarray  # shape (n_samples,) — binary 0/1
    feature_names: list[str]
    selection_seed: int
    source: Literal["synthetic", "catalog", "hetionet"] = "synthetic"


def _feature_matrix_source() -> Literal["hetionet", "catalog", "synthetic"]:
    raw = os.environ.get("HETQML_FEATURE_MATRIX_SOURCE", "catalog").strip().lower()
    if raw in ("synthetic", "gaussian", "legacy"):
        return "synthetic"
    if raw in ("hetionet", "dwpc", "real"):
        return "hetionet"
    return "catalog"


def _selection_seed(selection: Selection) -> int:
    """Stable per-selection seed; same as runner._seed_for but local so the
    ML module doesn't depend on the runner."""
    payload = "|".join(
        [selection.disease, selection.compound, selection.gene, selection.metaedge]
    )
    digest = hashlib.sha256(payload.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big", signed=False)


def _synthetic_feature_matrix(selection: Selection, *, n_samples: int) -> FeatureMatrix:
    seed = _selection_seed(selection)
    rng = np.random.default_rng(seed)

    n_pos = n_samples // 2
    n_neg = n_samples - n_pos

    base_axis = rng.normal(0.0, 1.0, size=N_FEATURES)
    base_axis = base_axis / np.linalg.norm(base_axis)
    pos_mean = base_axis * 0.6
    neg_mean = -base_axis * 0.6

    cov = np.eye(N_FEATURES) * 0.9 + np.full((N_FEATURES, N_FEATURES), 0.05)
    np.fill_diagonal(cov, 1.0)

    x_pos = rng.multivariate_normal(pos_mean, cov, size=n_pos)
    x_neg = rng.multivariate_normal(neg_mean, cov, size=n_neg)
    x = np.vstack([x_pos, x_neg]).astype(np.float64)
    y = np.concatenate([np.ones(n_pos, dtype=np.int64), np.zeros(n_neg, dtype=np.int64)])

    perm = rng.permutation(n_samples)
    x = x[perm]
    y = y[perm]

    feature_names = [
        "metapath_CbGaD",
        "metapath_CtDdG",
        "ecfp_density",
        "drug_target_count",
        "disease_neighbor_deg",
        "pathway_overlap",
        "compound_clinical_phase",
        "gene_essentiality",
    ]
    return FeatureMatrix(
        X=x,
        y=y,
        feature_names=feature_names,
        selection_seed=seed,
        source="synthetic",
    )


def build_features(selection: Selection, *, n_samples: int = 200) -> FeatureMatrix:
    """Binary-classification feature matrix keyed on ``selection``.

    Source priority: ``hetionet`` → ``catalog`` → ``synthetic``. The
    hetionet backend requires ``HETQML_HETIONET_EDGES_PATH`` to point at
    a valid Hetionet edges TSV; otherwise it falls back to catalog.
    """
    seed = _selection_seed(selection)
    source = _feature_matrix_source()

    if source == "hetionet":
        built = _hetionet_features.try_build_hetionet_feature_matrix(
            selection, n_samples=n_samples, seed=seed
        )
        if built is not None:
            x, y, names = built
            return FeatureMatrix(
                X=x,
                y=y,
                feature_names=names,
                selection_seed=seed,
                source="hetionet",
            )
        # Fall back to catalog when no edge file is loaded.

    if source in ("hetionet", "catalog"):
        built = _catalog_features.try_build_catalog_feature_matrix(
            selection, n_samples=n_samples, seed=seed
        )
        if built is not None:
            x, y, names = built
            return FeatureMatrix(
                X=x,
                y=y,
                feature_names=names,
                selection_seed=seed,
                source="catalog",
            )
    return _synthetic_feature_matrix(selection, n_samples=n_samples)


def build_features_for_candidates(
    selection: Selection,
    candidates: list[tuple[str, str]],
) -> np.ndarray:
    """Feature vectors for ``(compound_display, disease_display)`` pairs.

    Uses the focal selection's anchor gene and metaedge. When hetionet mode
    is active and every pair resolves, rows are real DWPC metapath scalars;
    otherwise falls back to catalog features, then to the legacy per-pair
    Gaussian hash rows.
    """
    source = _feature_matrix_source()

    if source == "hetionet":
        real = _hetionet_features.hetionet_feature_rows_for_pairs(selection, candidates)
        if real is not None:
            return real

    if source in ("hetionet", "catalog"):
        real = _catalog_features.catalog_feature_rows_for_pairs(selection, candidates)
        if real is not None:
            return real

    base_seed = _selection_seed(selection)
    rows = []
    for compound, disease in candidates:
        pair_hash = hashlib.sha256(
            f"{base_seed}|{compound}|{disease}".encode("utf-8")
        ).digest()
        pair_seed = int.from_bytes(pair_hash[:4], "big", signed=False)
        rng = np.random.default_rng(pair_seed)
        rows.append(rng.normal(0.0, 1.0, size=N_FEATURES))
    return np.array(rows, dtype=np.float64)
