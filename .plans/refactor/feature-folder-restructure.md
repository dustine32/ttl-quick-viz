# Task: Restructure features/ into type-grouped subfolders (where count justifies it)

**Status:** ACTIVE
**Issue:** —
**Branch:** clean-up

## Goal
Group the two large feature folders (`graph/`, `view-config/`) and the borderline
mid-size ones into `components/`, `hooks/`, `services/`, `slices/` subfolders, while
keeping small features flat. Mirror the c-site convention (`C:\work\panther\annotations\go-pango-annotations-trials\c-site\src\features\cards\`).
Tests stay green at every checkpoint; the public barrel of each feature
(`@/features/<name>`) keeps the same export surface so external callers don't break.

## Context
- **Convention reference:** `C:\work\panther\annotations\go-pango-annotations-trials\c-site\src\features\cards\` (full split: components / hooks / models / services / slices / utils) and `cardClash/` (light split: components / hooks / utils). `library/` stays flat at one file. RTK Query lives in `slices/*ApiSlice.ts`, no separate `api/`.
- **Related files:** all of `site/src/features/`, `site/tests/features/` (mirrors src paths), every `features/*/index.ts` barrel, `docs/dev-guide-react.md`.
- **Triggered by:** `features/graph/` (13 files) and `features/view-config/` (17 files) are getting hard to scan flat. User wants the c-site layout.

## Current State
- **What works now:** All features compile, tests pass, public surface flows through `@/features/<name>` barrels for cross-feature consumers; some renderers reach in via deep paths (`@/features/graph/useElkLayout`, `@/features/view-config/viewConfigSlice`).
- **What's broken/missing:** Two flat feature folders are too crowded; some files (`TtlPane.tsx` 430 lines, `SearchBox.tsx` 332, `GraphCanvas.tsx` 432, `TreeCanvas.tsx` 453, `ForceCanvas.tsx` 300) hold inline subcomponents that should be their own files.

## Conventions
- **Group when ≥ ~7 files**, flat below that.
- Subfolder names match c-site: `components/`, `hooks/`, `services/`, `slices/`, `models/`, `utils/`. **No `api/` folder** — RTK Query goes in `slices/*ApiSlice.ts` (matches c-site `cardsApiSlice.ts`).
- `index.ts` barrel stays at feature root and re-exports from subfolders, so external `@/features/<name>` callers don't change.
- `types.ts` stays at feature root (it's the shared wire-shape file in `graph/`).
- File renames at this checkpoint:
  - `features/graph/graphApi.ts` → `features/graph/slices/graphApiSlice.ts`
  - `features/graph/graphSlice.ts` → `features/graph/slices/graphSlice.ts`
  - `features/view-config/viewConfigSlice.ts` → `features/view-config/slices/viewConfigSlice.ts`
- Tests mirror new src paths: e.g. `tests/features/graph/slices/graphApiSlice.test.ts`.
- **Deep imports prefer the barrel** when crossing feature boundaries; same-feature deep imports update to new internal paths.

## Steps

> Run `npm run build && npm test` after **every** phase before moving on.
> Commit per phase so reverts are scoped.

### Phase 1: Restructure `features/graph/` (13 files) — DONE
- [x] Create `components/`, `hooks/`, `services/`, `slices/`
- [x] Move components → `components/`: `GraphCanvas.tsx`, `PrettyNode.tsx`, `LaneNode.tsx`, `GraphList.tsx`, `StandaloneList.tsx`
- [x] Move hooks → `hooks/`: `useElkLayout.ts`
- [x] Move services → `services/`: `elkOptions.ts`, `swimlaneLayout.ts`, `radialLayout.ts`, `dagreLayout.ts`, `connectedComponents.ts`
- [x] Move + rename slices: `graphApi.ts` → `slices/graphApiSlice.ts`; `graphSlice.ts` → `slices/graphSlice.ts`
- [x] Update internal imports within `features/graph/`
- [x] Update external deep imports (`graph-tree/TreeCanvas`, `view-config/LayoutPicker`, all 7 graph tests)
- [x] Update `features/graph/index.ts` barrel to re-export from new paths
- [x] Mirror tests: `tests/features/graph/{components,hooks,services,slices}/`
- [x] `npm run build && npm test` → green (16 files / 89 tests)

### Phase 2: Restructure `features/view-config/` (17 files)
- [ ] Create `components/`, `hooks/`, `services/`, `slices/`
- [ ] Components → `components/`: `ViewPanel`, `FilterControls`, `FocusControls`, `LabelModeToggle`, `LayoutPicker`, `PredicateFilter`, `StylingControls`, `SwimlaneControls`, `TypeLegend`
- [ ] Hooks → `hooks/`: `useGraphDerivedData.ts`
- [ ] Services → `services/`: `applyView.ts`, `focus.ts`, `palette.ts`, `prefixes.ts`, `selectors.ts`
- [ ] Slice → `slices/`: `viewConfigSlice.ts`
- [ ] Update barrel + internal + external deep imports (notably `revealNode` from `viewConfigSlice` is reached deeply by every canvas)
- [ ] Mirror tests: `tests/features/view-config/services/applyView.test.ts`
- [ ] `npm run build && npm test` → green

### Phase 3: Inline-subcomponent extractions (no folder change yet)
- [ ] `features/ttl-source/TtlPane.tsx`: extract inline `TtlBody` → `TtlBody.tsx`, `Empty` → `Empty.tsx`, `describeError` → `describeError.ts`
- [ ] `features/search/SearchBox.tsx`: extract `SectionHeader` → `SectionHeader.tsx`, `EdgeRowDisplay` → `EdgeRowDisplay.tsx`, lift the index/match memo block → `useSearchIndex.ts`
- [ ] No behavior change. `npm run build && npm test` → green

### Phase 4: Restructure now-grown small features
- [ ] `features/ttl-source/` → `components/{TtlPane, TtlBody, Empty}`, `services/{findLine, registerTurtle, describeError}`
- [ ] `features/search/` → `components/{SearchBox, SectionHeader, EdgeRowDisplay}`, `hooks/{useSearchIndex}`
- [ ] `features/graph-cytoscape/` (6 files) → `components/{CytoscapeCanvas}`, `services/{layouts, register}`, `types/{cytoscape-dagre.d.ts, cytoscape-extensions.d.ts}`
- [ ] `features/graph-tree/` (5 files) → `components/{TreeCanvas, MindMapNode}`, `services/{buildTree}`, `slices/{treeSlice}`
- [ ] Barrels + imports + tests mirroring
- [ ] `npm run build && npm test` → green

### Phase 5: Stay-flat features — confirm and document
- [ ] Confirm `graph-force/` (3), `graph-graphin/` (2), `graph-sigma/` (2), `inspector/` (4), `ui/` (2), `url-state/` (3) stay flat
- [ ] No moves; just note in dev guide

### Phase 6: Update dev guide
- [ ] Edit `docs/dev-guide-react.md` §1 — soften "feature-first, not type-first" to "feature-first; type-subfolders inside a feature when count warrants it (≥ ~7 files)"
- [ ] Refresh the worked tree example to show the new shape
- [ ] Add a one-liner referencing c-site as the pattern source

## Out of Scope (note for follow-up)
The bigger maintenance win is the **cross-canvas duplication** of `applyView` / fit-view / reveal logic across all 7 canvas components (~80 lines × 7 ≈ 560 near-identical lines). That's a behavior-touching change and deserves its own plan: extract `useFilteredGraph`, `useFitViewOnNonce`, `useRevealOnSelection`, plus `<CanvasStatus>` overlay, in `features/graph/hooks/` and `features/graph/components/`. Do NOT bundle into this plan.

## Recovery Checkpoint

> **⚠ UPDATE THIS AFTER EVERY CHANGE**

- **Last completed action:** Phase 1 done. `features/graph/` regrouped into `components/hooks/services/slices/`; all 89 tests pass; build clean. `graphApi.ts` renamed to `graphApiSlice.ts` and `graphSlice.ts` moved into `slices/`. Two external deep-import call-sites updated (`graph-tree/TreeCanvas.tsx`, `view-config/LayoutPicker.tsx`); rest of the codebase already used the `@/features/graph` barrel.
- **Next immediate action:** Phase 2 — restructure `features/view-config/` (17 files).
- **Recent commands run:** none
- **Uncommitted changes:** prior session's standalone-mode work staged on `clean-up` branch (StandaloneList.tsx, dagreLayout.ts, etc. — unrelated to this plan but on the same branch)
- **Environment state:** branch `clean-up`, no servers running

## Failed Approaches
<!-- Prevent repeating mistakes after context reset -->

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
|      |        |        |

## Blockers
- None currently

## Notes
- **Threshold:** ~7 files. Hard cases:
  - `graph-cytoscape/` (6) — borderline; group lightly because the .d.ts files are clearly a separate concern.
  - `graph-tree/` (5) — borderline; group because `treeSlice` and `buildTree` are clearly different kinds.
  - `search/` and `ttl-source/` — group only **after** Phase 3 extracts inline subcomponents and pushes them past the threshold.
- **Why no `api/` folder:** c-site puts RTK Query inside `slices/cardsApiSlice.ts`. Mirror that — RTK Query is just a slice with extra middleware.
- **Barrels are the public surface.** All cross-feature imports should resolve through `@/features/<name>`; deep paths inside another feature are a code smell to clean up *only when convenient* during this refactor — don't make this PR also a deep-path-cleanup PR.
- **Tests** mirror src paths exactly (per `dev-guide-react.md` §9).

## Lessons Learned
<!-- Fill during and after task. -->
- (TBD)

## Additional Context (Claude)
- The cross-canvas duplication is the bigger win — flagged as out-of-scope above so this PR stays a pure structural move.
- `clean-up` branch already has unrelated staged changes (standalone-mode toggle work). If the user wants this restructure isolated, branch from `main` instead — but a single tidy-up branch is also reasonable.
- Phase 1 (graph/) is the riskiest because almost every canvas reaches into it. Run build + tests aggressively after each move.
- Dev guide currently says "feature-first, not type-first" — the new convention is *still feature-first at the top level*, just that within a feature we group by file kind once it's big enough. Make sure the doc rewrite preserves that nuance.
