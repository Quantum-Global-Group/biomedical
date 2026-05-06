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

**Default HF export (`pnpm export:hf`) talks to Fly:** Settings → PUT/ibm-validate/smoke and Operations poll **`https://hetqml-api.fly.dev`** (`NEXT_PUBLIC_LITE_REMOTE_API=true` baked into the bundle). Initialization / Experiment / Validate still mock catalog narratives where the full app isn’t wired in lite.

---

## Offline demo build (fixtures only — no Fly)

Use when you intentionally want **browser-only IBM + Operations fixtures** (`localStorage`, DEMO badges, no Refresh):

```bash
cd hetqml-fullstack/apps/web
pnpm export:hf:demo
```

Then copy `hf_space/static/` into the Docker image as usual.

---

## Two render modes (sidebar toggle)

| Mode | What you see |
|------|----------------|
| **Demo** (default) | Inaxaplin → Hypertension-attributed ESKD walkthrough; mock leaderboard topped by "Quantum Kernel + Metapath" PR-AUC 0.827 |
| **Headline** | Hetionet CtD methodology study — the preregistered five-row panel (Stacking ensemble (Pauli) PR-AUC 0.7987 → QSVC 0.7216) with H1/H1b/H2/H3 decision-rule status and § citations on every Trust Scorecard axis |

---

## Locked out vs Hetionet Full (lite remains lite)

- **Validate** reviewer-decision panel + Skeptic-Notes editor remain **display-only** (nothing persists for decisions).
- **Visualize** is still a lite placeholder — no heavy 3D / circuit panels in this export.

IBM validate, smoke test, Operations feeds, and **Refresh feeds** mirror Full **once** `export:hf` + deployed API CORS below are aligned.

---

## Build and publish

From the **biomedical** repo (branch `roc/preregistration-tighten` or your release):

### Default (**linked Fly API** — prod Space)

```bash
pnpm --filter hetqml-web export:hf
```

This runs lite `next build` with **`NEXT_PUBLIC_LITE_REMOTE_API=true`** + **`NEXT_PUBLIC_API_URL=https://hetqml-api.fly.dev`**, copies `apps/web/out/` → `apps/web/hf_space/static/`.

Override the API URL for a fork:

```bash
cd hetqml-fullstack/apps/web
BUILD_TARGET=lite NEXT_PUBLIC_LITE_REMOTE_API=true NEXT_PUBLIC_API_URL=https://your-api.example next build \
  && rm -rf hf_space/static && mkdir -p hf_space/static && cp -r out/. hf_space/static/
```

Deploy the **HetQML API** on Fly **with updated CORS** (see `apps/api`): browser origins **`*.hf.space`** and **`https://huggingface.co`** are allowed via `allow_origin_regex`. Add **`ALLOWED_ORIGINS`** entries if your Space uses a different host.

Push **`hetqml-fullstack/apps/web/hf_space/`** (with generated `static/`) to your Space repo, then Docker build:

```bash
cd hetqml-fullstack/apps/web/hf_space
docker build -t hetionet-lite .
docker run --rm -p 7860:7860 hetionet-lite
```

`static/` is **gitignored** in-repo and produced only by `export:hf` / `export:hf:demo`.

Alias: **`pnpm export:hf:linked`** is identical to **`export:hf`**.

---

## Hugging Face Git remote

```bash
git clone https://huggingface.co/spaces/quantumGlobalGroup/Hetionet-Lite
# copy refreshed hf_space/ contents into the clone, commit, push (use an HF token as the Git password)
```

Or use the Hub CLI: `uv tool install hf` then `hf download quantumGlobalGroup/Hetionet-Lite --repo-type=space` for an initial sync.

### GitHub Actions (recommended)

`static/` is **not** tracked on GitHub, so clones never contain the exported bundle. Either run `export:hf` manually before copying into the Space repo, or use CI:

1. Repository **secret** **`HF_TOKEN`**: Hugging Face token with write access to the Space (`Settings → Secrets and variables → Actions`).
2. Optional **variable** **`HF_SPACE_REPO_ID`**: default `quantumGlobalGroup/Hetionet-Lite`.

Workflow **`.github/workflows/huggingface-hetionet-lite.yml`** at the biomedical repo root runs **`pnpm --filter hetqml-web export:hf`** then `scripts/sync_hf_space_lite.py` (same as running it locally).

**Triggers:** `workflow_dispatch`, or push to **`main`** or **`roc/preregistration-tighten`** when `hetqml-fullstack/apps/web/**` or the workflow / sync script changes (drop **tighten** from the workflow after it merges to **main**).

Locally after export:

```bash
export HF_TOKEN=hf_***
python3 scripts/sync_hf_space_lite.py
```

---

## Source

**GitHub:** [Quantum-Global-Group/biomedical](https://github.com/Quantum-Global-Group/biomedical) · branch `roc/preregistration-tighten`

**Preregistration** (sibling repo): `hybrid-qml-kg-poc/preregistration/osf_preregistration_v1.md` §1.3 + §8.1
