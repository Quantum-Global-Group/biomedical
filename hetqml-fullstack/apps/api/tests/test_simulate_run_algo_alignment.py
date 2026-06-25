"""Contract tests: when `simulate_run` receives a real `AlgoResult`, headline
metrics and the leaderboard's top row must match — reviewers rely on this for
an honest pairing between the metric strip and the table.

See `jobs.runner.simulate_run` (splice block) and `Runner._run` (dispatcher).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from hetqml_api.jobs.runner import (
    Runner,
    _canonical_leaderboard_name,
    simulate_run,
)
from hetqml_api.jobs.store import InMemoryJobStore
from hetqml_api.ml.algorithms import AlgoResult
from hetqml_api.schemas import Job, RunPath, Selection


def _job(*, family: Literal["classical", "hybrid", "quantum", "stacking"] = "hybrid") -> Job:
    return Job(
        id="testjob012345678901234567890ab",
        status="running",
        selection=Selection(
            disease="Hypertension-attributed ESKD",
            compound="Inaxaplin",
            gene="APOL1",
            metaedge="CtD · Compound–treats–Disease",
        ),
        run_path=RunPath(family=family),
        created_at=datetime.now(UTC),
    )


def test_simulate_run_splices_algo_into_metrics_and_leaderboard_top():
    algo = AlgoResult(
        family="hybrid",
        pr_auc=0.8123,
        roc_auc=0.7654,
        brier=0.045,
        ece=0.012,
        cv_pr_auc=[0.8, 0.81, 0.82, 0.81, 0.82],
        cv_roc_auc=[0.76, 0.77, 0.76, 0.77, 0.76],
        top_model="QK-SVC ZZ(2,4) — contract fixture",
        runtime_seconds=1.0,
        n_samples=100,
        n_features=24,
        backend="aer_simulator (local)",
        qubits=4,
        shots=1024,
        depth=12,
        fidelity=0.99,
        used_real_hardware=False,
    )
    job = _job(family="hybrid")
    result = simulate_run(job, algo=algo)

    assert round(algo.pr_auc, 4) == result.metrics.pr_auc
    assert round(algo.roc_auc, 4) == result.metrics.roc_auc
    assert round(algo.brier, 4) == result.metrics.brier
    assert round(algo.ece, 4) == result.metrics.ece

    top = next(r for r in result.leaderboard if r.is_top)
    assert top.model == algo.top_model
    assert top.pr_auc == result.metrics.pr_auc
    assert top.roc_auc == result.metrics.roc_auc
    assert top.family == algo.family
    assert top.row_status == "RUN"
    assert sum(1 for r in result.leaderboard if r.row_status == "SIM") == 14


def test_simulate_run_without_algo_marks_all_leaderboard_rows_sim():
    result = simulate_run(_job(), algo=None)
    assert all(r.row_status == "SIM" for r in result.leaderboard)


def test_simulate_run_classical_algo_yields_no_quantum_backend_in_circuit():
    algo = AlgoResult(
        family="classical",
        pr_auc=0.71,
        roc_auc=0.68,
        brier=0.08,
        ece=0.03,
        cv_pr_auc=[0.70, 0.71, 0.72, 0.71, 0.70],
        cv_roc_auc=[0.67, 0.68, 0.69, 0.68, 0.67],
        top_model="Logistic-GBM ensemble",
        runtime_seconds=0.5,
        n_samples=100,
        n_features=24,
    )
    result = simulate_run(_job(family="classical"), algo=algo)
    assert result.quantum_circuit.backend is None
    assert result.metrics.pr_auc == round(algo.pr_auc, 4)


# ── canonical-name splice tests ──────────────────────────────────────────────


def _assert_canonical_splice(
    top_model: str,
    canonical_row_name: str,
    family: str,
    job_family: str,
) -> None:
    """Helper: build an AlgoResult, call simulate_run, verify the canonical
    leaderboard row is the one that gets spliced and marked is_top.

    After splicing, the target row's ``model`` field changes from
    ``canonical_row_name`` to ``algo.top_model``, so assertions look for
    the row whose model equals ``top_model`` (the spliced row).
    """
    algo = AlgoResult(
        family=family,
        pr_auc=0.7012,
        roc_auc=0.6543,
        brier=0.06,
        ece=0.02,
        cv_pr_auc=[0.70, 0.70, 0.71, 0.70, 0.70],
        cv_roc_auc=[0.65, 0.66, 0.65, 0.66, 0.65],
        top_model=top_model,
        runtime_seconds=0.5,
        n_samples=100,
        n_features=24,
    )
    job = _job(family=job_family)
    result = simulate_run(job, algo=algo)

    # The spliced row now has model=algo.top_model (changes from canonical name)
    spliced = next(r for r in result.leaderboard if r.model == top_model)
    assert spliced.pr_auc == round(algo.pr_auc, 4), (
        f"expected {canonical_row_name!r} pr_auc={algo.pr_auc}, "
        f"got pr_auc={spliced.pr_auc}"
    )
    assert spliced.family == algo.family
    assert spliced.is_top is True, (
        f"{canonical_row_name!r} should be is_top after splice"
    )
    assert spliced.row_status == "RUN"

    # The old canonical name should NOT appear in the leaderboard anymore
    # (the row was renamed to top_model)
    old_rows = [r for r in result.leaderboard if r.model == canonical_row_name]
    assert len(old_rows) == 0, (
        f"Row {canonical_row_name!r} should have been renamed to {top_model!r}"
    )

    # Exactly one row should be RUN, exactly one is_top
    n_run = sum(1 for r in result.leaderboard if r.row_status == "RUN")
    assert n_run == 1, f"expected exactly 1 RUN row, got {n_run}"
    n_top = sum(1 for r in result.leaderboard if r.is_top)
    assert n_top == 1, f"expected exactly 1 is_top row, got {n_top}"


def test_simulate_run_splices_stacking_ensemble_row():
    """Stacking ensemble run should splice real metrics into the
    "Stacking ensemble" canonical row, not a random top performer."""
    _assert_canonical_splice(
        top_model="Stacking ensemble (LR+GBM+ET → meta-LR)",
        canonical_row_name="Stacking ensemble",
        family="classical",
        job_family="stacking",
    )


def test_simulate_run_splices_rgcn_row():
    """R-GCN algo should splice into the "R-GCN" canonical row."""
    _assert_canonical_splice(
        top_model="R-GCN (1-hop) → LogReg",
        canonical_row_name="R-GCN",
        family="classical",
        job_family="classical",
    )


def test_simulate_run_splices_transe_row():
    """TransE algo should splice into the "TransE" canonical row."""
    _assert_canonical_splice(
        top_model="TransE → LogReg",
        canonical_row_name="TransE",
        family="classical",
        job_family="classical",
    )


def test_simulate_run_falls_back_to_is_top_when_no_canonical_match():
    """An algo with no canonical match (e.g. plain classical LR+GBM) should
    splice into whatever the leaderboard marked is_top, preserving the
    existing behaviour."""
    algo = AlgoResult(
        family="classical",
        pr_auc=0.7012,
        roc_auc=0.6543,
        brier=0.06,
        ece=0.02,
        cv_pr_auc=[0.70, 0.70, 0.71, 0.70, 0.70],
        cv_roc_auc=[0.65, 0.66, 0.65, 0.66, 0.65],
        top_model="LR + GBM ensemble",
        runtime_seconds=0.5,
        n_samples=100,
        n_features=24,
    )
    job = _job(family="classical")
    result = simulate_run(job, algo=algo)

    top = next(r for r in result.leaderboard if r.is_top)
    assert top.model == "LR + GBM ensemble"
    assert top.pr_auc == round(algo.pr_auc, 4)
    assert top.row_status == "RUN"
    assert sum(1 for r in result.leaderboard if r.row_status == "RUN") == 1


def test__canonical_leaderboard_name_known_algos():
    """Every known algorithm top_model should map to the correct canonical row."""
    cases: list[tuple[str, str]] = [
        ("Stacking ensemble (LR+GBM+ET → meta-LR)", "Stacking ensemble"),
        ("R-GCN (1-hop) → LogReg", "R-GCN"),
        ("TransE → LogReg", "TransE"),
    ]
    for top_model, expected in cases:
        algo = AlgoResult(
            family="classical",
            pr_auc=0.5,
            roc_auc=0.5,
            brier=0.1,
            ece=0.05,
            cv_pr_auc=[0.5, 0.5, 0.5, 0.5, 0.5],
            cv_roc_auc=[0.5, 0.5, 0.5, 0.5, 0.5],
            top_model=top_model,
            runtime_seconds=0.1,
            n_samples=10,
            n_features=8,
        )
        assert _canonical_leaderboard_name(algo) == expected, f"mismatch for {top_model!r}"


def test__canonical_leaderboard_name_returns_none_for_unmatched():
    """top_model strings that don't start with a canonical name return None."""
    algo = AlgoResult(
        family="classical",
        pr_auc=0.5,
        roc_auc=0.5,
        brier=0.1,
        ece=0.05,
        cv_pr_auc=[0.5, 0.5, 0.5, 0.5, 0.5],
        cv_roc_auc=[0.5, 0.5, 0.5, 0.5, 0.5],
        top_model="Some custom algorithm v2",
        runtime_seconds=0.1,
        n_samples=10,
        n_features=8,
    )
    assert _canonical_leaderboard_name(algo) is None


