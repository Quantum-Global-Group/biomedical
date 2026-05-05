---
title: Hetionet QML — lite
emoji: 🧬
colorFrom: gray
colorTo: yellow
sdk: static
app_file: static/index.html
pinned: false
license: mit
---

# Hetionet QML — lite (Hugging Face Space)

Static export of the [hetqml-web](https://github.com/Quantum-Global-Group/biomedical) Next.js dashboard,
deployed to Hugging Face Space as `sdk: static`.

This Space surfaces the **research-narrative shell**: Initialize → Experiment
→ Validate, with mock data so visitors can click through the workflow end-to-end.
The full version (live FastAPI, IBM Quantum BYOK, decision audit log,
Visualize 3D panels) lives in the project's Fly.io deployment.

## Two render modes (sidebar toggle)

| Mode | What you see |
|---|---|
| **Demo** (default) | Inaxaplin → Hypertension-attributed ESKD walkthrough; mock leaderboard topped by "Quantum Kernel + Metapath" PR-AUC 0.827 |
| **Headline** | Hetionet CtD methodology study — the project's preregistered five-row panel (Stacking ensemble (Pauli) PR-AUC 0.7987 → QSVC 0.7216) with H1/H1b/H2/H3 decision-rule status and § citations on every Trust Scorecard axis |

## What's locked out vs the full version

- **Operations** and **Settings** routes show a "live-only" panel — no
  platform health, no IBM Quantum BYOK, no decision history.
- **Validate** Reviewer-Decision panel and Skeptic-Notes editor are
  display-only (no backend to persist Keep/Review/Reject).
- **Visualize** is a placeholder — the 3D molecule / KG / UMAP / quantum
  kernel circuit panels are migration-in-progress for both the full and
  lite versions.

## Build

From the repo root:

```bash
pnpm --filter hetqml-web export:hf
```

Builds with `BUILD_TARGET=lite` (`output: "export"`, `NEXT_PUBLIC_LITE_MODE=true`)
and copies `apps/web/out/` → `apps/web/hf_space/static/`. Push the
contents of `hf_space/` to the configured HF Space repo.

## Source

GitHub: [Quantum-Global-Group/biomedical](https://github.com/Quantum-Global-Group/biomedical) · branch `roc/preregistration-tighten`

Preregistration (sibling repo): `hybrid-qml-kg-poc/preregistration/osf_preregistration_v1.md` §1.3 + §8.1
