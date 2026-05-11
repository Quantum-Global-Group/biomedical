"""Contract tests: when `simulate_run` receives a real `AlgoResult`, headline
metrics and the leaderboard's top row must match — reviewers rely on this for
an honest pairing between the metric strip and the table.

See `jobs.runner.simulate_run` (splice block) and `Runner._run` (dispatcher).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from hetqml_api.jobs.runner import simulate_run
from hetqml_api.ml.algorithms import AlgoResult
from hetqml_api.schemas import Job, RunPath, Selection


def _job(*, family: Literal["classical", "hybrid", "quantum"] = "hybrid") -> Job:
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
    assert sum(1 for r in result.leaderboard if r.row_status == "SIM") == 12


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
