#!/usr/bin/env python3
"""Write `fixtures/demo_jobs/*.json` for operators who want disk snapshots.

  cd apps/api && uv run python scripts/export_demo_jobs.py

Reuses `hetqml_api.jobs.demo_jobs`. JSON is optional — `HETQML_SEED_DEMO_JOBS`
materializes in-process at API boot without these files.
"""

from __future__ import annotations

from pathlib import Path

from hetqml_api.jobs.demo_jobs import DEMO_JOB_SPECS, materialize_demo_job

_API_ROOT = Path(__file__).resolve().parents[1]
_OUT = _API_ROOT / "fixtures" / "demo_jobs"


def main() -> None:
    _OUT.mkdir(parents=True, exist_ok=True)
    for job_id, family in DEMO_JOB_SPECS:
        job = materialize_demo_job(job_id, family)
        path = _OUT / f"{job_id}.json"
        path.write_text(job.model_dump_json(by_alias=True, indent=2) + "\n")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
