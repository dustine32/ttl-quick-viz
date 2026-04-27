# Task: Mind-map / tree renderer using React Flow + ELK `mrtree`

**Status:** COMPLETE
**Issue:** none (user request)
**Branch:** clean-up

## Goal
Add a `tree` renderer alongside the existing 6 (`xyflow`, `cytoscape`,
`force`, `force3d`, `sigma`, `graphin`) that shows the graph as a
mind-map / hierarchical tree rooted at a chosen node, with collapse /
expand. Built on `@xyflow/react` + `elkjs` (`mrtree`) — both already
deps; no new packages.

## Why React Flow + ELK, not `react-d3-tree`

The codebase is *already configured* for tree layouts:

- `site/src/features/graph/elkOptions.ts` exposes `'mrtree'` and
  `'radial'` in `XyflowLayout` and returns proper ELK options for both
  via `getElkOptions()`.
- `site/src/features/graph/useElkLayout.ts` is a generic hook keyed on
  `(graph, algo, nonce)` — pass it a tree-shaped Graph and `'mrtree'`
  and it returns positioned nodes/edges with smoothstep curves.
- `PrettyNode.tsx` already provides the card/handle styling. Extending
  it with a chevron for collapse is ~20 LoC.
- Selection / focus / fit-view / reveal are all wired through the
  Redux nonce pattern; the tree canvas plugs into the same wires the
  other renderers do.

Picking `react-d3-tree` would force us to re-implement zoom/pan,
selection wiring, edge styling, layout, and fit-view — all things
React Flow already gives us. The *only* tree-specific work is the data
prep (BFS with cycle-breaking) and collapse/expand state.

## Context

- **Filter chokepoint preserved:** the new canvas calls `applyView()`
  exactly like the other 6 renderers, so all existing filters (hidden
  predicates / types, focus + depth, hide-standalone, min-degree) keep
  working unchanged. See `graph-filter-and-edge-search.md` for the
  chokepoint argument.
- **No api / conversion changes.** Pure UI feature; wire shape stays
  identical. CLAUDE.md cross-cutting invariant preserved.
- **Related files:**
  - **New:** `site/src/features/graph-tree/`
    - `buildTree.ts` — pure BFS with cycle-break, returns a tree-shaped
      `Graph` plus `backEdges` and `orphans` metadata.
    - `treeSlice.ts` — `collapsedIds: string[]` + reducers.
    - `MindMapNode.tsx` — `PrettyNode` + chevron + hidden-children
      badge.
    - `TreeCanvas.tsx` — wraps `<ReactFlow>`, calls `applyView()` →
      `buildTree()` → prune-collapsed → `useElkLayout(tree, 'mrtree')`.
    - `index.ts` — barrel.
  - **New tests:** `site/tests/features/graph-tree/buildTree.test.ts`,
    `site/tests/features/graph-tree/treeSlice.test.ts`.
  - **Edit:**
    - `site/src/features/graph/graphSlice.ts` — add `'tree'` to
      `GraphRenderer` union.
    - `site/src/app/store.ts` — register `treeReducer` under key `tree`.
    - `site/src/App.tsx` — add `<TreeCanvas />` branch.
    - `site/src/layout/Toolbar.tsx` — add `{ value: 'tree', label:
      'Tree / Mind map' }` to the renderer `Select`.
    - `site/src/features/view-config/LayoutPicker.tsx` — return `null`
      for `'tree'` (orientation/collapse controls live in the tree
      canvas itself).
- **Triggered by:** user — "I want another feature like mind map tree"
  → "I think react flow might make better mind map".

## Current State

- **What works now:** `xyflow` renderer can already pick `'mrtree'` from
  the layout dropdown and ELK lays the graph out as a tree. But:
  - Cycles still draw (loops back to ancestors), making the tree
    unreadable on real GO-CAM data.
  - No collapse / expand.
  - Root choice is whatever ELK picks (least-incoming heuristic), not
    user-controllable.
