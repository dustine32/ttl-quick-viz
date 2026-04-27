# ttl-quick-viz — site

Web front end: a React 19 + Vite + TypeScript SPA that loads TTL-derived graph
JSON from the sibling `api/` service and renders it through one of **seven
interchangeable graph engines**, with a synced TTL source pane in a
collapsible bottom panel. Mantine v9 drives the shell (header, side panels,
status bar, command palette, hotkeys, notifications); Redux Toolkit + RTK
Query handle state and data; Tailwind v4 handles utility styling.

## Quick start

```bash
cd site
npm install
cp .env.example .env       # edit VITE_API_URL if api/ isn't on http://localhost:8000
npm run dev
```

The dev server runs on Vite's default port (5173); `npm start` binds
`0.0.0.0:4242`. The browser fetches the FastAPI service in
[`../api/`](../api/README.md) directly — there is **no Vite proxy**. The api
must be running and CORS-permissive (it already is — the api opens CORS to
all origins in dev).

Hotkeys: `Ctrl+B` left panel · `Ctrl+Alt+B` right panel · `Ctrl+J` bottom
(TTL) panel · `Ctrl+K` command palette · `F` fit view · `R` re-run layout ·
`Shift+R` rebuild all graphs (calls `POST /api/convert`) · `Esc` clear
selection.

## Renderers

Switched by a `Select` in the header toolbar. State lives in
`state.graph.renderer` (type `GraphRenderer`).

| Value       | Library / file                                                         |
|-------------|------------------------------------------------------------------------|
| `xyflow`    | React Flow + ELK layout — `src/features/graph/`                        |
| `cytoscape` | Cytoscape + cola/dagre/fcose/cose-bilkent/euler/spread plugins         |
| `force`     | `react-force-graph-2d` — `src/features/graph-force/`                   |
| `force3d`   | `react-force-graph-3d` — `src/features/graph-force/`                   |
| `sigma`     | `@react-sigma/core` (WebGL) + graphology layouts                       |
| `graphin`   | `@antv/graphin` (G6) — `src/features/graph-graphin/`                   |
| `tree`      | Custom mind-map / tree renderer — `src/features/graph-tree/`           |

A separate `SegmentedControl` toggles **standalone-node mode** (`hide` /
`both` / `only`); when set to `only`, the canvas is replaced by a flat
`StandaloneList` of orphan nodes regardless of renderer.

## Features

- **Seven interchangeable renderers**, sharing a single wire shape
  (`Graph` in `src/features/graph/types.ts`).
- **Bottom TTL pane** (`features/ttl-source/`) — Prism-syntax-highlighted
  Turtle source fetched from `GET /api/graphs/{id}/ttl`, with token → line
  mapping that highlights the source for the currently selected node/edge.
- **AppShell layout** (`react-resizable-panels`): vertical split (upper +
  bottom-TTL); upper has a horizontal split (icon rail + left navbar + main
  + right aside).
- **Inspector pane** (`features/inspector/`) — properties / view tabs for
  the selected node or edge.
- **Command palette** (`features/search/`, `Ctrl+K`).
- **URL state sync** (`features/url-state/`) — selected graph, renderer,
  view config, panel state are reflected in the URL; "Copy shareable link"
  in the toolbar More menu.
- **View config** shared by all renderers (`features/view-config/`):
  layout, label modes, focus depth, palette, predicate/type filters,
  swimlane controls, derived-data hooks. Persists `standaloneMode` to
  `localStorage`.
- **Rebuild all** (toolbar More menu / `Shift+R`) — invokes
  `useConvertAllMutation` → `POST /api/convert`. Notifications report
  `okCount` / `errorCount` / `skippedCount`.

## Scripts

| Script              | What it does                                       |
|---------------------|----------------------------------------------------|
| `npm run dev`       | Vite dev server (default 5173)                     |
| `npm start`         | Vite dev server bound to `0.0.0.0:4242`            |
| `npm run build`     | `tsc -b && vite build` (emits to `dist/`)          |
| `npm run preview`   | Serve the production build                         |
| `npm run lint`      | ESLint flat config (`eslint.config.js`)            |
| `npm test`          | Vitest one-shot (jsdom + Testing Library)          |
| `npm run test:watch`| Vitest in watch mode                               |

## Layout (`src/`)

