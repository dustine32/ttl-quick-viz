# Task: Turn the viewer into an exploration tool — filters, coloring, search, focus

**Status:** ACTIVE (owner smoke-test pending; code complete)
**Issue:** —
**Branch:** init-feel

## Goal
Move the site from "render a graph" to "explore a graph." Add the feature set that makes RDF dumps actually legible: predicate filtering, `rdf:type` coloring, prefix-aware labels, ⌘K search, layout picker, focus/ego view. Done when a user can open an unfamiliar TTL graph of ~500 nodes and find the interesting structure without reading JSON.

## Context
- **Related files:**
  - `site/src/features/graph/GraphCanvas.tsx` (xyflow renderer)
  - `site/src/features/graph-cytoscape/CytoscapeCanvas.tsx` (cytoscape renderer)
  - `site/src/features/graph/useElkLayout.ts`, `elkOptions.ts`
  - `site/src/features/inspector/{InspectorPanel,NodeInspector,EdgeInspector}.tsx`
  - `site/src/features/inspector/shortenIri.ts` (IRI shortening, lift to a shared prefix registry)
  - `site/src/features/ui/uiSlice.ts` (selection + nonces; `rightPanelTab: 'properties' | 'view'` already exists)
  - `site/src/features/graph/graphSlice.ts` (renderer + selected graph id)
  - `site/src/layout/{Toolbar,RightPanel,LeftPanel,useAppHotkeys}.tsx`
- **Triggered by:** product brainstorm — current UI renders nodes but offers no navigation, filtering, or visual grouping. Graphs beyond ~30 nodes become illegible.
- **Context notes:** renderer toggle already wired; xyflow uses ELK, cytoscape uses a breadthfirst layout. Inspector already shortens IRIs inline.

## Current State

### What works now
- Renderer toggle (xyflow / cytoscape) with synced selection via `uiSlice`
- Node/edge inspector with IRI shortening
- Fit view + re-run layout via nonces
- Left: graph list. Right: inspector. Footer: status. Hotkey scaffold in `useAppHotkeys`.
- RTK Query fetches graph JSON from `/api/graphs/{id}`

### What's broken/missing
- No way to find a node by name on large graphs (no search)
- Every edge rendered the same — `rdf:type` and `rdfs:label` edges drown the interesting structure
- Every node the same color — classes invisible
- Labels are raw IRIs in the canvas (shortening only happens in the inspector)
- Only one layout per renderer; Cytoscape has no minimap
- No way to narrow the view to a neighborhood of a node
- Inspector doesn't link to neighbors — clicking through requires finding them on the canvas
- Export button is disabled; no way to share a specific view

## Steps

> Each phase ends at a **Checkpoint**: manual smoke in the browser with a real graph. The `'view'` tab on the right panel is the home for all configuration UI introduced by this plan.

### Phase 1: View-config slice + right-panel "View" tab scaffold — DONE
- [x] Create `features/view-config/viewConfigSlice.ts` with fields: `hiddenPredicates`, `hiddenTypes`, `labelMode`, `layoutAlgoXyflow`/`layoutAlgoCytoscape`, `focusNodeId`, `focusDepth`, `revealedNodeIds`, `pinnedNodeIds`, `sizeByDegree`
- [x] Wire into `app/store.ts`; selectors in `features/view-config/selectors.ts`
- [x] Build `features/view-config/ViewPanel.tsx` with Camera + Layout (live buttons) and placeholder sections for Predicates / Types / Labels / Focus
- [x] `RightPanel.tsx` renders `ViewPanel` on the `'view'` tab; old `ViewControls.tsx` removed
- [x] **Checkpoint:** `tsc -b --noEmit` clean. Browser smoke pending user check.

### Phase 2: Predicate filter + `rdf:type` coloring + legend — DONE
- [x] `useGraphDerivedData(graph)` hook returns predicate/type histograms + nodeTypes + degree
- [x] Stable palette via hash-to-index (`palette.ts::colorForType`); adding a new type doesn't shift existing colors
- [x] `PredicateFilter.tsx`: scrollable checkbox list with counts, "Show all / Hide all" quick actions
- [x] `TypeLegend.tsx`: color swatch + shortened IRI + count; clicking toggles `hiddenTypes`
- [x] `applyView.ts` pure filter: predicates hide edges, types hide nodes (and edges they touch)
- [x] `GraphCanvas` passes filtered graph to ELK, post-processes nodes with `colorForType` (accent border on `PrettyNode`)
- [x] `CytoscapeCanvas` uses filtered graph and `data(color)` in stylesheet; re-renders cleanly on filter change
- [x] **Checkpoint:** `tsc -b --noEmit` clean. Browser smoke pending.

