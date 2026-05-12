"""Catalog-backed candidate spotlight (compound–disease ranking).

Pairs are drawn from the same bundled catalogs as Initialize (graph slice:
focal pair, same-disease / same-compound neighbors, then random negatives).
Scores are **full-data** logistic + gradient-boosting probabilities on the
same ``build_features`` / ``build_features_for_candidates`` tensors used for
CV — stable across classical / hybrid / quantum headline runs.
"""

from __future__ import annotations

import random

import numpy as np

from hetqml_api.catalog import compounds_catalog, diseases_catalog
from hetqml_api.ml.algorithms import score_feature_rows_classical
from hetqml_api.ml.catalog_features import resolve_compound_entry, resolve_disease_entry
from hetqml_api.ml.features import build_features, build_features_for_candidates
from hetqml_api.schemas import CandidateRankingRow, CandidateSpotlight, Job, JobMetrics, Selection


def _is_synth_compound_name(name: str) -> bool:
    return name.startswith("Synth-")


def _is_synth_disease_name(name: str) -> bool:
    return name.startswith("Synth ")


def _iter_catalog_candidate_pairs(
    selection: Selection,
    rng: random.Random,
    *,
    n: int,
) -> list[tuple[str, str]]:
    """Up to ``n`` unique ``(compound_display_name, disease_display_name)`` pairs."""
    compounds = compounds_catalog().items
    diseases = diseases_catalog().items
    fc = resolve_compound_entry(compounds, selection.compound)
    fd = resolve_disease_entry(diseases, selection.disease)
    if fc is None or fd is None:
        return []

    focal = (fc.name, fd.name)
    seen: set[tuple[str, str]] = {focal}
    out: list[tuple[str, str]] = [focal]

    def add_pair(p: tuple[str, str]) -> bool:
        if len(out) >= n or p in seen:
            return False
        seen.add(p)
        out.append(p)
        return True

    same_disease_curated = [
        (c.name, fd.name)
        for c in compounds
        if c.name != fc.name and not _is_synth_compound_name(c.name)
    ]
    rng.shuffle(same_disease_curated)
    for p in same_disease_curated:
        if len(out) >= n:
            break
        add_pair(p)

    same_compound_curated = [
        (fc.name, d.name)
        for d in diseases
        if d.name != fd.name and not _is_synth_disease_name(d.name)
    ]
    rng.shuffle(same_compound_curated)
    for p in same_compound_curated:
        if len(out) >= n:
            break
        add_pair(p)

    pool_c = [c for c in compounds if not _is_synth_compound_name(c.name)]
    pool_d = [d for d in diseases if not _is_synth_disease_name(d.name)]
    guard = 0
    while len(out) < n and guard < 25_000:
        guard += 1
        c = pool_c[rng.randrange(0, len(pool_c))]
        d = pool_d[rng.randrange(0, len(pool_d))]
        add_pair((c.name, d.name))

    if len(out) < n:
        same_disease_synth = [
            (c.name, fd.name)
            for c in compounds
            if c.name != fc.name and _is_synth_compound_name(c.name)
        ]
        rng.shuffle(same_disease_synth)
        for p in same_disease_synth:
            if len(out) >= n:
                break
            add_pair(p)

    if len(out) < n:
        same_compound_synth = [
            (fc.name, d.name)
            for d in diseases
            if d.name != fd.name and _is_synth_disease_name(d.name)
        ]
        rng.shuffle(same_compound_synth)
        for p in same_compound_synth:
            if len(out) >= n:
                break
            add_pair(p)

    guard = 0
    while len(out) < n and guard < 40_000:
        guard += 1
        c = compounds[rng.randrange(0, len(compounds))]
        d = diseases[rng.randrange(0, len(diseases))]
        add_pair((c.name, d.name))

    return out[:n]


def try_build_catalog_candidate_spotlight(
    job: Job,
    metrics: JobMetrics,
    rng: random.Random,
) -> CandidateSpotlight | None:
    """Return a spotlight when focal selection resolves in the catalog."""
    pairs = _iter_catalog_candidate_pairs(job.selection, rng, n=6)
    if len(pairs) < 6:
        return None

    fm = build_features(job.selection)
    x_cand = build_features_for_candidates(job.selection, pairs)
    if x_cand.shape != (6, fm.X.shape[1]):
        return None

    p_ens, delta_lin = score_feature_rows_classical(fm, x_cand)
    order = np.argsort(-p_ens)
    pairs_r = [pairs[int(i)] for i in order]
    scores = p_ens[order]
    deltas = delta_lin[order]

    ranking = [
        CandidateRankingRow(
            rank=i + 1,
            compound=pairs_r[i][0],
            disease=pairs_r[i][1],
            score=round(float(scores[i]), 4),
            delta_classical=round(float(deltas[i]), 4),
        )
        for i in range(6)
    ]
    family = job.run_path.family
    reasons = [
        f"Anchor gene {job.selection.gene} fixed for every candidate feature row",
        "Pairs: focal + same-disease / same-compound catalog neighbors + random negatives",
        (
            f"Scores: full-data LR+GBM on catalog features; headline CV PR-AUC "
            f"{round(metrics.pr_auc, 3)} from {family} run"
        ),
    ]
    return CandidateSpotlight(
        score=round(float(scores[0]), 4),
        reasons=reasons,
        ranking=ranking,
    )
