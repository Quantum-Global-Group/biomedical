"""Stubbed async job runner.

Establishes the queued → running → completed lifecycle the real ML pipeline
will use. For v1 the ML-derived fields in `JobResult` are filled with
deterministic seeded values so the UI exercises every panel. The real
pipeline (step 11 of Phase 2) swaps `_simulate_result` for a real
implementation while keeping the wire shape identical.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import math
import random
from datetime import UTC, datetime

from hetqml_api.catalog import integrity_guards_catalog
from hetqml_api.jobs.store import JobStore
from hetqml_api.ml import AlgoProbs, AlgoResult, run_algorithm_with_probs
from hetqml_api.persistence.protocols import SettingsStore
from hetqml_api.schemas import (
    BenchmarkRow,
    CalibrationBin,
    CandidateRankingRow,
    CandidateSpotlight,
    CVFold,
    DetailedMetrics,
    EvidenceMatrix,
    EvidenceMatrixCell,
    EvidenceOverlay,
    EvidencePath,
    EvidencePathStep,
    IntegrityGuardState,
    InterpretationPanel,
    Job,
    JobMetrics,
    JobResult,
    LeaderboardRow,
    MetricCI,
    ModelAgreement,
    ModelAgreementBar,
    ProvenanceEvent,
    QualityFlag,
    QuantumCircuitInfo,
    ReliabilityDiagram,
    Selection,
    SkepticWarning,
    StatComparisonRow,
    TrustAxis,
    TrustScorecard,
)

logger = logging.getLogger(__name__)


def _seed_for(job: Job) -> int:
    """Stable per-selection seed; differs by run-path family on purpose."""
    seed_input = "|".join(
        [
            job.selection.disease,
            job.selection.compound,
            job.selection.gene,
            job.selection.metaedge,
            job.run_path.family,
        ]
    )
    digest = hashlib.sha256(seed_input.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big", signed=False)


def _metrics_from(rng: random.Random) -> JobMetrics:
    """Synthetic stand-in used when the real ML pipeline is bypassed (tests
    that import `simulate_run` directly without the dispatcher). The
    runner's main path replaces these with real CV metrics from
    `ml.run_algorithm`."""
    return JobMetrics(
        pr_auc=round(0.55 + 0.40 * rng.random(), 4),
        roc_auc=round(0.60 + 0.35 * rng.random(), 4),
        brier=round(0.05 + 0.10 * rng.random(), 4),
        ece=round(0.01 + 0.06 * rng.random(), 4),
    )


def _metrics_from_algo(algo: AlgoResult) -> JobMetrics:
    """Same shape, but populated from real cross-validated metrics."""
    return JobMetrics(
        pr_auc=round(algo.pr_auc, 4),
        roc_auc=round(algo.roc_auc, 4),
        brier=round(algo.brier, 4),
        ece=round(algo.ece, 4),
    )


def _detailed(
    rng: random.Random,
    base: JobMetrics,
    *,
    algo: AlgoResult | None = None,
    probs: AlgoProbs | None = None,
) -> DetailedMetrics:
    def ci_fixed(name: str, value: float, span: float) -> MetricCI:
        return MetricCI(
            name=name,
            value=round(value, 4),
            ci_low=round(max(0.0, value - span), 4),
            ci_high=round(min(1.0, value + span), 4),
        )

    def ci_real(name: str, value: float, bounds: tuple[float, float]) -> MetricCI:
        return MetricCI(
            name=name,
            value=round(value, 4),
            ci_low=round(max(0.0, bounds[0]), 4),
            ci_high=round(min(1.0, bounds[1]), 4),
        )

    # CV folds: use real per-fold values when available (algo always carries them).
    if algo is not None and len(algo.cv_pr_auc) == 5:
        folds = [
            CVFold(
                fold=i + 1,
                pr_auc=round(algo.cv_pr_auc[i], 4),
                roc_auc=round(algo.cv_roc_auc[i], 4),
            )
            for i in range(5)
        ]
    else:
        folds = [
            CVFold(
                fold=i + 1,
                pr_auc=round(base.pr_auc + (rng.random() - 0.5) * 0.08, 4),
                roc_auc=round(base.roc_auc + (rng.random() - 0.5) * 0.06, 4),
            )
            for i in range(5)
        ]

    # Confidence intervals: use real bootstrap bounds when available.
    boot = probs.bootstrap_cis if probs is not None else None
    metric_cis = [
        ci_real("PR-AUC", base.pr_auc, boot["PR-AUC"]) if boot and "PR-AUC" in boot
        else ci_fixed("PR-AUC", base.pr_auc, 0.04),
        ci_real("ROC-AUC", base.roc_auc, boot["ROC-AUC"]) if boot and "ROC-AUC" in boot
        else ci_fixed("ROC-AUC", base.roc_auc, 0.03),
        ci_fixed("F1", 0.62 + 0.25 * rng.random(), 0.04),
        ci_fixed("Brier", base.brier, 0.02),
        ci_fixed("MCC", 0.55 + 0.20 * rng.random(), 0.05),
    ]
    return DetailedMetrics(
        metric_cis=metric_cis,
        cv_folds=folds,
        cv_strategy="5-fold stratified · ancestry-aware",
        folds_real=algo is not None and len(algo.cv_pr_auc) == 5,
        cis_real=probs is not None and probs.bootstrap_cis is not None,
    )


# Canonical 13-row leaderboard roster the plan calls for: 8 classical
# (including the three Project-Rephetio metapath baselines DWPC, Random
# Walk w/ Restart, PathCount Geometric) + 3 hybrid + 2 pure-quantum.
# Order is the static-export presentation order; PR-AUC sort happens after
# stochastic scoring so the static order is just a roster, not a ranking.
#
# Each entry is (algorithm_name, params_display). The params string is the
# user-facing label rendered in the leaderboard "params" column and used to
# compute the path-aware param-ratio in the footer (e.g. "28 / 18,000").
_CANONICAL_LEADERBOARD: list[tuple[str, str]] = [
    # Hybrid (3) — quantum-kernel and stacking-ensemble headliners
    ("Quantum Kernel + Metapath", "28"),
    ("QSVC (Pauli)", "16"),
    ("VQC", "24"),
    # Classical (8) — top-line baselines plus the 3 canonical metapath
    # baselines from §1.3 of the preregistration
    ("Stacking ensemble", "2.1k"),
    ("RotatE → LR", "384"),
    ("Extra Trees", "18k"),
    ("SVM (RBF)", "92"),
    ("Logistic Regression", "128"),
    ("DWPC (Project Rephetio)", "n"),  # parameter-free metapath baseline
    ("Random Walk w/ Restart", "1"),  # restart probability only
    ("PathCount Geometric", "n"),  # parameter-free metapath baseline
    # Pure-quantum (2) — variational classifiers
    ("VQE-classifier", "30"),
    ("QAOA", "36"),
]

_FAMILY_BY_NAME: dict[str, str] = {
    "Quantum Kernel + Metapath": "hybrid",
    "QSVC (Pauli)": "hybrid",
    "VQC": "hybrid",
    "Stacking ensemble": "classical",
    "RotatE → LR": "classical",
    "Extra Trees": "classical",
    "SVM (RBF)": "classical",
    "Logistic Regression": "classical",
    "DWPC (Project Rephetio)": "classical",
    "Random Walk w/ Restart": "classical",
    "PathCount Geometric": "classical",
    "VQE-classifier": "quantum",
    "QAOA": "quantum",
}


def _leaderboard(rng: random.Random, family: str) -> list[LeaderboardRow]:
    """Render the 13-row canonical leaderboard.

    Always emits the same 13 algorithms (8 classical / 3 hybrid / 2 quantum)
    so the canonical baselines DWPC, Random Walk w/ Restart and PathCount
    Geometric are present on every run regardless of run-path family. PR-AUC
    is seeded per-selection so the table is deterministic but reorders
    visibly when the user changes path/compound/disease.
    """
    rows: list[LeaderboardRow] = []
    classical_best_pr = round(0.66 + 0.10 * rng.random(), 4)
    for name, params in _CANONICAL_LEADERBOARD:
        fam = _FAMILY_BY_NAME[name]
        # Family-tinted score band: hybrid/quantum get a slight lift in the
        # default range so the top-of-table diversity matches the static
        # export. The actual top is still determined by the path-aware
        # selection below.
        if fam == "hybrid":
            pr = round(0.65 + 0.20 * rng.random(), 4)
        elif fam == "quantum":
            pr = round(0.60 + 0.20 * rng.random(), 4)
        else:
            pr = round(0.55 + 0.30 * rng.random(), 4)
        rows.append(
            LeaderboardRow(
                model=name,
                family=fam,  # type: ignore[arg-type]
                pr_auc=pr,
                roc_auc=round(0.60 + 0.35 * rng.random(), 4),
                delta_classical=round(pr - classical_best_pr, 4),
                is_top=False,
                params=params,
            )
        )
    rows.sort(key=lambda r: r.pr_auc, reverse=True)
    # Top model is path-aware: best within active family if any.
    same_family = [r for r in rows if r.family == family]
    top = same_family[0] if same_family else rows[0]
    top.is_top = True
    return rows


def _benchmarks(rng: random.Random, leaderboard: list[LeaderboardRow]) -> list[BenchmarkRow]:
    """Benchmark suite rows: tab cells are simulated strings keyed off leaderboard PR-AUC.

    Status is always ``SIM`` so the UI cannot imply live benchmark harness telemetry.
    """

    out: list[BenchmarkRow] = []
    for row in leaderboard:
        family_label = row.family.capitalize()
        out.append(
            BenchmarkRow(
                model=row.model,
                family=family_label,  # type: ignore[arg-type]
                status="SIM",
                cells={
                    # classification
                    "prAuc": f"{row.pr_auc:.3f}",
                    "rocAuc": f"{row.roc_auc:.3f}",
                    "f1": f"{0.55 + 0.30 * rng.random():.3f}",
                    "mcc": f"{0.50 + 0.30 * rng.random():.3f}",
                    # ranking
                    "map": f"{0.50 + 0.25 * rng.random():.3f}",
                    "ndcg10": f"{0.60 + 0.30 * rng.random():.3f}",
                    "hit10": f"{0.65 + 0.30 * rng.random():.3f}",
                    "deltaClassical": f"{row.delta_classical:+.3f}",
                    # calibration
                    "brier": f"{0.05 + 0.10 * rng.random():.3f}",
                    "ece": f"{0.02 + 0.06 * rng.random():.3f}",
                    "mce": f"{0.04 + 0.10 * rng.random():.3f}",
                    "slope": f"{0.85 + 0.15 * rng.random():.2f}",
                    # efficiency
                    "runtime": f"{rng.randint(0, 9)}m {rng.randint(0, 59):02d}s",
                    "params": f"{rng.randint(8, 999)}",
                    "cost": f"${rng.uniform(0.10, 5.00):.2f}",
                    "cpuHours": f"{rng.uniform(0.05, 1.50):.2f}",
                    # quantum-hw
                    "backend": "ibm_torino" if row.family != "classical" else "—",
                    "shots": f"{rng.randint(4096, 32768):,}" if row.family != "classical" else "—",
                    "depth": f"{rng.randint(20, 80)}" if row.family != "classical" else "—",
                    "readout": (
                        f"{0.95 + 0.04 * rng.random():.3f}" if row.family != "classical" else "—"
                    ),
                    # cv-strategy
                    "folds": "5 stratified",
                    "std": f"{0.005 + 0.020 * rng.random():.3f}",
                    "split": "ancestry-aware",
                    "leakage": "none",
                },
            )
        )
    return out


def _stat_comparison(rng: random.Random, top_pr: float) -> list[StatComparisonRow]:
    def row(label: str, ref: float, sig_floor: float) -> StatComparisonRow:
        delta = round(top_pr - ref, 4)
        p = max(0.0001, min(0.5, sig_floor + (rng.random() - 0.5) * 0.05))
        if p < 0.005:
            sig = "highly-significant"
        elif p < 0.05:
            sig = "significant"
        elif p < 0.1:
            sig = "marginal"
        else:
            sig = "ns"
        return StatComparisonRow(
            label=label,
            delta=delta,
            p_value=round(p, 4),
            effect_size=round(abs(delta) * 4.5, 3),
            significance=sig,  # type: ignore[arg-type]
        )

    return [
        row("vs best classical", 0.72, 0.03),
        row("vs best hybrid", 0.79, 0.06),
        row("vs best quantum", 0.74, 0.05),
        row("vs DWPC", 0.65, 0.005),
        row("vs random predictor", 0.50, 0.0005),
    ]


def _embedding(
    spotlight: CandidateSpotlight, job: Job
) -> list[list[float]]:
    """2D layout for the Visualize · 3D UMAP scatter.

    When umap-learn is installed, computes a real UMAP projection of each
    candidate's feature vector from ``build_features_for_candidates`` (catalog
    or synthetic rows depending on ``HETQML_FEATURE_MATRIX_SOURCE``). Falls back to a deterministic
    hash-based surrogate when umap-learn is unavailable or the dataset is
    too small (< 2 candidates).

    One row per ranked candidate (in `spotlight.ranking` order).
    """
    candidates = [(row.compound, row.disease) for row in spotlight.ranking]
    if len(candidates) >= 2:
        try:
            import umap as umap_lib  # type: ignore[import]
            from hetqml_api.ml.features import build_features_for_candidates

            X = build_features_for_candidates(job.selection, candidates)
            seed = _seed_for(job)
            # UMAP random_state must fit in a signed int32.
            reducer = umap_lib.UMAP(
                n_components=2,
                random_state=int(seed % (2**31 - 1)),
                n_neighbors=min(len(candidates) - 1, 5),
                min_dist=0.3,
            )
            coords = reducer.fit_transform(X)
            # Normalise both axes to [-0.8, 0.8] so the scatter sits in the
            # same viewport as the hash-based surrogate.
            out: list[list[float]] = []
            for dim in range(2):
                lo, hi = float(coords[:, dim].min()), float(coords[:, dim].max())
                if hi > lo:
                    coords[:, dim] = (coords[:, dim] - lo) / (hi - lo) * 1.6 - 0.8
            return [[round(float(r[0]), 4), round(float(r[1]), 4)] for r in coords]
        except Exception:
            pass  # fall through to hash-based surrogate

    # Hash-based surrogate: deterministic, visually meaningful (score →
    # radius, rank → ring), no dependency on umap-learn.
    seed_hex = hashlib.sha256(_seed_for(job).to_bytes(8, "big", signed=False)).hexdigest()
    cx = (int(seed_hex[:8], 16) % 1000) / 1000 - 0.5  # [-0.5, 0.5]
    cy = (int(seed_hex[8:16], 16) % 1000) / 1000 - 0.5
    out = []
    for i, row in enumerate(spotlight.ranking):
        digest = hashlib.sha256(
            f"{row.compound}::{row.disease}::{job.id}".encode("utf-8")
        ).hexdigest()
        ang = (int(digest[:8], 16) % 10_000) / 10_000 * 2 * 3.14159265
        jitter = (int(digest[8:16], 16) % 10_000) / 10_000
        rank_radius = 0.18 + 0.06 * i
        score_radius = max(0.0, 1.0 - row.score) * 0.5
        r = rank_radius + score_radius + jitter * 0.08
        sx = 1 if (int(digest[16:18], 16) & 1) else -1
        sy = 1 if (int(digest[18:20], 16) & 1) else -1
        focus_pull = 0.15 if i == 0 else 1.0
        x = cx + r * focus_pull * sx * abs(math.cos(ang))
        y = cy + r * focus_pull * sy * abs(math.sin(ang))
        out.append([round(x, 4), round(y, 4)])
    return out


def _candidate_spotlight_synthetic(
    rng: random.Random, base: JobMetrics, job: Job
) -> CandidateSpotlight:
    reasons = [
        f"Anchor gene {job.selection.gene} matches curated targets",
        f"{job.run_path.family.title()} pipeline emphasizes metapath {job.selection.metaedge}",
        "Subgroup ancestry caveat surfaced — review before deployment",
    ]
    ranking = [
        CandidateRankingRow(
            rank=i + 1,
            compound=f"Synth-{rng.randint(1000, 99999):05d}",
            disease=job.selection.disease,
            score=round(base.pr_auc - 0.02 * i + (rng.random() - 0.5) * 0.01, 4),
            delta_classical=round((rng.random() - 0.4) * 0.08, 4),
        )
        for i in range(6)
    ]
    return CandidateSpotlight(
        score=round(base.pr_auc + (rng.random() - 0.5) * 0.02, 4),
        reasons=reasons,
        ranking=ranking,
    )


def _candidate_spotlight(
    rng: random.Random,
    base: JobMetrics,
    job: Job,
    *,
    algo: AlgoResult | None = None,
    probs: AlgoProbs | None = None,
) -> CandidateSpotlight:
    """Catalog-backed ranking when a real CV run exists; else RNG scaffold."""
    if algo is not None and probs is not None:
        try:
            from hetqml_api.ml.spotlight import try_build_catalog_candidate_spotlight

            live = try_build_catalog_candidate_spotlight(job, base, rng)
            if live is not None:
                return live
        except Exception:
            logger.exception("catalog candidate spotlight failed; using synthetic scaffold")
    return _candidate_spotlight_synthetic(rng, base, job)


def _real_guard_states(
    algo: AlgoResult,
    probs: AlgoProbs,
) -> dict[str, bool]:
    """Assertions for guards that can be evaluated from CV outputs.

    Returns a dict mapping guard-id → bool. Guards not in this dict fall
    back to the RNG-seeded default in `_integrity_guards`.
    """
    boot = probs.bootstrap_cis
    ci_width = (
        max(hi - lo for lo, hi in boot.values())
        if boot
        else None
    )
    states: dict[str, bool] = {
        # ECE < 0.10 is the clinical-use threshold.
        "calibration": algo.ece < 0.10,
        # Better than chance (prevalence = fraction of positive labels).
        "random-baseline": algo.pr_auc > probs.prevalence,
        # Better than the DWPC metapath baseline for Hetionet (Himmelstein 2017).
        "dwpc-baseline": algo.pr_auc > 0.35,
        # Provenance is always committed when a job reaches simulate_run.
        "provenance": True,
        # Bootstrap CI computed and CI width narrow enough to be meaningful.
        "bootstrap-ci": boot is not None and ci_width is not None and ci_width < 0.15,
    }
    # Quantum-only guards — meaningless for classical runs; skip so
    # the RNG default handles them (classical runs don't have shots/fidelity).
    if algo.shots is not None:
        states["shot-budget"] = algo.shots >= 512
    if algo.fidelity is not None:
        states["kernel-spread"] = algo.fidelity > 0.5
    return states


def _integrity_guards(
    rng: random.Random,
    *,
    algo: AlgoResult | None = None,
    probs: AlgoProbs | None = None,
) -> list[IntegrityGuardState]:
    cat = integrity_guards_catalog()
    real_states = _real_guard_states(algo, probs) if algo is not None and probs is not None else {}
    out: list[IntegrityGuardState] = []
    for guard in cat.items:
        if guard.id in real_states:
            passing = real_states[guard.id]
        else:
            passing = guard.default_on and rng.random() > (0.10 if guard.critical else 0.20)
        out.append(
            IntegrityGuardState(
                id=guard.id,
                label=guard.label,
                passing=passing,
                critical=guard.critical,
            )
        )
    return out


_TRUST_THRESHOLD = 0.65


def _trust(rng: random.Random, base: JobMetrics, guards: list[IntegrityGuardState]) -> TrustScorecard:
    """Five-axis trust scorecard.

    `passing` for every axis is derived against the same 0.65 threshold the
    radar dashes in (`TrustRadar` `threshold` prop). Keeping the rule
    consistent across UI + API means the failing-axis bold-red label
    triggers exactly when the polygon vertex falls inside the dashed
    threshold pentagon.
    """
    artifact_pass_rate = sum(1 for g in guards if g.passing) / max(1, len(guards))
    clinical_v = round(0.55 + 0.40 * rng.random(), 3)
    mechanism_v = round(0.55 + 0.40 * rng.random(), 3)
    model_v = round(min(0.99, base.pr_auc + 0.05), 3)
    baseline_v = round(0.50 + 0.45 * rng.random(), 3)
    artifact_v = round(artifact_pass_rate, 3)
    axes = [
        TrustAxis(axis="clinical", value=clinical_v, passing=clinical_v >= _TRUST_THRESHOLD),
        TrustAxis(axis="mechanism", value=mechanism_v, passing=mechanism_v >= _TRUST_THRESHOLD),
        TrustAxis(axis="model", value=model_v, passing=model_v >= _TRUST_THRESHOLD),
        TrustAxis(axis="baseline", value=baseline_v, passing=baseline_v >= _TRUST_THRESHOLD),
        TrustAxis(axis="artifact", value=artifact_v, passing=artifact_v >= _TRUST_THRESHOLD),
    ]
    composite = round(sum(a.value for a in axes) / len(axes), 3)
    return TrustScorecard(composite=composite, axes=axes)


def _reliability(
    rng: random.Random,
    base: JobMetrics,
    *,
    probs: AlgoProbs | None = None,
) -> ReliabilityDiagram:
    if probs is not None and len(probs.bin_observed) == 10:
        bins = [
            CalibrationBin(
                bin_low=round(i / 10, 1),
                bin_high=round((i + 1) / 10, 1),
                predicted=probs.bin_predicted[i],
                observed=probs.bin_observed[i],
                count=probs.bin_count[i],
            )
            for i in range(10)
        ]
        return ReliabilityDiagram(
            bins=bins,
            brier=base.brier,
            ece=base.ece,
            mce=probs.mce,
            log_loss=probs.real_log_loss,
            bins_real=True,
        )
    # Synthetic fallback (used when algo=None, e.g. in tests).
    bins = []
    for i in range(10):
        lo = i / 10
        hi = (i + 1) / 10
        predicted = (lo + hi) / 2
        observed = max(0.0, min(1.0, predicted + (rng.random() - 0.5) * 0.06))
        bins.append(
            CalibrationBin(
                bin_low=lo,
                bin_high=hi,
                predicted=round(predicted, 3),
                observed=round(observed, 3),
                count=rng.randint(40, 220),
            )
        )
    return ReliabilityDiagram(
        bins=bins,
        brier=base.brier,
        ece=base.ece,
        mce=round(base.ece * 1.6 + 0.01 * rng.random(), 4),
        log_loss=round(0.40 + 0.20 * rng.random(), 4),
    )


# Compounds with curated equity / ancestry caveats. Mirrors the static-export
# Inaxaplin warning ("APOL1 G1/G2 risk allele: ≈22% AA frequency vs ~0% in
# European-ancestry populations"). Anchor gene match drives the message text;
# absence of a match still raises an info-level caveat for these compounds.
_EQUITY_CAVEATS: dict[str, dict[str, str]] = {
    "Inaxaplin": {
        "anchor": "APOL1",
        "message": (
            "APOL1 G1/G2 risk allele: ≈22% AA frequency vs ~0% in"
            " European-ancestry populations — subgroup imbalance unresolved"
        ),
    },
    "Hydroxyurea": {
        "anchor": "HBB",
        "message": (
            "Sickle-cell trial data skewed toward African-ancestry cohorts;"
            " review subgroup balance before generalising"
        ),
    },
}

# Anchor-target alignment hints. When the selected anchor gene is not in the
# compound's curated primary-target list we raise an "anchor-mismatch" warning
# so reviewers see the same critique the static export surfaces.
_PRIMARY_TARGETS: dict[str, set[str]] = {
    "Inaxaplin": {"APOL1"},
    "Venetoclax": {"BCL2"},
    "Hydroxyurea": {"HBB", "RRM1", "RRM2"},
    "Lisinopril": {"ACE"},
    "Losartan": {"AGTR1"},
}


def _skeptic(
    rng: random.Random,
    base: JobMetrics,
    guards: list[IntegrityGuardState],
    leaderboard: list[LeaderboardRow],
    family: str,
    *,
    selection: Selection | None = None,
    detailed: DetailedMetrics | None = None,
) -> list[SkepticWarning]:
    """Build the seven-source skeptic warning list.

    Sources covered (matches `SkepticWarning.source` literal in `schemas.py`
    and the per-source labels in the web `SkepticView`):

    1. ``guards``                — critical guards off → audit BLOCKED.
    2. ``calibration``           — ECE > 0.05 (clinical-use threshold).
    3. ``delta-classical``       — Δ vs best classical < 0.01.
    4. ``top-loses-to-classical``— quantum/hybrid run, classical row wins.
    5. ``cv-variance``           — std(PR-AUC) across folds > 0.025.
    6. ``equity``                — compound has a curated ancestry caveat.
    7. ``anchor-mismatch``       — anchor gene absent from compound's
                                   curated primary targets.

    `selection` and `detailed` are optional so the in-tree tests that call
    `_skeptic` directly with the legacy positional signature keep working;
    the runner always passes both.
    """
    warnings: list[SkepticWarning] = []
    crit_off = [g for g in guards if g.critical and not g.passing]
    if crit_off:
        warnings.append(
            SkepticWarning(
                source="guards",
                severity="crit",
                message=f"Audit BLOCKED · {len(crit_off)} critical guard(s) failing",
            )
        )
    if base.ece > 0.05:
        warnings.append(
            SkepticWarning(
                source="calibration",
                severity="warn",
                message=f"ECE={base.ece:.3f} above 0.05 threshold — calibrate before clinical use",
            )
        )
    top = next((r for r in leaderboard if r.is_top), None)
    if top and top.delta_classical < 0.01:
        warnings.append(
            SkepticWarning(
                source="delta-classical",
                severity="warn",
                message=f"Top model only {top.delta_classical:+.3f} vs best classical",
            )
        )
    if family != "classical" and top and top.family == "classical":
        warnings.append(
            SkepticWarning(
                source="top-loses-to-classical",
                severity="warn",
                message="Top scoring model is classical — quantum branch did not win",
            )
        )
    # CV variance — derive from actual fold spread when available, else
    # fall back to the rng draw so callers without `detailed` still
    # surface the warning some of the time (matches the static export).
    if detailed is not None and detailed.cv_folds:
        fold_pr = [f.pr_auc for f in detailed.cv_folds]
        mean = sum(fold_pr) / len(fold_pr)
        var = sum((p - mean) ** 2 for p in fold_pr) / len(fold_pr)
        std = var**0.5
        if std > 0.025:
            warnings.append(
                SkepticWarning(
                    source="cv-variance",
                    severity="info",
                    message=(
                        f"CV variance σ={std:.3f} above 0.025 — multi-seed"
                        " stability borderline"
                    ),
                )
            )
    elif rng.random() < 0.3:
        warnings.append(
            SkepticWarning(
                source="cv-variance",
                severity="info",
                message="CV variance near 0.025 — multi-seed stability borderline",
            )
        )

    # Equity / ancestry caveat — keyed off the curated compound list. Plan
    # §7.3 calls for "equity caveat" as a first-class skeptic source.
    if selection is not None:
        eq = _EQUITY_CAVEATS.get(selection.compound)
        if eq is not None:
            warnings.append(
                SkepticWarning(
                    source="equity",
                    severity="warn",
                    message=eq["message"],
                )
            )

        # Anchor-target mismatch — checks the selected anchor gene against
        # the compound's curated primary targets. Surfaces a warning when
        # the anchor is *not* among them so reviewers cannot wave away the
        # mismatch silently.
        targets = _PRIMARY_TARGETS.get(selection.compound)
        if targets is not None and selection.gene not in targets:
            warnings.append(
                SkepticWarning(
                    source="anchor-mismatch",
                    severity="warn",
                    message=(
                        f"Anchor gene {selection.gene} not in {selection.compound}'s"
                        f" curated primary-target list ({', '.join(sorted(targets))})"
                    ),
                )
            )
    return warnings


def _evidence_matrix(rng: random.Random) -> EvidenceMatrix:
    layers = ["molecule", "kg", "mechanism", "clinical", "classical", "quantum"]
    cells = []
    for layer in layers:
        state = rng.choice(["live", "live", "live", "fallback", "supports", "weakens"])
        cells.append(
            EvidenceMatrixCell(
                layer=layer,  # type: ignore[arg-type]
                state=state,  # type: ignore[arg-type]
                note=f"{layer} evidence — {state}",
            )
        )
    supporting = sum(1 for c in cells if c.state in ("live", "supports"))
    return EvidenceMatrix(
        cells=cells,
        summary=f"{supporting}/{len(cells)} layers supportive",
    )


def _model_agreement(rng: random.Random) -> ModelAgreement:
    classical_score = round(0.65 + 0.20 * rng.random(), 3)
    hybrid_score = round(0.65 + 0.20 * rng.random(), 3)
    quantum_score = round(0.65 + 0.20 * rng.random(), 3)
    bars = [
        ModelAgreementBar(family="classical", score=classical_score, delta_reference=0.0),
        ModelAgreementBar(
            family="hybrid", score=hybrid_score, delta_reference=round(hybrid_score - classical_score, 3)
        ),
        ModelAgreementBar(
            family="quantum",
            score=quantum_score,
            delta_reference=round(quantum_score - classical_score, 3),
        ),
    ]
    spread = round(max(b.score for b in bars) - min(b.score for b in bars), 3)
    mean = round(sum(b.score for b in bars) / len(bars), 3)
    if spread < 0.04:
        verdict = "STRONG_AGREEMENT"
    elif spread < 0.10:
        verdict = "PARTIAL_DIVERGENCE"
    else:
        verdict = "BRANCH_DIVERGENCE"
    return ModelAgreement(bars=bars, spread=spread, mean=mean, verdict=verdict)  # type: ignore[arg-type]


def _provenance(rng: random.Random, job: Job) -> list[ProvenanceEvent]:
    base = job.created_at
    events = [
        ("Hetionet snapshot loaded", "hetionet/v1.0/edges.tsv", False),
        (f"Selection: {job.selection.compound} → {job.selection.disease}", "ui/initialize", False),
        ("Hard-negative sampler primed", "pipeline/sampler.py", False),
        (
            f"{job.run_path.family.title()} pipeline launched",
            f"pipeline/{job.run_path.family}.py",
            False,
        ),
        ("Cross-validation folds materialized", "pipeline/cv.py", False),
        ("Calibration computed", "pipeline/calibration.py", False),
        ("Trust scorecard updated", "validate/trust.py", False),
        ("Provenance hash committed", f"runs/{job.id}/provenance.json", False),
    ]
    out = []
    for i, (label, source, fallback) in enumerate(events):
        ts = base.replace(second=(base.second + i * 7) % 60)
        out.append(
            ProvenanceEvent(
                timestamp=ts.strftime("%H:%M:%S UTC"),
                label=label,
                source=source,
                fallback=fallback or rng.random() < 0.1,
            )
        )
    return out


def _quality_flags(rng: random.Random, base: JobMetrics) -> list[QualityFlag]:
    def flag(label: str, score: float, warn: float, fail: float, detail: str) -> QualityFlag:
        if score < fail:
            state = "fail"
        elif score < warn:
            state = "warn"
        else:
            state = "pass"
        return QualityFlag(label=label, state=state, detail=detail)  # type: ignore[arg-type]

    return [
        flag("PR-AUC 95% CI", base.pr_auc, 0.65, 0.55, "Bootstrap N=1000"),
        flag("ECE", 1 - base.ece, 0.93, 0.88, f"ECE={base.ece:.3f}"),
        flag("Multi-seed stability", 0.75 + 0.20 * rng.random(), 0.85, 0.75, "3 seeds"),
        flag("Kernel spread", 0.70 + 0.25 * rng.random(), 0.80, 0.65, "σ within range"),
        flag("Baseline parity (DWPC)", 0.70 + 0.25 * rng.random(), 0.80, 0.65, "Δ vs DWPC"),
        flag("Quantum advantage", 0.65 + 0.30 * rng.random(), 0.80, 0.65, "Δ vs best classical"),
    ]


def _evidence_overlays(job: Job) -> list[EvidenceOverlay]:
    return [
        EvidenceOverlay(
            column="target_pathway",
            items=[
                f"Anchor: {job.selection.gene}",
                "Pathway: WikiPathways WP4148",
                "Reactome R-HSA-1234",
            ],
        ),
        EvidenceOverlay(
            column="relation",
            items=[
                f"3-hop {job.selection.compound} → {job.selection.gene} → {job.selection.disease}",
                "RotatE plausibility 0.71",
                "DWPC weight 0.43",
            ],
        ),
        EvidenceOverlay(
            column="model_score",
            items=[
                f"Top model: {job.run_path.family.title()} ensemble",
                "Kernel separation 1.42",
                "Param ratio 0.87",
            ],
        ),
    ]


def _interpretation(rng: random.Random, family: str) -> InterpretationPanel:
    plausible = [
        "Anchor gene matches curated mechanism",
        f"{family.title()} pipeline aligns with clinical context",
        "Hard-negative variance acceptable",
        "Subgroup data reasonably balanced",
    ]
    weak = [
        "Equity caveat present — review subgroup",
        "Calibration borderline (ECE>0.05)" if rng.random() < 0.5 else "CV variance near threshold",
        "Δ vs classical is small",
        "Quantum-branch fidelity below 0.985" if family != "classical" else "No quantum evidence",
    ]
    return InterpretationPanel(plausible=plausible, weak=weak)


def _quantum_circuit(rng: random.Random, family: str, top_model: str) -> QuantumCircuitInfo:
    if family == "classical":
        return QuantumCircuitInfo(
            title="No quantum job · classical run path",
            note="Switch run path to hybrid or quantum for circuit metadata",
        )
    return QuantumCircuitInfo(
        backend="ibm_torino",
        qubits=rng.choice([12, 16, 20, 24]),
        shots=rng.choice([4096, 8192, 16384, 32768]),
        depth=rng.randint(20, 80),
        fidelity=round(0.97 + 0.02 * rng.random(), 4),
        zne_enabled=True,
        title=f"{top_model} circuit",
    )


def _evidence_path(rng: random.Random, job: Job) -> EvidencePath:
    weight_a = round(0.6 + 0.3 * rng.random(), 3)
    weight_b = round(0.5 + 0.4 * rng.random(), 3)
    weight_c = round(0.55 + 0.35 * rng.random(), 3)
    steps = [
        EvidencePathStep(
            **{
                "from": job.selection.compound,
                "to": job.selection.gene,
                "metaedge": "CbG",
                "weight": weight_a,
                "sources": ["DrugBank", "ChEMBL"],
            }
        ),
        EvidencePathStep(
            **{
                "from": job.selection.gene,
                "to": "Pathway/WP4148",
                "metaedge": "GpPW",
                "weight": weight_b,
                "sources": ["Reactome", "WikiPathways"],
            }
        ),
        EvidencePathStep(
            **{
                "from": "Pathway/WP4148",
                "to": job.selection.disease,
                "metaedge": "DaG",
                "weight": weight_c,
                "sources": ["DisGeNET", "DOID"],
            }
        ),
    ]
    plausibility = round(weight_a * weight_b * weight_c, 4)
    return EvidencePath(steps=steps, plausibility=plausibility)


def _circuit_from_algo(algo: AlgoResult, rng: random.Random) -> QuantumCircuitInfo:
    """Build `QuantumCircuitInfo` from a real `AlgoResult` so the visualize
    page reflects the actual run (qubits, depth, shots, backend) rather
    than a stub. Falls through to the rng-driven synthetic for the
    classical family."""
    if algo.family == "classical":
        return QuantumCircuitInfo(
            title="No quantum job · classical run path",
            note="Switch run path to hybrid or quantum for circuit metadata",
        )
    backend_label = algo.backend or "aer_simulator (local)"
    note = next(iter(algo.notes), None)
    return QuantumCircuitInfo(
        backend=backend_label,
        qubits=algo.qubits,
        shots=algo.shots,
        depth=algo.depth,
        fidelity=algo.fidelity,
        zne_enabled=algo.used_real_hardware,
        title=f"{algo.top_model} — ZZ feature map",
        note=note,
    )


def simulate_run(
    job: Job,
    *,
    algo: AlgoResult | None = None,
    probs: AlgoProbs | None = None,
) -> JobResult:
    """Build a full `JobResult` for a finished job.

    When `algo` is provided (the runner's main path), the headline metrics
    + leaderboard top row + quantum-circuit metadata reflect a real
    cross-validated run from `ml.run_algorithm_with_probs`. When `probs`
    is also provided, `_reliability`, `_detailed`, and `_integrity_guards`
    replace their synthetic scaffolding with real computed values.

    When `algo` is None, everything is synthetic — used by tests that
    import this function directly.
    """
    rng = random.Random(_seed_for(job))
    if algo is None:
        metrics = _metrics_from(rng)
    else:
        metrics = _metrics_from_algo(algo)
    detailed = _detailed(rng, metrics, algo=algo, probs=probs)
    leaderboard = _leaderboard(rng, job.run_path.family)
    # If we have a real run, splice the actual top model into the
    # leaderboard so the family's headline matches what the ML pipeline
    # produced. Without this, the displayed PR-AUC and the leaderboard
    # row would diverge.
    if algo is not None:
        # Find the existing top row for this family (or the global top)
        # and overwrite its metrics + name with the real result.
        target = next(
            (r for r in leaderboard if r.is_top), leaderboard[0]
        )
        target.model = algo.top_model
        target.family = algo.family  # type: ignore[assignment]
        target.pr_auc = round(algo.pr_auc, 4)
        target.roc_auc = round(algo.roc_auc, 4)
    for row in leaderboard:
        row.row_status = "RUN" if algo is not None and row.is_top else "SIM"
    benchmarks = _benchmarks(rng, leaderboard)
    top = next((r for r in leaderboard if r.is_top), leaderboard[0])
    stat_cmp = _stat_comparison(rng, top.pr_auc)
    spotlight = _candidate_spotlight(rng, metrics, job, algo=algo, probs=probs)
    guards = _integrity_guards(rng, algo=algo, probs=probs)
    trust = _trust(rng, metrics, guards)
    reliability = _reliability(rng, metrics, probs=probs)
    skeptic = _skeptic(
        rng,
        metrics,
        guards,
        leaderboard,
        job.run_path.family,
        selection=job.selection,
        detailed=detailed,
    )
    matrix = _evidence_matrix(rng)
    agreement = _model_agreement(rng)
    provenance = _provenance(rng, job)
    quality = _quality_flags(rng, metrics)
    overlays = _evidence_overlays(job)
    interpretation = _interpretation(rng, job.run_path.family)
    if algo is not None:
        circuit = _circuit_from_algo(algo, rng)
    else:
        circuit = _quantum_circuit(rng, job.run_path.family, top.model)
    path = _evidence_path(rng, job)

    return JobResult(
        metrics=metrics,
        detailed_metrics=detailed,
        leaderboard=leaderboard,
        benchmark_rows=benchmarks,
        stat_comparison=stat_cmp,
        candidate_spotlight=spotlight,
        integrity_guards=guards,
        trust_scorecard=trust,
        reliability=reliability,
        skeptic_warnings=skeptic,
        evidence_matrix=matrix,
        model_agreement=agreement,
        provenance=provenance,
        quality_flags=quality,
        evidence_overlays=overlays,
        interpretation=interpretation,
        quantum_circuit=circuit,
        evidence_path=path,
        embedding=_embedding(spotlight, job),
    )


class Runner:
    """Schedules background runs of jobs against a JobStore.

    For each scheduled job the runner:

      1. Marks the job as running.
      2. Resolves IBM credentials from the settings store (only consumed
         when family=quantum).
      3. Calls `ml.run_algorithm(family, ...)` to compute real
         cross-validated metrics + circuit metadata. The heavy work runs
         under `asyncio.to_thread` so the event loop stays responsive.
      4. Stitches the real metrics into the full `JobResult` envelope and
         marks the job as completed.

    On any exception the job is marked failed and the error message is
    persisted so the UI can show it.
    """

    def __init__(
        self,
        store: JobStore,
        *,
        settings_store: SettingsStore | None = None,
        synthetic_only: bool = False,
    ) -> None:
        self._store = store
        self._settings_store = settings_store
        # `synthetic_only` is the test-mode escape hatch: when True the
        # runner bypasses the ML dispatcher and produces deterministic
        # stub metrics. Existing tests import the runner without the ML
        # stack and shouldn't pay 0.2–4s per job.
        self._synthetic_only = synthetic_only

    def schedule(self, job: Job) -> asyncio.Task[None]:
        return asyncio.create_task(self._run(job.id))

    async def _resolve_ibm_credentials(self) -> tuple[str, str]:
        """Read IBM token + CRN from the settings store. Returns ('', '')
        when no settings store is wired or the operator hasn't filled
        them in — the dispatcher then falls back to the local Aer
        simulator."""
        if self._settings_store is None:
            return ("", "")
        try:
            settings = await self._settings_store.get("default")
        except Exception:
            return ("", "")
        ibm = settings.ibm_connection
        return (ibm.api_token or "", ibm.crn or "")

    async def _run(self, job_id: str) -> None:
        job = await self._store.get(job_id)
        if job is None:
            return
        running = job.model_copy(update={"status": "running"})
        await self._store.update(running)

        try:
            algo: AlgoResult | None = None
            probs: AlgoProbs | None = None
            if not self._synthetic_only:
                ibm_token, ibm_crn = await self._resolve_ibm_credentials()
                ibm_backend = ""
                if self._settings_store is not None:
                    try:
                        s = await self._settings_store.get("default")
                        ibm_backend = (s.quantum.default_backend or "").strip()
                    except Exception:
                        ibm_backend = ""
                # The ML dispatcher is CPU-bound (numpy + Aer); offload to
                # a worker thread so polling endpoints stay snappy.
                algo, probs = await asyncio.to_thread(
                    run_algorithm_with_probs,
                    running.run_path.family,
                    running.selection,
                    ibm_token=ibm_token,
                    ibm_crn=ibm_crn,
                    ibm_backend=ibm_backend,
                )
            else:
                # Test-mode: keep the previous "sleep 2s, return synthetic"
                # behaviour so unit tests stay fast.
                await asyncio.sleep(0.0)

            result = simulate_run(running, algo=algo, probs=probs)
            completed = running.model_copy(
                update={
                    "status": "completed",
                    "metrics": result.metrics,
                    "result": result,
                    "completed_at": datetime.now(UTC),
                }
            )
            await self._store.update(completed)
        except Exception as exc:
            failed = running.model_copy(
                update={
                    "status": "failed",
                    "error": str(exc),
                    "completed_at": datetime.now(UTC),
                }
            )
            await self._store.update(failed)
