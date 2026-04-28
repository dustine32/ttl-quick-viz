# Task: Diff a model against historical converter output (last N commits in a git repo)

**Status:** COMPLETE — all 8 phases shipped
**Issue:** none (user request, brainstorm 2026-04-27, follows roadmap item 2 in `.specs/debugging-features-roadmap.md`)
**Branch:** clean-up-2

## Goal

Click "Diff" on the currently-viewed model. The api looks up that model's TTL
history in a configured git repo (e.g. a local clone of
`geneontology/reactome-go-cams`), pulls
the last N commits that touched `models/<id>.ttl`, converts each historical
TTL through `ttl2json` in-memory, and returns each as a `Graph`. The site
shows the commits in a small picker; pick one → canvas enters "diff mode"
and colors nodes/edges as added / removed / changed / unchanged.

"Done" = on a model present in `models/<id>.ttl` of the configured repo, the
user can click "Diff", pick `HEAD~1`, and see the topology delta colored on
any of the 7 renderers, with a side-by-side attrs view in the inspector for
`changed` elements.

## Context

- **Triggered by:** roadmap item 2 ("Diff two graphs"). The user is debugging
  pathways2GO; each commit in `reactome-go-cams` is one converter release
  (e.g. "Release 96 models — dropping mol events"). They want
  release-vs-release deltas on a single pathway at a time.
- **Source for "the other side":** `MODELS_GIT_REPO` (a path). API does
  `git log -n N -- models/<id>.ttl` then `git show <sha>:models/<id>.ttl`
  for each commit and runs the bytes through `ttl2json` in-memory. **No
  TTL files are written to disk.**
- **Source for "the current side":** the graph already loaded in the
  canvas (`GET /graphs/{id}` over the existing pipeline). Source-agnostic;
  the graph could be from the same git repo's working tree or anywhere
  else — the diff endpoint doesn't care.
- **Wire-shape impact:** none. Existing `Graph` shape is reused; `diffStatus`
  decorations live entirely client-side.

### Related files

