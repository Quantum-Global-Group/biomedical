# HetQML Pipeline Status — What's Real vs Synthetic

**Last updated:** 2026-05-12 (trust axes §4: literature baseline + catalog / optional OpenTargets)
**Branch:** main (pipeline doc tracks behaviour, not a fixed SHA)

---

## Executive Summary

The dashboard runs a genuine ML cross-validation pipeline (classical, hybrid-quantum, IBM-Quantum). **By default** (`HETQML_FEATURE_MATRIX_SOURCE` unset or `catalog`) training features are **Hetionet-informed**: published Hetionet v1.0 metaedge edge totals plus bundled catalog attributes (DrugBank / DOID / gene categories, FDA flag, PubChem CID proxy), with a binary label for whether a row is the focal compound–disease pair versus a random catalog pair. Set `HETQML_FEATURE_MATRIX_SOURCE=synthetic` to restore the legacy Gaussian demo matrix. All statistical outputs — fold scores, calibration bins, bootstrap CIs, Brier score, ECE — are mathematically real computations on whichever matrix is active. For the Experiment **statistical comparison** panel, **McNemar** p-values (exact two-sided binomial on discordant OOF decisions) apply to **vs best classical** on hybrid/quantum runs and to **vs random predictor** (naive constant-at-prevalence baseline); other reference rows still use placeholder p-values until those models expose paired OOF predictions. **Validate trust radar:** the **baseline** spoke is a **literature ratio** (headline PR-AUC vs Himmelstein 2017 metapath anchors); **clinical** / **mechanism** default to **deterministic catalog proxies** (set `HETQML_TRUST_OPENTARGETS=1` to blend in OpenTargets GraphQL where available). Per-pair **DWPC** values from the full Hetionet graph are **not** bundled here yet; that remains future work (`hybrid-qml-kg-poc` ingestion path).

**Persistence:** In production and local `pnpm dev:api`, completed **jobs** are stored in **SQLite** via `SqliteJobStore` (`apps/api/src/hetqml_api/main.py`) on the same connection as decisions, notes, settings, and preregistration — **not** an in-memory job store. Pytest’s shared `client` fixture swaps in `InMemoryJobStore` only to keep HTTP tests fast (see `tests/conftest.py` and `tests/test_app_job_store_wiring.py`).

---

## Layer-by-Layer Status

### 1 · Feature Data — CATALOG (Hetionet-informed) · DWPC still future

| Item | Status |
|---|---|
| `build_features()` in `ml/features.py` | **Default:** `ml/catalog_features.py` — log-scaled **Hetionet v1.0 metaedge edge totals** (`catalog.METAEDGES`) + catalog fields (FDA, therapeutic class, disease/gene category, PubChem CID proxy). Labels = focal compound–disease vs random catalog pairs. |
| `HETQML_FEATURE_MATRIX_SOURCE=synthetic` | Legacy Gaussian `multivariate_normal` demo (previous behaviour). |
| `build_features_for_candidates()` | Same catalog row builder per `(compound, disease)` when resolution succeeds; else hash-Gaussian fallback. |

**Impact:** CV metrics are no longer “pure noise” features, but rows are still **not** per-pair DWPCs from the live Hetionet export. Treat headline PR-AUC as **pipeline + catalog signal**, not validated repurposing evidence, until pairwise DWPC ingestion lands.

**Next:** Ship or compute a pairwise feature table (DWPC / integrated scores) keyed on `(compound, disease, gene, metaedge)` and swap the row builder to read it; keep `HETQML_FEATURE_MATRIX_SOURCE=synthetic` for regression tests if needed.

---

### 2 · ML Pipeline — REAL (given real features)

| Item | Status | Notes |
|---|---|---|
| 5-fold stratified CV | ● Real | `_cv_score()` in `ml/algorithms.py` |
| PR-AUC, ROC-AUC, Brier, ECE | ● Real | Computed over concatenated CV folds |
| Per-fold scores (5 folds) | ● Real | `algo.cv_pr_auc / cv_roc_auc` wired in Phase 3 |
| Calibration bins (10 bins) | ● Real | Uniform binning of actual predicted probabilities |
| MCE (max calibration error) | ● Real | `max(|observed − predicted|)` per bin |
| Log-loss | ● Real | Numerically-safe binary cross-entropy |
| Bootstrap 95% CI (PR-AUC, ROC-AUC) | ● Real | 1 000-resample paired bootstrap |
| Classical family (LR + GBM ensemble) | ● Real | scikit-learn `LogisticRegression` + `GradientBoostingClassifier` |
| Hybrid family (QK-SVC, Aer sim) | ● Real | Qiskit ZZFeatureMap kernel on local Aer simulator |
| Quantum family (IBM hardware) | ● Plumbed | Requires user-supplied `api_token` + `crn` in Settings |

---

### 3 · Candidate Spotlight — CATALOG + CLASSICAL SCORES (bundled graph slice)

