# site/ — Claude guidance

React 19 + Vite + TypeScript SPA that fetches TTL-derived graph JSON from the sibling `api/` FastAPI service and renders it with one of two interchangeable graph engines. Uses Redux Toolkit + RTK Query for data, Mantine v9 for the shell/controls, and Tailwind v4 for utility styling.

> **Developer guide:** See [`../docs/dev-guide-react.md`](../docs/dev-guide-react.md)
> for the deeper "how we build here" — feature-first layout, Mantine vs
> Tailwind split, state management patterns, testing, and worked examples.
> This file is the quick repo map; that file is the onboarding read.

## Directory layout (`src/`)

- `app/` — Redux store (`store.ts`) and typed hooks (`hooks.ts` → `useAppDispatch`, `useAppSelector`).
- `App.tsx`, `main.tsx` — root wiring: `Provider` → `MantineProvider` → `ErrorBoundary` → `App`.
- `layout/` — `AppShell` (Mantine AppShell wrapper), `Toolbar` (header), `LeftPanel`, `RightPanel`, `StatusBar`, `useAppHotkeys`, `icons.tsx`.
- `features/graph/` — React Flow (`@xyflow/react`) renderer + ELK layout hook. **Also hosts the shared wire-shape types.**
- `features/graph-cytoscape/` — Cytoscape renderer. Smaller surface; just canvas + layouts.
- `features/inspector/` — right-panel node/edge inspectors.
- `features/search/` — `CommandPalette` (Ctrl+K).
- `features/ui/` — `uiSlice` for panels, selection, nonces (fit-view, relayout, reveal), palette.
- `features/view-config/` — layout picker, label/style toggles, focus, prefixes, palette, derived-data hooks.
- `features/url-state/` — `useUrlSync` reads/writes state to the URL.
- `shared/components/` — cross-feature components (e.g. `ErrorBoundary`).
- `data/sample-graph.json` — local fallback sample.
- `test/setup.ts` — Vitest + jsdom setup.

Path alias: `@/*` → `src/*` (configured in `tsconfig.app.json` and `vite.config.ts`).

## The two renderers

- React Flow lives in `src/features/graph/` — main entry `GraphCanvas.tsx`, layout via `useElkLayout.ts` + `elkOptions.ts`, custom node in `PrettyNode.tsx`.
- Cytoscape lives in `src/features/graph-cytoscape/` — main entry `CytoscapeCanvas.tsx`, layouts in `layouts.ts`.
- The switch is a Mantine `SegmentedControl` in `src/layout/Toolbar.tsx`, bound to `graph.renderer` (`'xyflow' | 'cytoscape'`) via `setRenderer` in `src/features/graph/graphSlice.ts`.
- **Shared wire shape:** `src/features/graph/types.ts` (`Graph`, `GraphNode`, `GraphEdge`, `GraphSummary`). Both renderers consume this; re-exported from `src/features/graph/index.ts`.
- When adding a visual feature, decide if it belongs in one renderer or both; cross-cutting view state (layout, labels, palette, focus) lives in `features/view-config/` so both renderers can read it.

## Data flow

1. UI component calls an RTK Query hook (`useGetGraphsQuery`, `useGetGraphQuery`) from `src/features/graph/graphApi.ts` (`baseUrl: '/api'`).
2. Vite dev server proxies `/api/*` to `http://localhost:8000` (see `vite.config.ts`).
3. FastAPI (`api/`) returns JSON matching the `Graph` wire shape.
4. Renderer consumes nodes/edges; layout (ELK or Cytoscape's built-ins) positions them.

## State management

- Store: `src/app/store.ts` — reducers `graph`, `ui`, `viewConfig`, plus `graphApi` reducer + middleware.
- Always use `useAppSelector` / `useAppDispatch` from `src/app/hooks.ts` (typed).
- **Adding a slice:** create `features/<name>/<name>Slice.ts` with `createSlice`, re-export reducer from `features/<name>/index.ts`, register in `store.ts`.
- **Adding an RTK Query endpoint:** add a `build.query` / `build.mutation` to `graphApi` in `features/graph/graphApi.ts`; export the generated hook.
- Imperative actions (fit-view, relayout, reveal) are modeled as **nonce counters** in `uiSlice`; renderers subscribe and react to the number changing. Follow that pattern for new one-shot commands rather than inventing ad-hoc refs.

## UI kit — Mantine + Tailwind, clear split

**Project convention:**

- **Mantine v9** (`@mantine/core`, `@mantine/hooks`) for real components —
  `Button`, `ActionIcon`, `Switch`, `Select`, `SegmentedControl`, `Text`,
  `Title`, `AppShell`, `Modal`, `Drawer`, `Menu`, `Tooltip`, forms,
  notifications, hotkeys (`useHotkeys`). Anything where you want built-in
  behavior, a11y, and cohesive styling.
- **Tailwind v4** (via `@tailwindcss/vite`) for layout and utilities only —
  `flex`, `grid`, `items-center`, `justify-between`, `gap-*`, `p-*`,
  `w-full`, simple text tweaks on plain `<h1>`/`<p>` (`text-sm text-neutral-500`),
  responsive helpers, ad-hoc color/border/shadow.
- **Don't** reimplement Mantine components with Tailwind (a hand-rolled
  `<button className="px-3 py-1.5 bg-blue-500 ...">` loses accessibility
  and cohesion). **Don't** use Mantine `Group`/`Stack` purely to flex two
  things (Tailwind is lighter for pure layout).
