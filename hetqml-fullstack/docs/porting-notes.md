# Porting notes

What came from `hetqml-pages/` and what was rewritten.

## Ported (logic preserved, idiom changed)

| `hetqml-pages` source | `hetqml-fullstack` destination | Notes |
|---|---|---|
| [assets/investigation-recommendations.js](../../hetqml-pages/assets/investigation-recommendations.js) — pure logic | [apps/web/src/lib/investigation/recommendations.ts](../apps/web/src/lib/investigation/recommendations.ts) | `evaluateInvestigation`, `getNextRecommendedField`, `allowedValuesForField`, `isOptionGuided`. Profiles + cascade order kept verbatim. |
| `assets/investigation-recommendations.js` — DOM hacks (MutationObserver, setTimeout against React-controlled inputs, `.combo-option` fallback handlers) | **Removed.** Replaced by [ParameterCombobox.tsx](../apps/web/src/components/investigation/ParameterCombobox.tsx) | We own the React tree now, so the cascade is a `useMemo` over `allowedValuesForField` and the "Guided / All" toggle is component state. |
| [assets/run-path-chooser.js](../../hetqml-pages/assets/run-path-chooser.js) — pure logic | [apps/web/src/lib/investigation/runPath.ts](../apps/web/src/lib/investigation/runPath.ts) | `RUN_PATH_MODES`, `RUN_PATH_FAMILIES`, `getRunPathSelection`. |
| `assets/run-path-chooser.js` — `localStorage` persistence | [SessionPanel.tsx](../apps/web/src/components/initialize/SessionPanel.tsx) + [lib/sessions/storage.ts](../apps/web/src/lib/sessions/storage.ts) | Snapshots store `selection` + `runPath` under `hetqml.sessions`. |

## Initialize UI parity (Next vs `hetqml-pages` static)

- **Styles:** [hetqml-export.css](../apps/web/src/styles/hetqml-export.css) is copied from the static export bundle; [legacy-overrides.css](../apps/web/src/styles/legacy-overrides.css) holds small a11y/layout patches.
- **Shell:** [AppShell.tsx](../apps/web/src/components/shell/AppShell.tsx) + [Sidebar.tsx](../apps/web/src/components/shell/Sidebar.tsx) mirror fixed sidebar, collapse (`body.sidebar-collapsed`), brand, nav structure, theme row, status bar.
- **Layout:** Initialize uses three `.grid-7-5` rows plus “how-to” and `footer-actions` like the static HTML. **Gaps:** Live KG is a **placeholder frame** (no 3D/WebGL bundle). Algorithm catalog rows are a **representative subset** of the 32 algorithms in the export. Evidence guards are **representative groups** (not the full 23-guard catalog). **Extra:** the **Run / FastAPI** panel is fullstack-only for job execution.

The other 5 pages render via [StubPage.tsx](../apps/web/src/components/shell/StubPage.tsx) and link back to the corresponding page in `../hetqml-pages/`:

- `experiment` — metric strip, leaderboard, candidate spotlight
- `validate` — trust scorecard, calibration plot, decision panel
- `visualize` — already a stub in the original export
- `operations` — IBM Quantum backends, queue, alerts
- `settings` — preferences, API keys

## Not ported

- The other three asset modules ([benchmark-suite.js](../../hetqml-pages/assets/benchmark-suite.js), [session-resourcefulness.js](../../hetqml-pages/assets/session-resourcefulness.js), [visualize-panels.js](../../hetqml-pages/assets/visualize-panels.js)). Each surfaces on a stubbed page; port when that page is built.
- The full reference catalogs (137 diseases / 1,552 compounds / 20,945 genes). The static export only ships visible subsets and the rest does not exist in the repo. Seeded representative subsets in [apps/web/src/lib/data/](../apps/web/src/lib/data/) — replace with FastAPI-served reference data when the catalog source is wired in.

## Architecture deltas

- **No more "static enhancement" idiom.** The static export targets standalone `.js` modules under `assets/` because the editable Next.js source is missing. This duplicate has the editable React tree, so cascade filtering, recommendations, and the run-path chooser are real components.
- **FastAPI is the new ML surface.** `POST /investigations/run` returns a queued job; `GET /jobs/{id}` is the polling endpoint. Runner is stubbed (deterministic SHA-256 of the selection → canned metrics) so the full lifecycle exists without a real ML pipeline.
- **`JobStore` is a Protocol** — swap `InMemoryJobStore` for a Postgres implementation later in one file.
- **CORS is locked down.** Only `https://hetqml-web.fly.dev` (prod) + `http://localhost:3000` (dev) can hit the API from a browser. Internal Fly 6PN traffic doesn't pass through CORS.
