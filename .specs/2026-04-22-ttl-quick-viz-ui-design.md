# TTL Quick Viz — UI Design Spec

**Date:** 2026-04-22
**Scope:** The `site/` React SPA. The sibling `api/` Go service is out of scope for this spec; the UI is built so that flipping to a real API later is mechanical.

## Purpose

A quick, local dev tool for visually examining property graphs (nodes + edges) as you build them. Paste a graph into a fixture file, reload, see it laid out. Mantine + Tailwind + Redux Toolkit wired up so that follow-on features (API fetching, filters, node inspection) have a place to land without refactoring.

## Goals

- View a property graph (directed, labelled nodes and edges) with pan / zoom / fit-view / minimap.
- Up to ~1,000 nodes with comfortable interaction.
- Load the graph from a bundled sample JSON file for v1.
- RTK Query already in the data path, so swapping to a real HTTP call later is a one-line change.
- Feature-sliced code organisation that reads well and scales with the tool.

## Non-goals (v1)

- No real backend. `api/` stays untouched.
- No node / edge click-to-inspect side panel.
- No search, filter, or highlighting.
- No layout-algorithm switcher (Elk layered by default; tunable in config only).
- No editing. Read-only viewer.
- No dark-mode toggle (can be added later; Mantine + Tailwind both support it).
- No snapshot / visual regression / E2E testing.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Build | Vite + React + TypeScript (`react-ts` template) | Standard modern React scaffold |
| Styling (primary) | Tailwind CSS | All layout, spacing, typography |
| Interactive primitives | Mantine | **Only** for complex interactive components (Button, TextInput, Modal, Select). Not used in v1 render output, but `MantineProvider` is wired so new features can reach for it |
| Graph rendering | `@xyflow/react` (React Flow) | React-native API, built-in pan/zoom/minimap/controls |
| Auto-layout | `elkjs` in a web worker | Quality hierarchical/layered layout; worker keeps UI responsive |
| Data layer | `@reduxjs/toolkit` + `react-redux` | RTK Query as the graph-data abstraction (placeholder now, real API later) |
| Test | Vitest + React Testing Library | Native Vite integration |

**Mantine + Tailwind division of labor:** Tailwind owns structural/visual styling. Mantine is reserved for complex interactive primitives (Button, TextInput, Modal, etc.). No Mantine layout components (`AppShell`, `Container`, `Stack`, `Group`) — use Tailwind.

## Folder layout (feature-sliced)

```
site/
├── src/
│   ├── main.tsx                       # <Provider store> + <MantineProvider> + <ErrorBoundary> + <App/>
│   ├── App.tsx                        # Tailwind layout: <header> + <main><GraphCanvas/></main>
│   ├── index.css                      # Tailwind directives + Mantine base CSS import
│   │
│   ├── app/
│   │   ├── store.ts                   # configureStore + middleware
│   │   └── hooks.ts                   # typed useAppDispatch / useAppSelector
│   │
│   ├── features/
│   │   └── graph/
│   │       ├── GraphCanvas.tsx        # <ReactFlow> + Controls + MiniMap + Background
│   │       ├── graphApi.ts            # RTK Query — getGraph endpoint (placeholder)
│   │       ├── graphSlice.ts          # { selectedGraphId } — stub for UI state
│   │       ├── useElkLayout.ts        # Graph -> positioned RF Node[]/Edge[], memoized
│   │       ├── types.ts               # Graph, GraphNode, GraphEdge
│   │       └── index.ts               # public API barrel
│   │
│   ├── shared/
│   │   └── components/
│   │       └── ErrorBoundary.tsx      # class boundary with Tailwind fallback
│   │
│   └── data/
│       └── sample-graph.json          # one sample graph for v1
│
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsconfig.node.json
└── package.json
```

**Path alias:** `@/*` resolves to `src/*` — configured in `tsconfig.json` (`compilerOptions.paths`) and `vite.config.ts` (`resolve.alias`). All intra-`src` imports use `@/...`.

**Feature boundary rules:**

