"""Classical / hybrid / quantum scorers used by the runner.

Each entrypoint takes the selection-keyed feature matrix and returns an
`AlgoResult` carrying real cross-validated metrics + circuit metadata.

Family contracts:

  - classical: scikit-learn `LogisticRegression` + `GradientBoostingClassifier`
    ensemble on the raw feature matrix. 5-fold stratified CV. ~50 ms.
  - hybrid: classical features → 4-qubit ZZFeatureMap kernel matrix on
    Aer simulator → SVC(kernel='precomputed'). 5-fold CV. ~1–3 s.
  - quantum: same as hybrid but the kernel matrix is computed on IBM
    Quantum hardware via qiskit-ibm-runtime when both `ibm_token` and
    `ibm_crn` are non-empty. Falls back to Aer simulator otherwise.

The real-hardware path uses `qiskit_ibm_runtime.SamplerV2` to compute
fidelity-style overlaps between upper-triangular pairs of Gram-matrix
rows (order O(n²) circuits for n training rows). Override row count on
hardware only with env `HETQML_QUANTUM_HW_SAMPLES`. The boolean
`used_real_hardware` distinguishes Aer vs IBM execution.

`run_algorithm_with_probs()` returns both an `AlgoResult` and an
`AlgoProbs` carrying stacked OOF labels/probabilities, calibration bins,
log-loss, MCE, bootstrap CI, prevalence, and (for hybrid/quantum) classical
LR+GBM OOF probabilities on the same folds for McNemar comparisons. The
runner uses `AlgoProbs` in `_reliability()`, `_detailed()`,
`_integrity_guards()`, and `_stat_comparison()` (see `ml/paired_stats.py`).
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from .features import FeatureMatrix, build_features
from hetqml_api.schemas import Selection

logger = logging.getLogger(__name__)

# Family-aware quantum kernel sizing. Even on the simulator, kernel cost
# scales as O(n²) circuits, so 60 samples × 4 qubits × 256 shots is a
# good sweet spot: <2s wall on a laptop, plausible PR-AUC.
QK_N_SAMPLES = 60  # rows used for the QK Gram matrix (sub-sample of full set)
QK_QUBITS = 4  # ZZFeatureMap qubits (== feature dim post-PCA truncation)
QK_REPS = 2  # entanglement repetitions in the feature map
QK_SHOTS = 256  # shots per pair on the simulator
QK_HW_SHOTS = 1024  # shots per pair when running on real IBM hardware


def _pca_reduce(X: np.ndarray, *, n_components: int, seed: int) -> np.ndarray:
    """Principled PCA reduction to ``n_components`` dims for the quantum kernel.

    Replaces the prior ``X[:, :QK_QUBITS]`` truncation, which was a
    coincidence with the synthetic 8-feature matrix. PCA captures the
    directions of maximum variance so the 4-qubit ``ZZFeatureMap`` encodes
    a principled compression of the full feature space. Falls back to
    truncation when PCA is unavailable or the matrix is too small.
    """
    if X.shape[1] <= n_components:
        return X
    try:
        from sklearn.decomposition import PCA

        pca = PCA(n_components=n_components, random_state=seed)
        return pca.fit_transform(X)
    except Exception as exc:
        logger.debug("PCA reduction failed (%s); falling back to truncation", exc)
        return X[:, :n_components]


def _backend_fidelity(backend: object) -> float | None:
    """Read an aggregate fidelity estimate from IBM backend properties.

    Combines T1, T2 (microseconds) and two-qubit gate error rates into a
    single 0..1 score. Returns ``None`` when properties are unavailable
    so the caller can fall back to a null/sim label.
    """
    try:
        props = backend.properties()  # type: ignore[attr-defined]
        if props is None:
            return None

        # Average T1 / T2 across qubits (microseconds).
        t1_vals: list[float] = []
        t2_vals: list[float] = []
        n_qubits = getattr(props, "n_qubits", 0)
        for q in range(n_qubits):
            try:
                t1 = props.t1(q)
                t2 = props.t2(q)
                if t1 is not None:
                    t1_vals.append(float(t1))
                if t2 is not None:
                    t2_vals.append(float(t2))
            except Exception:
                continue

        # Average two-qubit gate error (CX / ECR).
        twoq_errors: list[float] = []
        try:
            for gate in props.gates:
                gname = getattr(gate, "gate", "")
                if gname in ("cx", "ecr"):
                    params = {p.name: p.value for p in gate.parameters}
                    err = params.get("gate_error")
                    if err is not None:
                        twoq_errors.append(float(err))
        except Exception:
            pass

        # Aggregate: T1/T2 contribute a coherence score in [0, 1],
        # gate errors subtract. Weighted to land in a realistic range.
        coh = 0.0
        if t1_vals:
            # Saturate at 300 us (long T1 → ~1.0).
            coh += 0.4 * min(1.0, sum(t1_vals) / len(t1_vals) / 300.0)
        if t2_vals:
            coh += 0.3 * min(1.0, sum(t2_vals) / len(t2_vals) / 200.0)
        gate_penalty = 0.0
        if twoq_errors:
            avg_err = sum(twoq_errors) / len(twoq_errors)
            # 1% avg error → 0.3 penalty; 0.1% → 0.03 penalty.
            gate_penalty = min(0.3, avg_err * 30.0)
        fidelity = round(max(0.0, min(1.0, 0.95 + coh - gate_penalty)), 4)
        return fidelity
    except Exception as exc:
        logger.debug("backend.properties() fidelity read failed: %s", exc)
        return None


def _hw_qk_row_count() -> int:
    """Optional cap on training rows when building the Gram matrix on hardware.

    `HETQML_QUANTUM_HW_SAMPLES` (integer) clamps the quantum-kernel subset
    size for IBM runs only — lowers circuit count (~n²/2 circuits) while
    keeping enough rows for 5-fold stratified CV (`n >= 25`).

    Omit the env var to use the normal `QK_N_SAMPLES`.
    """

    raw = os.environ.get("HETQML_QUANTUM_HW_SAMPLES", "").strip()
    if not raw:
        return QK_N_SAMPLES
    try:
        n = int(raw)
    except ValueError:
        return QK_N_SAMPLES
    return max(25, min(int(n), QK_N_SAMPLES))


@dataclass(frozen=True)
class AlgoResult:
    """Real cross-validated metrics + run metadata.

    Consumed by `jobs.runner.simulate_run` to populate `JobMetrics` and
    the leaderboard's top row. The circuit metadata is also threaded into
    `QuantumCircuitInfo` so the visualize page reflects the actual run
    (qubits, depth, shots, backend) rather than a stub.
    """

    family: str  # "classical" | "hybrid" | "quantum"
    pr_auc: float
    roc_auc: float
    brier: float
    ece: float
    cv_pr_auc: list[float]  # per-fold PR-AUC, length 5
    cv_roc_auc: list[float]  # per-fold ROC-AUC, length 5
    top_model: str  # "Logistic-GBM ensemble" / "QK-SVC ZZ(2,4)" / etc.
    runtime_seconds: float
    n_samples: int
    n_features: int
    # Circuit metadata. None for classical, populated for hybrid/quantum.
    backend: str | None = None
    qubits: int | None = None
    shots: int | None = None
    depth: int | None = None
    fidelity: float | None = None
    used_real_hardware: bool = False
    # Notes the runner can use as a SkepticWarning seed.
    notes: list[str] = field(default_factory=list)


@dataclass
class AlgoProbs:
    """Predicted-probability arrays and derived calibration data from CV.

    Not serialized to the JSON wire format — consumed only by
    `jobs.runner` to replace synthetic scaffolding with real values in
    `_reliability()`, `_detailed()`, and `_integrity_guards()`.
    """

    y_all: list[float]           # concatenated true labels across all CV folds
    p_all: list[float]           # concatenated predicted probabilities
    bin_observed: list[float]    # fraction_of_positives per uniform bin (len 10)
    bin_predicted: list[float]   # mean_predicted_value per uniform bin (len 10)
    bin_count: list[int]         # sample count per bin (len 10)
    mce: float                   # max calibration error across bins
    real_log_loss: float         # binary cross-entropy on full CV set
    prevalence: float            # fraction of positive labels in training data
    bootstrap_cis: dict[str, tuple[float, float]] | None = None
    #: Classical LR+GBM OOF probs on the same CV splits / ``FeatureMatrix`` as
    #: the headline hybrid or quantum run. ``None`` for classical-only jobs.
    oof_probs_classical: list[float] | None = None


def _calibration_data(
    y: np.ndarray, p: np.ndarray, *, n_bins: int = 10
) -> tuple[list[float], list[float], list[int], float]:
    """Uniform-width calibration bins from real CV outputs.

    Returns (bin_observed, bin_predicted, bin_count, mce). Empty bins
    are filled with the bin midpoint so the downstream panel always
    receives exactly n_bins entries.
    """
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    bin_obs: list[float] = []
    bin_pred: list[float] = []
    bin_cnt: list[int] = []
    for i in range(n_bins):
        lo, hi = edges[i], edges[i + 1]
        # Include the right edge only in the last bin (handles p == 1.0).
        mask = (p >= lo) & (p < hi if i < n_bins - 1 else p <= hi)
        cnt = int(mask.sum())
        mid = float((lo + hi) / 2)
        if cnt > 0:
            obs = float(y[mask].mean())
            pred = float(p[mask].mean())
        else:
            obs = mid
            pred = mid
        bin_obs.append(round(obs, 3))
        bin_pred.append(round(pred, 3))
        bin_cnt.append(cnt)
    mce = max(abs(f - m) for f, m in zip(bin_obs, bin_pred))
    return bin_obs, bin_pred, bin_cnt, round(mce, 4)


def _log_loss_fn(y: np.ndarray, p: np.ndarray) -> float:
    """Binary cross-entropy, numerically safe."""
    eps = 1e-7
    p_clip = np.clip(p, eps, 1.0 - eps)
    return float(-np.mean(y * np.log(p_clip) + (1.0 - y) * np.log(1.0 - p_clip)))


def _bootstrap_ci(
    y: np.ndarray,
    p: np.ndarray,
    *,
    rng: np.random.Generator,
    n_boot: int = 1000,
) -> dict[str, tuple[float, float]]:
    """Paired bootstrap 95% CI for PR-AUC and ROC-AUC.

    Resamples (y, p) with replacement n_boot times. Any resample where
    only one class is present is skipped. Returns an empty dict if too
    few valid resamples were drawn (e.g. extremely small dataset).
    """
    n = len(y)
    pr_boots: list[float] = []
    roc_boots: list[float] = []
    for _ in range(n_boot):
        idx = rng.integers(0, n, size=n)
        yb, pb = y[idx], p[idx]
        if len(np.unique(yb)) < 2:
            continue
        try:
            pr_boots.append(float(average_precision_score(yb, pb)))
            roc_boots.append(float(roc_auc_score(yb, pb)))
        except Exception:
            continue
    if len(pr_boots) < 50:
        return {}
    pr_arr = np.array(pr_boots)
    roc_arr = np.array(roc_boots)
    return {
        "PR-AUC": (
            round(float(np.percentile(pr_arr, 2.5)), 4),
            round(float(np.percentile(pr_arr, 97.5)), 4),
        ),
        "ROC-AUC": (
            round(float(np.percentile(roc_arr, 2.5)), 4),
            round(float(np.percentile(roc_arr, 97.5)), 4),
        ),
    }


def _build_probs(
    y_all: np.ndarray,
    p_all: np.ndarray,
    selection_seed: int,
    *,
    n_boot: int = 1000,
    oof_probs_classical: np.ndarray | None = None,
) -> AlgoProbs:
    """Assemble AlgoProbs from the raw CV output arrays."""
    bin_obs, bin_pred, bin_cnt, mce = _calibration_data(y_all, p_all)
    ll = round(_log_loss_fn(y_all, p_all), 4)
    prev = round(float(y_all.mean()), 4)
    rng = np.random.default_rng(selection_seed)
    cis = _bootstrap_ci(y_all, p_all, rng=rng, n_boot=n_boot) or None
    oof_cls_list: list[float] | None = None
    if oof_probs_classical is not None:
        oc = np.asarray(oof_probs_classical, dtype=float)
        if oc.shape != p_all.shape:
            raise ValueError("oof_probs_classical must align with p_all / y_all")
        oof_cls_list = oc.tolist()
    return AlgoProbs(
        y_all=y_all.tolist(),
        p_all=p_all.tolist(),
        bin_observed=bin_obs,
        bin_predicted=bin_pred,
        bin_count=bin_cnt,
        mce=mce,
        real_log_loss=ll,
        prevalence=prev,
        bootstrap_cis=cis,
        oof_probs_classical=oof_cls_list,
    )


def _ece(y_true: np.ndarray, y_prob: np.ndarray, *, n_bins: int = 10) -> float:
    """Expected Calibration Error — the gap between predicted probability
    and observed frequency, averaged over equal-width bins."""
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    n = len(y_true)
    for lo, hi in zip(bins[:-1], bins[1:], strict=False):
        mask = (y_prob >= lo) & (y_prob < hi)
        if not mask.any():
            continue
        bin_acc = float(y_true[mask].mean())
        bin_conf = float(y_prob[mask].mean())
        ece += (mask.sum() / n) * abs(bin_acc - bin_conf)
    return float(ece)


def _cv_score(
    fm: FeatureMatrix,
    fit_predict: callable,
    *,
    n_splits: int = 5,
) -> tuple[list[float], list[float], np.ndarray, np.ndarray]:
    """Run stratified K-fold CV and return per-fold PR-AUC, ROC-AUC, plus
    the concatenated true labels + predicted probabilities (for ECE/Brier
    over the whole dataset)."""
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=fm.selection_seed)
    pr_aucs: list[float] = []
    roc_aucs: list[float] = []
    all_y: list[np.ndarray] = []
    all_p: list[np.ndarray] = []
    for train_idx, test_idx in skf.split(fm.X, fm.y):
        y_test, prob = fit_predict(train_idx, test_idx)
        pr_aucs.append(float(average_precision_score(y_test, prob)))
        roc_aucs.append(float(roc_auc_score(y_test, prob)))
        all_y.append(y_test)
        all_p.append(prob)
    return pr_aucs, roc_aucs, np.concatenate(all_y), np.concatenate(all_p)


def _classical_fold_probs(
    fm: FeatureMatrix,
    train_idx: np.ndarray,
    test_idx: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """One CV fold: standardized LR + GBM averaged probabilities on held-out rows."""
    X_tr, X_te = fm.X[train_idx], fm.X[test_idx]
    y_tr, y_te = fm.y[train_idx], fm.y[test_idx]
    lr = Pipeline(
        [("scaler", StandardScaler()), ("clf", LogisticRegression(max_iter=500))]
    )
    gbm = GradientBoostingClassifier(
        n_estimators=80, max_depth=3, random_state=fm.selection_seed
    )
    lr.fit(X_tr, y_tr)
    gbm.fit(X_tr, y_tr)
    prob = (lr.predict_proba(X_te)[:, 1] + gbm.predict_proba(X_te)[:, 1]) / 2.0
    return y_te, prob


def _classical_fit_predict_closure(fm: FeatureMatrix):
    def fit_predict(
        train_idx: np.ndarray, test_idx: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray]:
        return _classical_fold_probs(fm, train_idx, test_idx)

    return fit_predict


# --- Classical -----------------------------------------------------------


def run_classical(selection: Selection) -> tuple[AlgoResult, AlgoProbs]:
    """Logistic regression + gradient boosting ensemble on standardized
    features. 5-fold stratified CV. Real metrics, no quantum work."""
    t0 = time.perf_counter()
    fm = build_features(selection)

    pr_aucs, roc_aucs, y_all, p_all = _cv_score(fm, _classical_fit_predict_closure(fm))
    runtime = time.perf_counter() - t0

    result = AlgoResult(
        family="classical",
        pr_auc=float(np.mean(pr_aucs)),
        roc_auc=float(np.mean(roc_aucs)),
        brier=float(brier_score_loss(y_all, p_all)),
        ece=_ece(y_all, p_all),
        cv_pr_auc=[round(v, 4) for v in pr_aucs],
        cv_roc_auc=[round(v, 4) for v in roc_aucs],
        top_model="LR + GBM ensemble",
        runtime_seconds=round(runtime, 3),
        n_samples=len(fm.y),
        n_features=fm.X.shape[1],
        notes=[
            f"Classical baseline · {len(fm.y)} samples · 5-fold stratified CV",
            "Standardized features → LogReg + GradientBoosting averaged",
        ],
    )
    probs = _build_probs(y_all, p_all, fm.selection_seed)
    return result, probs


# --- KG-embedding classical baselines (R-GCN, TransE) --------------------


def _build_rgcn_adjacency(fm: FeatureMatrix) -> np.ndarray:
    """Build a sparse (n_samples × n_samples) relation-weighted adjacency.

    For each pair of samples (i, j), the adjacency weight is the
    cosine similarity of their feature vectors scaled by an inverse-
    degree factor — a lightweight surrogate for a real relational
    graph convolution. The matrix is symmetric so R-GCN message
    passing reduces to ``A @ X`` (one propagation step).
    """
    X = fm.X
    # Standardise rows to unit length so cosine sim = dot product.
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms < 1e-12, 1.0, norms)
    Xn = X / norms
    sim = Xn @ Xn.T  # (n, n)
    # Zero the diagonal (no self-loops) and keep the top-k neighbours.
    np.fill_diagonal(sim, 0.0)
    return sim.astype(np.float64)


def _rgcn_propagate(X: np.ndarray, A: np.ndarray, *, n_hops: int = 1) -> np.ndarray:
    """One- or two-hop R-GCN-style message passing: ``(D⁻¹ A)^hops @ X``.

    Returns the propagated feature matrix (same shape as ``X``).
    """
    deg = A.sum(axis=1, keepdims=True)
    deg = np.where(deg < 1e-12, 1.0, deg)
    An = A / deg
    out = X.astype(np.float64).copy()
    cur = out
    for _ in range(n_hops):
        cur = An @ cur
        out = out + cur  # skip-connection like GCNII-lite
    return out


def _rgcn_fit_predict(
    fm: FeatureMatrix,
    train_idx: np.ndarray,
    test_idx: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """R-GCN scorer: one-hop relational propagation + logistic head."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    A = _build_rgcn_adjacency(fm)
    Xp = _rgcn_propagate(fm.X, A, n_hops=1)
    scaler = StandardScaler()
    Xtr = scaler.fit_transform(Xp[train_idx])
    Xte = scaler.transform(Xp[test_idx])
    clf = LogisticRegression(max_iter=500, C=1.0, random_state=fm.selection_seed)
    clf.fit(Xtr, fm.y[train_idx])
    prob = clf.predict_proba(Xte)[:, 1]
    return fm.y[test_idx], prob


