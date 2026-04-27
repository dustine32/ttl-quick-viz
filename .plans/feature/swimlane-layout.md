# Task: Swimlane / column-grouped layout for the React Flow renderer

**Status:** ACTIVE
**Issue:** —
**Branch:** clean-up

## Goal

Add a new "Swimlanes" layout that arranges nodes into vertical columns
grouped by a property (default `rdf:type`), like the
[JointJS activity diagram demo](https://www.jointjs.com/demos/activity-diagram).
Render lane backgrounds and headers behind the graph so the grouping is
visually obvious. React Flow renderer only — Cytoscape/Force/Sigma ignore
this layout option.

## Context

- **Related files:**
  - `site/src/features/graph/useElkLayout.ts` — existing ELK layout hook
  - `site/src/features/graph/elkOptions.ts` — layout algo enum + ELK options
  - `site/src/features/graph/GraphCanvas.tsx` — React Flow renderer
  - `site/src/features/view-config/viewConfigSlice.ts` — view state
  - `site/src/features/view-config/LayoutPicker.tsx` — algo dropdown
  - `site/src/features/view-config/ViewPanel.tsx` — right-panel controls
  - `site/src/features/view-config/derived.ts` (or wherever `useGraphDerivedData` lives) — node→type map
- **Triggered by:** user request after seeing the JointJS demo

## Current State

- **What works:** ELK provides `layered`, `force`, `mrtree`, etc. via
  `useElkLayout`. Nodes are colored by their `rdf:type` already
  (`colorForType` + `useGraphDerivedData`). Layout selection lives in
  `viewConfigSlice` and is read by `GraphCanvas`.
- **What's missing:** No way to group nodes spatially. Two graphs with the
  same nodes look identical regardless of how many distinct types they have.

## Approach

**Custom layout, no new deps.** Bucket nodes by a chosen property → assign
each bucket an x-range → run a top-down hierarchical layout per lane → add
horizontal padding between lanes. Reuses existing dagre-style logic, no ELK
partitioning needed.

Why custom over ELK partitioning:

- ELK partitioning needs verbose Java-style options and produces a
  black-box layout that's hard to tune per-lane (e.g. variable lane widths).
- Our graphs are small (≤500 nodes typical), so cross-lane edge routing
  via simple bezier is fine.
- Lane headers + backgrounds are easier to render when we own the
  coordinate math.

## Steps

### Phase 1: Layout primitive (pure function, fully testable)

- [ ] Create `site/src/features/graph/swimlaneLayout.ts` exporting
      `computeSwimlaneLayout(graph, opts)`:
  - Input: `Graph`, `{ groupBy: (nodeId) => string | null, maxLanes: number, laneOrder?: string[] }`
  - Output: `{ nodes: Node[], edges: Edge[], lanes: Lane[] }`
    where `Lane = { key: string, label: string, x: number, width: number }`
  - Algorithm:
    1. Bucket nodes by `groupBy(id)`. Nodes returning `null` → "Other" lane.
    2. If `bucketCount > maxLanes`, keep the top-N by node count and
       merge the rest into "Other".
    3. Sort lanes (alphabetic by default, or `laneOrder` if given).
    4. For each lane, compute width = `max(estimateNodeWidth(label) for n in lane) + 2*PADDING`.
    5. Run a simple top-down stacked layout per lane:
       `nodeY = LANE_HEADER_H + i * (NODE_H + GAP)`. (Phase 4 can switch
       to per-lane dagre for trees.)
    6. Compute `lane.x` cumulatively with a `LANE_GAP` between lanes.
    7. Position each node at `(lane.x + (lane.width - node.width)/2, nodeY)`.
- [ ] Constants: `LANE_HEADER_H = 32`, `LANE_GAP = 24`, `NODE_GAP = 16`,
      `LANE_PADDING_X = 16`.
- [ ] Unit test: `site/tests/features/graph/swimlaneLayout.test.ts` —
      verifies bucket counts, "Other" merging at `maxLanes`, x-ordering,
      that two nodes in the same lane share an x-range.

### Phase 2: Wire into GraphCanvas

- [ ] Add `'swimlane'` to the layout algo enum in `elkOptions.ts` (or
      wherever `LayoutAlgoXyflow` is defined). Make sure `selectLayoutAlgoXyflow`
      returns it cleanly.
- [ ] In `GraphCanvas.tsx`, branch when `layoutAlgo === 'swimlane'`:
      skip `useElkLayout`, call `computeSwimlaneLayout` instead. The result
      shape should match what `useElkLayout` returns so the rest of the
      component is unchanged. Wrap the call in a `useMemo`.
- [ ] Pass `groupBy = (id) => derived.nodeTypes.get(id) ?? null` and
      `maxLanes` from the slice (Phase 3).

### Phase 3: View-panel controls

- [ ] Add to `viewConfigSlice`:
  - `laneProperty: 'type'` (room to extend later — `'predicate' | string`)
  - `maxLanes: 8` (default)
  - Reducers `setLaneProperty`, `setMaxLanes`.
  - Selectors `selectLaneProperty`, `selectMaxLanes`.
- [ ] Add a new `<SwimlaneControls>` component in
      `features/view-config/`. Show only when `layoutAlgo === 'swimlane'`:
  - `Select` for the grouping property (just `rdf:type` for now).
  - `NumberInput` (1–20) for max lanes.
- [ ] Add `<SwimlaneControls />` to `ViewPanel.tsx` inside a new
      "Swimlanes" `Section`, conditionally rendered.

### Phase 4: Lane backgrounds + headers in React Flow

- [ ] Add a custom React Flow node type `lane` (in
      `features/graph/LaneNode.tsx`) — non-draggable, non-selectable,
      `zIndex: -1`, renders a tinted rectangle with the lane label at the
      top. Width/height come from `data`.
- [ ] In the swimlane branch of `GraphCanvas`, push lane nodes into the
      `nodes` array before regular nodes, with `data: { label, width, height }`
      and styling that matches the canvas palette.
- [ ] Set `nodesDraggable={false}` on lane nodes via `draggable: false`
      per node.
- [ ] Confirm React Flow's z-ordering with mixed node types (set a
      higher `zIndex` on `pretty` nodes if needed).

