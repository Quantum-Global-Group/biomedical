# Hetionet QML — static page snapshot

This folder is a static export of the `hetqml-next-full` Next.js app. Every route
is prerendered as plain HTML with the React bundle attached. Six pages:

| Route          | Path                       |
|----------------|----------------------------|
| 01 Initialize  | `initialize/index.html`    |
| 02 Experiment  | `experiment/index.html`    |
| 03 Validate    | `validate/index.html`      |
| 04 Visualize   | `visualize/index.html`     |
| 05 Operations  | `operations/index.html`    |
| 06 Settings    | `settings/index.html`      |

Root `index.html` redirects to `/initialize/`.

## Why you can't just double-click `index.html`

The bundled scripts and CSS are referenced with absolute paths
(`/_next/static/...`). Under `file://` the browser resolves those paths against
the filesystem root, not this folder, so nothing loads. Run any tiny static
server and the paths resolve correctly.

## Easiest way to view

Pick whichever you have:

**Python** (almost always installed):
```
cd "C:\Users\Jon B\Downloads\hetqml-pages"
python -m http.server 8080
```
then open <http://localhost:8080>.

**Node / npx** (you have it via WSL):
```
cd "/mnt/c/Users/Jon B/Downloads/hetqml-pages"
npx --yes serve -l 8080 .
```
then open <http://localhost:8080>.

**PowerShell one-liner** (no install needed if Python is on PATH):
```
.\serve.cmd
```
which just wraps `python -m http.server 8080`.

## What's in each page

- **01 Initialize** — searchable comboboxes for disease / compound / anchor
  gene / metaedge with category-pill filters, candidate context with
  `.ctx-tag` / `.ctx-row-rich` styling, run-path catalog, live 3D KG preview,
  evidence posture (23-guard accordion across 6 groups), session card / list.
- **02 Experiment** — metric strip, source check, model leaderboard,
  detailed metrics with 5-fold CV bars, candidate spotlight, scientific
  quality controls.
- **03 Validate** — 4-card metric strip, trust-scorecard radar (5 axes),
  reliability diagram with calibration plot, reviewer decision panel,
  skeptic notes, decision history.
- **04 Visualize** — placeholder stub (3Dmol.js / Three.js / UMAP /
  ZZFeatureMap not yet ported from `dashboard_live.html`).
- **05 Operations** — system health, IBM Quantum backends, active job queue,
  resource utilization, cost / budget, data sources, alerts.
- **06 Settings** — profile, appearance, pipeline defaults, quantum
  preferences, notifications, privacy, IBM connection, API keys, keyboard
  shortcuts, about.

## Source

The pages here come from `C:\Users\Jon B\Downloads\hetqml-next-full\` (Next.js
14 App Router). To rebuild:
```
cd "C:\Users\Jon B\Downloads\hetqml-next-full"
npm run build         # writes a fresh ./out folder
```
