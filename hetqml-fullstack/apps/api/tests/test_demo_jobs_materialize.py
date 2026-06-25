"""Demo job materialization + optional env-gated seed."""

from __future__ import annotations

from hetqml_api.jobs.demo_jobs import DEMO_JOB_SPECS, materialize_demo_job


def test_materialized_demo_jobs_are_completed_with_expected_family():
    for job_id, family in DEMO_JOB_SPECS:
        job = materialize_demo_job(job_id, family)
        assert job.id == job_id
        assert job.status == "completed"
        assert job.run_path.family == family
        assert job.result is not None
        assert job.result.evidence_matrix.source == "focal_selection_heuristic"
        assert job.result.model_agreement.leaderboard_derived is True
        any_paired = [r.paired_oof for r in job.result.stat_comparison]
        assert True in any_paired
        assert False in any_paired