- A feature imports from its own internals + `shared/` + `app/`.
- Features import from other features only via their `index.ts`.
- `features/graph/index.ts` re-exports: `GraphCanvas`, `useGetGraphQuery`, `graphSlice`, `types`.
- No feature imports from another feature's internal file path.

## Canonical graph JSON shape

```json
{
  "nodes": [
    { "id": "n1", "label": "Alice", "attrs": { "role": "admin" } }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2", "label": "knows", "attrs": {} }
  ]
}
```

**Contract:**

- `id` is required on every node and edge and must be unique within its collection.
- `label` and `attrs` are optional on both.
- Edges are directed; `source` and `target` must reference existing node ids.
- `attrs` is a free-form JSON object reserved for future inspector panels.

TypeScript contract (`features/graph/types.ts`):

```ts
export type GraphNode = {
  id: string;
  label?: string;
  attrs?: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  attrs?: Record<string, unknown>;
};

export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};
```

## Components

### `main.tsx`

Bootstraps React, nests providers in this order: `<Provider store>` → `<MantineProvider>` → `<ErrorBoundary>` → `<App/>`. Imports Mantine core CSS and Tailwind directives via `index.css`.

### `App.tsx`

Plain Tailwind layout — no Mantine shell:

```tsx
<div className="flex h-dvh flex-col bg-neutral-50">
  <header className="flex items-center border-b border-neutral-200 px-4 py-2">
    <h1 className="text-sm font-medium text-neutral-700">TTL Quick Viz</h1>
  </header>
  <main className="flex-1 min-h-0">
    <GraphCanvas />
  </main>
</div>
```

### `app/store.ts`

```ts
export const store = configureStore({
  reducer: {
    graph: graphSlice.reducer,
    [graphApi.reducerPath]: graphApi.reducer,
  },
  middleware: (gDM) => gDM().concat(graphApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### `app/hooks.ts`

Typed `useAppDispatch` and `useAppSelector` per standard RTK pattern.

### `features/graph/graphApi.ts`

RTK Query API. For v1, `queryFn` resolves with the imported sample JSON — no `fetch`.

```ts
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import sampleGraph from '@/data/sample-graph.json';
import type { Graph } from './types';

export const graphApi = createApi({
  reducerPath: 'graphApi',
  baseQuery: fakeBaseQuery<Error>(),
  endpoints: (build) => ({
    getGraph: build.query<Graph, string>({
      queryFn: async (_id) => ({ data: sampleGraph as Graph }),
    }),
  }),
});

export const { useGetGraphQuery } = graphApi;
```

**Future API flip** (pointer, not v1 work): swap the definition to

```ts
baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
endpoints: (build) => ({
  getGraph: build.query<Graph, string>({
    query: (id) => `/graphs/${id}`,
  }),
}),
```

Component code is untouched because `useGetGraphQuery('sample')` keeps the same signature.

### `features/graph/graphSlice.ts`

Minimal UI-state slice:

```ts
const graphSlice = createSlice({
  name: 'graph',
  initialState: { selectedGraphId: 'sample' } as { selectedGraphId: string },
  reducers: {
    setSelectedGraphId(state, action: PayloadAction<string>) {
      state.selectedGraphId = action.payload;
    },
  },
});
```

Wired into the store but not consumed in v1 components. It exists so the second thing that needs store state has an obvious home.

### `features/graph/useElkLayout.ts`

```ts
type LayoutStatus = 'idle' | 'laying-out' | 'ready' | 'error';

type UseElkLayoutResult = {
  status: LayoutStatus;
  nodes: Node[];        // React Flow Node[]
  edges: Edge[];        // React Flow Edge[]
  error?: Error;
};

