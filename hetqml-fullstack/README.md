# hetqml-fullstack

Next.js (web) + FastAPI (api) port of `hetqml-pages/`. Deploys as two Fly apps in one organization.

## Layout

```
apps/web   Next.js 14 App Router, TypeScript, Vitest
apps/api   FastAPI, Python 3.12, uv, pytest
```

## Local development

Two terminals:

```sh
pnpm install            # at the repo root
pnpm dev:web            # http://localhost:3000

cd apps/api && uv sync  # one-time
pnpm dev:api            # binds 0.0.0.0:8000 (reachable from LAN / WSL port-forward quirks)
```

The web app reads `NEXT_PUBLIC_API_URL` (browser) and `API_INTERNAL_URL` (server). Copy `apps/web/.env.example` to `apps/web/.env.local`.

**IBM “Validate connection” shows “Failed to fetch”?** Usually the browser never reached FastAPI (`pnpm dev:api`, wrong URL, or CORS hostname). With **Windows browser + uvicorn on WSL2**, **`localhost:8000` in the JS fetch hits Windows**, not Linux — **`next dev` defaults to proxying `/__hetqml_api → 127.0.0.1:8000`** so reload the web app after `pnpm install` pulls that behavior. Override with **`NEXT_PUBLIC_DISABLE_DEV_API_PROXY=true`** only if localhost port-forwarding already works end-to-end. For a LAN IP origin, extend **`ALLOWED_ORIGINS`** on the API.

### IBM Quantum hardware runs (`family: quantum`)

- Save **API token + CRN** in **Settings** (same instance you open in the IBM Quantum Platform). The runner uses **`channel=ibm_quantum_platform`**, your **CRN as `instance=`**, and **`Settings → Pipeline/Quantum → Default backend`** (`defaultBackend`, e.g. `ibm_torino`) when picking the QPU (falls back to **least_busy** real hardware if that name is unavailable).
- After a hardware job, check **uvicorn logs** for `IBM Quantum kernel:` (backend, circuit count, **`runtime_job_id`**) and the job **result notes** for **“IBM Runtime job id (Workloads UI)”** — search that id in **Quantum Platform → Workloads**. Clear console filters (instance / region / user) if you do not see it.
- Optional API env: **`HETQML_QUANTUM_HW_SAMPLES`** (integer, min **25**, max **60**) caps how many rows feed the QK Gram matrix on **IBM only**, reducing circuit count for a smaller smoke run.

## Tests

```sh
pnpm test               # both
pnpm test:web           # vitest
pnpm test:api           # pytest
```

## Deploy

Two Fly apps, same organization, talking over Fly 6PN private networking:

- `hetqml-web` — public, reads `API_INTERNAL_URL=http://hetqml-api.internal:8000` from server code, exposes `NEXT_PUBLIC_API_URL=https://hetqml-api.fly.dev` to the browser.
- `hetqml-api` — public for browser fetches; CORS locked to `https://hetqml-web.fly.dev` and `http://localhost:3000`.

From **`hetqml-fullstack/`** (monorepo root). Deploy **from each app directory** so Fly loads that folder’s `fly.toml` and Docker’s build context is the app (not the monorepo root). Using `fly deploy ./apps/api --config apps/api/fly.toml` can make `flyctl` resolve `--config` relative to `./apps/api`, look for `apps/api/apps/api/fly.toml`, miss the real file, then error with “missing app name”.

```sh
# First-time app setup (once per Fly app)
( cd apps/api && fly launch --no-deploy --copy-config )
( cd apps/web && fly launch --no-deploy --copy-config )

# Deploy — cwd = app package (correct Docker context + fly.toml)
( cd apps/api && fly deploy )

( cd apps/web && fly deploy --build-arg NEXT_PUBLIC_API_URL=https://hetqml-api.fly.dev )
```

## What's wired vs. stubbed

- **Initialize** — fully wired. Cascade-filtered comboboxes, recommendation card, run-path chooser, `POST /investigations/run` + polling on `GET /jobs/{id}`.
- **Experiment, Validate, Visualize, Operations, Settings** — stubs that link back to the corresponding page in `../hetqml-pages/`.

See [docs/porting-notes.md](docs/porting-notes.md) for what came from `hetqml-pages/` and what was rewritten.
