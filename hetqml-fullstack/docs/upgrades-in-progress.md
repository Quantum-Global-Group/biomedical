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

Total: **152/152 passing** under `pytest` (including stacking, R-GCN/TransE, Hetionet features, Pauli feature map, canonical-name splice, runner timeout).

## 6. Verification snapshot

| Check | Status |
|---|---|---|
| `pytest` (api) | 152/152 passing |
| `pnpm test:api:fast` (excl. slow ML) | 118/118 passing (~35 s) |
| `npm test` / `pnpm test:web` (vitest) | 98/98 passing |
| `tsc --noEmit` | clean |
| `ruff check` | clean |
| `pnpm verify` (typecheck + vitest + fast api + ruff) | passes |
| Real classical run wall time (laptop) | ~50 ms |
| Real hybrid run wall time (laptop, Aer sim) | ~1.4 s |
| Real quantum run wall time (IBM Torino, queue + 60×60×1024 shots) | minutes — queue-dominated |

## 7. Open work

Tracked here so the next person picking it up has the full punch list.

### Algorithms / ML
- [x] **Pre-PCA feature reduction** — `ml/algorithms.py: _pca_reduce`
      replaces the `X[:, :QK_QUBITS]` truncation with principled PCA
      for the 4-qubit ZZFeatureMap. Fit per-call on the training matrix.
- [x] **Real Hetionet metapath features** — `ml/hetionet_features.py`
      loads 8 DWPC metapath features from Hetionet edge TSV, log1p-
      compressed. Falls back to catalog → synthetic when no edge file.
- [x] **Hard-negative sampling** — 1:5 positive:negative ratio per
      preregistration §5.1, semi-hard mining by therapeutic class /
      disease category.
- [x] **Real backend fidelity** — reads T1, T2, two-qubit gate error
      from `backend.properties()` instead of placeholder `0.985`.
- [x] **R-GCN + TransE classical baselines** (preregistration §6.2) —
      `run_rgcn` (1-hop message passing on feature-similarity adjacency
      → LogReg) and `run_transe` (relation translation energy → LogReg
      calibration). Both return `family="classical"`, 5-fold CV.
- [x] **Stacking ensemble** — LR + GBM + ExtraTrees → meta-LR, 5-fold
      stratified CV with proper OOF stacking. Runs as family="stacking"
      through the runner dispatcher. Real metrics splice into the
      `"Stacking ensemble"` canonical leaderboard row.

### Quantum
- [x] **Pauli feature map** (reps=2) available in the dispatcher —
      `PauliFeatureMap` (Z+XX) is the preregistration headline encoding;
      `feature_map="zz"|"pauli"` parameter on all kernel functions.
      Hybrid/quantum default remains ZZ for backward compat.
- [ ] **Pauli Path ZNE in the live runner** — currently the ZNE helpers
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
- [x] **PubChem cache GC** — age-based pruning (`max_age_days`) + size-
      based oldest-first LRU eviction (`max_size_mb`). Throttled to once
      per `gc_interval_seconds`. Full test coverage.
- [x] **Per-job timeout** in the runner — `asyncio.wait_for` wraps the
      ML dispatcher `to_thread` call. Configurable via `HETQML_JOB_TIMEOUT`
      env var (default 300 s) or `Runner(..., job_timeout=N)`. On timeout
      the job flips to `failed` with a descriptive error message.
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

## 8. Leaderboard splice alignment — canonical-name matching

`simulate_run` in `jobs/runner.py` now uses **canonical-name matching** to
splice real `AlgoResult` metrics into the correct leaderboard row rather
than overwriting whatever happened to be marked `is_top` by the randomized
PR-AUC sort.

### What changed

1. **`_canonical_leaderboard_name()`** — maps `algo.top_model` to its
   canonical row name via prefix matching (e.g. `"Stacking ensemble (LR+…)`
   → `"Stacking ensemble"`).
2. **`_leaderboard()` family normalization** — `family="stacking"` is
   normalized to `"classical"` for the `same_family` filter so the stacking
   ensemble row gets the `is_top` badge.
3. **Splice block** — resets `is_top` across all rows, then sets it on the
   canonical target. Falls back to the existing `is_top` logic when no
   canonical match is found (preserving backward compat for
   `"LR + GBM ensemble"` and `"QK-SVC ZZ(2,4)"`).

### Mapped algorithms

| `algo.top_model` | Canonical row | Splice behaviour |
|---|---|---|
| `Stacking ensemble (LR+GBM+ET → meta-LR)` | `"Stacking ensemble"` | Spliced + `is_top` set on `"Stacking ensemble"` row |
| `R-GCN (1-hop) → LogReg` | `"R-GCN"` | Spliced + `is_top` set on `"R-GCN"` row |
| `TransE → LogReg` | `"TransE"` | Spliced + `is_top` set on `"TransE"` row |
| `LR + GBM ensemble` | (no match) | Falls through to `is_top` classical row |
| `QK-SVC ZZ(2,4)` / `QK-SVC Pauli(2,4)` | (no match) | Falls through to `is_top` hybrid/quantum row |

### Tests added

- `test_simulate_run_splices_stacking_ensemble_row`
- `test_simulate_run_splices_rgcn_row`
- `test_simulate_run_splices_transe_row`
- `test_simulate_run_falls_back_to_is_top_when_no_canonical_match`
- `test__canonical_leaderboard_name_known_algos`
- `test__canonical_leaderboard_name_returns_none_for_unmatched`
- `test_runner_times_out_long_running_job` (per-job timeout)
- `test_runner_with_adequate_timeout_completes` (timeout control)

### Verify scripts

New root `package.json` scripts:

- `pnpm test:api:fast` — runs the 118 fast tests (~35 s), skips slow ML
- `pnpm verify` — `typecheck` + `vitest` + `test:api:fast` + `ruff check`
- `pnpm verify:ci` — full CI belt including slow ML tests

## 9. Pointers

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
