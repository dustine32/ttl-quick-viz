# site/ — Claude guidance

React 19 + Vite + TypeScript SPA that fetches TTL-derived graph JSON from the
sibling `api/` service and renders it through one of **seven interchangeable
graph engines**, with a synced TTL source pane in a collapsible bottom panel.
Uses Redux Toolkit + RTK Query for data, Mantine v9 for the shell/controls,
and Tailwind v4 for utility styling. `react-resizable-panels` drives the
collapsible left / right / bottom panes.

> **Developer guide:** See [`../docs/dev-guide-react.md`](../docs/dev-guide-react.md)
> for the deeper "how we build here" — feature-first layout, Mantine vs
> Tailwind split, state management patterns, testing, and worked examples.
> This file is the quick repo map; that file is the onboarding read.

## Directory layout (`src/`)

- `App.tsx`, `main.tsx` — root wiring: `Provider` → `MantineProvider` →
  `ErrorBoundary` → `App`. `App` reads `state.graph.renderer` and renders
  one of seven canvases inside `AppShell`.
- `app/` — Redux store (`store.ts`) and typed hooks (`hooks.ts`). Reducers:
  `graph`, `ui`, `viewConfig`, `tree`, plus `graphApi` reducer + middleware.
- `layout/` — `AppShell` (`react-resizable-panels` shell), `Toolbar`,
  `LeftPanel`, `RightPanel`, `CanvasHeader`, `PanelHeader`, `IconRail`,
  `StatusBar`, `useAppHotkeys`.
- `features/graph/` — React Flow (`@xyflow/react`) renderer + ELK layout
  hook + dagre/radial/swimlane services. **Also hosts the shared wire-shape
  types** (`types.ts`) and the RTK Query slice (`slices/graphApiSlice.ts`).
- `features/graph-cytoscape/` — Cytoscape renderer (`CytoscapeCanvas`,
  `layouts.ts`, `register.ts`).
- `features/graph-force/` — Force 2D / 3D (`ForceCanvas`, `ForceCanvas3D`).
- `features/graph-sigma/` — Sigma (WebGL) renderer.
- `features/graph-graphin/` — Graphin (G6) renderer.
- `features/graph-tree/` — Tree / mind-map renderer + its own
  `treeSlice.ts` and `buildTree.ts`.
- `features/ttl-source/` — bottom TTL pane (`TtlPane`, `findLine`,
  `registerTurtle`). Pulls source via `useGetGraphTtlQuery`; highlights
  the line for the currently selected node/edge.
- `features/inspector/` — right-panel node/edge inspectors with a
  properties / view tab switcher.
- `features/search/` — `SearchBox` + command palette (Ctrl+K).
- `features/ui/` — `uiSlice`: `leftPanelOpen`, `rightPanelOpen`,
  `rightPanelTab`, `bottomPanelOpen`, `selectedNodeId`, `selectedEdgeId`,
  `fitViewNonce`, `relayoutNonce`, `revealNonce`, `paletteOpen`.
- `features/view-config/` — layout picker, label/style toggles, focus,
  prefixes, palette, predicate/type filter, swimlane controls,
  `standaloneMode` (persisted to `localStorage`), derived-data hooks.
- `features/url-state/` — `useUrlSync` reads/writes state to the URL.
- `shared/components/` — cross-feature components (e.g. `ErrorBoundary`).
- `data/sample-graph.json` — local fallback sample.

Tests live **outside `src/`** in `site/tests/`, mirroring the `src/` tree
(e.g. `tests/features/graph/slices/graphSlice.test.ts`,
`tests/features/ttl-source/findLine.test.ts`,
`tests/features/graph-tree/buildTree.test.ts`). `tests/setup.ts` is the
Vitest + jsdom setup file.

Path alias: `@/*` → `src/*` (configured in `tsconfig.app.json` and
`vite.config.ts`).

## The seven renderers

State: `state.graph.renderer: 'xyflow' | 'cytoscape' | 'force' | 'force3d' |
'sigma' | 'graphin' | 'tree'` (set via `setRenderer` in
`src/features/graph/slices/graphSlice.ts`). The toolbar binds it to a
Mantine `Select` (no longer the old `SegmentedControl`).

| Renderer    | Entry component / location                              |
|-------------|---------------------------------------------------------|
| `xyflow`    | `features/graph/components/GraphCanvas.tsx` + `useElkLayout`  |
| `cytoscape` | `features/graph-cytoscape/CytoscapeCanvas.tsx` + `layouts.ts` |
| `force`     | `features/graph-force/ForceCanvas.tsx`                  |
| `force3d`   | `features/graph-force/ForceCanvas3D.tsx`                |
| `sigma`     | `features/graph-sigma/SigmaCanvas.tsx`                  |
| `graphin`   | `features/graph-graphin/GraphinCanvas.tsx`              |
| `tree`      | `features/graph-tree/TreeCanvas.tsx` (+ `treeSlice`)    |