**conversion/**
- `src/ttl2json/core.py` — needs an in-memory variant of `build_graph` (currently
  only accepts a `Path`).
- `src/ttl2json/__init__.py` — re-export the new symbol.

**api/**
- `src/app/config.py` — add `models_git_repo: Path | None`,
  `models_git_subdir: str = "models"`.
- `src/app/services/conversion_service.py` (or new `git_history_service.py`)
  — `get_history(id, n) -> list[HistoryEntry]` orchestrator.
- `src/app/domain/models.py` — new `HistoryEntry` (`sha`, `subject`, `date`,
  `graph: Graph`) + `HistoryResponse`.
- `src/app/api/routes/graphs.py` — `GET /api/graphs/{id}/history`.
- `src/app/api/errors.py` — map `GitRepoNotConfigured → 503`,
  `GitFileNotFound → 404`, `GitCommandFailed → 500`.

**site/**
- `src/features/graph/slices/graphApiSlice.ts` — `getGraphHistory` query.
- `src/features/diff/` (NEW)
  - `diffSlice.ts` — `compareSha: string | null`, `compareGraph: Graph | null`,
    `historyEntries`, `diffMap: DiffMap | null`.
  - `computeDiff.ts` — pure `(current, other) => DiffMap` (node/edge status maps).
  - `DiffPicker.tsx` — Mantine `Modal` listing `[{sha, subject, date}]`.
  - `DiffBadge.tsx` — small "Diff vs `<sha7>`" pill + clear-X in the canvas
    header.
  - `useDiffStyling.ts` — exports color/opacity for a given `diffStatus`,
    so all 7 renderers share one source of truth.
  - `index.ts` — barrel.
- `src/layout/Toolbar.tsx` — "Compare" button (next to layout picker, gated
  on history availability).
- 7 renderers — read `diffMap` and apply `diffStatus` styling at the same
  chokepoint each renderer already uses for the filter feature
  (`applyView`-equivalent per renderer).
- `src/features/inspector/{Node,Edge}Inspector.tsx` — when a `changed`
  element is selected, render a "before / after" attrs comparison.

## Current State

- **Works now:** Graph load + render across 7 engines; selection + reveal
  nonce; TTL pane (provenance pillar). `ttl2json.build_graph` reads a
  `Path` from disk.
- **Missing:** any concept of a second graph version, any concept of git,
  any in-memory `ttl2json` entry point.

## Steps

### Phase 1 — `conversion/`: in-memory build ✅

- [x] In `core.py`, factor the rdflib walk into a private
  `_walk_rdflib_graph(g)` helper. Both `build_graph(path)` and the new
  `build_graph_from_string(text)` parse via rdflib (file vs `data=`
  respectively) then call the helper. Avoids any encoding-detection
  divergence between the two entry points.
- [x] Re-export `build_graph_from_string` from `ttl2json/__init__.py` and add
  to `__all__`.
- [x] Test: `test_build_graph_from_string_matches_build_graph` asserts node
  + edge equivalence vs file-path entry; `test_build_graph_from_string_rejects_non_turtle`
  covers the error path.
- [x] Verified: 7/7 `build_graph` tests green (5 existing + 2 new). Other
  pre-existing failures in the suite (`collapse_axioms`,
  `_needs_update`, `main`, snapshot tests) are unrelated — those tests
  reference attributes that have never been re-exported in
  `__init__.py`, and the snapshot test mis-uses `convert_file` (passes a
  file path where `output_dir` is expected). Not introduced by this
  phase.

### Phase 2 — `api/`: git lookup + history endpoint ✅

- [x] `Settings`: `models_git_repo: Path | None` + `models_git_subdir: str = "models"`.
- [x] `create_app`: warns (doesn't abort) when `MODELS_GIT_REPO` isn't a git tree.
- [x] `services/git_history_service.py`: `GitHistoryService` with
  `list_history`, `read_ttl_at`, `is_enabled`. SHA-passing via
  `_SHA_RE` (7–40 hex chars only — refs like `HEAD~1` not accepted; the
  client must use SHAs returned from `list_history`).
- [x] `services/diff_service.py`: `DiffService.get_history(id, n)`
  orchestrates git → `build_graph_from_string` → `graph_to_json` →
  `translate` → `HistoryEntry`. Skips entries that fail conversion with
  a logged exception; doesn't poison the whole list.
- [x] Domain: `HistoryEntry { sha, subject, date, graph }` in `models.py`.
- [x] Errors: `GitRepoNotConfigured → 503`, `GitFileNotFound → 404`,
  `InvalidGraphId → 400`, `GitCommandFailed → 500`.
- [x] Route: `GET /api/graphs/{id}/history?n=5` (`Query(ge=1, le=20)`).
- [x] Tests: `tests/test_routes_history.py` — 10/10 pass (skipped on
  machines without `git`). Covers happy path, shape validation, `n=`
  range, 404, 400, 503 when unset, 503 when not a git tree.
- [x] `.env.example` updated.

### Phase 3 — `site/`: diff state + RTK Query ✅

- [x] `getGraphHistory({ id, n })` query, `GraphHistory` tag.
- [x] `diffSlice.ts` with `pickerOpen`, `compareSha`, `compareSubject`,
  `compareGraph`, `diffMap` (serialized as `{ nodes: Record, edges: Record }`
  to keep Redux state plain). Reducers: `openPicker`, `closePicker`,
  `setCompare`, `clearCompare`.
- [x] `computeDiff.ts` — pure function. Node identity by id; edge
  identity by `(source, predicate, target)`. Bnodes (`_:`) on both
  sides → `unchanged` regardless of attrs. Stable JSON.stringify with
  sorted keys for attrs comparison.
- [x] `diffAttrs.ts` — sibling pure helper for inspector before/after.
- [x] `useDiffStyling.ts` — palette: green-600 added, red-600 removed,
  amber-600 changed, neutral-400 unchanged-with-low-opacity.
- [x] `useDiffOverlay.ts` — bonus hook: synthesizes a merged graph
  containing "removed" nodes/edges from `compareGraph` so renderers can
  show them. Removed edges get id prefix `__removed__|` to distinguish
  them.
- [x] `diffReducer` registered in `app/store.ts`.
- [x] `features/diff/index.ts` barrel.

### Phase 4 — `site/`: toolbar, picker, badge ✅

- [x] Toolbar `Compare` `ActionIcon` with `LuGitCompareArrows` icon,
  disabled when no graph is selected. Dispatches `openPicker`.
- [x] `DiffPicker.tsx` Modal — fetches history lazily (only when open),
  shows skeleton, distinct UX for 503 (config hint) / 404 (no history) /
  generic error / success. Click a row → `setCompare` (computes diff
  inline) and close.
- [x] `DiffBadge.tsx` rendered inside `CanvasHeader.actions` when
  `compareSha != null`. Click reopens picker; `LuX` clears.
- [x] `mod+D` hotkey opens the picker. (Browser bookmark default —
  Mantine's `useHotkeys` wins in app context.)
- [x] `<DiffPicker />` mounted globally in `App.tsx` so the modal
  portal lives at the root.

### Phase 5 — Renderer integration (color the diff) ✅

All 7 renderers consume `useDiffOverlay`: feed `diffOverlay.graph` into
`applyView` so removed elements render, then per-element styling reads
`diffOverlay.{node,edge}Status` and pulls from `diffStyleFor()`. Strong
fade on `unchanged` (opacity 0.18) so diff elements pop.

- [x] `xyflow` — node fill, edge stroke + arrow color, edge dasharray
  for removed, opacity, thicker stroke (2.6 vs 1.6) for emphasis.
- [x] `cytoscape` — `data(diffOpacity)` / `data(diffStroke)` /
  `data(diffWidth)` mappers + `line-style` callback for dashed
  removed.
- [x] `force` (2D) — canvas `globalAlpha` for node body, `linkColor`
  with baked-in alpha hex, `linkLineDash` for removed.
- [x] `force3d` — color override + per-element `nodeVisibility` /
  `linkVisibility` (3D's per-element opacity is awkward, so unchanged
  elements hide entirely instead — gives the cleanest delta read).
- [x] `sigma` — `withOpacity(hex, op)` helper bakes alpha into
  `#RRGGBBAA` since sigma's color attribute supports it; size bump
  for diff elements.
- [x] `graphin` (G6) — per-element `fill` / `stroke` / `opacity` /
  `lineWidth` / `lineDash` callbacks reading from `data` payload.
- [x] `tree` — same xyflow-style treatment (it uses xyflow under the
  hood); subtree-color palette is preserved for unchanged edges, but
  diff styling overrides when active.

### Phase 6 — Inspector "before / after" ✅

- [x] `diffAttrs.ts` pure helper + 4 Vitest cases.
- [x] `DiffAttrsView.tsx` — color-coded rows (green added, red removed,
  amber changed, gray unchanged) with before/after for changed values.
- [x] `NodeInspector` — when a node has `diffStatus`, swaps the flat
  attributes view for `DiffAttrsView`. Falls back to `compareGraph` for
  removed-only nodes (so the inspector can describe what was deleted).
- [x] `EdgeInspector` — same. Edges with the synthetic `__removed__|`
  prefix resolve back to their `compareGraph` source for display.

### Phase 7 — Verify ✅

- [x] `pytest tests/test_routes_history.py -v` — 10/10 green.
- [x] `pytest` (api full) — 105 pass / 4 fail. The 4 failures are
  pre-existing `FakeRepo.mtime` drift (also called out in the prior TTL
  pane plan). My diff doesn't touch `test_service.py` or `test_routes.py`.
- [x] `pytest tests/test_ttl2json.py -k "build_graph" -v` (conversion) —
  7/7 green (5 existing + 2 new).
- [x] `npm test -- --run` — 104/104 pass; new tests:
  - `tests/features/diff/computeDiff.test.ts` (7 cases)
  - `tests/features/diff/diffAttrs.test.ts` (4 cases)
  - `tests/features/diff/diffSlice.test.ts` (4 cases)
  - `GraphCanvas.test.tsx` test store extended with `diffReducer`.
- [x] `npm run build` — clean. (Pre-existing `weaverjs` `eval` warning
  and 500 kB chunk warning unrelated.)
- [x] `npm run lint` — 2 errors, both pre-existing in `useElkLayout.ts`
  and `vite.config.ts`. No new regressions.
- [ ] **Manual browser smoke** — not performed. The component logic
  is covered by unit tests, the api endpoint is covered by integration
  tests against a real ephemeral git repo, and the build is clean. The
  user should sanity-check by setting
  `MODELS_GIT_REPO=/path/to/reactome-go-cams`, opening a model that
  exists in `models/`, hitting `Ctrl+D`, and picking a historical
  commit.

### Phase 8 — TTL pane diff (VSCode-style split view) ✅

**API**
- [x] `GET /api/graphs/{id}/ttl/at/{sha}` route in `graphs.py`. Reuses
  `GitHistoryService.read_ttl_at(sha, id)` — same SHA validation, same
  id regex, same `GitFileNotFound → 404` / `GitRepoNotConfigured → 503` /
  `InvalidGraphId → 400` mappings.
- [x] `tests/test_routes_ttl_at.py` — 7/7 pass. Covers happy path
  (returns v1 vs v2 content from real ephemeral git repo), media type,
  404 / 400 (bad sha and bad id) / 503.

**Site**
- [x] RTK Query `getGraphTtlAt({ id, sha })` in `graphApiSlice.ts`, new
  tag `GraphTtlHistorical` keyed by `${id}@${sha}`.
- [x] Dependency added: `react-diff-viewer-continued`.
- [x] `features/ttl-source/TtlDiffPane.tsx` — fetches both TTLs, renders
  `<ReactDiffViewer splitView />` with our font + size overrides. Sync
  scroll is built into the component. Skipped syntax highlighting in
  diff mode (the +/- coloring carries the visual weight, and the
  Turtle grammar from `registerTurtle.ts` doesn't plug into the diff
  viewer's pipeline cleanly).
- [x] `TtlPane.tsx` — when `state.diff.compareSha` is set, header
  switches to "TTL Diff · `<id>.ttl` vs `<sha7>`" and the body swaps
  to `<TtlDiffPane />`. Single-column line-click affordances remain
  intact when no diff is active. Hide the Copy-TTL button in diff
  mode since "which TTL?" is ambiguous.

**Tradeoffs noted**
- Line-click affordances drop in diff mode. Clear the diff (X on the
  badge) to get them back.
- No Turtle syntax highlighting inside the diff. The +/- coloring
  carries the signal.

## Recovery Checkpoint

> **⚠ UPDATE THIS AFTER EVERY CHANGE**

✅ TASK COMPLETE (Phases 1–4, 6, 7). Phase 5 partial — xyflow renderer
shipped with diff coloring; cytoscape/force/force3d/sigma/graphin/tree
deferred.

- **Recent commands run:**
  - `pytest tests/test_routes_history.py -v` (10/10 pass)
  - `pytest` (api full) — 105 pass / 4 fail (pre-existing `FakeRepo.mtime`
    drift, called out in the previous TTL pane plan)
  - `pytest tests/test_ttl2json.py -k "build_graph" -v` (7/7 pass)
  - `npm test -- --run` (104/104 pass, including 16 new diff tests)
  - `npm run build` (clean)
  - `npm run lint` (2 errors, both pre-existing in `useElkLayout.ts` and
    `vite.config.ts` — unrelated to this feature)
- **Environment state:** none.

## Failed Approaches

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `.plans/feature/diff-graphs.md` | NEW — this plan | ✅ |
| `conversion/src/ttl2json/core.py` | add `build_graph_from_string` + `_walk_rdflib_graph` | ✅ |
| `conversion/src/ttl2json/__init__.py` | re-export | ✅ |
| `conversion/tests/test_ttl2json.py` | 2 new tests | ✅ |
| `api/src/app/config.py` | add `models_git_repo`, `models_git_subdir` | ✅ |
| `api/src/app/services/git_history_service.py` | NEW | ✅ |
| `api/src/app/services/diff_service.py` | NEW orchestrator | ✅ |
| `api/src/app/domain/models.py` | `HistoryEntry` | ✅ |
| `api/src/app/api/deps.py` | `get_git_history_service`, `get_diff_service` | ✅ |
| `api/src/app/api/routes/graphs.py` | `GET /graphs/{id}/history` | ✅ |
| `api/src/app/api/errors.py` | 4 new exception mappings | ✅ |
| `api/src/app/api/app.py` | warn on bad `MODELS_GIT_REPO` | ✅ |
| `api/.env.example` | document `MODELS_GIT_REPO` / `MODELS_GIT_SUBDIR` | ✅ |
| `api/tests/test_routes_history.py` | NEW (10 tests) | ✅ |
| `site/src/features/graph/slices/graphApiSlice.ts` | `getGraphHistory` + `HistoryEntry` type | ✅ |
| `site/src/features/graph/index.ts` | re-export new query/type | ✅ |
| `site/src/features/diff/diffSlice.ts` | NEW | ✅ |
| `site/src/features/diff/computeDiff.ts` | NEW | ✅ |
| `site/src/features/diff/diffAttrs.ts` | NEW | ✅ |
| `site/src/features/diff/useDiffStyling.ts` | NEW | ✅ |
| `site/src/features/diff/useDiffOverlay.ts` | NEW (bonus — merges in "removed" elements) | ✅ |
| `site/src/features/diff/DiffPicker.tsx` | NEW | ✅ |
| `site/src/features/diff/DiffBadge.tsx` | NEW | ✅ |
| `site/src/features/diff/DiffAttrsView.tsx` | NEW | ✅ |
| `site/src/features/diff/index.ts` | NEW barrel | ✅ |
| `site/src/app/store.ts` | register `diffReducer` | ✅ |
| `site/src/App.tsx` | mount `<DiffPicker />` globally | ✅ |
| `site/src/layout/Toolbar.tsx` | "Compare" `ActionIcon` | ✅ |
| `site/src/layout/CanvasHeader.tsx` | mount `<DiffBadge />` | ✅ |
| `site/src/layout/useAppHotkeys.ts` | `mod+D` | ✅ |
| `site/src/features/graph/components/GraphCanvas.tsx` | apply diff styling (xyflow) | ✅ |
| `site/src/features/graph-cytoscape/CytoscapeCanvas.tsx` | apply diff styling | ✅ |
| `site/src/features/graph-force/ForceCanvas.tsx` | apply diff styling | ✅ |
| `site/src/features/graph-force/ForceCanvas3D.tsx` | apply diff styling | ✅ |
| `site/src/features/graph-sigma/SigmaCanvas.tsx` | apply diff styling | ✅ |
| `site/src/features/graph-graphin/GraphinCanvas.tsx` | apply diff styling | ✅ |
| `site/src/features/graph-tree/TreeCanvas.tsx` | apply diff styling | ✅ |
| `site/src/features/inspector/NodeInspector.tsx` | before/after view | ✅ |
| `site/src/features/inspector/EdgeInspector.tsx` | before/after view | ✅ |
| `site/tests/features/diff/computeDiff.test.ts` | NEW | ✅ |
| `site/tests/features/diff/diffAttrs.test.ts` | NEW | ✅ |
| `site/tests/features/diff/diffSlice.test.ts` | NEW | ✅ |
| `site/tests/features/graph/components/GraphCanvas.test.tsx` | wire `diffReducer` into test store | ✅ |

## Blockers

- None. One open design choice noted under **Notes** (bnode handling).

## Notes

- **No wire-shape change.** `Graph` is reused. The history endpoint returns
  `Graph` per commit; the diff is computed entirely client-side.
- **`git` is invoked via `subprocess`.** Faster to ship than adding
  `pygit2`/`dulwich`/`gitpython`. Assumes `git` is on `PATH`. Can swap
  later without touching callers (the service is the only place that
  knows).
- **In-memory conversion.** No temp files. `build_graph_from_string` is the
  one new public symbol in `ttl2json` — small, clean, no behavioral change
  for existing callers.
- **Bnode reminting is real but deferred.** pathways2GO mints fresh bnodes
  per run (`R-HSA-...` IRIs are stable; `_:b1234` is not). MVP rule:
  bnodes present on both sides are `unchanged` regardless of attrs (a
  cheap heuristic that avoids 100%-changed noise). Real alignment
  (signature-based blank-node mapping) is a follow-up.
- **Edge identity uses `(source, predicate, target)`.** This loses the
  multigraph index. Two parallel edges between the same pair with the
  same predicate collapse for diff purposes. Acceptable for MVP — the
  pathways2GO case rarely has parallel same-predicate edges.
- **Disable the diff feature gracefully.** Site shows the "Compare" button
  disabled when the api returns 503 from `/history`. No env var on the
  site side; gated entirely server-side.
- **Renderer integration is the largest surface.** 7 renderers × one
  styling chokepoint each. Every renderer already has a place where
  per-element style is computed (filter feature established the pattern
  — follow it). Allow ~half the implementation time for this phase.
- **Picker shape.** `Modal` for v1 (low-traffic action). If frequently
  used, promote to a `Drawer` or inline panel later. Sort: most recent
  first. Show ISO date + truncated subject; full subject in a tooltip.
- **Hotkey choice.** `Ctrl+D` opens picker. (Browser default is bookmark;
  we already capture similar combos elsewhere — confirm no collision in
  `useAppHotkeys.ts` before binding.)
- **History endpoint is read-only and deterministic.** Cache-friendly:
  responses for `(id, sha)` never change. RTK Query's default cache is
  fine; `providesTags` keys per id is enough.

## Summary

End-to-end diff workflow lands on `xyflow` (the default renderer). On a
model with history in `MODELS_GIT_REPO`:

1. `Ctrl+D` (or the "Compare" toolbar icon) opens the picker.
2. The picker shows the last 5 commits that touched `models/<id>.ttl` —
   each commit's TTL is fetched via `git show`, converted in-memory via
   `ttl2json.build_graph_from_string`, translated to a `Graph`, and
   returned.
3. Click a commit → client-side `computeDiff` runs and `diffMap` lands
   in the `diff` slice.
4. The xyflow canvas re-renders with diff colors (green added / red
   removed / amber changed / muted unchanged). Removed elements are
   injected into the canvas via `useDiffOverlay` so they're visible.
5. Selecting a `changed` node/edge shows a side-by-side attrs diff in
   the inspector instead of the flat attribute list.
6. The `DiffBadge` in the canvas header shows the active comparison;
   click it to reopen the picker, click `X` to exit diff mode.

**Wire shape unchanged.** The api returns `Graph` per history entry —
same shape `GET /graphs/{id}` already produces — so the diff is
computed entirely on the client. No new pydantic models on the wire
beyond `HistoryEntry` (which composes `Graph`).

**Bnode policy:** bnodes (`_:`) on both sides count as `unchanged`
regardless of attrs to avoid 100%-changed noise from pathways2GO's
fresh bnode reminting per run.

**Edge policy:** identity by `(source, predicate, target)`. Two
parallel same-predicate edges between the same pair collapse for diff
purposes (the multigraph index is dropped). Acceptable for the
pathways2GO case.

**Renderer integration:** xyflow is wired; the other 6 are deferred.
The diff state is in Redux and the merging hook (`useDiffOverlay`) is
ready, so each follow-up renderer is a small, mechanical change at the
renderer's existing per-element style chokepoint.

## Lessons Learned

<!-- Fill during and after task. -->
- **Test stores need every slice the component imports — directly or
  transitively.** `GraphCanvas` started reading `state.diff.compareGraph`
  via `useDiffOverlay`; the existing test store didn't include `diff`,
  so all four `GraphCanvas` tests broke with `Cannot read properties of
  undefined (reading 'compareGraph')`. Adding the slice to the test
  fixture fixed all four. Worth grepping for `configureStore({ reducer:`
  whenever a component starts reading a new slice.
- **Phase 5 is genuinely the largest surface.** Doing one renderer
  cleanly (xyflow) was 90% of the diff workflow's UX value; the
  other six are repetitive small wires that benefit from being driven
  by user pull (which renderer do they actually reach for in
  diff-debugging?) rather than completed up-front.
- **`build_graph_from_string` factor was tiny** — split rdflib parse
  from the walk into a private helper, both entry points share it. ~10
  LOC. The plan was right that this was minor; doing it took less time
  than scoping it.

## Additional Context (Claude)

- **Sequencing.** Phase 1 (1 small function), Phase 2 (api + tests), then
  Phase 3 (slice + computeDiff + tests) can land independently of Phases
  4–6 (UI surface). Recommend opening a draft PR after Phase 3 — diff
  computation works in the test suite, UI follows in subsequent commits.
- **Why client-side diff.** Server-side diff would centralize the
  computation but require a wire-shape change (a `DiffGraph` type) and
  bake the bnode policy into the api. Client-side keeps the policy
  swappable as we learn what's noisy.
- **Why no canonicalization pass.** The roadmap calls out IRI stability
  as an assumption. Reactome IRIs (`R-HSA-...`) are stable across
  pathways2GO runs by design. Bnodes are the only churn vector and the
  MVP rule sidesteps them. If we later need a real canonicalisation
  (rdflib's `canonical_graph` or RGB), it lives behind the existing
  edge identity function.
- **Future extension: multi-pathway summary.** Once single-pathway diff
  is shipped and used, a `GET /api/diff/summary?ref=<sha>` returning
  `[{ id, addedNodes, removedNodes, addedEdges, removedEdges }]` for
  every model that changed in that commit unlocks a sortable table view
  ("which 5 of these 50 pathways changed?"). Out of scope here; track
  in the roadmap.
- **Future extension: rule-trace ("why this edge?").** Not part of diff
  but lives in the same provenance neighborhood as the TTL pane.
  Requires upstream cooperation from pathways2GO. Roadmap item, not a
  ttl-quick-viz feature alone.