### Phase 3: Prefix registry + label-mode toggle — DONE
- [x] `features/view-config/prefixes.ts` with default registry (rdf/rdfs/owl/xsd/foaf/dc/dcterms/skos/schema/obo) + `shortenIri` + `toPrefixed` + `formatIri`
- [x] `LabelModeToggle.tsx` — 3-way segmented control (Prefixed / Label / Full); slice `LabelMode` collapsed to 3 modes (dropped separate `id` — duplicate of `full` for RDF data)
- [x] Both canvases apply `labelMode` to node + edge labels (xyflow post-processes after ELK; cytoscape re-renders elements on mode change)
- [x] Inspector components migrated off `shortenIri` → `formatIri(..., labelMode)`; legacy `inspector/shortenIri.ts(+test)` deleted
- [x] Test store in `GraphCanvas.test.tsx` updated to include `viewConfig` reducer
- [x] **Checkpoint:** `tsc -b --noEmit` clean, all 27 site tests pass. Browser smoke pending.

### Phase 4: ⌘K command palette — jump to node — DONE
- [x] `features/search/CommandPalette.tsx` — Mantine `Modal` + `TextInput` (avoided adding `@mantine/spotlight`); arrow-key nav, Enter to choose, Esc/overlay closes, `{n} match(es)` counter
- [x] Index: each node indexed by `id`, `label`, and the prefixed-mode display string — substring match
- [x] Hotkey `mod+K` added to `useAppHotkeys` (toggles palette); toolbar gets a search button with tooltip
- [x] `uiSlice` gains `paletteOpen`, `togglePalette`, `setPaletteOpen`, `revealNonce`, `requestReveal`
- [x] Choosing a hit dispatches `selectNode` + `requestReveal`; `GraphCanvas` calls `setCenter` on the node's ELK position; `CytoscapeCanvas` calls `cy.animate({ center })`
- [x] **Checkpoint:** `tsc -b --noEmit` + all 27 tests pass. Browser smoke pending.

### Phase 5: Layout picker — DONE
- [x] xyflow: ELK options exposed via `getElkOptions(algo)` — `layered / mrtree / radial / force / stress`
- [x] cytoscape: `getCytoscapeLayout(algo)` — `breadthfirst / cose / concentric / circle / grid / random` (fcose deferred — built-ins cover the common shapes without a new dep)
- [x] `LayoutPicker.tsx` in toolbar — compact `Select` scoped to the active renderer
- [x] xyflow re-runs ELK on algo change or relayout nonce (`useElkLayout(graph, algo, nonce)`); cytoscape re-creates layout on algo change and responds to the relayout nonce
- [ ] localStorage persistence — deferred; the URL state pass (Phase 8) will cover this without adding a second persistence path
- [x] **Checkpoint:** `tsc -b --noEmit` + all 27 tests pass. Browser smoke pending.

### Phase 6: Focus / ego view + expand-on-double-click — DONE
- [x] `features/view-config/focus.ts` — undirected BFS from `focusNodeId` up to `focusDepth`, plus each revealed node's 1-hop neighborhood
- [x] `applyView` extended with `focusNodeId`/`focusDepth`/`revealedNodeIds`; order: predicate filter → type filter → focus/ego → reveal
- [x] `FocusControls.tsx` — "Focus on selected" button, depth slider (0–6), "Refocus on selected" + "Clear" once active
- [x] xyflow `onNodeDoubleClick` and cytoscape `dblclick` dispatch `revealNode(id)`
- [x] **Checkpoint:** `tsc -b --noEmit` + all 27 tests pass. Browser smoke pending.

### Phase 7: Inspector neighbor navigation + node sizing by degree — DONE
- [x] `NodeInspector` already listed in/out edges pre-plan; this phase wires `requestReveal` on neighbor click so the canvas pans to the target, plus adds a Degree row
- [x] `useGraphDerivedData` exposes degree per node (built in Phase 2); consumed by the inspector + styling
- [x] `Size nodes by degree` toggle (`sizeByDegree`) + `StylingControls.tsx`; cytoscape uses `mapData(degree, 0, 30, 36, 120)` for node width/height
- [x] xyflow degree sizing explicitly deferred (would require per-node width/height in ELK input + PrettyNode rework; not worth the churn before Phase 8 URL state). Toggle shows a note when xyflow is active.
- [x] **Checkpoint:** `tsc -b --noEmit` + all 27 tests pass. Browser smoke pending.

