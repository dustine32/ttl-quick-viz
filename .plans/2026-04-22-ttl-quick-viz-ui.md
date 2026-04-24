# TTL Quick Viz — UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Vite + React + TypeScript SPA under `site/` that visualises a property graph loaded from a bundled sample JSON, using React Flow + elkjs for layout, Tailwind for structural styling, Mantine for the provider only (no rendered primitives in v1), and Redux Toolkit + RTK Query as the data-layer placeholder for a future Go API.

**Architecture:** Feature-sliced layout with one feature (`graph`). RTK Query's `getGraph` endpoint currently resolves with the imported sample JSON via `queryFn`; a future one-line change swaps it to `fetchBaseQuery({ baseUrl: '/api' })`. Elk runs in its bundled worker; `useElkLayout` handles stale-request guarding so fast graph changes don't race.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind v4 (`@tailwindcss/vite`), Mantine v7 (provider only), `@xyflow/react`, `elkjs`, `@reduxjs/toolkit`, `react-redux`, Vitest + React Testing Library.

**Spec:** `.specs/2026-04-22-ttl-quick-viz-ui-design.md`

---

## Pre-flight notes for the executing engineer

1. **Working directory for all commands is `/Users/ebertdu/go/ttl-quick-viz/site`** unless stated otherwise. `site/` is an empty directory today.
2. **No `git add` / `git commit` in this plan.** The project owner commits manually. Each task ends at a natural commit boundary — the owner may choose to commit then; do not invoke git.
3. **Run `npm run dev`, `npm test`, and `npx tsc --noEmit` as smoke checks between tasks.** If type-checking or tests break, stop and fix before moving on.
4. **Tailwind v4 uses a Vite plugin, not a `tailwind.config.js` file by default.** The spec's folder layout listed a config file illustratively — we omit it unless we need theme customisation, which v1 does not.
5. **Mantine v7 requires `@mantine/core` + `@mantine/hooks` and a `MantineProvider`; import its CSS once.** We wire it but use no Mantine components in v1 — the provider is a placeholder for future `Button`, `TextInput`, `Modal` usage per the spec.

---

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `site/package.json`, `site/tsconfig.json`, `site/tsconfig.node.json`, `site/vite.config.ts`, `site/index.html`, `site/src/main.tsx`, `site/src/App.tsx`, `site/src/index.css`, `site/.gitignore`, `site/public/vite.svg` (everything produced by the Vite template)
- Remove after scaffold: `site/src/App.css`, `site/src/assets/` (demo-only)

- [ ] **Step 1: Initialise the Vite project in the existing `site/` directory**

From `/Users/ebertdu/go/ttl-quick-viz/site`:

```bash
npm create vite@latest . -- --template react-ts
```

When prompted that the directory is empty/current, proceed. Accept the react-ts template.

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

- [ ] **Step 3: Verify dev server boots**

```bash
npm run dev
```

Expected: Vite prints `Local: http://localhost:5173/`. Open it — should see the default Vite + React page. Stop the server (`Ctrl+C`).

- [ ] **Step 4: Remove the template's demo artifacts we won't use**

Delete these paths:
- `site/src/App.css`
- `site/src/assets/react.svg`

Empty the content of `site/src/App.tsx` — replace with a minimal stub:

```tsx
export default function App() {
  return <div>TTL Quick Viz</div>;
}
```

