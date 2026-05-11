# HetQML / biomedical — prioritized backlog

Consolidated from READMEs, `hetqml-fullstack/docs`, grep, and honesty/verification audits. Use this to drive issues and finish remaining work.

**Primary references**

- `hetqml-fullstack/README.md`
- `hetqml-fullstack/docs/porting-notes.md`
- `hetqml-fullstack/docs/upgrades-in-progress.md` (especially §7)
- `hetqml-pages/README.md`
- `hetqml-fullstack/apps/web/hf_space/README.md`
- `AGENTS.md` (workspace conventions; Initialize parity notes)

**Note:** There is no repo-root `README.md` in this workspace; narrative lives under `hetqml-fullstack/` and `hetqml-pages/`.

---

## Grep summary (task markers)

| Scope | Pattern | Result |
|--------|---------|--------|
| `hetqml-fullstack/` | `\b(TODO\|FIXME\|XXX\|HACK)\b` in `*.{ts,tsx,js,jsx,py,md}` | **0 matches** |
| `hetqml-fullstack/pnpm-lock.yaml` | substring `XXX` | **1 line** — integrity hash noise, not a task marker |
| `hetqml-pages/` | same pattern in `*.{js,html,md}` | **0 task markers** (`visualize-panels.js` uses `"TODO` as a **UI glyph label**, not a dev TODO) |

---

## 1. Must-fix / correctness

- **Synthetic / stub ML path vs publication claims:** `hetqml-fullstack/docs/porting-notes.md` still describes the runner as deterministic stub; `apps/api/src/hetqml_api/jobs/runner.py` and `ml/features.py` retain synthetic/feature-placeholder behavior; `docs/upgrades-in-progress.md` §7 lists **real Hetionet features**, **hard negatives**, **real fidelity**, **Pauli/stacking** — until done, headline metrics and baseline conjunction logic are **not** fully honest vs preregistration text.
- **Quantum fidelity:** `run_quantum` / `ml/algorithms.py` — **placeholder fidelity** (`0.985`) called out as needing real backend reads (`docs/upgrades-in-progress.md` §7).
- **Catalog honesty:** v1 catalogs are **seeded subsets**, not full 137/1552/20945 sets — replace when FastAPI serves real reference data (`docs/porting-notes.md`, “Not ported”).
- **Lite offline paths:** `apps/web/src/app/settings/SettingsClient.tsx` documents **lite stub** for IBM validate when there is no FastAPI — risk of users thinking validation succeeded when it did not.
- **Preregistration API:** v1 stub still **pending** parsing — decisions about “captured” vs real narrative (`apps/api/src/hetqml_api/routers/preregistration.py`, `apps/api/tests/test_preregistration.py`).

---

## 2. Verification / QA gaps

- **Playwright / E2E:** No `playwright.config` or E2E specs in-repo; `@playwright/test` may appear only via lockfile — add smoke flows (Initialize → job → Experiment / Validate) when ready.
- **Single `verify` script:** Root has `scripts/sync_hf_space_lite.py`; `hetqml-fullstack/package.json` has `test`, `test:web`, `test:api` — **no** unified `verify` wrapping lint + both suites + typecheck (optional repo-root or fullstack script).
- **Request trace IDs:** Treat as **open** unless implemented under another name (propagate request id UI ↔ API for support/audit).
- **Golden numeric snapshots / real `AlgoResult` / non-synthetic CI:** Tracked as **bootstrap CI on DGX**, GPU artifact, and `/preregistration/status` `gpuRunComplete` wiring (`docs/upgrades-in-progress.md` §7, “Bootstrap CI artifact”).
- **IBM workload / cache verification:** **PubChem cache GC**, **per-job timeout** for hardware queue hangs (`docs/upgrades-in-progress.md` §7); operators confirm jobs in **IBM Workloads UI** (`hetqml-fullstack/README.md`).

---

## 3. Product / UX parity (lite vs full, static vs Next)

- **Five Next routes as stubs** linking to static export: Experiment, Validate, Visualize, Operations, Settings (`hetqml-fullstack/README.md`, `StubPage.tsx`, `porting-notes.md`).
- **Initialize vs static reference (`hetqml-pages` on :8080):** Documented gaps — live KG **placeholder** (no 3D/WebGL), **subset** of 32 algorithms, evidence guards **not** full 23-guard catalog (`docs/porting-notes.md`); see `AGENTS.md` for cascade parity expectations.
- **Static `hetqml-pages`:** Visualize described as **placeholder** (no full 3D port) (`hetqml-pages/README.md`).
- **Lite (HF):** Validate reviewer panel **display-only**; Visualize **lite placeholder**; mock narratives where full app not wired; linked Fly API for IBM/Ops when exported (`apps/web/hf_space/README.md`).
- **Unported static asset modules:** `benchmark-suite.js`, `session-resourcefulness.js`, `visualize-panels.js` — port when those surfaces are fully built in Next (`docs/porting-notes.md`).

---

## 4. Docs / ops

- **Fly deploy:** cwd inside each app; build-args for `NEXT_PUBLIC_*`; CORS / proxy / WSL notes (`hetqml-fullstack/README.md`).
- **HF Space:** `export:hf`, `static/` gitignored, CORS for `*.hf.space`, sync script + workflow (`apps/web/hf_space/README.md`, `scripts/sync_hf_space_lite.py`).
- **Roadmap / punch list:** `docs/upgrades-in-progress.md` §7 (algorithms, quantum, service, reproducibility docs).

---

## 5. Nice-to-have

- **Rename `benchmark-status-live`** to a neutral class — used in `BenchmarkSuitePanel.tsx`, `apps/web/src/styles/hetqml-export.css`, `hetqml-pages/assets/benchmark-suite.js`.
- **OpenAPI round-trip** in CI (`docs/upgrades-in-progress.md` §7).
- **OSF amendments log stub**, **DGX doc cross-links**, **IBM Torino runbook** placeholders (`docs/upgrades-in-progress.md` §7).

---

## Honesty / labeling work already landed (context)

Recent UX and API work aligned disclosure with behavior (keep in mind when extending):

- Embedding scatter copy vs UMAP; `JobResult.embedding` docs; `rowStatus` **RUN**/**SIM** on leaderboard rows from API when `AlgoResult` is spliced vs synthetic harness; benchmark suite **SIM** status; **Data fidelity** callouts on Experiment / Visualize; static `visualize-panels.js` demo wording; `EXPECTED_JOB_RESULT_KEYS` contract in API tests.

Remaining honesty debt is mostly **ML/catalog/backend truth** (§1 above), not just UI labels.

---

## Suggested next actions

1. Copy §7 bullets from `docs/upgrades-in-progress.md` into your tracker and **dedupe** against `docs/porting-notes.md` parity list.
2. Tackle **§1 correctness** items before expanding marketing or preregistration claims.
3. Add **one** verification vertical (Playwright smoke **or** unified `verify` script **or** trace IDs), then iterate.

---

## Executive summary

READMEs and `docs/porting-notes.md` define a **large parity and stub surface** (stub routes, Initialize KG/algorithms/evidence gaps). `docs/upgrades-in-progress.md` §7 is the richest **correctness / ML / ops** backlog. Grep shows **no conventional TODO/FIXME** markers in TS/TSX/JS/Py/Md under fullstack; verification gaps (**E2E, unified verify, trace IDs, golden CI**) remain **process** items rather than inline comments.
