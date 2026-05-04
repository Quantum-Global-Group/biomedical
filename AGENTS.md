## Learned User Preferences

- For the editable Next.js Visualize work, split only browser-heavy renderers (3D/D3 lifecycle) and keep synthesis helpers in `VisualizePage` rather than one monolith or a broad evidence-util refactor.
- When the workspace only has the static export, prefer shipping features as localized patches to that export instead of waiting on the missing upstream Next tree.
- For `hetqml-pages` static enhancement modules, use TDD: add failing `node --test` cases first, then implement until green.
- For HetQML Initialize parity, treat static `hetqml-pages` on port 8080 as the reference UX; `hetqml-fullstack` Next.js on port 3000 should match cascading disease → compound → gene → Hetionet metaedge with guided narrowing like that static flow.

## Learned Workspace Facts

- `hetqml-pages/` here is a static Next.js export (serve that folder with `python3 -m http.server` or `npx serve`, per README), not the original editable Next.js app source; `hetqml-fullstack` runs from repo root with `pnpm install` then `pnpm dev:web`, and `pnpm dev:api` when the backend is needed.
- Enhancements target standalone `.js` modules under `hetqml-pages/assets/`, each page wires exactly one module script in its HTML, and generated `_next` bundles are left untouched.
- Those modules run in a page that still hydrates client React; DOM tweaks may need deferred timing (e.g. `setTimeout`) so selections survive React-controlled inputs.
- Node tests for the `.js` files use `node --test` plus `readFile` and `import(\`data:text/javascript,${encodeURIComponent(moduleSource)}\`)` to exercise browser-oriented ES modules without a bundler.
- Related editable Next.js source for HetQML has lived outside this repo under the WSL Windows-mounted Downloads tree (not part of `biomedical/`).
- In `hetqml-fullstack/apps/web`, `ParameterCombobox` sits in a grid with cascade-locked rows using `pointer-events: none`, which can stack dropdowns under later rows and block picks; reliable mitigations include raising z-index on `.combo.open`/`.combo-list`, deferred document `mousedown` (capture) for outside close, `mousedown` on options, and forcing the open list visible in CSS when export rules would hide it.
