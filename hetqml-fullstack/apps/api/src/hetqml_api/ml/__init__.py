"""Algorithm dispatcher used by `jobs.runner`.

`run_algorithm(family, selection, ...)` returns an `AlgoResult` carrying
real cross-validated metrics + circuit metadata. The runner consumes the
result and threads it through the rest of the (still-deterministic)
JobResult fields — provenance, evidence matrix, etc. — so the wire shape
matches what the UI already renders.

Three families:

  - classical: scikit-learn pipeline (logistic regression + gradient
    boosting ensemble) on a deterministic Hetionet-derived feature matrix.
    Real metrics, real CV. No external services.

  - hybrid: classical features + a Qiskit ZZFeatureMap quantum kernel
    computed on the local Aer simulator, fed into a kernel SVM. Real
    quantum circuits, real kernel matrix, real SVM. No external services.

  - quantum: same as hybrid but the kernel matrix is computed on IBM
    Quantum hardware via qiskit-ibm-runtime when both `ibm_token` and
    `ibm_crn` are non-empty. Falls back to the local Aer simulator
    otherwise (and `used_real_hardware=False` flips so the UI can label
    the run accordingly).
"""

from __future__ import annotations

from .algorithms import AlgoResult, run_algorithm

__all__ = ["AlgoResult", "run_algorithm"]