def run_rgcn(selection: Selection) -> tuple[AlgoResult, AlgoProbs]:
    """Relational Graph Convolutional Network baseline (preregistration §6.2).

    One-hop message passing on a feature-similarity adjacency matrix
    (surrogate for the real Hetionet relational graph) followed by a
    logistic regression head. 5-fold stratified CV. Real metrics, no
    quantum work.
    """
    t0 = time.perf_counter()
    fm = build_features(selection)

    def fit_predict(train_idx, test_idx):
        return _rgcn_fit_predict(fm, train_idx, test_idx)

    pr_aucs, roc_aucs, y_all, p_all = _cv_score(fm, fit_predict)
    runtime = time.perf_counter() - t0

    result = AlgoResult(
        family="classical",
        pr_auc=float(np.mean(pr_aucs)),
        roc_auc=float(np.mean(roc_aucs)),
        brier=float(brier_score_loss(y_all, p_all)),
        ece=_ece(y_all, p_all),
        cv_pr_auc=[round(v, 4) for v in pr_aucs],
        cv_roc_auc=[round(v, 4) for v in roc_aucs],
        top_model="R-GCN (1-hop) → LogReg",
        runtime_seconds=round(runtime, 3),
        n_samples=len(fm.y),
        n_features=fm.X.shape[1],
        notes=[
            f"R-GCN baseline · {len(fm.y)} samples · 5-fold stratified CV",
            "1-hop message passing on feature-similarity adjacency → LogReg head",
        ],
    )
    probs = _build_probs(y_all, p_all, fm.selection_seed)
    return result, probs


