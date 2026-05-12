# HetQML Pipeline Status — What's Real vs Synthetic

**Last updated:** 2026-05-12 (repo hygiene: umap lockfile, persistence doc, ORCID/types)
**Branch:** main (pipeline doc tracks behaviour, not a fixed SHA)

---

## Executive Summary

The dashboard runs a genuine ML cross-validation pipeline (classical, hybrid-quantum, IBM-Quantum) on a **deterministic synthetic feature matrix**. All statistical outputs — fold scores, calibration bins, bootstrap CIs, Brier score, ECE — are mathematically real computations, but they operate on Gaussian noise rather than actual Hetionet metapath features. Every synthetic value in the UI is labeled with a provenance pill (● real / ○ synthetic); no synthetic number is presented without disclosure.

---

## Layer-by-Layer Status

### 1 · Feature Data — SYNTHETIC (highest priority for a paper)

| Item | Status |
|---|---|
| `build_features()` in `ml/features.py` | Gaussian RNG seeded by selection hash — **not real Hetionet data** |
| 8 feature names (`metapath_CbGaD`, `ecfp_density`, …) | Cosmetic labels only; values are `rng.multivariate_normal()` |
| `build_features_for_candidates()` | Same synthetic construction per candidate pair; used only to seed UMAP |

**Impact:** Every downstream metric (PR-AUC, calibration, bootstrap CI) is statistically valid but scientifically empty until `build_features()` is replaced with real Hetionet metapath feature extraction.

**To fix:** Swap `build_features()` with a loader that pulls DWPC/metapath counts + PubChem/molecular descriptors from the Hetionet graph, keyed on `(compound, disease, gene, metaedge)`. The downstream scorers are agnostic to the data source.

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

### 3 · Candidate Spotlight — SYNTHETIC

| Item | Status |
|---|---|
| Compound names | `Synth-XXXXX` — random integers, not real DrugBank/PubChem IDs |
| Disease | Real selection ID passed through |
| Spotlight scores | `base.pr_auc − 0.02 × rank + rng jitter` |
| Evidence matrix cells | Random states from `["live", "fallback", "supports", "weakens"]` |
| Evidence paths | Synthetic step chains; no real Hetionet traversal |
| UMAP embedding coords | Real UMAP of synthetic feature vectors (meaningful structure, not real biology) |

**To fix:** Replace `_candidate_spotlight()` with a real drug repurposing ranking that queries the Hetionet graph for (compound, disease) pairs connected via the selected metaedge, scored by the trained model's predicted probability on each pair's real feature vector.

---

### 4 · Trust Scorecard — MIXED

| Axis | Status | Source |
|---|---|---|
| model | ● Real | `base.pr_auc + 0.05` (disclosed offset) |
| artifact | ◐ Semi-real | Pass rate of integrity guards (7 real + 16 RNG) |
| clinical | ○ Synthetic | `0.55 + 0.40 × rng.random()` |
| mechanism | ○ Synthetic | `0.55 + 0.40 × rng.random()` |
| baseline | ○ Synthetic | `0.50 + 0.45 × rng.random()` |

**To make synthetic axes real:**
- `clinical`: OpenTargets / ClinicalTrials.gov association score for the compound-disease pair
- `mechanism`: Gene-ontology overlap between drug targets and disease pathways
- `baseline`: Published AURPC from the Himmelstein 2017 Hetionet paper for the same metaedge class

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

### 6 · Statistical Comparison — SYNTHETIC

| Item | Status |
|---|---|
| Δ (top model vs reference PR-AUC) | ● Real |
| p-values | ○ Synthetic — `sig_floor + rng.random() × 0.05` |
| Effect sizes | ○ Synthetic — `|Δ| × 4.5` (post-hoc scaling, not from a real test) |

**To fix:** McNemar's test or paired permutation test over the 5 CV folds comparing the top model against a classical baseline. Requires storing per-fold predictions for both the model and reference.

---

### 7 · Persistence

| Store | Backend | Survives restart? |
|---|---|---|
| Decision history | SQLite (`sqlite.py`) | ✓ Yes |
| Settings / profile | SQLite | ✓ Yes |
| Job results | SQLite (`SqliteJobStore` in `main.py`) | ✓ Yes |
| Preregistration docs | SQLite | ✓ Yes |

**Tests:** some API tests still construct `InMemoryJobStore` for isolation; the running FastAPI app uses `SqliteJobStore` with the same connection as decisions/settings.

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
| 3 | Replace `build_features()` with real Hetionet metapath feature loader | 1–2 weeks |
| 4 | Replace synthetic candidates with real (compound, disease) pairs from graph query | 1 week |
| 5 | ~~Wire `JobStore` to SQLite~~ — `SqliteJobStore` is live in `main.py` | Done |
| 6 | Real p-values via McNemar / permutation test over CV folds | 2–3 days |
| 7 | Clinical + mechanism trust axes from OpenTargets / GO overlap | 1–2 weeks |
| 8 | Remaining integrity guards (ancestry, leakage, hard-negatives) | 2–4 weeks |

---

## What Can Be Cited in a Paper Now

- **Can cite:** PR-AUC, ROC-AUC, Brier score, ECE, bootstrap 95% CIs, per-fold CV scores — all computed from real cross-validation over the synthetic feature matrix. The pipeline infrastructure, guard framework, and calibration methodology are all sound.
- **Cannot cite:** Any specific metric value as evidence of drug-repurposing signal, since the feature matrix is synthetic Gaussian data. Trust scorecard clinical/mechanism/baseline axes. Statistical comparison p-values. Candidate rankings or evidence paths.
- **Must disclose:** That feature data is a deterministic synthetic proxy for Hetionet metapath features, and that the dashboard is a pipeline prototype, not a validated repurposing engine.