- **What's broken/missing:** the *data prep* step — BFS with explicit
  cycle-breaking and a chosen root — and a UI affordance (collapse).

## Design notes

### Data shape

Source graph is a directed property graph (`Graph = { nodes, edges }`
in `features/graph/types.ts`). Edges have direction (`source` →
`target`) and a `label` (predicate IRI). Real data has cycles — GO-CAM
has bidirectional `enabled_by` / `part_of` patterns; Reactome has
reaction loops. Naive recursion will hang the tab.

### Root selection

Computed in `buildTree.ts`, in priority order:

1. **`focusNodeId`** if set (already a user-chosen anchor; reuse).
2. **First "source" node** in the filtered graph (no incoming edges).
   Sort by `nodeId` for determinism.
3. **Highest-degree node** as fallback for fully-cyclic graphs.

User overrides via the existing focus UI (right-click → focus exists
in the inspector). Post-MVP: a dedicated "Set as tree root" action.

### BFS cycle-break

```text
visited = { root }
treeEdges  = []
backEdges  = []
queue   = [root]

while queue not empty:
  parent = queue.shift()
  for each edge (parent → child) in graph.edges where source == parent.id:
    if child in visited: backEdges.push(edge); continue
    visited.add(child)
    treeEdges.push(edge)
    queue.push(child)

orphans = graph.nodes.filter(n => !visited.has(n.id))
return {
  tree: { nodes: visited-as-array, edges: treeEdges },
  backEdges,
  orphans,
  rootId,
}
```

Notes:
- **Direction:** outgoing edges only by default. A toggle for
  reverse/undirected is a post-MVP option.
- **Determinism:** sort children by `(predicate, targetId)` so
  successive runs build the same tree (otherwise React reconciles
  garbage on every relayout).
- **Disconnected components:** anything not reached → `orphans`. MVP
  shows a small badge "N nodes unreachable from root" overlay; click
  shows them in a list (or post-MVP: forest mode with multiple roots).

### Collapse / expand

- New slice `treeSlice.ts`: `{ collapsedIds: string[] }`.
- Reducers: `toggleCollapsed(id)`, `expandAll()`, `collapseAll(depth?)`.
- Selector: `selectCollapsedIds → Set<string>`.
- `buildTree()` takes `collapsedIds: Set<string>` as an option; for
  any node in that set, do not descend into its children. Track
  `hiddenChildCount` per collapsed node so the badge knows what to
  show.
- The `MindMapNode` chevron (bottom-right of the card) dispatches
  `toggleCollapsed(id)`. When collapsed, the badge "+N" appears next
  to the chevron.

### Layout

- `useElkLayout(tree, 'mrtree', relayoutNonce, widthFor)` — same hook
  the xyflow renderer uses, just fed a tree-shaped `Graph` and the
  `mrtree` algo. ELK already produces vertical-tree positions with
  sensible spacing in `elkOptions.ts`.
- Orientation: `mrtree` defaults to `elk.direction: DOWN`. An
  orientation toggle (DOWN / RIGHT) goes in `treeSlice.ts` if we want
  it; trivial — change one ELK option key. MVP ships with `DOWN`.

### Why a renderer, not a layout option

Two reasons:
1. The data is *transformed* (cycles dropped, subtrees pruned by
   collapse state), not just positioned. Layout options shouldn't
   change the dataset.
2. Collapse/expand UI needs a custom node and a slice — not something
   a layout switch can host.

Mirroring the existing `graph-force`, `graph-sigma`, etc. structure is
the right pattern.

## Steps

### Phase 1: Data prep (pure, fully testable)

- [ ] Create `site/src/features/graph-tree/buildTree.ts` exporting:
  - `type BuildTreeOpts = { rootId?: string | null; collapsedIds?:
    Set<string>; direction?: 'out' | 'in' };`
  - `type BuildTreeResult = { tree: Graph; backEdges: GraphEdge[];
    orphans: GraphNode[]; rootId: string | null; hiddenChildCount:
    Map<string, number> };`
  - `buildTree(graph: Graph, opts?: BuildTreeOpts): BuildTreeResult`.