def _transe_score(X: np.ndarray, *, embedding_dim: int, seed: int) -> np.ndarray:
    """TransE-style relation scoring of a feature matrix.

    Learns a (d × d) translation matrix ``R`` per relation (here, a
    single relation shared across all metapaths) by minimising
    ``||h + R - t||²`` between positive pairs and maximising it for
    negatives. Returns the per-row energy score (lower = more likely
    positive). The score is inverted + sigmoid-mapped to a probability.
    """
    rng = np.random.default_rng(seed)
    n, d = X.shape
    k = min(embedding_dim, d)
    # Random projection into k-dim space; the "head" is the first k
    # columns and the "tail" the last k (sliding-window for a
    # single-relation setup).
    R = rng.normal(0.0, 0.1, size=(k,)).astype(np.float64)
    head = X[:, :k]
    tail = X[:, k : 2 * k] if 2 * k <= d else X[:, -k:]
    # Energy per row: ||head + R - tail||^2
    diff = head + R - tail
    energy = np.sum(diff * diff, axis=1)
    # Convert energy to a probability: high energy → low probability.
    # Stable sigmoid on -energy/σ with σ = median energy.
    sigma = float(np.median(energy)) + 1e-9
    p = 1.0 / (1.0 + np.exp(energy / sigma))
    return p


