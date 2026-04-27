# Task: 3-way standalone-node toggle (hide / both / only) with localStorage persistence

**Status:** COMPLETE
**Issue:** none (user request, 2026-04-27)
**Branch:** clean-up

## Goal
Replace the boolean `hideStandaloneNodes` with a 3-state `standaloneMode`
(`'hide' | 'both' | 'only'`). Surface it on the toolbar as a `SegmentedControl`
that stays in sync with the same control in the View → Filter panel. When mode
is `'only'`, swap the canvas for a list pane of orphan nodes. Persist the chosen
mode to `localStorage` so it survives reloads.

## Context
- **Related files:**
  - `site/src/features/view-config/viewConfigSlice.ts` — slice + localStorage hydrate
  - `site/src/features/view-config/selectors.ts` — replace `selectHideStandaloneNodes`
  - `site/src/features/view-config/index.ts` — re-exports
  - `site/src/features/view-config/applyView.ts` — input shape change
  - `site/src/features/view-config/FilterControls.tsx` — Switch → SegmentedControl
  - `site/src/layout/Toolbar.tsx` — add `SegmentedControl`
  - `site/src/App.tsx` — render `StandaloneList` when mode === 'only'
  - `site/src/app/store.ts` — `subscribe()` to write changes back to localStorage
  - `site/src/features/graph/StandaloneList.tsx` — NEW (list pane of orphans)
  - 7 canvas wrappers: `GraphCanvas`, `CytoscapeCanvas`, `ForceCanvas`,
    `ForceCanvas3D`, `SigmaCanvas`, `GraphinCanvas`, `TreeCanvas` —
    swap selector + applyView arg
  - `site/src/features/ttl-source/TtlPane.tsx` — same swap for the TTL pane's
    visibility computation
  - `site/tests/features/view-config/applyView.test.ts` — update test inputs
- **Triggered by:** user — "easy access to toggle between hide standalone, show
  both, show standalone only … sync with the filter inside the settings …
  persistent in local storage."

## Current State
- **What works now:** `hideStandaloneNodes: boolean` in the slice. A single
  `Switch` in `FilterControls`. All 7 canvases + the TTL pane consume it via
  `applyView({ hideStandaloneNodes })`.
- **What's broken/missing:** no toolbar-level access, no "show only orphans"
  view, no persistence — every reload defaults to `false`.

## Steps

### Phase 1: Slice + selectors + applyView
- [x] Add `StandaloneMode` type + `loadStandaloneMode()` localStorage helper
      in `viewConfigSlice.ts`. Default `'both'`.
- [x] Replaced `hideStandaloneNodes` + `setHideStandaloneNodes` with
      `standaloneMode` + `setStandaloneMode`.
- [x] Replaced `selectHideStandaloneNodes` with `selectStandaloneMode`;
      `index.ts` re-exports updated (also exports `STANDALONE_MODE_STORAGE_KEY`
      and `StandaloneMode`).
- [x] `ApplyViewInput` now takes `standaloneMode?: StandaloneMode`. Only
      `'hide'` triggers the orphan filter.

### Phase 2: localStorage persistence
- [x] `store.ts` subscribes to the store and writes
      `viewConfig.standaloneMode` to `ttl-quick-viz:standaloneMode` on change
      (try/catch around `localStorage.setItem` for SSR/privacy mode).

### Phase 3: Wire into renderers + TTL pane
- [x] Updated all 7 canvases + `TtlPane` to read `selectStandaloneMode` and
      pass it into `applyView`.

### Phase 4: UI
- [x] Built `StandaloneList.tsx` — orphans = degree-0 nodes after the
      shared predicate/type filters apply (mirrors what `'hide'` mode would
      drop). Click → `selectNode` + `requestReveal`.
- [x] Toolbar `SegmentedControl` (`Connected | All | Orphans`). Renderer
      `Select` and `LayoutPicker` are disabled/hidden in `'only'` mode.
- [x] `FilterControls.tsx` Switch → SegmentedControl with help text.
- [x] `App.tsx` swaps the canvas for `<StandaloneList />` when mode === `'only'`.

### Phase 5: Tests + verify
- [x] `applyView.test.ts` updated: every `hideStandaloneNodes: true` →
      `standaloneMode: 'hide'`; added a case proving `'both'` and `'only'`
      are no-ops inside `applyView`.