- [ ] Implement root selection chain.
- [ ] Implement BFS with `visited` Set; record `backEdges` and
  `orphans`.
- [ ] Skip descending into collapsed nodes; track `hiddenChildCount`.
- [ ] Sort children by `(predicate, targetId)` for determinism.
- [ ] **Tests** (`site/tests/features/graph-tree/buildTree.test.ts`):
  - empty graph → `tree` empty, `rootId` null.
  - linear chain `a → b → c` → 3-node tree, no back-edges.
  - simple cycle `a → b → a` → tree `{a → b}`, 1 back-edge.
  - multi-edge cycle `a → b → c → a, b → d` → 4 nodes in tree,
    1 back-edge.
  - disconnected components → `orphans` populated.
  - explicit `rootId` honored.
  - root fallback chain (no focus, sources exist → first source; no
    sources → max-degree).
  - `direction: 'in'` walks reverse edges.
  - `collapsedIds: { 'b' }` on chain `a → b → c → d` → tree contains
    `a, b` only; `hiddenChildCount.get('b') === 2`.

### Phase 2: Slice + selectors

- [ ] Create `site/src/features/graph-tree/treeSlice.ts`:
  - state: `{ collapsedIds: string[]; orientation: 'DOWN' | 'RIGHT' }`.
  - reducers: `toggleCollapsed`, `expandAll`, `setOrientation`.
  - selectors: `selectCollapsedIds` (memoized → `Set<string>`),
    `selectTreeOrientation`.
- [ ] Register in `site/src/app/store.ts`.
- [ ] **Tests** (`treeSlice.test.ts`): toggle round-trip, expandAll
  clears, orientation set/get.

### Phase 3: Custom node

- [ ] `site/src/features/graph-tree/MindMapNode.tsx`:
  - Same shell as `PrettyNode` (card, accent stripe, handles).
  - Add a chevron `ActionIcon` bottom-right.
  - Read collapsed state via `useAppSelector(selectCollapsedIds)`.
  - Show a "+N" badge when collapsed *and* `hiddenChildCount > 0`
    (passed in via `data.hiddenChildCount`).
  - On chevron click: `dispatch(toggleCollapsed(id))`. Stop
    propagation so the node `onClick` doesn't fire.

### Phase 4: Renderer

- [ ] `site/src/features/graph-tree/TreeCanvas.tsx`:
  - Mirror `GraphCanvas.tsx` boilerplate (selectedGraphId,
    `useGetGraphQuery`, `useGraphDerivedData`).
  - `applyView()` with all the same filter selectors.
  - `buildTree(filtered, { rootId: focusNodeId, collapsedIds })` →
    `tree, backEdges, orphans, hiddenChildCount`.
  - `useElkLayout(tree, 'mrtree', relayoutNonce, widthFor)`.
  - Color/label nodes via `colorForType` + `formatIri` exactly like
    `GraphCanvas.tsx`. Pass `hiddenChildCount` into node data so
    `MindMapNode` can show the badge.
  - Register `nodeTypes = { mindmap: MindMapNode }` and force every
    laid-out node to `type: 'mindmap'`.
  - Wire selection: `onNodeClick → selectNode`,
    `onNodeDoubleClick → revealNode`, `onPaneClick → clearSelection`.
  - `fitViewNonce`, `revealNonce` effects copied from `GraphCanvas`.
  - Top-right overlay: small Mantine `Badge` row showing `N
    back-edges`, `M unreachable nodes` if non-zero. Click on either
    opens a Mantine `Popover` listing them (links dispatch `selectNode`
    so the inspector shows context).

### Phase 5: Wire-up

- [ ] `site/src/features/graph/graphSlice.ts` — extend `GraphRenderer`:
  add `| 'tree'`.
- [ ] `site/src/App.tsx` — add `{renderer === 'tree' && <TreeCanvas />}`.
- [ ] `site/src/layout/Toolbar.tsx` — add `{ value: 'tree', label:
  'Tree / Mind map' }` to renderer `Select`.
