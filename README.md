# Biomedical — HetQML workspace

This repository holds **HetQML** (Hetionet-informed quantum / hybrid ML workflow UI) as two related trees:

| Directory | Role |
|-----------|------|
| [`hetqml-fullstack/`](hetqml-fullstack/) | Editable **Next.js** web app + **FastAPI** API — local dev, tests, Fly.io deploys. |
| [`hetqml-pages/`](hetqml-pages/) | **Static export** of the UI (prerendered HTML + `_next` bundles) for lightweight hosting or UX reference. |

Start with the README in each folder for commands, routes, and deployment detail.

## Quick start — full stack

From `hetqml-fullstack/`:

```bash
pnpm install
pnpm dev:web          # default http://localhost:3000
```

With the API (second terminal):

```bash
cd apps/api && uv sync    # one-time
pnpm dev:api              # default port 8000
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and set `NEXT_PUBLIC_API_URL` / `API_INTERNAL_URL` as documented in [`hetqml-fullstack/README.md`](hetqml-fullstack/README.md). Optional: `HETQML_WEB_PORT` and `HETQML_API_PORT` for alternate ports.

## Quick start — static pages

Serve **`hetqml-pages/` as the HTTP document root** (not the repo parent). Absolute asset paths such as `/_next/static/...` break under `file://` or the wrong base URL.

```bash
cd hetqml-pages
python3 -m http.server 8080
# open http://localhost:8080
```

See [`hetqml-pages/README.md`](hetqml-pages/README.md) for routes and page-level behavior.

## Agent / contributor notes

Cursor and automation guidance for this workspace lives in [`AGENTS.md`](AGENTS.md) (serving rules, lite vs full builds, Fly deploy cwd, static `assets/` enhancement pattern, and related conventions).

## Requirements (typical)

- **Full stack:** Node 18+ (repo uses pnpm 9), Python 3.12 + [uv](https://docs.astral.sh/uv/) for the API.
- **Static only:** Python 3 or any static file server (`npx serve`).