Replace `site/src/index.css` with a single newline (we'll add Tailwind in Task 2):

```css
```

- [ ] **Step 5: Verify the app still boots and renders the stub**

```bash
npm run dev
```

Expected: page shows the text "TTL Quick Viz". Stop the server.

- [ ] **Step 6: Verify TypeScript type-checks cleanly**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

### Task 2: Install and configure Tailwind v4

**Files:**
- Modify: `site/vite.config.ts`
- Modify: `site/src/index.css`
- Modify: `site/src/App.tsx` (temporarily, to verify a Tailwind class applies)

- [ ] **Step 1: Install Tailwind and its Vite plugin**

```bash
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Register the plugin in `vite.config.ts`**

Replace the contents of `site/vite.config.ts` with:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

- [ ] **Step 3: Import Tailwind in `index.css`**

Replace the contents of `site/src/index.css` with:

```css
@import "tailwindcss";
```

- [ ] **Step 4: Smoke-verify a Tailwind utility works**

Temporarily edit `site/src/App.tsx` to use a Tailwind class:

```tsx
export default function App() {
  return (
    <div className="p-4 text-blue-600 font-bold">
      TTL Quick Viz
    </div>
  );
}
```

- [ ] **Step 5: Run dev server and visually verify**

```bash
npm run dev
```

Expected: the text "TTL Quick Viz" appears **bold, blue, with padding**. Stop the server.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

### Task 3: Configure `@/*` path alias

**Files:**
- Modify: `site/tsconfig.json`
- Modify: `site/vite.config.ts`
- Modify: `site/src/App.tsx` (smoke import)

- [ ] **Step 1: Add `paths` to `tsconfig.json`**

Open `site/tsconfig.json`. Inside `compilerOptions`, add:

```json
"baseUrl": ".",
"paths": {
  "@/*": ["src/*"]
}
```

The resulting `compilerOptions` block should retain everything that was there and add these two keys.

- [ ] **Step 2: Add `resolve.alias` to `vite.config.ts`**

Replace `site/vite.config.ts` with:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 3: Ensure Node types are available for `__dirname`**

```bash
npm install -D @types/node
```

- [ ] **Step 4: Create a tiny aliased file and import it**

Create `site/src/hello.ts`:

```ts
export const hello = 'aliased import works';
```

Modify `site/src/App.tsx`:

```tsx
import { hello } from '@/hello';

export default function App() {
  return (
    <div className="p-4 text-blue-600 font-bold">
      {hello}
    </div>
  );
}
```

- [ ] **Step 5: Verify dev server resolves the alias**

```bash
npm run dev
```

Expected: page renders "aliased import works" in bold blue. Stop the server.

- [ ] **Step 6: Verify TypeScript resolves the alias**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 7: Clean up the smoke file**

Delete `site/src/hello.ts`. Revert `site/src/App.tsx` to:

```tsx
export default function App() {
  return (
    <div className="p-4 text-blue-600 font-bold">
      TTL Quick Viz
    </div>
  );
}
```

---

### Task 4: Set up Vitest + React Testing Library

**Files:**
- Modify: `site/package.json` (adds `test` script)
- Modify: `site/vite.config.ts` (adds `test` config)
- Create: `site/src/test/setup.ts`
- Create: `site/src/test/smoke.test.tsx`
- Modify: `site/tsconfig.json` (adds vitest globals type)

- [ ] **Step 1: Install Vitest and RTL**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Add the `test` script to `package.json`**

Open `site/package.json`. Under `scripts`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configure Vitest inside `vite.config.ts`**

Replace `site/vite.config.ts` with:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

- [ ] **Step 4: Create the test setup file**

Create `site/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Add Vitest globals to the TypeScript config**

Open `site/tsconfig.json`. Inside `compilerOptions.types` (add the array if missing), add `"vitest/globals"` and `"@testing-library/jest-dom"`:

```json
"types": ["vitest/globals", "@testing-library/jest-dom"]
```

- [ ] **Step 6: Write a failing smoke test**

Create `site/src/test/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import App from '@/App';

describe('App', () => {
  it('renders the title', () => {
    render(<App />);
    expect(screen.getByText('TTL Quick Viz')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the test and verify it passes**

```bash
npm test
```

Expected: `1 passed`. If it fails, check that App renders the literal "TTL Quick Viz" text from Task 3 Step 7.

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

### Task 5: Wire MantineProvider

**Files:**
- Modify: `site/src/main.tsx`
- Modify: `site/src/index.css`
- Modify: `site/src/test/setup.ts` (match Mantine v7 test requirements)

- [ ] **Step 1: Install Mantine**

```bash
npm install @mantine/core @mantine/hooks
```

- [ ] **Step 2: Import Mantine core CSS into `index.css`**

Modify `site/src/index.css` to:

```css
@import "@mantine/core/styles.css";
@import "tailwindcss";
```

Order matters: Mantine CSS before Tailwind so Tailwind utilities override Mantine defaults if they ever collide.

- [ ] **Step 3: Wrap the app in `MantineProvider` in `main.tsx`**

Replace `site/src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import App from '@/App';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <App />
    </MantineProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: Mock `window.matchMedia` for Mantine in tests**

Mantine's color-scheme logic calls `window.matchMedia`, which jsdom does not implement. Modify `site/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';

// Mantine queries color scheme at render time; jsdom lacks matchMedia.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
```

- [ ] **Step 5: Verify dev boots and test still passes**

```bash
npm run dev
```

Expected: still shows "TTL Quick Viz" with Tailwind styling. Stop the server.

```bash
npm test
```

Expected: `1 passed`.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

### Task 6: Set up Redux store with typed hooks

**Files:**
- Create: `site/src/app/store.ts`
- Create: `site/src/app/hooks.ts`
- Modify: `site/src/main.tsx`
- Create: `site/src/app/store.test.ts`

- [ ] **Step 1: Install Redux Toolkit and react-redux**

```bash
npm install @reduxjs/toolkit react-redux
```

- [ ] **Step 2: Write a failing test for the empty store**

Create `site/src/app/store.test.ts`:

```ts
import { store } from '@/app/store';

describe('store', () => {
  it('is configured and returns an initial state object', () => {
    const state = store.getState();
    expect(typeof state).toBe('object');
    expect(state).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
npm test
```

Expected: FAIL with `Cannot find module '@/app/store'`.

- [ ] **Step 4: Implement the empty store**

Create `site/src/app/store.ts`:

```ts
import { configureStore } from '@reduxjs/toolkit';

export const store = configureStore({
  reducer: {},
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 5: Run the test and verify it passes**

```bash
npm test
```

Expected: `2 passed`.

- [ ] **Step 6: Add typed hooks**

Create `site/src/app/hooks.ts`:

```ts
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/app/store';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: <T>(selector: (state: RootState) => T) => T = useSelector;
```

- [ ] **Step 7: Wrap `App` in `<Provider store>`**

Modify `site/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { store } from '@/app/store';
import App from '@/App';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <MantineProvider>
        <App />
      </MantineProvider>
    </Provider>
  </StrictMode>,
);
```

- [ ] **Step 8: Verify dev boots and tests pass**

```bash
npm run dev
```

Expected: page still renders. Stop the server.

```bash
npm test && npx tsc --noEmit
```

Expected: `2 passed`, no type errors.

---

### Task 7: Define graph types and feature barrel

**Files:**
- Create: `site/src/features/graph/types.ts`
- Create: `site/src/features/graph/index.ts`

- [ ] **Step 1: Create the types module**

Create `site/src/features/graph/types.ts`:

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

- [ ] **Step 2: Create the feature barrel**

Create `site/src/features/graph/index.ts`:

```ts
export type { Graph, GraphNode, GraphEdge } from '@/features/graph/types';
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

### Task 8: Create sample graph fixture

**Files:**
- Create: `site/src/data/sample-graph.json`

- [ ] **Step 1: Create the sample graph**

Create `site/src/data/sample-graph.json` with ~20 nodes and ~25 edges representing a small org chart with mixed labels and attrs:

```json
{
  "nodes": [
    { "id": "n1",  "label": "CEO",        "attrs": { "dept": "exec" } },
    { "id": "n2",  "label": "CTO",        "attrs": { "dept": "engineering" } },
    { "id": "n3",  "label": "CFO",        "attrs": { "dept": "finance" } },
    { "id": "n4",  "label": "VP Eng",     "attrs": { "dept": "engineering" } },
    { "id": "n5",  "label": "VP Product", "attrs": { "dept": "product" } },
    { "id": "n6",  "label": "Eng Mgr A",  "attrs": { "dept": "engineering" } },
    { "id": "n7",  "label": "Eng Mgr B",  "attrs": { "dept": "engineering" } },
    { "id": "n8",  "label": "PM Alice",   "attrs": { "dept": "product" } },
    { "id": "n9",  "label": "PM Bob",     "attrs": { "dept": "product" } },
    { "id": "n10", "label": "Dev 1",      "attrs": { "dept": "engineering" } },
    { "id": "n11", "label": "Dev 2",      "attrs": { "dept": "engineering" } },
    { "id": "n12", "label": "Dev 3",      "attrs": { "dept": "engineering" } },
    { "id": "n13", "label": "Dev 4",      "attrs": { "dept": "engineering" } },
    { "id": "n14", "label": "Dev 5",      "attrs": { "dept": "engineering" } },
    { "id": "n15", "label": "Dev 6",      "attrs": { "dept": "engineering" } },
    { "id": "n16", "label": "Finance 1",  "attrs": { "dept": "finance" } },
    { "id": "n17", "label": "Finance 2",  "attrs": { "dept": "finance" } },
    { "id": "n18", "label": "Designer 1", "attrs": { "dept": "product" } },
    { "id": "n19", "label": "Designer 2", "attrs": { "dept": "product" } },
    { "id": "n20", "label": "Contractor", "attrs": { "dept": "external" } }
  ],
  "edges": [
    { "id": "e1",  "source": "n1",  "target": "n2",  "label": "manages" },
    { "id": "e2",  "source": "n1",  "target": "n3",  "label": "manages" },
    { "id": "e3",  "source": "n1",  "target": "n5",  "label": "manages" },
    { "id": "e4",  "source": "n2",  "target": "n4",  "label": "manages" },
    { "id": "e5",  "source": "n4",  "target": "n6",  "label": "manages" },
    { "id": "e6",  "source": "n4",  "target": "n7",  "label": "manages" },
    { "id": "e7",  "source": "n6",  "target": "n10", "label": "manages" },
    { "id": "e8",  "source": "n6",  "target": "n11", "label": "manages" },
    { "id": "e9",  "source": "n6",  "target": "n12", "label": "manages" },
    { "id": "e10", "source": "n7",  "target": "n13", "label": "manages" },
    { "id": "e11", "source": "n7",  "target": "n14", "label": "manages" },
    { "id": "e12", "source": "n7",  "target": "n15", "label": "manages" },
    { "id": "e13", "source": "n5",  "target": "n8",  "label": "manages" },
    { "id": "e14", "source": "n5",  "target": "n9",  "label": "manages" },
    { "id": "e15", "source": "n8",  "target": "n18", "label": "collaborates" },
    { "id": "e16", "source": "n9",  "target": "n19", "label": "collaborates" },
    { "id": "e17", "source": "n3",  "target": "n16", "label": "manages" },
    { "id": "e18", "source": "n3",  "target": "n17", "label": "manages" },
    { "id": "e19", "source": "n6",  "target": "n20", "label": "contracts" },
    { "id": "e20", "source": "n10", "target": "n11", "label": "pairs_with" },
    { "id": "e21", "source": "n12", "target": "n13", "label": "pairs_with" },
    { "id": "e22", "source": "n8",  "target": "n6",  "label": "coordinates" },
    { "id": "e23", "source": "n9",  "target": "n7",  "label": "coordinates" },
    { "id": "e24", "source": "n18", "target": "n19", "label": "pairs_with" },
    { "id": "e25", "source": "n2",  "target": "n5",  "label": "peers" }
  ]
}
```

- [ ] **Step 2: Ensure Vite's TypeScript handles JSON imports**

The default Vite `react-ts` template enables `resolveJsonModule` and `esModuleInterop` — verify by running:

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0. If you get "Cannot find module '...json'" errors later, add `"resolveJsonModule": true` to `tsconfig.json` → `compilerOptions`.

---

### Task 9: Implement `graphSlice` (TDD)

**Files:**
- Create: `site/src/features/graph/graphSlice.test.ts`
- Create: `site/src/features/graph/graphSlice.ts`
- Modify: `site/src/features/graph/index.ts`
- Modify: `site/src/app/store.ts`

- [ ] **Step 1: Write failing tests for the slice**

Create `site/src/features/graph/graphSlice.test.ts`:

```ts
import { graphSlice, setSelectedGraphId } from '@/features/graph/graphSlice';

describe('graphSlice', () => {
  it('starts with selectedGraphId = "sample"', () => {
    const state = graphSlice.reducer(undefined, { type: '@@INIT' });
    expect(state.selectedGraphId).toBe('sample');
  });

  it('setSelectedGraphId updates the id', () => {
    const state = graphSlice.reducer(
      { selectedGraphId: 'sample' },
      setSelectedGraphId('other'),
    );
    expect(state.selectedGraphId).toBe('other');
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test
```

Expected: FAIL with module not found or similar.

- [ ] **Step 3: Implement the slice**

Create `site/src/features/graph/graphSlice.ts`:

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type GraphUiState = {
  selectedGraphId: string;
};

const initialState: GraphUiState = {
  selectedGraphId: 'sample',
};

export const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    setSelectedGraphId(state, action: PayloadAction<string>) {
      state.selectedGraphId = action.payload;
    },
  },
});

export const { setSelectedGraphId } = graphSlice.actions;
export const graphReducer = graphSlice.reducer;
```

- [ ] **Step 4: Export from the feature barrel**

Modify `site/src/features/graph/index.ts`:

```ts
export type { Graph, GraphNode, GraphEdge } from '@/features/graph/types';
export { graphSlice, graphReducer, setSelectedGraphId } from '@/features/graph/graphSlice';
```

- [ ] **Step 5: Wire into the store**

Modify `site/src/app/store.ts`:

```ts
import { configureStore } from '@reduxjs/toolkit';
import { graphReducer } from '@/features/graph';

export const store = configureStore({
  reducer: {
    graph: graphReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: `4 passed`.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

### Task 10: Implement `graphApi` (RTK Query placeholder, TDD)

**Files:**
- Create: `site/src/features/graph/graphApi.test.ts`
- Create: `site/src/features/graph/graphApi.ts`
- Modify: `site/src/features/graph/index.ts`
- Modify: `site/src/app/store.ts`

- [ ] **Step 1: Write a failing test that exercises the endpoint**

Create `site/src/features/graph/graphApi.test.ts`:

```ts
import { configureStore } from '@reduxjs/toolkit';
import { graphApi } from '@/features/graph/graphApi';
import type { Graph } from '@/features/graph/types';

function makeStore() {
  return configureStore({
    reducer: { [graphApi.reducerPath]: graphApi.reducer },
    middleware: (gDM) => gDM().concat(graphApi.middleware),
  });
}

describe('graphApi.getGraph', () => {
  it('returns a Graph with nodes and edges for the "sample" id', async () => {
    const store = makeStore();
    const result = await store.dispatch(graphApi.endpoints.getGraph.initiate('sample'));
    expect(result.data).toBeDefined();
    const data = result.data as Graph;
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(Array.isArray(data.edges)).toBe(true);
    expect(data.nodes.length).toBeGreaterThan(0);
    expect(data.edges.length).toBeGreaterThan(0);
    const firstNode = data.nodes[0];
    expect(typeof firstNode.id).toBe('string');
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement the API**

Create `site/src/features/graph/graphApi.ts`:

```ts
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import sampleGraph from '@/data/sample-graph.json';
import type { Graph } from '@/features/graph/types';

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

- [ ] **Step 4: Export from the feature barrel**

Modify `site/src/features/graph/index.ts`:

```ts
export type { Graph, GraphNode, GraphEdge } from '@/features/graph/types';
export { graphSlice, graphReducer, setSelectedGraphId } from '@/features/graph/graphSlice';
export { graphApi, useGetGraphQuery } from '@/features/graph/graphApi';
```

- [ ] **Step 5: Wire into the store**

Modify `site/src/app/store.ts`:

```ts
import { configureStore } from '@reduxjs/toolkit';
import { graphReducer, graphApi } from '@/features/graph';

export const store = configureStore({
  reducer: {
    graph: graphReducer,
    [graphApi.reducerPath]: graphApi.reducer,
  },
  middleware: (gDM) => gDM().concat(graphApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: `5 passed`.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

### Task 11: Install `elkjs` and implement `useElkLayout` (TDD)

**Files:**
- Create: `site/src/features/graph/useElkLayout.test.tsx`
- Create: `site/src/features/graph/useElkLayout.ts`
- Create: `site/src/features/graph/elkOptions.ts`
- Modify: `site/src/features/graph/index.ts`

- [ ] **Step 1: Install `elkjs` and `@xyflow/react` (we need its Node/Edge types for the hook signature)**

```bash
npm install elkjs @xyflow/react
```

- [ ] **Step 2: Write failing tests for the hook**

We mock elkjs so tests don't depend on real layout. Create `site/src/features/graph/useElkLayout.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { Graph } from '@/features/graph/types';

// Mock elkjs with a deterministic synchronous-ish layout.
vi.mock('elkjs/lib/elk.bundled.js', () => {
  class FakeELK {
    async layout(input: {
      children: Array<{ id: string; width: number; height: number }>;
      edges: Array<{ id: string; sources: string[]; targets: string[] }>;
    }) {
      return {
        ...input,
        children: input.children.map((c, i) => ({ ...c, x: i * 120, y: 0 })),
        edges: input.edges,
      };
    }
  }
  return { default: FakeELK };
});

// Import AFTER mock so the hook picks up the mocked module.
import { useElkLayout } from '@/features/graph/useElkLayout';

const graph: Graph = {
  nodes: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ],
  edges: [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'bc', source: 'b', target: 'c' },
  ],
};

describe('useElkLayout', () => {
  it('returns status "ready" and positioned nodes/edges for a valid graph', async () => {
    const { result } = renderHook(() => useElkLayout(graph));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.nodes).toHaveLength(3);
    expect(result.current.edges).toHaveLength(2);

    const first = result.current.nodes[0];
    expect(first.id).toBe('a');
    expect(typeof first.position.x).toBe('number');
    expect(typeof first.position.y).toBe('number');

    const firstEdge = result.current.edges[0];
    expect(firstEdge.source).toBe('a');
    expect(firstEdge.target).toBe('b');
  });

  it('returns status "idle" with empty arrays when graph is undefined', () => {
    const { result } = renderHook(() => useElkLayout(undefined));
    expect(result.current.status).toBe('idle');
    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
  });
});
```

- [ ] **Step 3: Run and verify failure**

```bash
npm test
```

Expected: FAIL with module not found for `@/features/graph/useElkLayout`.

- [ ] **Step 4: Create the Elk options module**

Create `site/src/features/graph/elkOptions.ts`:

```ts
export const elkLayoutOptions: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '60',
};

export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 44;
```

- [ ] **Step 5: Implement the hook**

Create `site/src/features/graph/useElkLayout.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from '@xyflow/react';
import type { Graph } from '@/features/graph/types';
import { elkLayoutOptions, NODE_WIDTH, NODE_HEIGHT } from '@/features/graph/elkOptions';

type LayoutStatus = 'idle' | 'laying-out' | 'ready' | 'error';

export type UseElkLayoutResult = {
  status: LayoutStatus;
  nodes: Node[];
  edges: Edge[];
  error?: Error;
};

const elk = new ELK();

export function useElkLayout(graph: Graph | undefined): UseElkLayoutResult {
  const [result, setResult] = useState<UseElkLayoutResult>({
    status: 'idle',
    nodes: [],
    edges: [],
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!graph) {
      setResult({ status: 'idle', nodes: [], edges: [] });
      return;
    }

    const myRequest = ++requestIdRef.current;
    setResult((prev) => ({ ...prev, status: 'laying-out' }));

    const elkInput = {
      id: 'root',
      layoutOptions: elkLayoutOptions,
      children: graph.nodes.map((n) => ({
        id: n.id,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };

    elk
      .layout(elkInput)
      .then((layouted) => {
        if (myRequest !== requestIdRef.current) return;
        const positionedNodes: Node[] = (layouted.children ?? []).map((c) => {
          const original = graph.nodes.find((n) => n.id === c.id);
          return {
            id: c.id,
            position: { x: c.x ?? 0, y: c.y ?? 0 },
            data: { label: original?.label ?? c.id },
          };
        });
        const positionedEdges: Edge[] = graph.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
        }));
        setResult({
          status: 'ready',
          nodes: positionedNodes,
          edges: positionedEdges,
        });
      })
      .catch((err: unknown) => {
        if (myRequest !== requestIdRef.current) return;
        const fallbackNodes: Node[] = graph.nodes.map((n) => ({
          id: n.id,
          position: { x: 0, y: 0 },
          data: { label: n.label ?? n.id },
        }));
        const fallbackEdges: Edge[] = graph.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
        }));
        setResult({
          status: 'error',
          nodes: fallbackNodes,
          edges: fallbackEdges,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
  }, [graph]);

  return result;
}
```

- [ ] **Step 6: Export from the feature barrel**

Modify `site/src/features/graph/index.ts`:

```ts
export type { Graph, GraphNode, GraphEdge } from '@/features/graph/types';
export { graphSlice, graphReducer, setSelectedGraphId } from '@/features/graph/graphSlice';
export { graphApi, useGetGraphQuery } from '@/features/graph/graphApi';
export { useElkLayout } from '@/features/graph/useElkLayout';
export type { UseElkLayoutResult } from '@/features/graph/useElkLayout';
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: `7 passed`.

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

### Task 12: Implement `GraphCanvas` (TDD smoke)

**Files:**
- Create: `site/src/features/graph/GraphCanvas.test.tsx`
- Create: `site/src/features/graph/GraphCanvas.tsx`
- Modify: `site/src/features/graph/index.ts`

- [ ] **Step 1: Write a failing smoke test**

Create `site/src/features/graph/GraphCanvas.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { vi } from 'vitest';
import { store } from '@/app/store';

// Mock elkjs so we get a deterministic ready state.
vi.mock('elkjs/lib/elk.bundled.js', () => {
  class FakeELK {
    async layout(input: { children: Array<{ id: string }>; edges: unknown[] }) {
      return {
        ...input,
        children: input.children.map((c, i) => ({ ...c, x: i * 100, y: 0 })),
      };
    }
  }
  return { default: FakeELK };
});

// Mock @xyflow/react: React Flow does heavy DOM measurement that jsdom handles badly.
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes }: { children: React.ReactNode; nodes: Array<{ id: string }> }) => (
    <div data-testid="react-flow" data-node-count={nodes.length}>
      {children}
    </div>
  ),
  Background: () => <div data-testid="rf-background" />,
  MiniMap: () => <div data-testid="rf-minimap" />,
  Controls: () => <div data-testid="rf-controls" />,
}));

import { GraphCanvas } from '@/features/graph/GraphCanvas';

function renderCanvas() {
  return render(
    <Provider store={store}>
      <MantineProvider>
        <GraphCanvas />
      </MantineProvider>
    </Provider>,
  );
}

describe('GraphCanvas', () => {
  it('shows loading, then renders the ReactFlow container once layout is ready', async () => {
    renderCanvas();

    // Loading state is synchronous on first render.
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    const rf = screen.getByTestId('react-flow');
    expect(Number(rf.getAttribute('data-node-count'))).toBeGreaterThan(0);
    expect(screen.getByTestId('rf-minimap')).toBeInTheDocument();
    expect(screen.getByTestId('rf-controls')).toBeInTheDocument();
    expect(screen.getByTestId('rf-background')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test
```

Expected: FAIL with module not found.

- [ ] **Step 3: Import React Flow styles in `index.css`**

React Flow needs its stylesheet or nodes render invisible. Modify `site/src/index.css`:

```css
@import "@mantine/core/styles.css";
@import "@xyflow/react/dist/style.css";
@import "tailwindcss";
```

- [ ] **Step 4: Implement `GraphCanvas`**

Create `site/src/features/graph/GraphCanvas.tsx`:

```tsx
import { ReactFlow, Background, MiniMap, Controls } from '@xyflow/react';
import { useGetGraphQuery } from '@/features/graph/graphApi';
import { useElkLayout } from '@/features/graph/useElkLayout';

export function GraphCanvas() {
  const { data, isLoading, error } = useGetGraphQuery('sample');
  const layout = useElkLayout(data);

  if (isLoading || layout.status === 'laying-out' || layout.status === 'idle') {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-600">
        Failed to load graph.
      </div>
    );
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

- [ ] **Step 5: Export from the feature barrel**

Modify `site/src/features/graph/index.ts`:

```ts
export type { Graph, GraphNode, GraphEdge } from '@/features/graph/types';
export { graphSlice, graphReducer, setSelectedGraphId } from '@/features/graph/graphSlice';
export { graphApi, useGetGraphQuery } from '@/features/graph/graphApi';
export { useElkLayout } from '@/features/graph/useElkLayout';
export type { UseElkLayoutResult } from '@/features/graph/useElkLayout';
export { GraphCanvas } from '@/features/graph/GraphCanvas';
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: `8 passed`.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

### Task 13: Implement `ErrorBoundary` (TDD)

**Files:**
- Create: `site/src/shared/components/ErrorBoundary.test.tsx`
- Create: `site/src/shared/components/ErrorBoundary.tsx`

- [ ] **Step 1: Write failing tests**

Create `site/src/shared/components/ErrorBoundary.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

function Boom() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  const originalError = console.error;

  beforeEach(() => {
    // React logs caught errors to console.error; silence the noise in test output.
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>ok</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('renders fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement the boundary**

Create `site/src/shared/components/ErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-700">
          <p className="text-sm">Something went wrong.</p>
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: `10 passed`.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

---

### Task 14: Wire final `App.tsx` layout and run end-to-end smoke

**Files:**
- Modify: `site/src/App.tsx`
- Modify: `site/src/main.tsx`
- Modify: `site/src/test/smoke.test.tsx`

- [ ] **Step 1: Update the App smoke test**

The App now renders the `GraphCanvas` inside the shell, so the earlier smoke assertion needs to match the new output. Modify `site/src/test/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { vi } from 'vitest';
import { store } from '@/app/store';

vi.mock('elkjs/lib/elk.bundled.js', () => {
  class FakeELK {
    async layout(input: { children: Array<{ id: string }>; edges: unknown[] }) {
      return {
        ...input,
        children: input.children.map((c, i) => ({ ...c, x: i * 100, y: 0 })),
      };
    }
  }
  return { default: FakeELK };
});

vi.mock('@xyflow/react', () => ({
  ReactFlow: () => <div data-testid="react-flow" />,
  Background: () => null,
  MiniMap: () => null,
  Controls: () => null,
}));

import App from '@/App';

describe('App', () => {
  it('renders the header title and the graph canvas region', () => {
    render(
      <Provider store={store}>
        <MantineProvider>
          <App />
        </MantineProvider>
      </Provider>,
    );
    expect(screen.getByRole('heading', { name: /TTL Quick Viz/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify the existing test now fails**

```bash
npm test
```

Expected: smoke test FAILS — current `App.tsx` doesn't render a heading with the right role yet.

- [ ] **Step 3: Update `App.tsx` with the final layout**

Replace `site/src/App.tsx` with:

```tsx
import { GraphCanvas } from '@/features/graph';

export default function App() {
  return (
    <div className="flex h-dvh flex-col bg-neutral-50">
      <header className="flex items-center border-b border-neutral-200 px-4 py-2">
        <h1 className="text-sm font-medium text-neutral-700">TTL Quick Viz</h1>
      </header>
      <main className="flex-1 min-h-0">
        <GraphCanvas />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Wrap root in `ErrorBoundary`**

Modify `site/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { store } from '@/app/store';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import App from '@/App';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <MantineProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </MantineProvider>
    </Provider>
  </StrictMode>,
);
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: `10 passed` (the App smoke test now asserts against the new structure; the GraphCanvas test already covered the ready-state rendering).

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 7: Manual end-to-end smoke**

```bash
npm run dev
```

Open `http://localhost:5173`. Expected:

1. Header "TTL Quick Viz" at the top.
2. After a brief "Loading…" flicker, a graph of ~20 nodes + ~25 edges renders in the main area.
3. Pan and zoom work with mouse wheel + drag.
4. Minimap visible in the corner.
5. Controls (zoom in / out / fit) visible.
6. Arrowheads visible on edges (directed).
7. No console errors.

Stop the server when satisfied.

- [ ] **Step 8: Final file-layout sanity check**

Run:

```bash
find /Users/ebertdu/go/ttl-quick-viz/site/src -type f | sort
```

Expected files (order may differ by `find` impl):

```
site/src/App.tsx
site/src/app/hooks.ts
site/src/app/store.test.ts
site/src/app/store.ts
site/src/data/sample-graph.json
site/src/features/graph/GraphCanvas.test.tsx
site/src/features/graph/GraphCanvas.tsx
site/src/features/graph/elkOptions.ts
site/src/features/graph/graphApi.test.ts
site/src/features/graph/graphApi.ts
site/src/features/graph/graphSlice.test.ts
site/src/features/graph/graphSlice.ts
site/src/features/graph/index.ts
site/src/features/graph/types.ts
site/src/features/graph/useElkLayout.test.tsx
site/src/features/graph/useElkLayout.ts
site/src/index.css
site/src/main.tsx
site/src/shared/components/ErrorBoundary.test.tsx
site/src/shared/components/ErrorBoundary.tsx
site/src/test/setup.ts
site/src/test/smoke.test.tsx
```

---

## Self-review results

- **Spec coverage:** Every section of `.specs/2026-04-22-ttl-quick-viz-ui-design.md` maps to at least one task (Stack → Tasks 1–6, 11–12; Folder layout → final task 14; Canonical JSON shape → Task 7; Components → Tasks 7–14; Data flow → exercised in Task 14 manual smoke; Error handling → Tasks 11/12 fallbacks + Task 13 boundary; Testing → Tasks 9–13).
- **Placeholders:** None; every code step contains the complete content.
- **Type consistency:** `Graph`, `GraphNode`, `GraphEdge` defined in Task 7 are the shape used by the fixture (Task 8), `graphApi` (Task 10), and `useElkLayout` (Task 11). React Flow's `Node`/`Edge` types come from `@xyflow/react` and are used consistently in Tasks 11, 12.
- **No-commit policy respected:** no `git add` / `git commit` steps anywhere in the plan.