A separate **standalone-node** `SegmentedControl` in the toolbar
(`features/view-config/standaloneMode`: `'hide' | 'both' | 'only'`) replaces
the canvas with a flat `StandaloneList` when set to `'only'` — no renderer
runs.

**Shared wire shape:** `src/features/graph/types.ts` (`Graph`, `GraphNode`,
`GraphEdge`, `GraphSummary`). All seven renderers consume this; re-exported
from `src/features/graph/index.ts`. **The matching shape on the api side
lives in `api/src/app/domain/models.py`** and is produced upstream by
`conversion/src/ttl2json/core.py`. Touch all three when changing the wire.

When adding a visual feature, decide if it belongs in one renderer, several,
or all — cross-cutting view state (layout, labels, palette, focus, filters)
belongs in `features/view-config/` so every renderer can read it.

## Data flow

1. Component calls an RTK Query hook from
   `src/features/graph/slices/graphApiSlice.ts`:
   - `useGetGraphsQuery()` → `GET /graphs`
   - `useGetGraphQuery(id)` → `GET /graphs/{id}`
   - `useGetGraphTtlQuery(id)` → `GET /graphs/{id}/ttl` (returns raw text)
   - `useConvertAllMutation()` → `POST /convert`
   - `useRebuildGraphMutation({ id, force? })` → `POST /graphs/{id}/rebuild`
2. `baseUrl` reads `import.meta.env.VITE_API_URL` (e.g.
   `http://localhost:8000/api`). The browser hits the api directly — **no
   Vite proxy.**
3. The api is CORS-permissive (`allow_origins=["*"]`) so the dev origin
   doesn't matter.
4. Cache tags: `Graphs` (list), `Graph` (per id), `GraphTtl` (per id).
   `rebuildGraph` invalidates `Graph` + `GraphTtl` for that id and the
   `LIST` tag; `convertAll` invalidates the `LIST` tag.
5. Renderer consumes nodes/edges; layout (ELK / Cytoscape built-ins / force
   sim / Sigma / G6 / tree) positions them.

## State management

- Store: `src/app/store.ts` — reducers `graph`, `ui`, `viewConfig`, `tree`,
  plus `graphApi.reducer` + middleware. `setupListeners(store.dispatch)` is
  registered (powers `refetchOnFocus`/`refetchOnReconnect`).
- `viewConfig.standaloneMode` is persisted to `localStorage` via a
  `store.subscribe` callback.
- Always use `useAppSelector` / `useAppDispatch` from
  `src/app/hooks.ts` (typed).
- **Adding a slice:** create `features/<name>/<name>Slice.ts` with
  `createSlice`, re-export reducer from `features/<name>/index.ts`,
  register in `store.ts`.
- **Adding an RTK Query endpoint:** add a `build.query` / `build.mutation`
  to `graphApi` in `features/graph/slices/graphApiSlice.ts`; export the
  generated hook. Add tags + invalidation if the endpoint mutates server
  state.
- Imperative actions (fit-view, relayout, reveal) are modeled as **nonce
  counters** in `uiSlice`; renderers subscribe and run a `useEffect` keyed
  on the nonce. Follow that pattern for new one-shot commands rather than
  inventing ad-hoc refs.

## UI kit — Mantine + Tailwind, clear split

**Project convention:**

- **Mantine v9** (`@mantine/core`, `@mantine/hooks`,
  `@mantine/notifications`) for real components — `Button`, `ActionIcon`,
  `Switch`, `Select`, `SegmentedControl`, `Tooltip`, `Menu`, `Modal`,
  `Drawer`, `Text`, `Title`, forms, hotkeys (`useHotkeys`), notifications.
  Anything where you want built-in behavior, a11y, and cohesive styling.
- **Tailwind v4** (via `@tailwindcss/vite`) for layout and utilities only —
  `flex`, `grid`, `items-center`, `justify-between`, `gap-*`, `p-*`,
  `w-full`, simple text tweaks on plain `<h1>`/`<p>` (`text-sm
  text-neutral-500`), responsive helpers, ad-hoc color/border/shadow.
- **Don't** reimplement Mantine components with Tailwind (a hand-rolled
  `<button className="px-3 py-1.5 bg-blue-500 ...">` loses accessibility
  and cohesion). **Don't** use Mantine `Group`/`Stack` purely to flex two
  things — Tailwind is lighter for pure layout.
- Mixing on one element is fine: `<Stack className="h-full overflow-auto"
  gap="xs">` — Tailwind for layout, Mantine for spacing tokens.
- **No other UI libraries** — no MUI, Chakra, Ant, Radix, HeadlessUI. No
  CSS-in-JS (styled-components, emotion css prop). CSS Modules only for
  genuinely unique canvas/overlay cases.

See [`../docs/dev-guide-react.md`](../docs/dev-guide-react.md) §3 for
worked examples.

