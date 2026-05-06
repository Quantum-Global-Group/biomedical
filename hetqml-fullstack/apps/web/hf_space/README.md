---
title: Hetionet Lite
emoji: 🧬
colorFrom: gray
colorTo: yellow
sdk: docker
pinned: false
license: mit
---

# Hetionet Lite (Hugging Face Space)

Docker Space serving the static export of the [hetqml-web](https://github.com/Quantum-Global-Group/biomedical) Next.js **lite** dashboard (`BUILD_TARGET=lite`, `NEXT_PUBLIC_LITE_MODE=true`). The container listens on **port 7860** (FastAPI + Uvicorn + static files).

This Space surfaces the **research-narrative shell**: Initialize → Experiment → Validate, with mock data so visitors can click through the workflow end-to-end. The full version (live FastAPI, IBM Quantum BYOK, decision audit log, Visualize 3D panels) uses the project’s Fly.io deployment.

## Two render modes (sidebar toggle)

| Mode | What you see |
|------|----------------|
| **Demo** (default) | Inaxaplin → Hypertension-attributed ESKD walkthrough; mock leaderboard topped by "Quantum Kernel + Metapath" PR-AUC 0.827 |
| **Headline** | Hetionet CtD methodology study — the preregistered five-row panel (Stacking ensemble (Pauli) PR-AUC 0.7987 → QSVC 0.7216) with H1/H1b/H2/H3 decision-rule status and § citations on every Trust Scorecard axis |

## What’s locked out vs the full version

- **Settings → IBM smoke test / live validation** calls FastAPI endpoints that are omitted in static export (`Validate connection` saves locally only; IBM panels on Operations remain fixtures).
- **Validate** reviewer-decision panel and Skeptic-Notes editor are display-only (no backend to persist Keep/Review/Reject).
- **Visualize** is a placeholder — the 3D molecule / KG / UMAP / quantum kernel circuit panels are migration-in-progress for both the full and lite versions.

## Build and publish

From the **biomedical** repo root (after checkout of `roc/preregistration-tighten` or your release branch):

```bash
pnpm --filter hetqml-web export:hf
```

This runs `next build` with lite flags and copies `apps/web/out/` → `apps/web/hf_space/static/`.

Then push the **contents** of `hetqml-fullstack/apps/web/hf_space/` to the Space repo (or build locally with `docker build` from that directory after `export:hf`).

```bash
cd hetqml-fullstack/apps/web/hf_space
docker build -t hetionet-lite .
docker run --rm -p 7860:7860 hetionet-lite
```

`static/` is required for the image build; it is intentionally **gitignored** in the monorepo and produced only by `export:hf`.

### Hugging Face Git remote

```bash
git clone https://huggingface.co/spaces/quantumGlobalGroup/Hetionet-Lite
# copy refreshed hf_space/ contents into the clone, commit, push (use an HF token as the Git password)
```

Or use the Hub CLI: `uv tool install hf` then `hf download quantumGlobalGroup/Hetionet-Lite --repo-type=space` for an initial sync.

## Source

**GitHub:** [Quantum-Global-Group/biomedical](https://github.com/Quantum-Global-Group/biomedical) · branch `roc/preregistration-tighten`

**Preregistration** (sibling repo): `hybrid-qml-kg-poc/preregistration/osf_preregistration_v1.md` §1.3 + §8.1
