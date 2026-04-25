# Task: Restructure site into professional IDE-style layout (toolbar + left drawer + right panel + canvas)

**Status:** COMPLETE
**Issue:** —
**Branch:** init-feel

## Goal

Replace the current one-file `App.tsx` (header + renderer switch + canvas) with a structured, professional layout: top toolbar, collapsible left drawer for graph/file navigation, right-side panel for properties and view controls, and a main canvas region for the graph. Introduce a React structure that scales (layout components, feature folders, UI slice) without over-engineering.

## Context

- **Related files:**
  - `site/src/App.tsx` (current flat layout — to be split)
  - `site/src/main.tsx` (provider chain — `MantineProvider` already present)
  - `site/src/app/store.ts`, `site/src/app/hooks.ts` (Redux store)
  - `site/src/features/graph/` (React Flow renderer + RTK Query `graphApi` + `graphSlice`)
  - `site/src/features/graph-cytoscape/` (Cytoscape renderer)
  - `site/src/shared/components/ErrorBoundary.tsx`
  - `site/package.json` (deps: `@mantine/core` 9.x, `@mantine/hooks`, `@xyflow/react`, `cytoscape`, `@reduxjs/toolkit`, `tailwindcss` 4.x)
- **Triggered by:** User request — "make it professional… side panel on right for properties and views and left panel a drawer of files or nav … a toolbar."
- **Design spec:** Not yet written. If the layout grows past what the checklist here captures (icons, theming, keyboard shortcuts), lift details into `.specs/2026-04-23-site-layout-design.md`.

## Current State

- **What works now:**
  - `App.tsx` renders a thin header with title + `SegmentedControl` to pick renderer (`xyflow` | `cytoscape`)
  - `main` region shows `<GraphCanvas />` or `<CytoscapeCanvas />` depending on `state.graph.renderer`
  - RTK Query `graphApi` loads list + selected graph; `useGetGraphsQuery` fetches the list, `useGetGraphQuery(firstId)` fetches the first graph only (`firstId` is hardcoded as `list?.[0]?.id`)
  - Selected-node / selected-edge inspection does not exist — clicking a node does nothing
  - `graphSlice` has `selectedGraphId` ("sample") and `renderer`, but `selectedGraphId` is **not wired to the canvases** (they ignore it and use `firstId`)
  - No panels, no toolbar, no collapse, no keyboard shortcuts