| Item | Status |
|---|---|
| Compound / disease | **Curated-first** catalog names (focal pair, same-disease / same-compound neighbors, then curated random pairs; synthetic placeholders only if the catalog cannot fill six slots). |
| Spotlight scores | **Real probabilities** — full-data logistic + GBM ensemble on the same 8-D catalog feature rows as §1 (`score_feature_rows_classical` in `ml/algorithms.py`). |
| Activation | When a completed job has both `AlgoResult` **and** `AlgoProbs` (`simulate_run`); otherwise legacy RNG scaffold (`Synth-…`). |
| Evidence matrix / paths | Still synthetic scaffolding (unchanged). |
| UMAP embedding coords | Real UMAP of candidate feature rows when `umap-learn` is installed (catalog or hash fallback). |

**Next:** Rank by true DWPC / path evidence from the full Hetionet export (not only catalog neighborhoods), and optionally align the scoring head with the headline family (hybrid kernel) instead of the shared classical head.

---

### 4 · Trust Scorecard — MIXED (literature baseline + catalog / optional OpenTargets)

| Axis | Status | Source |
|---|---|---|
| model | ● Real | `base.pr_auc + 0.05` (disclosed offset) |
| artifact | ◐ Semi-real | Pass rate of integrity guards (7 real + 16 RNG) |
| clinical | ◐ Semi-real | **Default:** deterministic proxy from bundled catalog (FDA flag, therapeutic class vs disease category). **Optional:** OpenTargets drug↔disease clinical-stage evidence when `HETQML_TRUST_OPENTARGETS=1` (public GraphQL; cached per selection). |
| mechanism | ◐ Semi-real | **Default:** gene vs disease category heuristics from catalog. **Optional:** OpenTargets MOA gene match + target–disease association slice when `HETQML_TRUST_OPENTARGETS=1`. |
| baseline | ● Real | Headline PR-AUC ÷ published Hetionet metapath AUROC anchors (Himmelstein et al., eLife 2017), keyed by metaedge code — `trust_axes.baseline_axis_value` |

**Implementation:** `apps/api/src/hetqml_api/trust_axes.py`; `jobs/runner.py::_trust` wires real ML runs to `compute_trust_extras`. RNG scaffolding remains only when `algo is None` (synthetic job path).

**Next:** Richer mechanism (curated GO / pathway overlap), ClinicalTrials.gov trial counts, and DOID→EFO mapping tables so OpenTargets hits survive rare disease strings without relying on substring fallbacks.

---

### 5 · Integrity Guards — MIXED (7 real / 16 RNG)

**Real-asserted (7):**

| Guard | Assertion |
|---|---|
| `calibration` | `ECE < 0.10` |
| `random-baseline` | `PR-AUC > prevalence` |
| `dwpc-baseline` | `PR-AUC > 0.35` (Himmelstein 2017 Hetionet baseline) |
| `provenance` | Always passes (job hash matches selection) |
| `bootstrap-ci` | `bootstrap_cis is not None` and CI width `< 0.15` |
| `shot-budget` | Quantum-only: `algo.shots >= 512` |
| `kernel-spread` | Quantum-only: `algo.fidelity > 0.5` |

**Still RNG-seeded (16, labeled SIM in UI):**

| Guard | Why still synthetic |
|---|---|
| `ancestry-balance`, `equity-flag` | Need sample-level ancestry metadata not in feature matrix |
| `hard-negatives` | Need curated negative compound-disease pairs |
| `feature-leakage` | Label-collision check not yet implemented |
| `lodo`, `loco` | Require additional leave-one-out CV runs |
| `multi-seed` | Requires re-running with different RNG seeds |
| `reviewer-blind` | Workflow property, no ML assertion possible |
| `time-split` | Feature matrix has no temporal metadata |
| `unit-tests` | CI-asserted, not runtime-asserted |
| Others (7) | Require infrastructure or external metadata not yet available |

---

### 6 · Statistical Comparison — MIXED (McNemar where OOF pairs exist)

| Item | Status |
|---|---|
| Δ PR-AUC (stacked OOF) | ● Real for **vs best classical** (hybrid/quantum) and **vs random predictor** — `average_precision_score` on concatenated CV hold-out labels vs headline or reference probs |
| Δ PR-AUC (hardcoded refs) | ◐ Semi-real — **vs best hybrid / vs best quantum / vs DWPC** still use fixed reference PR anchors for Δ only (no second model’s OOF probs in-repo yet) |
| p-values | ● Real (exact McNemar, two-sided binomial on discordant pairs) for **vs best classical** when `oof_probs_classical` is present (`AlgoProbs`, hybrid/quantum runs) and for **vs random predictor** (headline vs naive constant-at-prevalence probabilities, same OOF stack) |
| p-values (other rows) | ○ Synthetic — same RNG scaffold as before until those baselines expose paired OOF predictions |
| Effect sizes | ● Real — Richardson `(b−c)/(b+c)` on McNemar discordant pairs for the two real rows; **`|Δ| × 4.5`** placeholder only for the three synthetic p-value rows |

**Implementation:** `ml/paired_stats.py` (McNemar + AP); `ml/algorithms.py` runs a second classical CV pass on the **same** `FeatureMatrix` and folds as the QK-SVC headline and stores `oof_probs_classical` on `AlgoProbs`; `jobs/runner.py` `_stat_comparison` consumes it.