- Mixing on one element is fine: `<Stack className="h-full overflow-auto" gap="xs">` — Tailwind for layout, Mantine for spacing tokens.
- **No other UI libraries** — no MUI, Chakra, Ant, Radix, HeadlessUI. No
  CSS-in-JS (styled-components, emotion css prop). CSS Modules only for
  genuinely unique canvas/overlay cases.

See [`../docs/dev-guide-react.md`](../docs/dev-guide-react.md) §3 for
worked examples.

## Layout & hotkeys

- `AppShell` wraps Mantine's `AppShell` with header/navbar/aside/footer; navbar and aside collapse based on `ui.leftPanelOpen` / `ui.rightPanelOpen`.
- Hotkeys registered in `src/layout/useAppHotkeys.ts`: `Ctrl+B` (left), `Ctrl+Alt+B` (right), `Ctrl+K` (palette), `F` (fit), `R` (relayout), `Esc` (clear selection). Add new ones here and wire the matching toolbar affordance in `Toolbar.tsx`.

## Common commands

Run from `site/`:

- `npm install` — install deps.
- `npm run dev` — Vite dev server (default port 5173). Requires `api/` on `:8000`.
- `npm start` — same as dev but binds `0.0.0.0:4242`.
- `npm run build` — `tsc -b && vite build`.
- `npm run preview` — serve the production build.
- `npm run lint` — ESLint flat config (`eslint.config.js`).
- `npm test` / `npm run test:watch` — Vitest (jsdom, Testing Library).

## Vite dev proxy

- `vite.config.ts` proxies `/api` → `http://localhost:8000`.
- If `api/` isn't running, every RTK Query request 502s — the UI renders but graph lists/bodies stay empty and the fetch errors surface in the console/inspector.
- If `api/` binds a different port, update the proxy target here (keep it in sync).

## Gotchas

- **Wire-shape drift:** `src/features/graph/types.ts` must match `api/src/app/domain/` and the JSON emitted by `conversion/ttl2json.py`. Change all three (or a shared contract) together.
- **Two renderers:** every new feature needs a conscious call — one or both. Favor putting logic in `features/view-config/` or `uiSlice` when it's shared.
- **Strict TS:** `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly` are on. Use `import type` for type-only imports.
- **React 19 StrictMode** is enabled — effects run twice in dev; write idempotent setup/teardown.

## Adding a feature (example: a new graph action)

1. If it's a one-shot imperative command (like "center on selection"), add a nonce + reducer to `features/ui/uiSlice.ts` and export the action from `features/ui/index.ts`.
2. Add a `Tooltip`+`ActionIcon` in `src/layout/Toolbar.tsx` that dispatches the action.
3. Register a hotkey in `src/layout/useAppHotkeys.ts`.
4. In each renderer that should respond, subscribe to the nonce with `useAppSelector` and run the side-effect in a `useEffect` keyed on the nonce value.
5. If it needs persisted view state instead of a one-shot, put it in `features/view-config/viewConfigSlice.ts` and read via selectors in `features/view-config/selectors.ts`.
6. Add a Vitest test next to the slice (`*.test.ts`) and/or the component (`*.test.tsx`).