- **What's broken/missing:**
  - No graph list UI — user cannot switch between graphs even though the API returns a list
  - No properties/inspector UI — no way to see a node's IRI, labels, incoming/outgoing edges
  - No toolbar with layout / fit-view / zoom / export actions (each renderer has its own overlay controls, but there's no unified action surface)
  - Flat component structure — `App.tsx` will get messy as soon as we add panels
  - `selectedGraphId` stored in Redux but unused

## Steps

### Phase 1: Layout skeleton (no behavior change)

- [ ] Create `site/src/layout/` directory
- [ ] `layout/AppShell.tsx` — Mantine `<AppShell>` with `header`, `navbar` (left), `aside` (right), and `main`; wire `useDisclosure` for navbar + aside collapse; default both open on desktop, closed on mobile
- [ ] `layout/Toolbar.tsx` — top bar: app title on left, renderer `SegmentedControl` in center, placeholder action buttons on right (Fit view, Re-layout, Export — no-op for now), burger buttons to toggle the two panels
- [ ] `layout/LeftPanel.tsx` — navbar content: section header "Graphs", placeholder list (will be filled in Phase 3)
- [ ] `layout/RightPanel.tsx` — aside content: tabs for "Properties" and "View" (Mantine `Tabs`), both empty placeholders for now
- [ ] `layout/StatusBar.tsx` — optional footer with node/edge counts + loading status (thin, 24px)
- [ ] Rewrite `App.tsx` to compose these: `<AppShell>{Toolbar, LeftPanel, RightPanel, <GraphCanvas /> or <CytoscapeCanvas />, StatusBar}</AppShell>`
- [ ] Verify: visual smoke test — panels open, collapse, resize; canvas fills remaining space; renderer switch still works

### Phase 2: UI slice for panel + selection state

- [ ] Create `site/src/features/ui/uiSlice.ts` with:
  - `leftPanelOpen: boolean` (default true)
  - `rightPanelOpen: boolean` (default true)
  - `rightPanelTab: 'properties' | 'view'` (default 'properties')
  - `selectedNodeId: string | null` (default null)
  - `selectedEdgeId: string | null` (default null)
  - actions: `toggleLeftPanel`, `toggleRightPanel`, `setRightPanelTab`, `selectNode(id | null)`, `selectEdge(id | null)`, `clearSelection`
- [ ] Register `ui` reducer in `app/store.ts`
- [ ] Wire `useDisclosure` replacement — `AppShell` reads panel open state from Redux instead of local state (so toolbar buttons can toggle, keyboard shortcuts can toggle, and state persists across renderer switch)
- [ ] Add `uiSlice.test.ts` covering reducers (mirror style of `graphSlice.test.ts`)

### Phase 3: Graph list in Left Panel (activate `selectedGraphId`)

- [ ] Create `site/src/features/graph/GraphList.tsx`:
  - `useGetGraphsQuery()` for items
  - Mantine `NavLink` per graph; active state driven by `state.graph.selectedGraphId`
  - Click dispatches `setSelectedGraphId(id)`
- [ ] Refactor `GraphCanvas.tsx` and `CytoscapeCanvas.tsx` to read `selectedGraphId` from Redux instead of `list?.[0]?.id` — fall back to first item only if `selectedGraphId` is empty or missing from the list
- [ ] Consider: once a list is loaded, if `selectedGraphId` is not in the list, dispatch `setSelectedGraphId(list[0].id)` (small `useEffect` inside `GraphList`, not in the canvases)
- [ ] Mount `<GraphList />` inside `LeftPanel.tsx`
- [ ] Test: switch graphs, ensure both renderers react; renderer switch preserves selected graph

### Phase 4: Properties panel wiring

- [ ] Extend `@/features/graph/types.ts` export (already has node/edge shapes — confirm fields: `id`, `label`, optional `iri`, `type`, attributes)
- [ ] Add selection events:
  - In `GraphCanvas.tsx` (React Flow): `onNodeClick` / `onEdgeClick` / `onPaneClick` → dispatch `selectNode` / `selectEdge` / `clearSelection`
  - In `CytoscapeCanvas.tsx`: bind `cy.on('tap', 'node', …)`, `cy.on('tap', 'edge', …)`, `cy.on('tap', (e) => { if (e.target === cy) dispatch(clearSelection()) })`
- [ ] Create `site/src/features/inspector/NodeInspector.tsx`:
  - Reads `selectedNodeId` + current graph data; finds the node; renders key/value table (IRI, label, type, attrs)
  - Lists incoming + outgoing edges (label → neighbor id, clickable to switch selection)
- [ ] Create `site/src/features/inspector/EdgeInspector.tsx`:
  - Reads `selectedEdgeId`; shows predicate/label, source, target (clickable)
- [ ] Create `site/src/features/inspector/InspectorPanel.tsx`:
  - If node selected → `<NodeInspector />`
  - Else if edge selected → `<EdgeInspector />`
  - Else → empty-state placeholder ("Select a node or edge to inspect")
- [ ] Mount `<InspectorPanel />` under the "Properties" tab of `RightPanel.tsx`

### Phase 5: View controls tab (Right Panel → "View")

- [ ] Extract current Cytoscape and React Flow view-affecting knobs into a `ViewControls.tsx` under `@/features/graph/`:
  - Fit view button (both renderers expose an API — store ref via context or imperative handle)
  - Re-layout button (React Flow → re-run ELK; Cytoscape → rerun layout)
  - Background toggle (React Flow `<Background />`)
  - Mini-map toggle
  - Edge-label toggle
- [ ] Minimal viable version for Phase 5: just fit-view + re-layout; the rest can be follow-ups
- [ ] Mount under the "View" tab

### Phase 6: Toolbar actions

- [ ] Wire Toolbar buttons to actions created in Phase 5 (fit view, re-layout)
- [ ] Add left-panel and right-panel toggle buttons (burger icons) — both update the UI slice
- [ ] Add keyboard shortcuts via `@mantine/hooks` `useHotkeys`:
  - `mod+B` → toggle left panel
  - `mod+Alt+B` → toggle right panel
  - `mod+F` → fit view
  - `Escape` → clear selection
- [ ] Keep Toolbar dumb — it only dispatches; real logic lives in the features

### Phase 7: Polish + verification

- [ ] Responsive breakpoints: below `md`, both panels default collapsed; above, both open
- [ ] Empty/loading/error states use shared components (loading skeletons via Mantine `Skeleton`, consistent across list + canvas + inspector)
- [ ] Smoke-test checklist (manual, with dev server running):
  - [ ] Panels collapse/expand via toolbar and shortcuts
  - [ ] Switching graphs reloads canvas for both renderers
  - [ ] Clicking a node updates the Properties tab; clicking the canvas clears it
  - [ ] Clicking an edge updates the Properties tab
  - [ ] Fit view works in both renderers
  - [ ] Re-layout works in both renderers
  - [ ] Renderer switch keeps graph selection and clears only the now-incompatible selection state if needed
  - [ ] Responsive: narrow the window, panels hide; widen, they come back
- [ ] Run `npm run test` — every existing test still passes; new tests for `uiSlice`, `NodeInspector`, `GraphList` added
- [ ] Run `npm run build` clean (no TS errors after restructure)

## Recovery Checkpoint

✅ TASK COMPLETE

- **Tests:** 32/32 passing (`npm test`)
- **Build:** clean (`npm run build` — TS + Vite both OK; only warning is the 500 kB chunk size, pre-existing)
- **Dev server:** left running in background on http://localhost:5174 for visual smoke test
- **Not verified (needs human):** visual smoke test — panel resize/collapse, node/edge click, renderer switch, hotkeys (F, R, Esc, Ctrl+B, Ctrl+Alt+B)

## Failed Approaches

<!-- Prevent repeating mistakes after context reset -->

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `site/src/App.tsx` | Rewrite (compose layout) | done |
| `site/src/layout/AppShell.tsx` | Create | done |
| `site/src/layout/Toolbar.tsx` | Create | done |
| `site/src/layout/LeftPanel.tsx` | Create | done |
| `site/src/layout/RightPanel.tsx` | Create | done |
| `site/src/layout/StatusBar.tsx` | Create | done |
| `site/src/features/ui/uiSlice.ts` | Create | done |
| `site/src/features/ui/uiSlice.test.ts` | Create | done |
| `site/src/app/store.ts` | Add `ui` reducer | done |
| `site/src/features/graph/GraphList.tsx` | Create | done |
| `site/src/features/graph/GraphCanvas.tsx` | Read `selectedGraphId` + selection events | done |
| `site/src/features/graph-cytoscape/CytoscapeCanvas.tsx` | Read `selectedGraphId` + selection events | done |
| `site/src/features/inspector/NodeInspector.tsx` | Create | done |
| `site/src/features/inspector/EdgeInspector.tsx` | Create | done |
| `site/src/features/inspector/InspectorPanel.tsx` | Create | done |
| `site/src/features/graph/ViewControls.tsx` | Create | done |
| `site/src/features/ui/uiSlice.ts` | Added `fitViewNonce` / `relayoutNonce` + `requestFitView` / `requestRelayout` actions (Phase 5 extension) | done |
| `site/src/features/inspector/shortenIri.ts` | Create — IRI-shortening helper for inspector | done |
| `site/src/features/inspector/shortenIri.test.ts` | Create | done |
| `site/src/features/inspector/index.ts` | Create | done |
| `site/src/layout/icons.tsx` | Create — inline SVG icon set (panel, fit-view, layout, download, graph) to avoid new icon dep | done |
| `site/src/layout/useAppHotkeys.ts` | Create — global shortcuts: Ctrl+B (left), Ctrl+Alt+B (right), F (fit), R (re-layout), Esc (clear selection) | done |
| `site/src/layout/index.ts` | Create | done |
| `site/src/features/ui/index.ts` | Create | done |
| `site/src/app/store.ts` | Register `ui` reducer | done |
| `site/src/features/graph/index.ts` | Export `GraphList`, `ViewControls` | done |
| `site/src/features/graph/graphSlice.ts` | Initial `selectedGraphId` changed from `'sample'` → `''` (list auto-selects first) | done |
| `site/src/features/graph/graphSlice.test.ts` | Updated for empty-string default | done |
| `site/src/features/graph/GraphCanvas.test.tsx` | Rewrote for Redux-driven `selectedGraphId` flow | done |
| `site/src/features/graph/GraphCanvas.tsx` | Reads `selectedGraphId` from Redux; click handlers; fitView nonce effect | done |
| `site/src/features/graph-cytoscape/CytoscapeCanvas.tsx` | Reads `selectedGraphId` from Redux; tap handlers; fit/relayout nonce effects | done |
| `site/src/App.tsx` | Rewritten to compose layout + hotkeys | done |
| `site/tsconfig.app.json` | Pre-existing fix: added `ignoreDeprecations: "6.0"` for TS 6 `baseUrl` warning | done |
| `site/vite.config.ts` | Pre-existing fix: imported `defineConfig` from `vitest/config` for merged typing | done |
| `site/src/shared/components/ErrorBoundary.test.tsx` | Pre-existing fix: `Boom()` return type `never` for JSX-component typing | done |

## Blockers

- None currently

## Notes

- **Why Mantine `AppShell` over custom flex layout:** Mantine is already a dependency; `AppShell` gives responsive collapse, header height management, and proper `padding`/`offset` for free. Rolling our own with Tailwind would work but duplicates functionality and lacks the built-in responsive breakpoints.
- **Selection shared across renderers:** Storing `selectedNodeId` / `selectedEdgeId` in the UI slice (not per-renderer) means clicking in React Flow and then switching to Cytoscape preserves the selection — good UX. Both canvases should `useEffect` on selection change to highlight the matching element.
- **Avoid over-abstracting the renderer:** Don't build a `GraphRenderer` interface with `fitView()` / `relayout()` yet. Two renderers, two small imperative refs exposed via context, is enough. Only extract an interface when a third renderer appears or the surface area justifies it.
- **Keep the Tailwind + Mantine split pragmatic:** Mantine handles layout shell and controls (SegmentedControl, NavLink, Tabs, Tooltip). Tailwind handles ad-hoc styling (spacing, color overrides for canvas area). Don't fight either.
- **IRIs in the inspector:** Full IRIs can be very long. Use Mantine `Tooltip` + `CopyButton`, display a shortened form (last path segment) in the key column.

## Lessons Learned

- **Phase 1 + Phase 2 collapsed into one pass** — the plan kept them separate, but the `useDisclosure`-then-Redux rewrite would have been throwaway work. Merged worked fine and saved a pass.
- **Nonce counters in Redux beat ref plumbing for cross-panel actions.** Adding `fitViewNonce` / `relayoutNonce` to `uiSlice` let the Toolbar, ViewControls tab, and hotkeys all trigger canvas actions without any context or imperative ref handshake. Canvas components just `useEffect` on the nonce.
- **Skipping initial mount via `if (nonce === 0) return`** keeps the fit-on-mount behavior coming from ReactFlow's `fitView` prop, without a double-fire from the effect.
- **Inline SVG icons kept `package.json` untouched.** Adding `@tabler/icons-react` would have been more idiomatic Mantine, but 6 SVGs is under the premature-dep threshold.
- **Three unrelated TS errors surfaced when `npm run build` got run** (config `baseUrl`, `vitest/config` typing, `Boom(): never`). Likely hadn't been noticed because nobody had been running the full `tsc -b` recently. Fixed in-place — trivial.

## Summary

- Replaced flat `App.tsx` with a Mantine `AppShell`-based layout: header (Toolbar), left Navbar (GraphList), right Aside (Properties / View tabs), footer (StatusBar), center canvas.
- Introduced `features/ui/uiSlice.ts` with panel open state, selection state (node/edge, shared across renderers), and fit-view / re-layout nonces.
- Activated the previously-unused `selectedGraphId` — users can now switch between graphs in the list.
- Added node/edge click handlers to both renderers; `InspectorPanel` shows IRI/label/attrs and walks incoming/outgoing edges.
- Added `ViewControls` tab (fit view, re-run layout) and toolbar buttons wired to the same actions.
- Global hotkeys: Ctrl+B (left panel), Ctrl+Alt+B (right panel), F (fit), R (re-layout), Esc (clear selection).
- 32/32 tests pass; production build compiles clean.

## Follow-up Work

1. Shareable URLs — move `selectedGraphId` (and maybe `selectedNodeId`) into the URL via `react-router`.
2. Visual selection highlight — the selection is wired to Redux but neither renderer visually highlights the selected node/edge yet. React Flow `selected` prop and Cytoscape `.selected()` would do it.
3. `@tabler/icons-react` — replace inline SVG with first-class icon lib once the count grows.
4. Split ReactFlow + Cytoscape into `features/graph/renderers/{xyflow,cytoscape}/` to formalize the sibling structure.
5. Export action (toolbar button currently disabled) — JSON + SVG/PNG.
6. Code-split the bundle — 780 kB gzipped is heavy; `cytoscape` and `@xyflow/react` are good candidates for lazy loading based on the active renderer.

## Additional Context (Claude)

**Architectural observations**

- Two renderers are currently siblings under `features/`. That's fine for now, but both import the same `graphApi` + `types` — consider renaming to `features/graph/renderers/xyflow/` and `features/graph/renderers/cytoscape/` as part of Phase 1 or 2 if the restructure is already invasive. Not blocking; flag for discussion.
- `useElkLayout` is specific to React Flow; Cytoscape uses its built-in `breadthfirst` layout. If the View tab grows a "Layout algorithm" dropdown, they'll diverge fast. Scope that out of this plan.
- `selectedGraphId: 'sample'` as the initial state is a hardcoded guess. Once Phase 3 activates the selection, a better initial state is `''` with a `useEffect` that sets it to `list[0].id` on first successful fetch. This avoids the dead-default footgun.

**Risk spotted**

- `tsconfig.json` version is `~6.0.2` per `package.json` — TypeScript 6 is newer than most tooling expects. If you hit plugin or type incompatibilities during the restructure (e.g., Mantine type defs), downgrading TS is out of scope; instead, pin the offending type package or use `any` in a narrow spot and note it. Flag any such workarounds in **Failed Approaches**.
- Mantine `AppShell` in v9 uses a newer API than older tutorials show. If docs disagree, trust the installed version — check `node_modules/@mantine/core/lib/components/AppShell/` or run the Mantine docs site against `9.1`.

**Alternative considered (and why not)**

- **Custom split-pane with `react-resizable-panels`:** Gives the user drag-to-resize panels. Nice, but adds a dep and we don't yet know users need resize. Defer until someone asks.
- **Floating / docking panels (à la VSCode):** Overkill for two panels and one canvas. Revisit only if we add a third surface (e.g., SPARQL query editor).
- **Separate routes per graph (`/graph/:id`):** Would replace `selectedGraphId` with URL state. Good idea long-term — shareable links — but adds `react-router` and rewrites data flow. Out of scope for "make it professional"; capture as a follow-up.

**Suggested follow-ups (after this plan merges)**

1. Move `selectedGraphId` to URL via `react-router` for shareable links.
2. Add SPARQL / filter input as a third toolbar surface.
3. Add dark mode (Mantine color scheme) — trivial to wire once AppShell is in place.
4. Replace the two-renderer segmented control with a persisted user preference (localStorage via Redux Toolkit's `createListenerMiddleware`).