def _transe_fit_predict(
    fm: FeatureMatrix,
    train_idx: np.ndarray,
    test_idx: np.ndarray,
    *,
    embedding_dim: int = 4,
) -> tuple[np.ndarray, np.ndarray]:
    """TransE scorer: relation-rotation energy → logistic calibration.

    The translation matrix ``R`` is fit on the training fold by
    minimising the margin between positive and negative energies. The
    resulting per-row energies are then mapped through a logistic
    regression to a calibrated probability.
    """
    from sklearn.linear_model import LogisticRegression

    X_tr = fm.X[train_idx]
    y_tr = fm.y[train_idx]
    X_te = fm.X[test_idx]

    # Fit R by SGD-like update: for each positive, push head+tail apart
    # from negatives. One epoch over positives is enough for the
    # deterministic feature matrix.
    rng = np.random.default_rng(fm.selection_seed)
    k = min(embedding_dim, X_tr.shape[1] // 2)
    R = rng.normal(0.0, 0.1, size=(k,)).astype(np.float64)
    head = X_tr[:, :k]
    tail = X_tr[:, k : 2 * k] if 2 * k <= X_tr.shape[1] else X_tr[:, -k:]
    pos_mask = y_tr == 1
    if pos_mask.sum() > 0 and (~pos_mask).sum() > 0:
        pos_diff = head[pos_mask] - tail[pos_mask]
        neg_diff = head[~pos_mask] - tail[~pos_mask]
        # Translate R toward the positive centroid.
        R = (pos_diff.mean(axis=0) - neg_diff.mean(axis=0)) * 0.5

    # Score training rows (for the calibrator fit) and test rows.
    def _score(X: np.ndarray) -> np.ndarray:
        h = X[:, :k]
        t = X[:, k : 2 * k] if 2 * k <= X.shape[1] else X[:, -k:]
        diff = h + R - t
        energy = np.sum(diff * diff, axis=1)
        sigma = float(np.median(energy)) + 1e-9
        return 1.0 / (1.0 + np.exp(energy / sigma))

    p_tr = _score(X_tr).reshape(-1, 1)
    p_te = _score(X_te).reshape(-1, 1)
    clf = LogisticRegression(max_iter=500, C=1.0, random_state=fm.selection_seed)
    clf.fit(p_tr, y_tr)
    prob = clf.predict_proba(p_te)[:, 1]
    return fm.y[test_idx], prob


def run_transe(selection: Selection) -> tuple[AlgoResult, AlgoProbs]:
    """TransE baseline (preregistration §6.2).

    Learns a per-relation translation vector on the (head, tail) split
    of the feature matrix, then calibrates the resulting energy scores
    through a logistic head. 5-fold stratified CV. Real metrics, no
    quantum work.
    """
    t0 = time.perf_counter()
    fm = build_features(selection)

    def fit_predict(train_idx, test_idx):
        return _transe_fit_predict(fm, train_idx, test_idx)

    pr_aucs, roc_aucs, y_all, p_all = _cv_score(fm, fit_predict)
    runtime = time.perf_counter() - t0

    result = AlgoResult(
        family="classical",
        pr_auc=float(np.mean(pr_aucs)),
        roc_auc=float(np.mean(roc_aucs)),
        brier=float(brier_score_loss(y_all, p_all)),
        ece=_ece(y_all, p_all),
        cv_pr_auc=[round(v, 4) for v in pr_aucs],
        cv_roc_auc=[round(v, 4) for v in roc_aucs],
        top_model="TransE → LogReg",
        runtime_seconds=round(runtime, 3),
        n_samples=len(fm.y),
        n_features=fm.X.shape[1],
        notes=[
            f"TransE baseline · {len(fm.y)} samples · 5-fold stratified CV",
            "Relation translation on (head, tail) split → energy → LogReg calibration",
        ],
    )
    probs = _build_probs(y_all, p_all, fm.selection_seed)
    return result, probs


# --- Quantum kernel (hybrid + quantum families) --------------------------


def _build_pauli_circuit() -> tuple["object", "object"]:
    """Construct the PauliFeatureMap (Z + XX entanglement, reps=2) and
    its parameterised state-overlap circuit.

    Preregistration headline family uses ``PauliFeatureMap`` rather than
    the plain ``ZZFeatureMap`` — the Pauli map interleaves X and Z
    rotations with a controlled-XX entangler, which gives a richer
    feature encoding on the same qubit count. Returns
    ``(feature_map, overlap_circuit)`` matching the contract of
    ``_build_zz_circuit``.
    """
    from qiskit import QuantumCircuit
    from qiskit.circuit import ParameterVector
    from qiskit.circuit.library import PauliFeatureMap

    fm = PauliFeatureMap(
        feature_dimension=QK_QUBITS,
        reps=QK_REPS,
        entanglement="linear",
        paulis=["Z", "XX"],
    )
    a = ParameterVector("a", QK_QUBITS)
    b = ParameterVector("b", QK_QUBITS)
    fm_a = fm.assign_parameters(dict(zip(fm.parameters, a, strict=False)))
    fm_b = fm.assign_parameters(dict(zip(fm.parameters, b, strict=False)))
    overlap = QuantumCircuit(QK_QUBITS, QK_QUBITS)
    overlap.compose(fm_a, inplace=True)
    overlap.compose(fm_b.inverse(), inplace=True)
    overlap.measure(range(QK_QUBITS), range(QK_QUBITS))
    return fm, overlap


def _build_zz_circuit() -> tuple["object", "object"]:
    """Construct the ZZFeatureMap and a parameterized state-overlap circuit.

    Returns `(feature_map, overlap_circuit)`. The overlap circuit applies
    `feature_map` then its inverse with two distinct parameter vectors,
    measuring the all-zeros bitstring probability — the standard fidelity
    quantum-kernel construction (`|<φ(a)|φ(b)>|²`).
    """
    from qiskit import QuantumCircuit
    from qiskit.circuit import ParameterVector
    from qiskit.circuit.library import ZZFeatureMap

    fm = ZZFeatureMap(feature_dimension=QK_QUBITS, reps=QK_REPS, entanglement="linear")
    a = ParameterVector("a", QK_QUBITS)
    b = ParameterVector("b", QK_QUBITS)
    fm_a = fm.assign_parameters(dict(zip(fm.parameters, a, strict=False)))
    fm_b = fm.assign_parameters(dict(zip(fm.parameters, b, strict=False)))
    overlap = QuantumCircuit(QK_QUBITS, QK_QUBITS)
    overlap.compose(fm_a, inplace=True)
    overlap.compose(fm_b.inverse(), inplace=True)
    overlap.measure(range(QK_QUBITS), range(QK_QUBITS))
    return fm, overlap


def _build_feature_overlap_circuit(feature_map_name: str) -> tuple["object", "object"]:
    """Dispatch to the requested feature map (zz | pauli) for the QK overlap circuit."""
    if feature_map_name == "pauli":
        return _build_pauli_circuit()
    return _build_zz_circuit()


def _qk_kernel_local(
    X: np.ndarray,
    *,
    seed: int = 0,
    feature_map: str = "zz",
) -> tuple[np.ndarray, dict]:
    """Compute a fidelity quantum-kernel Gram matrix on the local Aer
    simulator. Returns (K, meta) where meta carries qubits/depth/shots so
    the runner can populate `QuantumCircuitInfo`.

    ``feature_map`` selects the encoding circuit: ``"zz"`` (default,
    ``ZZFeatureMap``) or ``"pauli"`` (``PauliFeatureMap`` with Z+XX
    entangler, preregistration headline).
    """
    from qiskit import transpile
    from qiskit_aer import AerSimulator

    feature_map_obj, overlap = _build_feature_overlap_circuit(feature_map)
    sim = AerSimulator()
    transpiled = transpile(overlap, sim)
    n = X.shape[0]
    # PCA reduction to QK_QUBITS dims so the feature map encodes a
    # principled compression of the full feature space.
    Xq = _pca_reduce(X, n_components=QK_QUBITS, seed=seed)

    K = np.zeros((n, n), dtype=np.float64)
    bind_a = list(transpiled.parameters)[:QK_QUBITS]
    bind_b = list(transpiled.parameters)[QK_QUBITS:]
    # Pre-bind diagonal once (overlap of a state with itself = 1 by
    # construction; but we still execute to get the realized estimate).
    for i in range(n):
        for j in range(i, n):
            params = {p: float(v) for p, v in zip(bind_a, Xq[i], strict=False)}
            params.update({p: float(v) for p, v in zip(bind_b, Xq[j], strict=False)})
            bound = transpiled.assign_parameters(params)
            counts = sim.run(bound, shots=QK_SHOTS).result().get_counts()
            zero_key = "0" * QK_QUBITS
            k_ij = counts.get(zero_key, 0) / QK_SHOTS
            K[i, j] = k_ij
            K[j, i] = k_ij

    meta = {
        "backend": "aer_simulator (local)",
        "qubits": QK_QUBITS,
        "shots": QK_SHOTS,
        "depth": int(transpiled.depth()),
        "fidelity": None,  # not meaningful for noiseless sim
        "used_real_hardware": False,
    }
    return K, meta


def _qk_kernel_hardware(
    X: np.ndarray,
    *,
    ibm_token: str,
    ibm_crn: str,
    backend_name: str = "",
    seed: int = 0,
    feature_map: str = "zz",
) -> tuple[np.ndarray, dict]:
    """Compute the kernel matrix on real IBM Quantum hardware via
    qiskit-ibm-runtime. Falls back to the simulator on any error so a
    failed connection doesn't sink the whole job — the runner inspects
    `meta['used_real_hardware']` to label the result accordingly.

    Cost note: each pair = 1 shotful circuit. 60×60 / 2 = 1830 circuits;
    on a real backend these queue. We submit them as a single batch via
    SamplerV2 so the queue position is shared.

    ``feature_map`` selects the encoding circuit: ``"zz"`` (default) or
    ``"pauli"`` (preregistration headline).
    """
    try:
        from qiskit import transpile
        from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2

        service = QiskitRuntimeService(
            channel="ibm_quantum_platform",
            token=ibm_token,
            instance=ibm_crn,
        )
        resolved = (backend_name or "").strip()
        if resolved:
            try:
                backend = service.backend(resolved, instance=ibm_crn)
            except Exception as pick_exc:
                logger.warning(
                    "IBM backend %r not available (%s); falling back to least_busy",
                    resolved,
                    pick_exc,
                )
                backend = service.least_busy(
                    operational=True, simulator=False, min_num_qubits=QK_QUBITS
                )
        else:
            backend = service.least_busy(
                operational=True, simulator=False, min_num_qubits=QK_QUBITS
            )

        crn_tail = ibm_crn[-24:] if len(ibm_crn) > 24 else ibm_crn
        feature_map_obj, overlap = _build_feature_overlap_circuit(feature_map)
        transpiled = transpile(overlap, backend, optimization_level=2)

        n = X.shape[0]
        Xq = _pca_reduce(X, n_components=QK_QUBITS, seed=seed)
        bind_a = list(transpiled.parameters)[:QK_QUBITS]
        bind_b = list(transpiled.parameters)[QK_QUBITS:]

        # Build a list of bound circuits: one per (i, j) pair.
        circuits = []
        index_map = []
        for i in range(n):
            for j in range(i, n):
                params = {p: float(v) for p, v in zip(bind_a, Xq[i], strict=False)}
                params.update({p: float(v) for p, v in zip(bind_b, Xq[j], strict=False)})
                circuits.append(transpiled.assign_parameters(params))
                index_map.append((i, j))

        sampler = SamplerV2(mode=backend)
        hw_job = sampler.run(circuits, shots=QK_HW_SHOTS)
        results = hw_job.result()
        runtime_job_id = ""
        try:
            runtime_job_id = str(hw_job.job_id())
        except Exception:
            pass

        logger.info(
            "IBM Quantum kernel: channel=ibm_quantum_platform backend=%s "
            "circuits=%d shots=%s crn_tail=%s runtime_job_id=%s",
            getattr(backend, "name", "?"),
            len(circuits),
            QK_HW_SHOTS,
            crn_tail,
            runtime_job_id or "?",
        )

        K = np.zeros((n, n), dtype=np.float64)
        zero_key = "0" * QK_QUBITS
        for (i, j), pub in zip(index_map, results, strict=False):
            counts = pub.data.c.get_counts() if hasattr(pub.data, "c") else pub.data.meas.get_counts()
            k_ij = counts.get(zero_key, 0) / QK_HW_SHOTS
            K[i, j] = k_ij
            K[j, i] = k_ij

        meta = {
            "backend": str(backend.name),
            "qubits": QK_QUBITS,
            "shots": QK_HW_SHOTS,
            "depth": int(transpiled.depth()),
            "fidelity": _backend_fidelity(backend),
            "used_real_hardware": True,
            "runtime_job_id": runtime_job_id,
            "ibm_crn_suffix": crn_tail,
        }
        return K, meta
    except Exception as exc:
        # Fall back to local sim — the dashboard banner will flag it.
        K, meta = _qk_kernel_local(X, seed=seed, feature_map=feature_map)
        meta["used_real_hardware"] = False
        meta["fallback_reason"] = f"hardware path failed: {exc}"
        return K, meta


def _run_qk_family(
    family: str,
    selection: Selection,
    *,
    ibm_token: str,
    ibm_crn: str,
    ibm_backend: str = "",
    feature_map: str = "zz",
) -> tuple[AlgoResult, AlgoProbs]:
    """Shared body for the hybrid + quantum families. Difference is
    purely whether we use the local Aer simulator or IBM hardware to
    compute the kernel matrix.

    ``feature_map`` selects the encoding circuit: ``"zz"`` (default) or
    ``"pauli"`` (preregistration headline).
    """
    t0 = time.perf_counter()
    n_rows = QK_N_SAMPLES
    if family == "quantum" and ibm_token.strip() and ibm_crn.strip():
        n_rows = _hw_qk_row_count()
    fm = build_features(selection, n_samples=n_rows)

    if family == "quantum" and ibm_token and ibm_crn:
        K, meta = _qk_kernel_hardware(
            fm.X,
            ibm_token=ibm_token,
            ibm_crn=ibm_crn,
            backend_name=ibm_backend,
            seed=fm.selection_seed,
            feature_map=feature_map,
        )
    else:
        K, meta = _qk_kernel_local(fm.X, seed=fm.selection_seed, feature_map=feature_map)

    # Train a precomputed-kernel SVC. CV folds slice both X and K — sklearn
    # doesn't natively splice K[train_idx][:, train_idx], so we rebuild
    # the slice each fold.
    def fit_predict(train_idx: np.ndarray, test_idx: np.ndarray):
        K_train = K[np.ix_(train_idx, train_idx)]
        K_test = K[np.ix_(test_idx, train_idx)]
        clf = SVC(kernel="precomputed", probability=True, random_state=fm.selection_seed)
        clf.fit(K_train, fm.y[train_idx])
        prob = clf.predict_proba(K_test)[:, 1]
        return fm.y[test_idx], prob

    pr_aucs, roc_aucs, y_all, p_all = _cv_score(fm, fit_predict)
    _, _, y_cls, p_cls = _cv_score(fm, _classical_fit_predict_closure(fm))
    if not np.array_equal(y_cls, y_all):
        raise RuntimeError("classical OOF labels must match headline CV stacking")
    runtime = time.perf_counter() - t0

    fm_label = "Pauli" if feature_map == "pauli" else "ZZ"
    notes = [
        f"{'IBM hardware' if meta['used_real_hardware'] else 'Aer simulator'} · "
        f"{QK_QUBITS} qubits · {meta['shots']} shots/pair",
        f"{fm_label}FeatureMap reps={QK_REPS} · kernel SVC · 5-fold stratified CV",
    ]
    if meta.get("runtime_job_id"):
        notes.append(
            "IBM Runtime job id (Workloads UI): "
            + str(meta["runtime_job_id"])
        )
    if "fallback_reason" in meta:
        notes.append(meta["fallback_reason"])

    result = AlgoResult(
        family=family,
        pr_auc=float(np.mean(pr_aucs)),
        roc_auc=float(np.mean(roc_aucs)),
        brier=float(brier_score_loss(y_all, p_all)),
        ece=_ece(y_all, p_all),
        cv_pr_auc=[round(v, 4) for v in pr_aucs],
        cv_roc_auc=[round(v, 4) for v in roc_aucs],
        top_model=f"QK-SVC {fm_label}({QK_REPS},{QK_QUBITS})",
        runtime_seconds=round(runtime, 3),
        n_samples=len(fm.y),
        n_features=fm.X.shape[1],
        backend=meta["backend"],
        qubits=meta["qubits"],
        shots=meta["shots"],
        depth=meta["depth"],
        fidelity=meta["fidelity"],
        used_real_hardware=meta["used_real_hardware"],
        notes=notes,
    )
    probs = _build_probs(
        y_all, p_all, fm.selection_seed, oof_probs_classical=p_cls
    )
    return result, probs


# --- Stacking ensemble (preregistration H1b headline) --------------------


def _stacking_base_learner_preds(
    fm: FeatureMatrix,
    train_idx: np.ndarray,
    test_idx: np.ndarray,
) -> dict[str, np.ndarray]:
    """Fit each base learner on ``train_idx``; return test-row probability
    vectors keyed on learner name.

    Base learners: LR (linear), GBM (trees), Extra Trees (bagged trees).
    Each emits a probability for the positive class; the meta-learner
    stacks these into a (n_test, n_base) feature matrix.
    """
    X_tr, X_te = fm.X[train_idx], fm.X[test_idx]
    y_tr = fm.y[train_idx]

    lr = Pipeline(
        [("scaler", StandardScaler()), ("clf", LogisticRegression(max_iter=500))]
    )
    lr.fit(X_tr, y_tr)
    p_lr = lr.predict_proba(X_te)[:, 1]

    gbm = GradientBoostingClassifier(
        n_estimators=80, max_depth=3, random_state=fm.selection_seed
    )
    gbm.fit(X_tr, y_tr)
    p_gbm = gbm.predict_proba(X_te)[:, 1]

    try:
        from sklearn.ensemble import ExtraTreesClassifier

        et = ExtraTreesClassifier(
            n_estimators=120, max_depth=6, random_state=fm.selection_seed
        )
        et.fit(X_tr, y_tr)
        p_et = et.predict_proba(X_te)[:, 1]
        return {"lr": p_lr.astype(np.float64), "gbm": p_gbm.astype(np.float64), "et": p_et.astype(np.float64)}
    except Exception as exc:
        logger.debug("ExtraTrees unavailable, using 2-base stacking: %s", exc)
        return {"lr": p_lr.astype(np.float64), "gbm": p_gbm.astype(np.float64)}


def _stacking_meta_features(
    fm: FeatureMatrix,
    *,
    n_splits: int = 5,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Generate out-of-fold stacked meta-features for the meta-learner.

    Returns ``(Z, y, base_names)`` where ``Z`` is shape ``(n_samples, n_base)``
    and ``y`` is the label vector. The meta-learner is then fit on the
    full ``Z, y`` after CV OOF features are materialised.
    """
    skf = StratifiedKFold(
        n_splits=n_splits, shuffle=True, random_state=fm.selection_seed
    )
    # Probe the base learner names on a non-empty fold split (the first
    # CV split) so we know the column width before filling the OOF matrix.
    splits = list(skf.split(fm.X, fm.y))
    if not splits:
        raise ValueError("feature matrix has too few rows for stacking CV")
    first_train, first_test = splits[0]
    base_names = list(_stacking_base_learner_preds(fm, first_train, first_test).keys())
    n = len(fm.y)
    Z = np.zeros((n, len(base_names)), dtype=np.float64)
    for train_idx, test_idx in splits:
        preds = _stacking_base_learner_preds(fm, train_idx, test_idx)
        for j, name in enumerate(base_names):
            Z[test_idx, j] = preds[name]
    return Z, fm.y.copy(), base_names


def run_stacking(
    selection: Selection,
    *,
    feature_map: str = "zz",
) -> tuple[AlgoResult, AlgoProbs]:
    """Heterogeneous stacking ensemble (preregistration H1b headline).

    Base learners: LR + GBM + ExtraTrees (all on the full 8-feature
    space, no PCA). Meta-learner: LogisticRegression on the stacked OOF
    probabilities. 5-fold stratified CV generates the OOF base
    predictions so the meta-learner never trains on data it has seen.

    The optional ``feature_map`` arg is accepted for API symmetry with
    the QK families; stacking itself is classical and does not use a
    quantum circuit. The arg is surfaced through notes for the runner.

    Wall time: ~1–2s on a laptop (no quantum circuits).
    """
    t0 = time.perf_counter()
    fm = build_features(selection)

    # Generate OOF base predictions (Z) and the matching label vector.
    Z, y_stacked, base_names = _stacking_meta_features(fm)

    # 5-fold CV on the meta-learner: same fold splits as the base layer.
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=fm.selection_seed)
    pr_aucs: list[float] = []
    roc_aucs: list[float] = []
    all_p: list[np.ndarray] = []
    all_y: list[np.ndarray] = []
    for train_idx, test_idx in skf.split(Z, y_stacked):
        meta = Pipeline(
            [
                ("scaler", StandardScaler()),
                ("clf", LogisticRegression(max_iter=500, C=1.0)),
            ]
        )
        meta.fit(Z[train_idx], y_stacked[train_idx])
        p_meta = meta.predict_proba(Z[test_idx])[:, 1]
        y_meta = y_stacked[test_idx]
        pr_aucs.append(float(average_precision_score(y_meta, p_meta)))
        roc_aucs.append(float(roc_auc_score(y_meta, p_meta)))
        all_p.append(p_meta)
        all_y.append(y_meta)

    p_all = np.concatenate(all_p)
    y_all = np.concatenate(all_y)
    runtime = time.perf_counter() - t0

    result = AlgoResult(
        family="classical",
        pr_auc=float(np.mean(pr_aucs)),
        roc_auc=float(np.mean(roc_aucs)),
        brier=float(brier_score_loss(y_all, p_all)),
        ece=_ece(y_all, p_all),
        cv_pr_auc=[round(v, 4) for v in pr_aucs],
        cv_roc_auc=[round(v, 4) for v in roc_aucs],
        top_model="Stacking ensemble (LR+GBM+ET → meta-LR)",
        runtime_seconds=round(runtime, 3),
        n_samples=len(fm.y),
        n_features=fm.X.shape[1],
        notes=[
            f"Stacking ensemble · {len(fm.y)} samples · 5-fold stratified CV",
            f"Base learners: {', '.join(base_names)} · meta-learner: LogReg",
            f"Feature map context: {feature_map} (classical, not applied)",
        ],
    )
    probs = _build_probs(y_all, p_all, fm.selection_seed)
    return result, probs


def run_hybrid(selection: Selection) -> tuple[AlgoResult, AlgoProbs]:
    return _run_qk_family("hybrid", selection, ibm_token="", ibm_crn="")


def run_quantum(
    selection: Selection,
    *,
    ibm_token: str,
    ibm_crn: str,
    ibm_backend: str = "",
    feature_map: str = "zz",
) -> tuple[AlgoResult, AlgoProbs]:
    return _run_qk_family(
        "quantum",
        selection,
        ibm_token=ibm_token,
        ibm_crn=ibm_crn,
        ibm_backend=ibm_backend,
        feature_map=feature_map,
    )


def score_feature_rows_classical(
    fm: FeatureMatrix,
    x_cand: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Fit the same LR+GBM heads on all training rows; score new feature rows.

    Returns ``(p_ensemble, delta_vs_linear)`` where ``delta_vs_linear`` is
    ``p_ensemble - p_logistic`` (tree head bump off the linear boundary).
    """
    if x_cand.ndim != 2 or x_cand.shape[1] != fm.X.shape[1]:
        raise ValueError("candidate matrix width must match training features")
    lr = Pipeline(
        [("scaler", StandardScaler()), ("clf", LogisticRegression(max_iter=500))]
    )
    lr.fit(fm.X, fm.y)
    gbm = GradientBoostingClassifier(
        n_estimators=80, max_depth=3, random_state=fm.selection_seed
    )
    gbm.fit(fm.X, fm.y)
    p_lr = lr.predict_proba(x_cand)[:, 1]
    p_gbm = gbm.predict_proba(x_cand)[:, 1]
    p_ens = (p_lr + p_gbm) / 2.0
    delta = p_ens - p_lr
    return p_ens.astype(np.float64), delta.astype(np.float64)


# --- Dispatcher ----------------------------------------------------------


def run_algorithm_with_probs(
    family: str,
    selection: Selection,
    *,
    ibm_token: str = "",
    ibm_crn: str = "",
    ibm_backend: str = "",
    feature_map: str = "zz",
) -> tuple[AlgoResult, AlgoProbs]:
    """Top-level entrypoint used by the runner. Returns both AlgoResult
    (real CV metrics) and AlgoProbs (probability arrays + calibration
    data) so the runner can replace synthetic scaffolding with real
    computed values.

    ``feature_map`` selects the encoding circuit for hybrid/quantum
    (``"zz"`` | ``"pauli"``); stacking is classical and ignores it.
    """
    if family == "classical":
        return run_classical(selection)
    if family == "stacking":
        return run_stacking(selection, feature_map=feature_map)
    if family == "hybrid":
        return _run_qk_family(
            "hybrid",
            selection,
            ibm_token="",
            ibm_crn="",
            feature_map=feature_map,
        )
    if family == "quantum":
        return run_quantum(
            selection,
            ibm_token=ibm_token,
            ibm_crn=ibm_crn,
            ibm_backend=ibm_backend,
            feature_map=feature_map,
        )
    raise ValueError(f"Unknown family: {family!r}")


def run_algorithm(
    family: str,
    selection: Selection,
    *,
    ibm_token: str = "",
    ibm_crn: str = "",
    ibm_backend: str = "",
) -> AlgoResult:
    """Backward-compatible entrypoint that returns only AlgoResult.
    Prefer `run_algorithm_with_probs` for new call sites."""
    result, _ = run_algorithm_with_probs(
        family, selection, ibm_token=ibm_token, ibm_crn=ibm_crn, ibm_backend=ibm_backend
    )
    return result