### Phase 5: Polish + edge cases

- [ ] If `data.nodes.length === 0` or no lanes resolve, fall back to the
      `layered` layout silently (or render an empty state).
- [ ] If a node has multiple types, pick the first deterministically
      (sorted ascending) — document this in `swimlaneLayout.ts`.
- [ ] Ensure `requestRelayout` (R hotkey) re-runs the swimlane layout
      (the `useMemo` dep on a relayout nonce).
- [ ] Manual test with a small handcrafted TTL and one of the GO-CAM
      samples that has 5+ types.

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `site/src/features/graph/swimlaneLayout.ts` | New | pending |
| `site/src/features/graph/LaneNode.tsx` | New | pending |
| `site/src/features/graph/elkOptions.ts` | Edit (algo enum) | pending |
| `site/src/features/graph/GraphCanvas.tsx` | Edit (branch + lane nodes) | pending |
| `site/src/features/view-config/viewConfigSlice.ts` | Edit (state + reducers) | pending |
| `site/src/features/view-config/LayoutPicker.tsx` | Edit (option) | pending |
| `site/src/features/view-config/SwimlaneControls.tsx` | New | pending |
| `site/src/features/view-config/ViewPanel.tsx` | Edit (section) | pending |
| `site/src/features/view-config/index.ts` | Edit (re-exports) | pending |
| `site/tests/features/graph/swimlaneLayout.test.ts` | New | pending |

## Recovery Checkpoint

- **Last completed action:** Plan written.
- **Next immediate action:** Phase 1 — implement `computeSwimlaneLayout`
  pure function + its unit test.
- **Recent commands run:** —
- **Uncommitted changes:** Various from prior UX work (toolbar redesign,
  panel headers, search popover). Not blocking.
- **Environment state:** none

## Failed Approaches

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Blockers

- None.

## Notes

- **Why custom over ELK partitioning:** ELK's `org.eclipse.elk.partitioning`
  works but is opaque and hard to tune per-lane. We control the math,
  ~80 lines, no new deps.
- **Lane property is extensible.** Default is `rdf:type`. Future work
  could add "by predicate" (group target nodes by the predicate that
  links them to a chosen pivot) or "by namespace prefix".
- **Renderer scope.** Only React Flow gets the lane background nodes.
  Cytoscape/Force/Sigma show plain layouts when this option is selected
  (or we can disable the option for them via the same `layoutVisible`
  guard already in `Toolbar.tsx`).
- **Performance.** Pure JS, single pass, O(n + e). Safe up to a few
  thousand nodes — beyond that we'd revisit.

## Lessons Learned

—

## Additional Context (Claude)

- **Why not dagre per lane?** Phase 1 uses simple top-down stacking
  because most GO-CAM lanes have <20 nodes. If hierarchies inside a lane
  start mattering (parent/child types), swap the stacking step for
  `dagre` (already a dep) keyed on each lane's subgraph. Keep the public
  signature of `computeSwimlaneLayout` stable so this is a Phase 1.5
  swap, not an API change.
- **Edge routing.** With simple bezier edges in React Flow, cross-lane
  edges work fine even with no routing intelligence. If diagrams get
  busy, we could route along lane gutters (orthogonal style with custom
  edge type), but defer until a real graph shows the problem.
- **Lane labels for `rdf:type`.** Use `formatIri(type, labelMode)` so
  the label respects the user's IRI display preference (already
  available from `view-config`).
- **Open question:** what's the rule when a node has zero types? Default
  to "Other" lane — fine. Worth surfacing the count in the lane header
  ("Other · 12") so users know it's a catch-all.