```
src/
├── App.tsx                           7-way renderer switch + AppShell wiring
├── main.tsx                          Provider chain: Redux → Mantine → ErrorBoundary
├── app/
│   ├── store.ts                      reducers: graph, ui, viewConfig, tree, graphApi
│   └── hooks.ts                      useAppDispatch / useAppSelector (typed)
├── layout/
│   ├── AppShell.tsx                  resizable-panels shell (vertical + horizontal)
│   ├── Toolbar.tsx                   brand, search, standalone mode, renderer Select, layout, More menu
│   ├── LeftPanel.tsx, RightPanel.tsx panel containers
│   ├── CanvasHeader.tsx, PanelHeader.tsx, IconRail.tsx, StatusBar.tsx
│   └── useAppHotkeys.ts              global keymap
├── features/
│   ├── graph/                        React Flow renderer + shared wire types
│   ├── graph-cytoscape/              Cytoscape renderer
│   ├── graph-force/                  Force 2D + 3D
│   ├── graph-sigma/                  Sigma (WebGL)
│   ├── graph-graphin/                Graphin (G6)
│   ├── graph-tree/                   Tree / mind-map (with own tree slice)
│   ├── ttl-source/                   bottom TTL pane (TtlPane, findLine, registerTurtle)
│   ├── inspector/                    NodeInspector / EdgeInspector
│   ├── search/                       SearchBox + command palette
│   ├── ui/                           uiSlice (panels, selection, nonces, palette)
│   ├── view-config/                  layout / labels / focus / palette / filters
│   └── url-state/                    URL ↔ Redux sync
├── shared/components/                ErrorBoundary, cross-cutting components
└── data/sample-graph.json            local fallback fixture
```

Tests live **outside `src/`** in `site/tests/`, mirroring the `src/` tree
(e.g. `tests/features/graph/slices/graphSlice.test.ts`, `tests/features/ttl-source/findLine.test.ts`).

Path alias: `@/*` → `src/*` (configured in `tsconfig.app.json` and
`vite.config.ts`).

## Architecture

- **Wire shape:** `Graph`, `GraphNode`, `GraphEdge`, `GraphSummary` live in
  [`src/features/graph/types.ts`](./src/features/graph/types.ts) and are
  shared by all seven renderers. The same contract is implemented on the
  Python side in `api/src/app/domain/models.py` and produced by
  `conversion/src/ttl2json/core.py`. Changing one without the others drifts
  the system.
- **Data flow:** Component → RTK Query hook from
  `src/features/graph/slices/graphApiSlice.ts` (`useGetGraphsQuery`,
  `useGetGraphQuery`, `useGetGraphTtlQuery`, `useConvertAllMutation`,
  `useRebuildGraphMutation`) → `api/` (CORS-allowed, base URL from
  `import.meta.env.VITE_API_URL`) → JSON → renderer.
- **No Vite proxy.** The browser hits the api directly. `vite.config.ts`
  registers only `react()` + `tailwindcss()`.
- **Tags & invalidation:** `getGraphs` provides `Graph` per id and a `LIST`
  tag; `rebuildGraph` invalidates `Graph`, `GraphTtl`, and the list.
- **Imperative actions** (fit-view, relayout, reveal) are modeled as
  **nonce counters** in `uiSlice`; renderers subscribe and react to the
  number changing. Follow that pattern for new one-shot commands.

## Stack

- React 19 + TypeScript (strict: `noUnusedLocals`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly`).
- Vite 8 with `@vitejs/plugin-react` and `@tailwindcss/vite`.
- Mantine v9 (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`)
  + Tailwind v4 utility classes.
- Redux Toolkit 2.x + RTK Query; React Redux 9.
- React Flow 12 + elkjs 0.11; Cytoscape 3.33 + plugins; force-graph 2D/3D;
  Sigma 5 / graphology 0.26; Graphin 3.
- `react-resizable-panels` for the shell.
- Prism React Renderer + a custom Turtle language for syntax highlighting.
- ESLint 9 flat config, Vitest 4 + jsdom + Testing Library.

## Troubleshooting

- **Empty UI / requests fail.** The `api/` FastAPI service isn't running or
  `VITE_API_URL` points at the wrong host/port. Check the browser console;
  a network error means the api is unreachable. (CORS isn't an issue in
  dev — the api opens it to all origins.)
- **Nodes/edges missing fields, or runtime type errors.** The wire shape in
  `src/features/graph/types.ts` has drifted from `api/src/app/domain/` or
  `conversion/src/ttl2json/core.py`. Align all three.
- **TTL pane shows "no source available".** Either no graph is selected,
  or `INPUT_DIR` is unset on the api (the `/ttl` endpoint returns 503).
  Set `INPUT_DIR` in `api/.env`.
- **Hotkeys don't fire in inputs.** Expected — Mantine's `useHotkeys`
  ignores `<input>` / `<textarea>` focus. Blur first.
- **`Shift+R` rebuild reports "Could not reach the conversion service".**
  Either the api is down or `INPUT_DIR` is unset (returns 503 →
  RTK Query `unwrap()` throws).
- **`npm install` fails on Windows with long paths.** Enable long paths or
  run the install from a shorter path.

For per-session engineering guidance (directory conventions, how to add a
slice/endpoint/hotkey, the renderer-sharing rules, state model), see
`CLAUDE.md` in this directory.