- [ ] `site/src/features/view-config/LayoutPicker.tsx` — early return
  `null` when `renderer === 'tree'` (matches existing guards for
  force/force3d/sigma/graphin).
- [ ] `site/src/features/graph-tree/index.ts` — barrel exporting
  `TreeCanvas`, `buildTree`, slice actions/selectors.

### Phase 6: Verify

- [ ] `npm run build` — clean.
- [ ] `npm run lint` — no new errors over baseline.
- [ ] `npm test` — existing tests pass + new `buildTree` and slice
  tests.
- [ ] Manual smoke in `npm run dev` against a real GO-CAM graph:
  - Switch to Tree renderer.
  - Confirm root is sensibly chosen (a "source" node, not random).
  - Click chevron → subtree collapses, "+N" badge appears.
  - Re-click → expands.
  - Toggle hide-standalone / min-degree → tree shrinks.
  - Set focus on a different node → tree re-roots.
  - Confirm cyclic data renders (no infinite loop, back-edge badge
    shows).
  - Confirm disconnected components surface in the orphan badge.

## Recovery Checkpoint

✅ TASK COMPLETE

- `npm run build` clean.
- `npm run lint` — 4 errors + 1 warning, all pre-existing in
  `SearchBox.tsx` + `vite.config.ts`; zero new regressions.
- `npm test` — 50/50 (was 34/34; +16 new from `buildTree` + `treeSlice`).
- Manual smoke pending: switch to **Tree / Mind map** renderer in the
  toolbar; chevron toggles collapse; back-edge / unreachable badges
  show up on cyclic / disconnected graphs.

## Failed Approaches

<!-- Prevent repeating mistakes after context reset -->

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
| (initial plan) `react-d3-tree` | Re-implemented zoom/pan/selection/fit-view that React Flow already provides; ignored that `elkOptions.ts` already exposes `mrtree`. Reverted before any code. | 2026-04-25 |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `site/src/features/graph-tree/buildTree.ts` | NEW (pure data prep) | ✅ |
| `site/src/features/graph-tree/treeSlice.ts` | NEW (collapse + orientation state) | ✅ |
| `site/src/features/graph-tree/MindMapNode.tsx` | NEW (PrettyNode + chevron) | ✅ |
| `site/src/features/graph-tree/TreeCanvas.tsx` | NEW (renderer) | ✅ |
| `site/src/features/graph-tree/index.ts` | NEW (barrel) | ✅ |
| `site/tests/features/graph-tree/buildTree.test.ts` | NEW (12 cases) | ✅ |
| `site/tests/features/graph-tree/treeSlice.test.ts` | NEW (4 cases) | ✅ |
| `site/src/features/graph/graphSlice.ts` | extend `GraphRenderer` union | ✅ |
| `site/src/app/store.ts` | register `treeReducer` | ✅ |
| `site/src/App.tsx` | add `<TreeCanvas />` branch | ✅ |
| `site/src/layout/Toolbar.tsx` | add Tree option to renderer Select | ✅ |
| `site/src/features/view-config/LayoutPicker.tsx` | guard `'tree'` | ✅ |

## Blockers

- None currently.

## Notes

- **Cycles are real and the visited-set is non-negotiable.** GO-CAM
  data has bidirectional `enabled_by` / `part_of`; Reactome has
  reaction loops. Recursive walks WILL hang.
- **Determinism.** Sort children by `(predicate, targetId)` inside
  `buildTree` so two runs over the same input give the same tree. The
  React reconciler will thrash otherwise.
- **Performance.** GO-CAM graphs run a few thousand nodes; BFS is O(V +
  E). React Flow + ELK handles this fine for the regular renderer
  already; tree mode strictly reduces the edge count, so we're net
  cheaper. Beyond ~5k nodes consider a `maxDepth` cap as a follow-up.
