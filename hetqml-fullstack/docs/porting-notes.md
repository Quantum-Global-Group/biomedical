# Porting notes

What came from `hetqml-pages/` and what was rewritten.

## Ported (logic preserved, idiom changed)

| `hetqml-pages` source | `hetqml-fullstack` destination | Notes |
|---|---|---|
| [assets/investigation-recommendations.js](../../hetqml-pages/assets/investigation-recommendations.js) — pure logic | [apps/web/src/lib/investigation/recommendations.ts](../apps/web/src/lib/investigation/recommendations.ts) | `evaluateInvestigation`, `getNextRecommendedField`, `allowedValuesForField`, `isOptionGuided`. Profiles + cascade order kept verbatim. |
| `assets/investigation-recommendations.js` — DOM hacks (MutationObserver, setTimeout against React-controlled inputs, `.combo-option` fallback handlers) | **Removed.** Replaced by [ParameterCombobox.tsx](../apps/web/src/components/investigation/ParameterCombobox.tsx) | We own the React tree now, so the cascade is a `useMemo` over `allowedValuesForField` and the "Guided / All" toggle is component state. |
| [assets/run-path-chooser.js](../../hetqml-pages/assets/run-path-chooser.js) — pure logic | [apps/web/src/lib/investigation/runPath.ts](../apps/web/src/lib/investigation/runPath.ts) | `RUN_PATH_MODES`, `RUN_PATH_FAMILIES`, `getRunPathSelection`. |
| `assets/run-path-chooser.js` — `localStorage` persistence | [SessionPanel.tsx](../apps/web/src/components/initialize/SessionPanel.tsx) + [lib/sessions/storage.ts](../apps/web/src/lib/sessions/storage.ts) | Snapshots store `selection` + `runPath` under `hetqml.sessions`. |
| [assets/benchmark-suite.js](../../hetqml-pages/assets/benchmark-suite.js) — `BENCHMARK_TABS` schema | [apps/web/src/lib/experiment/benchmarkTabs.ts](../apps/web/src/lib/experiment/benchmarkTabs.ts) + [BenchmarkSuitePanel.tsx](../apps/web/src/components/experiment/BenchmarkSuitePanel.tsx) | Tab/column schema kept verbatim; rendering is now a React table that reads from a real job result. |
| [assets/session-resourcefulness.js](../../hetqml-pages/assets/session-resourcefulness.js) — `enrichSession`, `compareSessions`, `getSmartResumeSuggestion` | [apps/web/src/lib/sessions/resourcefulness.ts](../apps/web/src/lib/sessions/resourcefulness.ts) | Pure logic only. The DOM mounting (MutationObserver + template-string injection) was discarded — the React tree owns rendering. |
| [assets/visualize-panels.js](../../hetqml-pages/assets/visualize-panels.js) — `VISUALIZE_DATA` fixture + `render*` HTML helpers | [apps/web/src/app/visualize/VisualizeLite.tsx](../apps/web/src/app/visualize/VisualizeLite.tsx) + the 13 panel components under [apps/web/src/components/visualize/](../apps/web/src/components/visualize/) | The 1.2k-line static-export module was superseded — `VisualizeClient` reads real `JobResult` from FastAPI, `VisualizeLite` ships an Inaxaplin/APOL1 fixture for the static HF Space build. |

## Initialize UI parity (Next vs `hetqml-pages` static)

- **Styles:** [hetqml-export.css](../apps/web/src/styles/hetqml-export.css) is copied from the static export bundle; [legacy-overrides.css](../apps/web/src/styles/legacy-overrides.css) holds small a11y/layout patches.
- **Shell:** [AppShell.tsx](../apps/web/src/components/shell/AppShell.tsx) + [Sidebar.tsx](../apps/web/src/components/shell/Sidebar.tsx) mirror fixed sidebar, collapse (`body.sidebar-collapsed`), brand, nav structure, theme row, status bar.
- **Layout:** Initialize uses three `.grid-7-5` rows plus “how-to” and `footer-actions` like the static HTML. **Gaps:** Live KG is a **placeholder frame** (no 3D/WebGL bundle). Algorithm catalog rows are a **representative subset** of the 32 algorithms in the export. Evidence guards are **representative groups** (not the full 23-guard catalog). **Extra:** the **Run / FastAPI** panel is fullstack-only for job execution.

All five Next routes are now real client components, not stubs:

- `experiment` — [ExperimentClient.tsx](../apps/web/src/app/experiment/ExperimentClient.tsx) drives metric strip, leaderboard, candidate spotlight from the live job result.
- `validate` — [ValidateClient.tsx](../apps/web/src/app/validate/ValidateClient.tsx) runs the trust scorecard, calibration plot, decision panel.
- `visualize` — [VisualizeClient.tsx](../apps/web/src/app/visualize/VisualizeClient.tsx) renders the 13 panels (full build) or [VisualizeLite.tsx](../apps/web/src/app/visualize/VisualizeLite.tsx) (HF Space static export).
- `operations` — [OperationsClient.tsx](../apps/web/src/app/operations/OperationsClient.tsx) polls `/ops/*` every 5 s.
- `settings` — [SettingsClient.tsx](../apps/web/src/app/settings/SettingsClient.tsx) covers all eight preference panels with server persistence.

[StubPage.tsx](../apps/web/src/components/shell/StubPage.tsx) is now an orphaned legacy component — kept temporarily with a `@deprecated` JSDoc note and safe to delete in the next cleanup pass.

## Not ported

- The full reference catalogs (137 diseases / 1,552 compounds / 20,945 genes). The static export only ships visible subsets and the rest does not exist in the repo. Seeded representative subsets in [apps/web/src/lib/data/](../apps/web/src/lib/data/) — replace with FastAPI-served reference data when the catalog source is wired in.

## Architecture deltas

- **No more "static enhancement" idiom.** The static export targets standalone `.js` modules under `assets/` because the editable Next.js source is missing. This duplicate has the editable React tree, so cascade filtering, recommendations, and the run-path chooser are real components.
- **FastAPI is the new ML surface.** `POST /investigations/run` returns a queued job; `GET /jobs/{id}` is the polling endpoint. Runner is stubbed (deterministic SHA-256 of the selection → canned metrics) so the full lifecycle exists without a real ML pipeline.
- **`JobStore` is a Protocol** — swap `InMemoryJobStore` for a Postgres implementation later in one file.
- **CORS is locked down.** Only `https://hetqml-web.fly.dev` (prod) + `http://localhost:3000` (dev) can hit the API from a browser. Internal Fly 6PN traffic doesn't pass through CORS.
