"""Deterministic synthetic feature builder for the Hetionet drug-repurposing
binary-classification task.

The real production feature set would come from Hetionet metapath counts,
PubChem descriptors, etc. For the dashboard demo we generate a
selection-keyed synthetic matrix that:

  - is deterministic (same selection → same data, so two runs are
    comparable),
  - has a learnable signal (so classical/hybrid/quantum metrics are
    plausible, not all 0.5),
  - varies across selections (so different disease/compound pairs produce
    visibly different leaderboards),
  - is small (≤200 samples × 8 features) so the quantum kernel matrix
    stays tractable on the local Aer simulator.

The *real* swap-in here is straightforward: replace `build_features`
with a Hetionet metapath-feature loader keyed on the selection. The
downstream classical/hybrid/quantum scorers don't care where X, y come
from.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

import numpy as np

from hetqml_api.schemas import Selection


@dataclass(frozen=True)
class FeatureMatrix:
    X: np.ndarray  # shape (n_samples, n_features)
    y: np.ndarray  # shape (n_samples,) — binary 0/1
    feature_names: list[str]
    selection_seed: int


# Number of features the classical/hybrid/quantum pipelines all see. Kept
# small (8) so the quantum kernel cost stays under a second on the local
# Aer simulator. The real feature set would be larger; the quantum branch
# would PCA down to a similar dimension.
N_FEATURES = 8


def _selection_seed(selection: Selection) -> int:
    """Stable per-selection seed; same as runner._seed_for but local so the
    ML module doesn't depend on the runner."""
    payload = "|".join(
        [selection.disease, selection.compound, selection.gene, selection.metaedge]
    )
    digest = hashlib.sha256(payload.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big", signed=False)


def build_features(selection: Selection, *, n_samples: int = 200) -> FeatureMatrix:
    """Generate a binary-classification feature matrix keyed on `selection`.

    The construction:

      - Two latent classes drawn from Gaussians whose means depend on the
        selection seed, so different selections see different signals.
      - Class 1 (positive: "this compound→disease pair is real") slightly
        overlaps class 0 — the signal is learnable but noisy enough that
        classical/hybrid/quantum each report distinct metrics.
      - Feature names mirror plausible Hetionet metapath / molecular
        descriptors so the downstream UI captions read sensibly.

    Returns a `FeatureMatrix` carrying the seed so callers can re-derive
    deterministic state if needed.
    """
    seed = _selection_seed(selection)
    rng = np.random.default_rng(seed)

    # Class balance: 50/50, so PR-AUC and ROC-AUC are comparable.
    n_pos = n_samples // 2
    n_neg = n_samples - n_pos

    # Selection-derived class means. The mean of class 1 sits at +0.6 in
    # most dimensions; class 0 at −0.6. The exact axes are jittered by the
    # seed so different selections see different "easy" directions.
    base_axis = rng.normal(0.0, 1.0, size=N_FEATURES)
    base_axis = base_axis / np.linalg.norm(base_axis)
    pos_mean = base_axis * 0.6
    neg_mean = -base_axis * 0.6

    # Class-conditional Gaussian covariates with mild correlation.
    cov = np.eye(N_FEATURES) * 0.9 + np.full((N_FEATURES, N_FEATURES), 0.05)
    np.fill_diagonal(cov, 1.0)

    X_pos = rng.multivariate_normal(pos_mean, cov, size=n_pos)
    X_neg = rng.multivariate_normal(neg_mean, cov, size=n_neg)
    X = np.vstack([X_pos, X_neg]).astype(np.float64)
    y = np.concatenate([np.ones(n_pos, dtype=np.int64), np.zeros(n_neg, dtype=np.int64)])

    # Shuffle so CV folds aren't all-positive / all-negative.
    perm = rng.permutation(n_samples)
    X = X[perm]
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
        X=X, y=y, feature_names=feature_names, selection_seed=seed,
    )