- **Filter chokepoint:** Tree canvas calls `applyView()` exactly like
  every other renderer. Do **not** invent a parallel filter path.
- **Renderer enum URL key:** `setRenderer('tree')` will round-trip
  through the existing `useUrlSync`. No change needed.
- **ELK tree algorithm is already configured.** `getElkOptions('mrtree')`
  in `elkOptions.ts` returns `{ direction: DOWN, mrtree.searchOrder:
  DFS, ... }`. Reuse — don't re-define.

## Lessons Learned

- Read the existing layout config *before* recommending a new lib —
  `elkjs` already had `mrtree` and `radial` plumbed; the right move was
  always React Flow.
- One BFS pass on the *full* graph (without collapse) plus a separate
  prune walk was simpler than trying to compute hidden-descendant
  counts inside the cycle-breaking BFS. `countDescendants` becomes a
  trivial DFS over the saved `childMap`.
- Determinism matters: sorting children by `(predicate, targetId)`
  inside `buildTree` keeps the React reconciler stable across
  rerenders. The "deterministic order" test caught a subtle case where
  predicate ordering trumps id ordering.

## Summary

A 7th renderer, **Tree / Mind map**, picked from the existing renderer
`Select`. Built on already-installed `@xyflow/react` + `elkjs` (`mrtree`
algorithm), so no new packages.

Pipeline per render: `applyView()` (filters) → `buildTree()` (BFS with
cycle-break + collapse-prune) → `useElkLayout(tree, 'mrtree')` →
`<ReactFlow>` with custom `MindMapNode`. The shared `applyView()`
chokepoint means hide-standalone, min-degree, hidden predicates/types,
and focus all keep working unchanged in tree mode.

Cycles are surfaced as a "back-edges" badge in the top-right; nodes
unreachable from the chosen root surface as an "unreachable" badge.
Each node shows a chevron — click to collapse the subtree; collapsed
nodes display "+N" (descendants hidden).

Root selection chain: explicit `focusNodeId` → first source (no
incoming) → max-degree fallback for fully-cyclic graphs.

## Additional Context (Claude)

### Why this is mostly already-built

The existing `xyflow` renderer with `mrtree` selected is *already* a
poor-man's tree view. What it lacks:

1. **Cycle handling** — addressed by `buildTree.ts` (Phase 1).
2. **Collapse / expand** — addressed by `treeSlice.ts` +
   `MindMapNode.tsx` (Phase 2-3).
3. **Curated root selection** — addressed by `buildTree.ts` root
   priority chain (Phase 1).

Everything else — layout, zoom/pan, selection, fit-view, edge styling,
URL state — is reused.

### Possible follow-ups (post-MVP)

- **Forest mode** — render every component's root side-by-side instead
  of hiding orphans.
- **Right-click → "Set as tree root"** → dispatches `setFocusNodeId`.
- **Inline back-edge badge per subtree** — count cross-edges from a
  given subtree, click → reveal targets in the inspector.
- **Tree-specific layout picker** (orientation: DOWN / RIGHT,
  mrtree DFS vs BFS, depth cap).
- **Reverse / undirected traversal toggle** — flip `direction` in
  `BuildTreeOpts`.
- **Animated collapse/expand** — React Flow's `useReactFlow` +
  `nodesChange` can drive transitions; nice polish, not needed v1.

### Risks

- **Cycles in directed walks but tree unrooted in undirected sense.**
  If the user picks a node that has no outgoing edges, the BFS yields a
  trivial tree (just the root). Mitigation: when the chosen root has
  zero children in the chosen direction, fall back to undirected BFS
  for that one component and surface a small warning. Defer to
  post-MVP unless smoke-testing trips on it.
- **Stale `useElkLayout` cache.** The hook keys on `(graph, algo,
  nonce)`. We need a stable graph identity — `buildTree` should return
  the same object reference when its inputs haven't changed. Wrap the
  call in `useMemo` keyed on `(filtered, focusNodeId, collapsedIds)`
  (where `collapsedIds` is a memoized Set from the slice).