export function useElkLayout(graph: Graph | undefined): UseElkLayoutResult;
```

- Uses `elkjs/lib/elk.bundled.js` with the bundled worker.
- Default layout options: `{ 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.spacing.nodeNode': '40', 'elk.layered.spacing.nodeNodeBetweenLayers': '60' }`.
- Memoized by graph reference identity.
- Uses a "latest-request" sentinel so that a stale layout result doesn't overwrite a newer one when graphs change quickly.
- On Elk failure: returns `status: 'error'` with all nodes positioned at `(0, 0)` so the canvas can still render something.

### `features/graph/GraphCanvas.tsx`

```tsx
export function GraphCanvas() {
  const { data, isLoading, error } = useGetGraphQuery('sample');
  const layout = useElkLayout(data);

  if (isLoading || layout.status === 'laying-out') {
    return <div className="flex h-full items-center justify-center text-neutral-500">Loading…</div>;
  }
  if (error) {
    return <div className="flex h-full items-center justify-center text-red-600">Failed to load graph.</div>;
  }

  return (
    <ReactFlow nodes={layout.nodes} edges={layout.edges} fitView nodesDraggable>
      <Background />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  );
}
```

Edges are directed — React Flow renders arrowheads by default.

### `shared/components/ErrorBoundary.tsx`

Classic React class boundary with a Tailwind-styled fallback (`"Something went wrong."` + a "Reload" button that calls `window.location.reload()`).

### `data/sample-graph.json`

A single sample graph — ~20 nodes, ~25 edges, mixed labels and attrs — enough to demonstrate pan / zoom / minimap meaningfully without being noisy.

## Data flow

1. App mounts. `main.tsx` wraps it in Redux store + Mantine provider + error boundary.
2. `GraphCanvas` calls `useGetGraphQuery('sample')`.
3. RTK Query's `queryFn` returns the imported sample JSON synchronously (cached thereafter).
4. `useElkLayout(data)` runs Elk in a worker. While running, status is `'laying-out'` → UI shows loading state.
5. Worker resolves with positioned nodes/edges → hook returns `status: 'ready'`.
6. `<ReactFlow>` renders with `fitView` so the whole graph is visible on first paint.
7. User pans, zooms, drags nodes; React Flow handles it locally (no re-layout, no state round-trip).

## Error handling

Scope-appropriate for a dev tool:

- **Malformed / missing sample JSON:** caught by TypeScript at build time; runtime fallback path via RTK Query error state.
- **Elk failure:** hook returns `status: 'error'`; fallback positions all nodes at `(0, 0)` so something renders; error is surfaced via `console.error`.
- **Uncaught render errors:** `ErrorBoundary` catches and shows the fallback.
- No toasts, no retry UI, no sentry.

## Testing

Minimal and hand-chosen, not comprehensive. Using Vitest + React Testing Library.

- **`useElkLayout` unit test:** small synthetic graph (3 nodes, 2 edges) → hook resolves to `status: 'ready'` with positioned entries matching the input count. Worker is mocked via a test-only Elk stub that runs synchronously.
- **`graphApi.getGraph` test:** dispatch the query through `setupApiStore` (or minimal `<Provider>`) and assert the returned shape matches the `Graph` contract.
- **`<GraphCanvas />` smoke test:** mount with a mocked `useGetGraphQuery` → shows loading → shows the ReactFlow container once layout resolves. Verifies providers wire up without errors.

Explicitly **out of scope** for v1 tests: snapshot tests, layout correctness beyond counts, visual regression, E2E with Playwright.

## Dev loop

```
npm install
npm run dev
```

Opens Vite at `http://localhost:5173`. Sample graph loads on mount, laid out in a worker, rendered by React Flow. Editing the sample JSON and hot-reloading shows the new graph.

## Future work (not in v1)

- `api/` Go backend — real `GET /graphs/:id`, list endpoint for a picker.
- Fixture picker UI (Mantine `Select`) once there's more than one graph to choose from.
- Node / edge click → Mantine `Modal` inspector showing `attrs`.
- Text search / filter via Mantine `TextInput`.
- Neighbor highlighting, path highlighting, stats bar.
- Layout algorithm switcher (Elk has many; currently hardcoded to `layered`).
- Dark mode toggle (Mantine color scheme + Tailwind dark variant).
