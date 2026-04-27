# Task: Add hide-standalone, min-degree filter, and edge search for huge TTL graphs

**Status:** COMPLETE
**Issue:** none (user request)
**Branch:** clean-up

## Goal
Make large GO-CAM/Reactome graphs usable by giving the user three new levers
that work across all 6 renderers: (1) hide standalone (orphan) nodes,
(2) hide nodes below a minimum degree, (3) search by edge in addition to nodes.

## Context
- **Related files:**
  - `site/src/features/view-config/viewConfigSlice.ts` (add state + reducers)
  - `site/src/features/view-config/selectors.ts` (add selectors)
  - `site/src/features/view-config/applyView.ts` (add filter logic — single
    chokepoint shared by all renderers)
  - `site/src/features/view-config/index.ts` (re-export new selectors/actions)
  - `site/src/features/view-config/ViewPanel.tsx` + a new
    `FilterControls.tsx` (UI)
  - All 6 canvases: `features/graph/GraphCanvas.tsx`,
    `features/graph-cytoscape/CytoscapeCanvas.tsx`,
    `features/graph-force/ForceCanvas.tsx`,
    `features/graph-force/ForceCanvas3D.tsx`,
    `features/graph-sigma/SigmaCanvas.tsx`,
    `features/graph-graphin/GraphinCanvas.tsx` — each reads selectors and
    forwards to `applyView()`
  - `site/src/features/search/SearchBox.tsx` (extend to search edges)
- **Triggered by:** user — "graphs are so huge ... not show stand alone nodes,
  search should search by edge."

## Current State
- **What works now:** filters by predicate + type + focus-with-BFS depth.
  All 6 renderers share `applyView()`; one filter chokepoint.
- **What's broken/missing:** no way to hide isolated nodes, no min-degree
  trim, search only indexes nodes.

## Steps

### Phase 1: View-config slice + selectors + applyView
- [x] Add `hideStandaloneNodes: boolean` and `minDegree: number` to
      `ViewConfigState` (defaults `false`, `0`).
- [x] Add reducers `setHideStandaloneNodes`, `setMinDegree` (clamp 0..20).
- [x] Add selectors `selectHideStandaloneNodes`, `selectMinDegree`.
- [x] Re-export new actions/selectors from `view-config/index.ts`.
- [x] Extend `ApplyViewInput` with `hideStandaloneNodes?` and `minDegree?`.
- [x] In `applyView()`: filter logic added.

### Phase 2: Wire into all 6 renderers
- [x] All 6 canvases pass new fields and add deps.

### Phase 3: Search by edge
- [x] Discriminated union `Hit`.
- [x] Index nodes and edges; display `"<source> —[<predicate>]→ <target>"`.
- [x] On choose: nodes → `selectNode` + `requestReveal`; edges →
      `selectEdge`.
- [x] node/edge badge; placeholder "Search nodes & edges…".

### Phase 4: UI
- [x] `FilterControls.tsx` with Switch + Slider 0..10.
- [x] "Filter" section in `ViewPanel.tsx`.

### Phase 5: Verify
- [x] `npm run build` — clean.
- [x] `npm run lint` — 4 errors, all pre-existing patterns; zero new
      regressions.
- [x] `npm test` — 34/34 (was 27/27; +7 in `applyView.test.ts`).

## Recovery Checkpoint

✅ TASK COMPLETE

## Failed Approaches
| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified
| File | Action | Status |
| ---- | ------ | ------ |
| `site/src/features/view-config/viewConfigSlice.ts` | extend state + reducers | ✅ |
| `site/src/features/view-config/selectors.ts` | add 2 selectors | ✅ |
| `site/src/features/view-config/index.ts` | re-export | ✅ |
| `site/src/features/view-config/applyView.ts` | filter logic | ✅ |
| `site/src/features/view-config/FilterControls.tsx` | NEW | ✅ |
| `site/src/features/view-config/ViewPanel.tsx` | add "Filter" section | ✅ |
| `site/src/features/graph/GraphCanvas.tsx` | pass new fields | ✅ |
| `site/src/features/graph-cytoscape/CytoscapeCanvas.tsx` | pass new fields | ✅ |
| `site/src/features/graph-force/ForceCanvas.tsx` | pass new fields | ✅ |
| `site/src/features/graph-force/ForceCanvas3D.tsx` | pass new fields | ✅ |
| `site/src/features/graph-sigma/SigmaCanvas.tsx` | pass new fields | ✅ |
| `site/src/features/graph-graphin/GraphinCanvas.tsx` | pass new fields | ✅ |
| `site/src/features/search/SearchBox.tsx` | nodes + edges index | ✅ |
| `site/tests/features/view-config/applyView.test.ts` | NEW (7 cases) | ✅ |

## Blockers
- None currently.

## Notes
- **Single chokepoint:** `applyView()` is called by all 6 renderers with the
  same input. Filters added there light up everywhere. Verified by reading
  every canvas.
- **`Hide standalone` vs `Min connections` semantics:** kept distinct —
  `minDegree` filters on the post-predicate graph (a *raw* connectivity
  threshold), then `hideStandaloneNodes` runs a second pass to clear
  cascading orphans (nodes that lost all their edges due to the previous
  step). Both can be on at once and they compose intuitively.
- **Edge reveal:** renderers' `revealNonce` only knows how to center on
  `selectedNodeId`. Centering on a selected edge would mean adding an
  `selectedEdgeId` branch to each renderer's reveal effect; not worth it for
  v1. Selecting an edge already updates the inspector and (in some
  renderers) highlights it visually.

## Lessons Learned
- The single `applyView()` chokepoint paid off — the filter was written once
  and lit up in all 6 renderers with a small mechanical change per canvas.
  Worth preserving as new renderers are added.
- Mid-task `git stash --keep-index` to baseline a pre-existing lint error
  was a near-miss — it stashed all my unstaged work. Better baseline:
  `git diff --stat HEAD` plus `git show HEAD:<file>`. Recovered via
  `git stash pop`.
- The "Hide standalone vs Min degree" two-control design composed exactly
  as intended (e.g., `minDegree=3` keeps node `a` but its edges are gone,
  and `hideStandalone` then correctly removes it).

## Summary
Three composable filters for huge TTL graphs:
1. **Hide standalone nodes** — toggle in View → Filter panel.
2. **Min connections** — slider (0..10) trims low-connectivity nodes.
3. **Search by edge** — Ctrl+K palette indexes edges; results show a
   "node"/"edge" badge.

All filters work in every renderer (xyflow, cytoscape, force, force3d,
sigma, graphin) because they apply at the shared `applyView()` chokepoint.

Possible follow-ups:
- Right-click → "Isolate subgraph" on canvas (focus + depth shortcut).
- Edge reveal/center for selected edges (currently only node selection
  drives `revealNonce`).
- Collapse-by-type / community grouping for very dense graphs.

## Additional Context (Claude)
- **Why no schema changes to api/conversion:** filtering is purely a view
  concern. Wire shape stays untouched; per CLAUDE.md the cross-cutting
  invariant is preserved.
- **Tests:** `applyView.ts` is a pure function — easy target for a Vitest
  unit test under `site/tests/features/view-config/applyView.test.ts`. Will
  add coverage for: empty `minDegree`, `minDegree > 0`,
  `hideStandaloneNodes`, both combined, and the case where focus is also
  set (focus runs after the new filters).