- [x] `npm test` → 89/89.
- [x] `npm run build` → clean.
- [x] `npm run lint` → 2 pre-existing errors (`useElkLayout.ts`,
      `vite.config.ts`); zero new.

## Recovery Checkpoint

✅ TASK COMPLETE

## Failed Approaches
<!-- Prevent repeating mistakes after context reset -->

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `site/src/features/view-config/viewConfigSlice.ts` | type + helper + state + reducer | ✅ |
| `site/src/features/view-config/selectors.ts` | rename selector | ✅ |
| `site/src/features/view-config/index.ts` | update re-exports | ✅ |
| `site/src/features/view-config/applyView.ts` | rename input field | ✅ |
| `site/src/features/view-config/FilterControls.tsx` | Switch → SegmentedControl | ✅ |
| `site/src/layout/Toolbar.tsx` | add SegmentedControl + disable layout in `only` | ✅ |
| `site/src/app/store.ts` | localStorage subscribe | ✅ |
| `site/src/App.tsx` | render StandaloneList for `only` | ✅ |
| `site/src/features/graph/StandaloneList.tsx` | NEW | ✅ |
| `site/src/features/graph/index.ts` | export StandaloneList | ✅ |
| `site/src/features/graph/GraphCanvas.tsx` | rename selector + arg | ✅ |
| `site/src/features/graph-cytoscape/CytoscapeCanvas.tsx` | rename | ✅ |
| `site/src/features/graph-force/ForceCanvas.tsx` | rename | ✅ |
| `site/src/features/graph-force/ForceCanvas3D.tsx` | rename | ✅ |
| `site/src/features/graph-sigma/SigmaCanvas.tsx` | rename | ✅ |
| `site/src/features/graph-graphin/GraphinCanvas.tsx` | rename | ✅ |
| `site/src/features/graph-tree/TreeCanvas.tsx` | rename | ✅ |
| `site/src/features/ttl-source/TtlPane.tsx` | rename | ✅ |
| `site/tests/features/view-config/applyView.test.ts` | update inputs + add no-op case | ✅ |

## Blockers
- None currently.

## Notes
- **No backwards-compat shim.** Per repo norm we just rename — no
  `selectHideStandaloneNodes` re-export pointing at the new selector.
- **`'only'` is a canvas-level swap, not a filter.** `applyView` does not
  return only-orphans for `'only'`; that mode swaps the entire renderer for
  `StandaloneList` in `App.tsx`. Keeps `applyView` semantics simple.
- **localStorage key:** `ttl-quick-viz:standaloneMode`. Single-key write —
  no need for redux-persist for one field.
- **Default is `'both'`**, preserving today's "show everything" behavior on
  first visit (no surprise filter for new users).

## Lessons Learned
- The single `applyView` chokepoint paid off again — `'only'` mode does not
  need to plumb through the filter; swapping at the `App.tsx` level keeps
  every renderer ignorant of the new mode.
- `localStorage` write-on-change via `store.subscribe` is far lighter than
  `redux-persist` for a single key. The `lastPersistedStandaloneMode` guard
  avoids redundant writes on unrelated state changes.
- Disabling the renderer `Select` and hiding the `LayoutPicker` while in
  `'only'` mode prevents the toolbar from offering controls that don't
  apply to the list pane.

## Summary
Replaced the boolean `hideStandaloneNodes` filter with a 3-state
`standaloneMode` enum (`'hide' | 'both' | 'only'`) surfaced as a Mantine
`SegmentedControl` on the toolbar and a matching control in
View → Filter — both bound to the same Redux slice key for free sync.
The `'only'` mode swaps the active canvas for a new `StandaloneList`
component that lists every degree-0 node (after predicate/type filters)
and lets you click into the inspector. The chosen mode persists to
`localStorage` (`ttl-quick-viz:standaloneMode`) so reloads stay in the
last selected mode.

## Additional Context (Claude)
- The user proposed an alternative ("just always filter via settings, no
  3-way") but went with the full 3-way design. If the list pane proves
  underwhelming, the lighter alt is still on the table — the slice/selector
  rename is the same regardless.
- Toolbar real estate is tight. Three-segment SegmentedControl with short
  labels (`Connected / All / Orphans`) fits without crowding the existing
  renderer dropdown + ellipsis menu.