## Layout & hotkeys

- `AppShell` (`src/layout/AppShell.tsx`) wraps `react-resizable-panels`:
  vertical split (`upper` + `bottom`), `upper` is a horizontal split with
  `IconRail` + collapsible `left` (navbar) + `main` + collapsible `right`
  (aside). The `bottom` panel hosts the TTL pane and is also collapsible.
  Open/close state is mirrored to `ui.{left,right,bottom}PanelOpen` via the
  panel callbacks; toolbar/hotkey actions write to those flags and
  `useEffect`s call `panel.expand()` / `panel.collapse()`.
- Hotkeys registered in `src/layout/useAppHotkeys.ts`:
  - `Ctrl+B` — left panel
  - `Ctrl+Alt+B` — right panel
  - `Ctrl+J` — bottom (TTL) panel
  - `Ctrl+K` — command palette
  - `F` — fit view (nonce)
  - `R` — re-run layout (nonce)
  - `Shift+R` — rebuild all graphs (`useConvertAllMutation`)
  - `Esc` — clear selection
  Add new ones here and wire the matching toolbar affordance in
  `Toolbar.tsx`.

## Toolbar

`src/layout/Toolbar.tsx` hosts:

- Brand block (logo + "TTL Quick Viz" + "Beta" pill).
- Centered `SearchBox`.
- Right cluster:
  - `SegmentedControl` for `standaloneMode` (`hide` / `both` / `only`).
  - `Select` for renderer (disabled when `standaloneMode === 'only'`).
  - `LayoutPicker` (only visible for `xyflow` / `cytoscape` and when
    `standaloneMode !== 'only'`).
  - "More" `Menu`: **Rebuild all graphs** (`Shift+R`), **Copy shareable
    link**, **Export image** (disabled — placeholder).

## Common commands

Run from `site/`:

- `npm install` — install deps.
- `npm run dev` — Vite dev server (default 5173). Requires `api/` on `:8000`.
- `npm start` — same as dev but binds `0.0.0.0:4242`.
- `npm run build` — `tsc -b && vite build`.
- `npm run preview` — serve the production build.
- `npm run lint` — ESLint flat config (`eslint.config.js`).
- `npm test` / `npm run test:watch` — Vitest (jsdom, Testing Library).

## API base URL (no proxy)

- `vite.config.ts` does **not** define a dev proxy. The browser hits the
  api directly.
- `src/features/graph/slices/graphApiSlice.ts` sets `baseUrl:
  import.meta.env.VITE_API_URL`. Configure it in `site/.env` (see
  `.env.example`). Default for local dev: `http://localhost:8000/api`.
- The api is CORS-permissive in dev (`allow_origins=["*"]`) — no origin
  configuration needed.
- If `api/` isn't running, RTK Query requests fail with a network error;
  the UI renders but graph lists/bodies stay empty and the error surfaces
  in the console.

## Gotchas

- **Wire-shape drift:** `src/features/graph/types.ts` must match
  `api/src/app/domain/models.py` and the JSON emitted by
  `conversion/src/ttl2json/core.py`. Change all three (or a shared
  contract) together.
- **Seven renderers:** every new feature needs a conscious call — one,
  some, or all. Favor putting logic in `features/view-config/` or
  `uiSlice` when shared.
- **TTL pane requires `INPUT_DIR` on the api.** Without it the api returns
  503 from `/graphs/{id}/ttl` and the pane shows an empty/error state.
- **Strict TS:** `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax`, `erasableSyntaxOnly` are on. Use `import type`
  for type-only imports.
- **React 19 StrictMode** is enabled — effects run twice in dev; write
  idempotent setup/teardown.
- **`react-resizable-panels` collapse vs hide.** Hiding the panel from the
  toolbar/hotkey path uses `panel.collapse()` (still mounted with size 0),
  not unmounting. Don't conditionally render `<Panel>` — that breaks the
  `autoSaveId` layout persistence.

## Adding a feature (example: a new graph action)

1. If it's a one-shot imperative command (like "center on selection"), add
   a nonce + reducer to `features/ui/uiSlice.ts` and export the action
   from `features/ui/index.ts`.
2. Add a `Tooltip`+`ActionIcon`/`Menu.Item` in `src/layout/Toolbar.tsx`
   that dispatches the action.
3. Register a hotkey in `src/layout/useAppHotkeys.ts`.
4. In each renderer that should respond, subscribe to the nonce with
   `useAppSelector` and run the side-effect in a `useEffect` keyed on the
   nonce value.
5. If it needs persisted view state instead of a one-shot, put it in
   `features/view-config/viewConfigSlice.ts` and read via selectors in
   `features/view-config/selectors.ts`. Persist to `localStorage` in
   `app/store.ts` (`store.subscribe`) if it should survive reloads.
6. Add a Vitest test under `site/tests/` mirroring the source path.
