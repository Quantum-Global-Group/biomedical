# Upgrades in progress — algorithms, ML, and backend

What's being added to the algorithm core, the ML pipeline, the
quantum-kernel path, and the FastAPI service to take the project from
"working POC" to "publication-grade" by Q1 2027 (*Quantum Machine
Intelligence* submission).

> **Submission target.** Q3 2026 OSF preregistration freeze · Q1 2027
> manuscript submission. Lead reviewer: Beale. Co-authors: Jack, Robinson,
> Elsayed.

This doc tracks the **algorithm + service work**, not the dashboard skin.
For the dashboard / lite-build / preregistration narrative work see PR
[Quantum-Global-Group/biomedical#1](https://github.com/Quantum-Global-Group/biomedical/pull/1).

---

## 1. Real algorithm dispatcher (this repo)

`apps/api/src/hetqml_api/ml/` — new package. Replaces the deterministic
seeded fixture in `jobs.runner._simulate_result` with three real algorithm
families that actually train, cross-validate, and emit metrics. The wire
shape into `JobResult` is unchanged so the dashboard renders the same
panels.

### Three families

| Family | Implementation | CV | Wall time | Notes |
|---|---|---|---|---|
| `classical` | `LogisticRegression` + `GradientBoostingClassifier` ensemble on standardised features. Average of LR + GBM `predict_proba` heads. | 5-fold stratified | ~50 ms | Deterministic per-selection seed; no quantum work. |
| `hybrid` | Classical features → 4-qubit `ZZFeatureMap` quantum-kernel Gram matrix on **local Aer simulator** → `SVC(kernel='precomputed')`. | 5-fold stratified | ~1–3 s | Sub-samples to 60 rows to keep the O(n²) kernel tractable. |
| `quantum` | Same as hybrid but the kernel matrix is computed on **real IBM Quantum hardware** via `qiskit_ibm_runtime.SamplerV2` when both `ibm_token` and `ibm_crn` are set. | 5-fold stratified | ~minutes (queue) | `used_real_hardware=True` flag flips for the UI; falls back to Aer otherwise. |

### Constants (`ml/algorithms.py`)

```python
QK_N_SAMPLES = 60     # QK Gram matrix sub-sample size (kernel cost is O(n²))
QK_QUBITS    = 4      # ZZFeatureMap qubits == feature dim post-PCA truncation
QK_REPS      = 2      # entanglement repetitions in the feature map
QK_SHOTS     = 256    # shots per pair on the Aer simulator
QK_HW_SHOTS  = 1024   # shots per pair on real IBM hardware (more expensive)
```

The 60-sample / 4-qubit / 256-shot triple is the demo sweet spot — under
2 s wall on a laptop with plausible PR-AUC. Production runs scale these
up after pre-PCA feature reduction lands.

### `AlgoResult` shape

`AlgoResult` (frozen dataclass) carries everything the runner threads into
`JobMetrics` + `LeaderboardRow` + `QuantumCircuitInfo`:

- per-fold PR-AUC and ROC-AUC (length 5)
- whole-dataset Brier + ECE (`_ece` is a 10-bin Expected Calibration Error)
- circuit metadata: backend name, qubits, shots, depth, fidelity
- `used_real_hardware` flag
- `notes[]` — free-form lines the runner can lift into a `SkepticWarning`

### Real-hardware path

`run_quantum(selection, *, ibm_token, ibm_crn)`:

1. `QiskitRuntimeService(channel="ibm_quantum", token=…, instance=…)`
2. `SamplerV2(mode=backend)` against the user-selected backend (`ibm_torino` by default).
3. For every pair `(i, j)` we run the standard QK overlap circuit
   (`U(x_i) · U(x_j)†` then measure all-zeros) at `QK_HW_SHOTS=1024`.
4. The full kernel matrix is sub-sampled to `QK_N_SAMPLES` representative
   rows; the remainder is back-filled from the Aer simulator so the
   downstream `SVC(kernel='precomputed')` still sees a full Gram matrix.
   This caps queue cost while keeping the SVM fit honest.
5. The fidelity number returned is a placeholder pending real backend
   property reads (see § "Open work" below).

The whole thing degrades gracefully — empty token → Aer simulator,
`used_real_hardware=False` flips, dashboard labels accordingly.

### Feature builder (`ml/features.py`)

Deterministic synthetic feature matrix keyed on `Selection`. Hashes the
selection tuple to seed `numpy.random` so:

- same selection → same data (runs are comparable)
- learnable signal (metrics are plausible, not 0.5)
- varies across selections (different leaderboards per pair)
- small (≤200 samples × 8 features) so the QK Gram stays tractable

The real swap-in is straightforward — replace `build_features()` with a
Hetionet metapath-feature loader keyed on the selection. The classical /
hybrid / quantum scorers don't care where `X, y` come from.

## 2. Pauli Path Zero-Noise Extrapolation (sibling repo)

Lives in [`hybrid-qml-kg-poc`](https://github.com/Quantum-Global-Group/hybrid-qml-kg-poc),
branch `roc/preregistration-followups`,
file `quantum_layer/advanced_error_mitigation.py`.

Three extrapolators added alongside the existing analytical one:

- `linear_zero_noise_extrapolation(values, scale_factors)` — least-squares
  linear fit, evaluated at zero noise.
- `richardson_zero_noise_extrapolation(values, scale_factors)` — Richardson
  extrapolation via Lagrange polynomial fit (higher-order accuracy when
  noise scales are non-uniform).
- `all_zero_noise_extrapolations(values, scale_factors)` — convenience
  wrapper returning `{linear, richardson, analytical}` so the bootstrap CI
  driver can record all three side by side and the manuscript can argue
  from agreement (not from a single estimator).

Noise scale factors are **locked to `[1, 3, 5]`** in
`utils/preregistered_constants.py` so the extrapolation is reproducible.
Audit + sensitivity write-ups land in
[`docs/results/zne_implementation_audit.md`](https://github.com/Quantum-Global-Group/hybrid-qml-kg-poc/blob/roc/preregistration-followups/docs/results/zne_implementation_audit.md).

## 3. Paired-bootstrap CI infrastructure (sibling repo)

`utils/bootstrap_ci.py` — preregistered conjunction-across-baselines
decision rule made testable.

- `paired_bootstrap_pr_auc_difference(y_true, p_a, p_b, *, n_resamples, seed)`
  — resamples row indices with replacement, recomputes PR-AUC for each
  model on the resampled rows, returns the percentile CI of the
  difference distribution.
- `conjunction_across_baselines(predictions_by_model, baseline_names, *, n_resamples, seed)`
  — applies the per-pair test to every (model, baseline) pair and returns
  the AND-conjunction (all CIs exclude zero in the favourable direction).

### Locked constants (`utils/preregistered_constants.py`)

```python
BOOTSTRAP_SEED        = 20260504   # locked at preregistration freeze
BOOTSTRAP_N_RESAMPLES = 10000
BOOTSTRAP_CI_LEVEL    = 0.95
NOISE_SCALE_FACTORS   = (1, 3, 5)
```

### Driver

`scripts/run_bootstrap_ci.py` runs the headline 5-fold CV, persists
per-fold OOF predictions to `results/cv_predictions/fold_{i}.npz`, then
runs the paired-bootstrap test on the cached predictions and emits
`docs/results/bootstrap_ci_analysis.md` — manuscript-ready report with
H1 / H1b tables, conjunction decision, OOF point estimates, run metadata.

`--gpu` flag gates on `_gate_gpu_or_abort()` which checks
`qiskit_aer_gpu` is present and CUDA-visible. `scripts/verify_qiskit_gpu.py`
is the six-check pre-flight that runs before any DGX run.

DGX wrapper at `scripts/run_bootstrap_ci_dgx.sh` + guide at
`docs/deployment/DGX_BOOTSTRAP_CI.md` — env-var overrides for fold count,
resamples, cache dir, resume-from-cache; tee'd timestamped log; GPU
verify gate; idempotent / resumable.

## 4. Service-side additions (this repo)

### Job runner (`apps/api/src/hetqml_api/jobs/runner.py`)

Heavily modified (+431 lines). The real change: `simulate_run` now wires
`run_algorithm()` from `hetqml_api.ml`. The remaining seeded fields
(provenance, evidence matrix, integrity guards, skeptic warnings) stay
deterministic until each gets its own real source.

The runner reads `ibm_token` + `ibm_crn` from the `SettingsStore`, picks
the family from `runPath`, dispatches to `run_classical/hybrid/quantum`,
and threads the resulting `AlgoResult` into:

- `JobMetrics.prAuc`, `.rocAuc`, `.brier`, `.ece` — directly
- `LeaderboardRow[0]` — top model, family-tagged
- `QuantumCircuitInfo` — backend, qubits, shots, depth, fidelity for the
  visualize page
- `SkepticWarning[]` seed — `notes[]` lifted into the warning feed

### Molecule router (`apps/api/src/hetqml_api/routers/molecule.py`)

New endpoint:

- `GET /molecule/{cid}` proxies the PubChem REST PUG API
  (`/rest/pug/compound/cid/{CID}/SDF?record_type=3d`) for 3D conformer SDF.
- On-disk cache at `<data_dir>/pubchem-sdf/<cid>.sdf` (configurable via
  `Settings.molecule_cache_subdir`).
- Returns `Content-Type: chemical/x-mdl-sdfile` so 3Dmol.js's
  `addModel(text, "sdf")` consumes the response directly.
- Cache hit decided on file presence; PubChem 3D records are CID-stable so
  no expiry. 404 from PubChem propagates 404; network/5xx propagates 502
  with the upstream status in the detail.

### Persistence (`apps/api/src/hetqml_api/persistence/sqlite.py`)

sqlite-backed `DecisionStore`, `NoteStore`, `SettingsStore` (+104 lines).
stdlib `sqlite3` only — no extra deps. Connection opened once per app,
WAL mode, foreign keys on, single `asyncio.Lock` so concurrent FastAPI
requests serialise their writes. All sqlite calls go through `to_thread`
so the asyncio loop is never blocked.

Schema strategy: complex Pydantic objects (`DecisionRecord`,
`UserSettings`, `Job`) live as JSON blobs; only indexed columns
(`pair_key`, `timestamp`, `owner`) are normalised. Cheap to migrate
while the wire shape is still settling.

Backend swappable via the `Protocol` in
`apps/api/src/hetqml_api/persistence/protocols.py` — when load profile
demands Postgres / a queue / a remote store, drop the new impl in;
routers don't change.

### Catalog (`apps/api/src/hetqml_api/catalog.py`)

+153 lines. Six catalog endpoints expanded with deterministic seeded
generators:

- `diseases_catalog()` — DOID-coded, with Hetionet edge counts
- `compounds_catalog()` — DrugBank-coded, therapeutic class
- `genes_catalog()` — NCBI gene IDs, anchor-target eligibility
- `metaedges_catalog()` — Hetionet metaedge codes + per-edge stats
- `algorithms_catalog()` — 32 algorithms across 7 groups, family-tagged
- `integrity_guards_catalog()` — 23 guards across 6 groups, criticality
  + default-on flags

`_seeded(seed: int) -> random.Random` — every catalog uses a deterministic
seed so two API instances with the same version emit identical fixtures.
Real catalogs (live Hetionet pulls + PubChem queries) plug in at the
same call sites.

## 5. Tests added

| File | What it covers |
|---|---|
| `apps/api/tests/test_molecule.py` | `GET /molecule/{cid}` happy path + cache hit + PubChem 404 + PubChem 5xx → 502 propagation. PubChem traffic mocked at the `httpx.AsyncClient` level. |
| `apps/api/tests/test_skeptic_generator.py` | The notes → `SkepticWarning` lifting in the runner. Seeds `AlgoResult` with synthetic notes and asserts the runner threads them through with the right severity tone. |
| `apps/api/tests/test_sqlite_job_store.py` | The new `JobStore` sqlite path. Round-trips a queued → running → completed job, asserts JSON-blob preservation, and checks concurrent writes serialise. |
| `apps/api/tests/test_preregistration.py` | `GET /preregistration/status` returns the locked constants, the Hetionet snapshot SHA-256 prefix, and `gpuRunComplete: false` until the bootstrap CI artifact lands. |
| `apps/api/tests/test_catalog.py` | The expanded six catalogs render deterministically across reseeds; counts match the documented totals (23 guards / 32 algorithms / 24 metaedges). |

Total: **54/54 passing** under `pytest`.

## 6. Verification snapshot

| Check | Status |
|---|---|
| `pytest` (api) | 54/54 passing |
| `npm test` (web vitest) | 98/98 passing |
| `tsc --noEmit` | clean |
| `ruff check` | clean |
| Real classical run wall time (laptop) | ~50 ms |
| Real hybrid run wall time (laptop, Aer sim) | ~1.4 s |
| Real quantum run wall time (IBM Torino, queue + 60×60×1024 shots) | minutes — queue-dominated |

## 7. Open work

Tracked here so the next person picking it up has the full punch list.

### Algorithms / ML
- [ ] **Pre-PCA feature reduction** so the 4-qubit `ZZFeatureMap` is a
      principled compression rather than coincidence with the synthetic
      8-feature matrix. Fits between `build_features()` and the QK
      kernel call.
- [ ] **Real Hetionet metapath features.** Replace the deterministic
      synthetic matrix in `ml/features.py` with a metapath-count loader
      keyed on the same `Selection` shape. Downstream scorers don't
      change.
- [ ] **Hard-negative sampling.** Project headline uses 1:5 hard
      negatives (preregistration §5.1); the synthetic builder currently
      generates balanced classes. Swap for class-balanced negatives
      with semi-hard mining.
- [ ] **Real backend fidelity.** `run_quantum` returns a placeholder
      `0.985` — read it from `backend.properties()` (T1, T2, gate error)
      so the visualize page reports something true.
- [ ] **R-GCN + TransE classical baselines** (preregistration §6.2 —
      listed but not implemented). Without them the
      conjunction-across-baselines decision rule can't fire on the full
      slate; the dashboard surfaces this as `BASELINE` 57% with the
      "pending all five baselines" note.
- [ ] **Stacking ensemble (Pauli)** as a first-class family. Headline
      experiment is preregistered as Pauli + stacking; right now hybrid
      is single-head SVC. Stacking landed in the sibling repo's pipeline
      but hasn't been wired into `hetqml_api.ml.algorithms`.

### Quantum
- [ ] **Pauli feature map** (reps=2) end-to-end on real IBM Torino
      hardware. Current `run_quantum` uses ZZFeatureMap; preregistration
      headline is PauliFeatureMap.
- [ ] **Pauli Path ZNE in the live runner** — currently the ZNE helpers
      in the sibling repo are run only by the bootstrap CI driver, not
      by the per-job runner here. Wiring `all_zero_noise_extrapolations`
      into `run_quantum` would surface mitigated kernels in the
      dashboard's quantum-circuit panel.
- [ ] **H2 hypothesis** — hardware-evaluated QSVC + Pauli Path ZNE
      within ±5pp of simulator on 95% bootstrap CI. Needs hardware time.
- [ ] **H3 hypothesis** — sub-quadratic scaling on IBM Torino at
      10 / 15 / 20 qubit dims. Needs hardware time + PCA-backed feature
      reduction first.

### Bootstrap CI artifact
- [ ] **Run `./scripts/run_bootstrap_ci_dgx.sh`** on the DGX. Until that
      lands, the headline view in the dashboard reads "CIs pending" on
      the Δ-vs-classical metric strip.
- [ ] Cross-link the emitted `bootstrap_ci_analysis.md` from the api so
      `/preregistration/status` returns `gpuRunComplete: true` and the
      HeadlineTrustScorecard's `BASELINE` axis renders the actual CI
      block.

### Service hardening
- [ ] **PubChem cache GC.** Current cache is unbounded; add an LRU cap
      keyed on the cache dir size or last-accessed timestamp.
- [ ] **Per-job timeout** in the runner — real-hardware paths can hang on
      queue. Bound + status flip to `failed` + skeptic-warning seed.
- [ ] **OpenAPI doc round-trip.** `/preregistration/status`,
      `/molecule/{cid}`, `/settings`, `/decisions` all have
      schemas; export the OpenAPI JSON as part of CI and assert the
      web client's typed bindings stay in sync.

### Docs / reproducibility
- [ ] **OSF amendments log** — `preregistration/amendments/` directory
      with one Markdown entry dated and signed off whenever the locked
      constants change. None to date; create the directory + a stub when
      the first amendment is needed.
- [ ] **DGX_SPARK ↔ DGX_BOOTSTRAP_CI** cross-link in both directions.
      Currently `DGX_BOOTSTRAP_CI.md` references `DGX_SPARK.md` for
      CUDA-PyTorch prereqs but not the other way.
- [ ] **IBM Torino hardware runbook** — separate forward-looking deliverable,
      not bundled with the bootstrap CI doc. Will land at
      `docs/deployment/IBM_TORINO_HARDWARE.md`.

## 8. Pointers

- This repo (FastAPI service + `hetqml_api.ml` package) — [`Quantum-Global-Group/biomedical`](https://github.com/Quantum-Global-Group/biomedical) on `roc/preregistration-tighten`
- Algorithm dispatcher — [`apps/api/src/hetqml_api/ml/`](../apps/api/src/hetqml_api/ml/)
  - `__init__.py` · `algorithms.py` · `features.py`
- Job runner — [`apps/api/src/hetqml_api/jobs/runner.py`](../apps/api/src/hetqml_api/jobs/runner.py)
- Molecule router — [`apps/api/src/hetqml_api/routers/molecule.py`](../apps/api/src/hetqml_api/routers/molecule.py)
- Persistence — [`apps/api/src/hetqml_api/persistence/sqlite.py`](../apps/api/src/hetqml_api/persistence/sqlite.py)
- Catalog — [`apps/api/src/hetqml_api/catalog.py`](../apps/api/src/hetqml_api/catalog.py)
- Sibling repo (preregistration / ZNE / bootstrap CI / DGX runner) — [`Quantum-Global-Group/hybrid-qml-kg-poc`](https://github.com/Quantum-Global-Group/hybrid-qml-kg-poc) on `roc/preregistration-followups`
- Locked constants — [`utils/preregistered_constants.py`](https://github.com/Quantum-Global-Group/hybrid-qml-kg-poc/blob/roc/preregistration-followups/utils/preregistered_constants.py)
- Bootstrap CI driver — [`scripts/run_bootstrap_ci.py`](https://github.com/Quantum-Global-Group/hybrid-qml-kg-poc/blob/roc/preregistration-followups/scripts/run_bootstrap_ci.py)
- ZNE helpers — [`quantum_layer/advanced_error_mitigation.py`](https://github.com/Quantum-Global-Group/hybrid-qml-kg-poc/blob/roc/preregistration-followups/quantum_layer/advanced_error_mitigation.py)
- DGX wrapper / guide — [`scripts/run_bootstrap_ci_dgx.sh`](https://github.com/Quantum-Global-Group/hybrid-qml-kg-poc/blob/roc/preregistration-followups/scripts/run_bootstrap_ci_dgx.sh) · [`docs/deployment/DGX_BOOTSTRAP_CI.md`](https://github.com/Quantum-Global-Group/hybrid-qml-kg-poc/blob/roc/preregistration-followups/docs/deployment/DGX_BOOTSTRAP_CI.md)
- Headline output (pending GPU run) — [`docs/results/bootstrap_ci_analysis.md`](https://github.com/Quantum-Global-Group/hybrid-qml-kg-poc/blob/roc/preregistration-followups/docs/results/bootstrap_ci_analysis.md)

---

*Document is intentionally append-only — do not delete shipped items
when revising; keep them as a log of what was decided and when.*
