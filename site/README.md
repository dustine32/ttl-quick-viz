# ttl-quick-viz — site

Web front end for **ttl-quick-viz**: a React 19 + Vite SPA that loads TTL-derived graph JSON from the sibling `api/` service and renders it with either React Flow (ELK layout) or Cytoscape. Mantine v9 drives the shell (header, collapsible side panels, status bar, command palette, hotkeys); Redux Toolkit + RTK Query handle state and data.

## Quick start

```bash
cd site
npm install
npm run dev
```

The dev server runs on Vite's default port (5173). It proxies `/api/*` to `http://localhost:8000`, so the FastAPI service in [`../api/`](../api/README.md) must be running — otherwise graph requests return 502 and the UI stays empty.

Hotkeys: `Ctrl+B` left panel, `Ctrl+Alt+B` right panel, `Ctrl+K` command palette, `F` fit view, `R` re-run layout, `Esc` clear selection.

## Features

- **Two interchangeable renderers**, switched by a `SegmentedControl` in the header:
  - React Flow (`@xyflow/react`) with ELK layout (`elkjs`) — `src/features/graph/`.
  - Cytoscape (`cytoscape`) — `src/features/graph-cytoscape/`.
- AppShell layout: header toolbar, left navbar (graph list), right inspector, footer status bar.
- Inspector pane for node and edge details.
- Command palette for node search (`Ctrl+K`).
- URL state sync (selected graph, renderer, view config) via `features/url-state/`.
- View config (layout, labels, focus, palette, predicate filter) lives in `features/view-config/` and applies to both renderers.
- Shareable link button in the toolbar copies the current URL.

## Scripts

| Script              | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Vite dev server (default port 5173)                |
| `npm start`         | Vite dev server bound to `0.0.0.0:4242`            |
| `npm run build`     | `tsc -b && vite build` (emits to `dist/`)          |
| `npm run preview`   | Serve the production build                         |
| `npm run lint`      | ESLint over the workspace (flat config)            |
| `npm test`          | Vitest one-shot run (jsdom + Testing Library)      |
| `npm run test:watch`| Vitest in watch mode                               |

## Layout

```
site/src/
  app/                  Redux store + typed hooks
  App.tsx, main.tsx     Root wiring (Provider → MantineProvider → ErrorBoundary)
  layout/               AppShell, Toolbar, LeftPanel, RightPanel, StatusBar, hotkeys
  features/
    graph/              React Flow renderer, ELK layout, shared wire-shape types
    graph-cytoscape/    Cytoscape renderer
    inspector/          Right-panel node/edge inspectors
    search/             Command palette
    ui/                 uiSlice (panels, selection, nonces, palette)
    view-config/        Layout picker, label/style controls, focus, selectors
    url-state/          URL ↔ Redux sync
  shared/components/    ErrorBoundary, cross-feature components
  data/                 Local sample graph JSON
  test/                 Vitest setup + smoke test
```

Path alias: `@/*` → `src/*`.

## Architecture

The graph wire shape (`Graph`, `GraphNode`, `GraphEdge`, `GraphSummary`) lives in [`src/features/graph/types.ts`](./src/features/graph/types.ts) and is shared by both renderers. The same contract is implemented on the Python side in `api/src/app/domain/` and produced by `conversion/ttl2json.py` — changing any one without the others will drift the system. Data travels: component → RTK Query (`src/features/graph/graphApi.ts`, `baseUrl: '/api'`) → Vite proxy → `api/` FastAPI → JSON → renderer.

## Stack

- React 19 + TypeScript (strict: `noUnusedLocals`, `verbatimModuleSyntax`, `erasableSyntaxOnly`).
- Vite 8 (`vite.config.ts`) with `@vitejs/plugin-react` and `@tailwindcss/vite`.
- Mantine v9 (`@mantine/core`, `@mantine/hooks`) + Tailwind v4 utility classes.
- Redux Toolkit 2.x + RTK Query; React Redux 9.
- React Flow 12 + elkjs 0.11; Cytoscape 3.
- ESLint 9 flat config, Vitest 4 + jsdom + Testing Library.

## Troubleshooting

- **Graph requests fail with 502 / empty UI** — the `api/` FastAPI service isn't running on `:8000`. Start it (`cd ../api && …`) or change the proxy target in `vite.config.ts` if the api binds a different port.
- **Nodes/edges missing fields or runtime type errors** — the wire shape in `src/features/graph/types.ts` has drifted from `api/src/app/domain/` or `conversion/ttl2json.py`. Align all three.
- **Hotkeys don't fire in inputs** — expected; Mantine's `useHotkeys` ignores input/textarea focus. Blur first.
- **`npm install` fails on Windows with long paths** — enable long paths or run the install from a shorter path.

For per-session engineering guidance (directory conventions, how to add a slice/endpoint/hotkey, the renderer-sharing rules), see `CLAUDE.md` in this directory.