### Phase 8: Shareable URL state — DONE (PNG export deferred)
- [x] `features/url-state/urlState.ts` — `v: 1` versioned hash payload with `g / r / lm / la / lc / hp / ht / fid / fd / rv / sbd`
- [x] `useUrlSync` hook — hydrates from `window.location.hash` on mount, serializes store → hash on every state change (skips write if unchanged, so idle clicks don't spam `replaceState`)
- [x] Copy-link button in toolbar with transient "Copied!" tooltip
- [ ] PNG / SVG export — deferred (cytoscape has `cy.png()` out of the box; xyflow needs `html-to-image`; leaving as a follow-up)
- [x] **Checkpoint:** `tsc -b --noEmit` + all 27 tests pass. Browser smoke pending (hash round-trip).

## Recovery Checkpoint

> **⚠ UPDATE THIS AFTER EVERY CHANGE**

- **Last completed action:** Phases 1–8 implemented. `tsc -b --noEmit` clean; all 27 vitest tests pass. Browser smoke not yet performed by owner.
- **Next immediate action:** Owner smoke-tests in the browser (hash round-trip, palette, filters, focus). If green, close plan. Deferred bits tracked in Notes and the "Follow-ups" list in Additional Context.
- **Recent commands run:**
  - `npx tsc -b --noEmit` (clean)
  - `npm test -- --run` (9 files, 27 tests, green)
- **Uncommitted changes:** large delta across `site/src/features/{view-config,search,url-state}/**`, `site/src/features/graph{,-cytoscape}/**`, `site/src/features/inspector/**`, `site/src/features/ui/uiSlice.ts`, `site/src/app/store.ts`, `site/src/layout/{App,Toolbar,useAppHotkeys,icons}.tsx`, `site/src/App.tsx`, plus this plan. `inspector/shortenIri.(ts|test.ts)` + `features/graph/ViewControls.tsx` deleted.
- **Environment state:** Dev server not running. No new npm deps.

## Failed Approaches
<!-- Fill in as execution surfaces problems. -->

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `site/src/features/view-config/viewConfigSlice.ts` | create | done |
| `site/src/features/view-config/selectors.ts` | create | done |
| `site/src/features/view-config/palette.ts` | create | done |
| `site/src/features/view-config/prefixes.ts` | create | done |
| `site/src/features/view-config/focus.ts` | create | done |
| `site/src/features/view-config/applyView.ts` | create | done |
| `site/src/features/view-config/useGraphDerivedData.ts` | create | done |
| `site/src/features/view-config/ViewPanel.tsx` | create | done |
| `site/src/features/view-config/PredicateFilter.tsx` | create | done |
| `site/src/features/view-config/TypeLegend.tsx` | create | done |
| `site/src/features/view-config/LabelModeToggle.tsx` | create | done |
| `site/src/features/view-config/LayoutPicker.tsx` | create | done |
| `site/src/features/view-config/FocusControls.tsx` | create | done |
| `site/src/features/view-config/StylingControls.tsx` | create | done |
| `site/src/features/view-config/index.ts` | create | done |
| `site/src/features/search/CommandPalette.tsx` | create | done |
| `site/src/features/search/index.ts` | create | done |
| `site/src/features/url-state/urlState.ts` | create | done |
| `site/src/features/url-state/useUrlSync.ts` | create | done |
| `site/src/features/url-state/index.ts` | create | done |
| `site/src/features/graph/GraphCanvas.tsx` | modify (filters/colors/labels/layout/focus/reveal/dblclick) | done |
| `site/src/features/graph/PrettyNode.tsx` | modify (accent color) | done |
| `site/src/features/graph/useElkLayout.ts` | modify (algo + relayout nonce) | done |
| `site/src/features/graph/elkOptions.ts` | modify (multi-algo + typed options) | done |
| `site/src/features/graph/ViewControls.tsx` | delete (replaced by ViewPanel) | done |
| `site/src/features/graph/GraphCanvas.test.tsx` | modify (add viewConfig reducer) | done |
| `site/src/features/graph-cytoscape/CytoscapeCanvas.tsx` | modify (filter/color/label/layout/focus/reveal/dblclick/sizing) | done |
| `site/src/features/graph-cytoscape/layouts.ts` | create | done |
| `site/src/features/inspector/NodeInspector.tsx` | modify (labelMode + reveal + degree) | done |
| `site/src/features/inspector/EdgeInspector.tsx` | modify (labelMode) | done |
| `site/src/features/inspector/shortenIri.ts(+test)` | delete (replaced by prefix registry) | done |
| `site/src/features/ui/uiSlice.ts` | modify (paletteOpen + revealNonce + actions) | done |
| `site/src/layout/Toolbar.tsx` | modify (LayoutPicker, Search button, Copy-link) | done |
| `site/src/layout/RightPanel.tsx` | modify (render ViewPanel) | done |
| `site/src/layout/useAppHotkeys.ts` | modify (mod+K) | done |
| `site/src/layout/icons.tsx` | modify (IconSearch + IconLink) | done |
| `site/src/App.tsx` | modify (mount palette + useUrlSync) | done |
| `site/src/app/store.ts` | modify (add view-config reducer) | done |
| `site/package.json` | no new deps (fcose/d3-scale-chromatic/html-to-image deferred) | n/a |

## Blockers
- None currently

## Notes

- **Single source of truth for filters + colors + labels:** one `viewConfigSlice`. Both renderers read from it. This is the only way to avoid the two canvases drifting apart visually.
- **Filter pipeline order:** `predicate filter → type filter → focus/ego → reveal set`. Apply in that order every time; put it in one pure function (`features/view-config/applyView.ts`) that both renderers call.
- **Prefix registry:** start with the W3C defaults + whatever appears in the conversion's input files. The registry becomes user-editable in a future phase (out of scope here); for now it's a hard-coded map extended only by code.
- **Layout re-run semantics:** changing `layoutAlgo` implicitly re-runs layout; `relayoutNonce` forces a re-run with the current algo. Keep these orthogonal.
- **`rightPanelTab` already exists** in `uiSlice` with a `'view'` value that goes nowhere — Phase 1 makes it real.
- **Focus nonce vs focus id:** use the id as the source of truth. A "reveal" nonce is separate and used only to re-center the camera when a selection is made via palette/inspector.
- **Degree sizing gotcha:** in xyflow, changing node size mid-layout shifts positions; compute degree *before* layout and pass into node data.
- **Don't over-abstract:** predicate filter, type coloring, label mode, prefix registry — each is a small component. Resist the urge to build a generic "filter engine." Three similar lines beats a premature abstraction.

## Lessons Learned
<!-- Fill during and after task. -->

## Additional Context (Claude)

### Explicitly deferred (not done in this plan)
- **PNG / SVG export** — cytoscape has `cy.png()` free; xyflow wants `html-to-image`. Small, standalone follow-up.
- **xyflow degree-based sizing** — requires per-node width/height in ELK input + PrettyNode rework. Cytoscape already shows degree sizing when the toggle is on.
- **`cytoscape-fcose` / `d3-scale-chromatic`** — not added; built-in layouts + a hand-picked palette cover the current needs.
- **localStorage persistence of layout choice** — URL hash already carries it across reloads in the same tab, so localStorage is redundant for now.
- **Saved view presets / editable prefix registry / graph tabs / diff view / SPARQL** — out of scope per original plan.

### Ordering rationale
Phases 1–3 compound: the slice (1) enables filter (2) which needs coloring (2) which relies on the prefix registry (3). Any other order forces rework. Phases 4–8 are independent and can be reordered if a specific feature becomes urgent.

### Out of scope (on purpose)
- **Multiple graphs open at once / tabs** — complicates selection, URL state, and memory. Revisit once the single-graph UX is solid.
- **Graph diff** — interesting, niche; a standalone plan later.
- **SPARQL / query box** — API doesn't support it; would need a real backend change.
- **Saved view presets** — deferred until users actually have views worth saving.
- **Editable prefix registry UI** — hard-coded defaults cover 95% of real RDF.
- **Virtualization for huge graphs** — Cytoscape handles 10k+ fine; xyflow struggles past ~500. If this becomes a real constraint, the answer is "use Cytoscape for big graphs" not "rebuild xyflow's renderer."

### Risks
- **Two renderers, one config:** every visual feature must work in both. If a feature genuinely can't be expressed in one renderer, document it in **Notes** rather than diverging silently.
- **Palette scope creep:** ⌘K can easily become a god-command. In this plan it's *jump to node* only. Commands (toggle filter, change layout) can come later.
- **URL state bit-rot:** once URL sync ships, any new view-config field has to be versioned. Include a `v: 1` in the hash payload from day one.

### Alternatives considered
- **Panel-first design** (one massive View panel) vs **inline-first** (filters in toolbar, coloring in legend). Chose panel-first — the toolbar is small and already full; the right panel has room and users expect config there.
- **Generic "facet filter"** instead of predicate/type/namespace separately. Rejected — the three filters look similar but their UIs want different affordances (predicate = checkbox list; type = legend with color; namespace = prefix picker).
- **Server-side filtering** (push filter state to `/api/graphs/{id}?hide=rdf:type`). Rejected — graphs are small enough that client-side is instant, and server filtering multiplies cache-key complexity for no user-visible win.