**Next:** Add OOF probability vectors for additional baselines (e.g. a true DWPC ranker head) so the remaining rows can drop the RNG p-values.

---

### 7 · Persistence

| Store | Backend | Survives restart? |
|---|---|---|
| Decision history | SQLite (`persistence/sqlite.py`) | ✓ Yes |
| Settings / profile | SQLite | ✓ Yes |
| Job results | SQLite **`SqliteJobStore`** (`main.py` → `open_connection` + `init_schema`) | ✓ Yes |
| Preregistration docs | SQLite | ✓ Yes |

**Production / `create_app`:** `SqliteJobStore` shares `app.state.sqlite_conn` with `SqliteDecisionStore`, `SqliteNoteStore`, `SqliteSettingsStore`, etc. Jobs survive `uvicorn --reload` and process restarts as long as `DATA_DIR` / `sqlite_filename` point at the same file (defaults under `apps/api/.data/`).

**Tests:** `tests/test_sqlite_job_store.py` covers create/list/get/update and reconnect survival. `tests/test_app_job_store_wiring.py` asserts the **default** app factory attaches `SqliteJobStore` (not in-memory). `tests/conftest.py` replaces `app.state.job_store` with `InMemoryJobStore` for the async `client` fixture so route tests stay fast; `test_preregistration.py` also builds an in-memory store in isolation. **`InMemoryJobStore`** remains in `jobs/store.py` as a test harness only — it is **not** used in the live `create_app` path.

---

### 8 · UMAP Embedding

`_embedding()` in `runner.py` tries `umap-learn` first; falls back to hash-based coordinates silently when the import fails.

**Current state:** With `umap-learn` installed (`cd hetqml-fullstack/apps/api && uv sync`), the runner uses a real UMAP projection of candidate feature rows. Commit `uv.lock` so CI and fresh clones get the dependency.

```bash
cd hetqml-fullstack/apps/api && uv sync
```

With 6 candidates and `n_neighbors=5`, UMAP will produce a meaningful 2D layout of the synthetic feature space. Positions will differ between runs with different compound/disease selections.

---

### 9 · IBM Quantum Integration

- Path is fully plumbed in `_qk_kernel_hardware()` via `qiskit-ibm-runtime`.
- Requires `api_token` and `crn` (Cloud Resource Name) set in Settings → IBM Connection.
- Without credentials the quantum family falls back to the local Aer simulator and `used_real_hardware=False` is set — the UI labels the run accordingly.
- The hybrid and quantum families are identical in practice (same ZZFeatureMap + kernel SVC) except for which backend computes the Gram matrix.

---

## Recommended Next Steps (by research-paper impact)

| Priority | Task | Effort |
|---|---|---|
| 1 | `uv sync` under `apps/api` (installs `umap-learn`; lockfile committed) | Done |
| 2 | Land observability, preregistration, e2e harness, ORCID/decision wiring | Done when merged |
| 3 | Pairwise DWPC / integrated scores from full Hetionet graph (replace catalog row builder) | 1–2 weeks |
| 4 | Replace synthetic candidates with real (compound, disease) pairs from graph query | Partially done — catalog slice + classical scores; full DWPC graph query remains |
| 5 | Job persistence: SQLite prod wiring + tests + doc (§7 / `test_app_job_store_wiring`) | Done |
| 6 | McNemar p-values on stacked OOF (vs classical + vs naive prevalence); extend to more baselines | Partial — hybrid/quantum + naive row done |
| 7 | Trust axes: literature baseline + catalog proxies; optional OpenTargets (`HETQML_TRUST_OPENTARGETS`) | Partial — GO / ClinicalTrials still future |
| 8 | Remaining integrity guards (ancestry, leakage, hard-negatives) | 2–4 weeks |

---

## What Can Be Cited in a Paper Now

- **Can cite (catalog mode):** CV methodology, calibration, bootstrap CIs, and that feature rows include **published Hetionet v1.0 metaedge totals** and curated catalog identifiers. Do **not** claim per-compound–disease DWPCs without the pairwise table.
- **Cannot cite:** Fine-grained repurposing effect sizes from DWPCs not yet in this repo. Trust scorecard **clinical / mechanism** as standalone clinical-trial or GO evidence unless `HETQML_TRUST_OPENTARGETS=1` and you disclose the OpenTargets slice used. Statistical comparison **p-values for vs hybrid / vs quantum / vs DWPC** (still RNG placeholders). Spotlight ranking as **Neo4j-derived path evidence** (it is catalog-neighborhood + classical head scores, not DWPC edge queries). Synthetic evidence matrix / paths.
- **May cite with disclosure:** Trust **baseline** spoke as a ratio vs published Hetionet metapath AUROC anchors (`trust_axes.py`). McNemar p-values for **vs best classical** and **vs random predictor** (`ml/paired_stats.py`).
- **Must disclose:** Synthetic mode when enabled; in catalog mode, disclose that edge totals are graph-level aggregates, not per-pair path counts from a live Neo4j pull.