# ── per-job timeout ───────────────────────────────────────────────────────────


async def test_runner_times_out_long_running_job():
    """A Runner with a very short job_timeout should flip the job to failed."""
    store = InMemoryJobStore()
    runner = Runner(store, synthetic_only=False, job_timeout=0.001)
    job = Job(
        id="timeout-test-job",
        status="queued",
        selection=Selection(
            disease="Hypertension-attributed ESKD",
            compound="Inaxaplin",
            gene="APOL1",
            metaedge="CtD · Compound–treats–Disease",
        ),
        run_path=RunPath(family="classical"),
        created_at=datetime.now(UTC),
    )
    await store.create(job)
    await runner._run(job.id)
    updated = await store.get(job.id)
    assert updated is not None
    assert updated.status == "failed", f"expected failed, got {updated.status}"
    assert updated.error is not None
    assert "timed out" in updated.error


async def test_runner_with_adequate_timeout_completes():
    """A Runner with a generous job_timeout should complete as normal."""
    store = InMemoryJobStore()
    runner = Runner(store, synthetic_only=False, job_timeout=300)
    job = Job(
        id="timeout-control-job",
        status="queued",
        selection=Selection(
            disease="Hypertension-attributed ESKD",
            compound="Inaxaplin",
            gene="APOL1",
            metaedge="CtD · Compound–treats–Disease",
        ),
        run_path=RunPath(family="classical"),
        created_at=datetime.now(UTC),
    )
    await store.create(job)
    await runner._run(job.id)
    updated = await store.get(job.id)
    assert updated is not None
    assert updated.status == "completed", f"expected completed, got {updated.status}"




