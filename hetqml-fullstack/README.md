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
pnpm dev:api            # http://localhost:8000
```

The web app reads `NEXT_PUBLIC_API_URL` (browser) and `API_INTERNAL_URL` (server). Copy `apps/web/.env.example` to `apps/web/.env.local`.

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

```sh
fly launch --no-deploy --copy-config --config apps/api/fly.toml
fly launch --no-deploy --copy-config --config apps/web/fly.toml
fly deploy --config apps/api/fly.toml
fly deploy --config apps/web/fly.toml
```

## What's wired vs. stubbed

- **Initialize** — fully wired. Cascade-filtered comboboxes, recommendation card, run-path chooser, `POST /investigations/run` + polling on `GET /jobs/{id}`.
- **Experiment, Validate, Visualize, Operations, Settings** — stubs that link back to the corresponding page in `../hetqml-pages/`.

See [docs/porting-notes.md](docs/porting-notes.md) for what came from `hetqml-pages/` and what was rewritten.
