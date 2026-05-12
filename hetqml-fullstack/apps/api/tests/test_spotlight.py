"""Catalog candidate spotlight — real compound names + scored ranking."""

from __future__ import annotations

import random
from datetime import UTC, datetime

import pytest

from hetqml_api.ml.spotlight import try_build_catalog_candidate_spotlight
from hetqml_api.schemas import Job, JobMetrics, RunPath, Selection


def _job() -> Job:
    return Job(
        id="spotlight-test-job-0123456789012",
        status="running",
        selection=Selection(
            disease="Hypertension-attributed ESKD",
            compound="Inaxaplin",
            gene="APOL1",
            metaedge="CtD · Compound–treats–Disease",
        ),
        run_path=RunPath(family="hybrid"),
        created_at=datetime.now(UTC),
    )


def test_catalog_spotlight_uses_real_compound_names() -> None:
    rng = random.Random(12345)
    metrics = JobMetrics(pr_auc=0.82, roc_auc=0.79, brier=0.09, ece=0.02)
    sp = try_build_catalog_candidate_spotlight(_job(), metrics, rng)
    assert sp is not None
    assert len(sp.ranking) == 6
    for row in sp.ranking:
        assert not row.compound.startswith("Synth-")
        assert 0.0 <= row.score <= 1.0


def test_catalog_spotlight_deterministic() -> None:
    rng_a = random.Random(99)
    rng_b = random.Random(99)
    metrics = JobMetrics(pr_auc=0.8, roc_auc=0.78, brier=0.1, ece=0.02)
    a = try_build_catalog_candidate_spotlight(_job(), metrics, rng_a)
    b = try_build_catalog_candidate_spotlight(_job(), metrics, rng_b)
    assert a is not None and b is not None
    assert [r.compound for r in a.ranking] == [r.compound for r in b.ranking]
    assert [r.score for r in a.ranking] == [r.score for r in b.ranking]
