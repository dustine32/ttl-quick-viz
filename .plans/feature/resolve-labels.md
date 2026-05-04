# Task: Resolve ontology labels — bundled RO cache + GOlr lookup button

**Status:** COMPLETE (site phases 1–4)
**Issue:** —
**Branch:** resolve-label

## Goal

Make graphs readable when the source TTL doesn't carry `rdfs:label` for every
referenced term. Two-tier strategy:

1. **Bundled relation labels** — every relation predicate used in noctua /
   GO-CAM models ships with the site as a static JSON map. Sourced from
   `noctua-visual-pathway-editor`'s `globalKnownRelations` (BFO + BSPO + RO
   + Uberon properties + …, ~760 entries, ~60 KB raw / ~15 KB gzipped).
   Applied automatically on graph load. No network. Covers **edge labels
   only** — class labels (GO terms, ChEBI, UBERON anatomy, CL cell types)
   are unbounded and not bundleable.
2. **On-demand GOlr lookup** — every node class IRI (GO, ChEBI, UBERON, CL,
   PR, NCBITaxon, ECO, SO, etc.) is resolved by a toolbar button **"Resolve
   labels"** that batches unresolved CURIEs to
   `noctua-golr.berkeleybop.org/select` and caches the answers in
   `localStorage` so subsequent loads are instant.

"Done" (site phase) = open a graph where edges read as opaque
`obo:RO_0002333` and nodes read as opaque `obo:GO_0003674`. After load:
edges already say "enabled by", "part of", "occurs in" (bundled). Press
"Resolve labels"; within a couple of seconds nodes resolve to "molecular
function", "G protein-coupled receptor", etc. via GOlr — and the result
persists across reloads.

## Scope

This plan is **website only**. Webview / VSCode extension parity is a later
phase noted at the end (CSP + postMessage proxy required).

## Context

### Why this is needed

Most pathways2GO / GO-CAM / Reactome TTL files reference terms by IRI but
don't inline `rdfs:label` for them — only the model's own classes/individuals
get labels. Open a `R-HSA-*.ttl` and edges are predicates like
`http://purl.obolibrary.org/obo/RO_0002333` ("enabled by") rendered as
`obo:RO_0002333`; nodes are IRIs like `obo:GO_0003674` instead of "molecular
function". This is the single biggest readability gap when debugging
pathways2GO output.

### How labels flow today

- Producer: `conversion/src/ttl2json/core.py::_walk_rdflib_graph` writes
  `node.label = labels.get(nid)` from `rdfs:label` literals only. No
  external lookup.
- Wire: `site/src/features/graph/types.ts::GraphNode.label?: string`.
- Consumer: `site/src/features/view-config/prefixes.ts::formatIri(iri,
  mode, { label })` — returns `label` when `mode === 'label'` and a label
  exists; otherwise falls back to `toPrefixed(iri)` then `shortenIri(iri)`.
  Same story for edges via `GraphEdge.label`.

So the wire already supports labels. What's missing is a **second source of
truth** for labels that the original TTL didn't carry — without changing
the wire shape and without changing the producer.

### Reference modules to crib from (NOT directly reusable)

Two upstream snapshots in sibling Angular projects we copy data out of —
no runtime dep on either, just commit the JSON.

**Prefix map** —
`C:\work\go\old-noctua-visual-pathway-editor\src\@noctua.curie`:

- `data/go-context.ts` — JSON-LD `@context` with ~150 prefix mappings (GO,
  RO, CHEBI, UBERON, CL, PR, NCBITaxon, etc., plus dozens of niche dbs).
- `services/curie.service.ts` — wraps `@geneontology/curie-util-es5` to
  expand/contract CURIEs.

We will **copy the prefix map** (verbatim into a TS const), but **not**
adopt `curie-util-es5` — `prefixes.ts::toPrefixed` already does what we
need; it just has 9 prefixes instead of ~150. We extend the registry, no
new dep.

**Bundled relation labels** —
`C:\work\go\old-noctua-visual-pathway-editor\src\environments\environment-data.ts`:

- Exports `globalKnownRelations: { id, label, relevant }[]` — 760 entries.
  Generated upstream by `noctua/noctua.js` from
  `self.known_relations` (which is fed in from a deploy-time owltools
  extraction in noctua's deploy pipeline; we don't reproduce that
  pipeline, just snapshot the output).
- IDs are **mostly** clean CURIEs (`BFO:0000050`, `RO:0002211`,
  `BSPO:0000096`) but ~80 entries are bare OBO fragments
  (`obo:uberon/core#posteriorly_connected_to`,
  `obo:wbphenotype/wbphenotype-equivalent-axioms-subq#during`). Those
  need a parallel index keyed by full IRI, since `iriToCurie` won't
  produce a CURIE for them (no prefix in the map). See
  "Two-key index" in Architecture.
- The `relevant` flag marks GO-CAM-active relations. We ignore it for
  now — every label is useful in the viewer; nothing to do with whether
  a UI surfaces a relation picker.

### Where labels need to land in the SPA

Anywhere that calls `formatIri(iri, 'label', { label })`:

- `features/graph/components/GraphCanvas.tsx` (xyflow node/edge label)
- `features/graph-cytoscape/CytoscapeCanvas.tsx`
- `features/graph-force/ForceCanvas.tsx`, `ForceCanvas3D.tsx`
- `features/graph-sigma/SigmaCanvas.tsx`
- `features/graph-graphin/GraphinCanvas.tsx`
- `features/graph-tree/TreeCanvas.tsx`
- `features/inspector/*` (right-panel node/edge inspectors)
- `features/search/SearchBox.tsx` and command palette
- `features/ttl-source/TtlPane.tsx` (line annotations, if any)

The plan threads the override through a single hook (
`useResolvedLabel(iri, fallbackLabel?)`), so callers don't change shape —
they just call the hook instead of reading `node.label` directly. Anywhere
that uses `formatIri` keeps working; we just pass the resolved label in.

## Current State

### What works now
- `formatIri` renders labels when present on nodes/edges.
- `DEFAULT_PREFIXES` covers 10 common namespaces — enough to *display* a
  CURIE for any obo IRI as `obo:GO_0003674`, but not enough to recognize
  the prefix as `GO`.
- `viewConfigSlice` has `labelMode: 'label' | 'curie' | 'full'`.

### What's missing
- No label data for terms whose TTL didn't inline a label.
- No CURIE-aware prefix map (everything obo:* gets the generic `obo:` pun).
- No GOlr client.
- No persistence layer for resolved labels.
- No toolbar affordance to trigger resolution.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ conversion/                                                          │
│ └── scripts/                                                         │
│     └── build_known_relations.py  // generator → site JSON           │
│                                                                      │
│ site/src/features/labels/                                            │
│ ├── data/                                                            │
│ │   ├── prefix-map.ts             // GO @context, ~150 entries       │
│ │   └── known-relations.json      // GENERATED. Flat IRI→label map.  │
│ ├── golrClient.ts                 // batched fetch of GOlr labels    │
│ ├── iriToCurie.ts                 // IRI ⇄ CURIE using prefix-map    │
│ ├── labelsSlice.ts                // { byIri: Record<iri,label> }    │
│ ├── selectors.ts                  // selectResolvedLabel(iri)        │
│ ├── useResolvedLabel.ts           // hook used by every renderer     │
│ ├── ResolveLabelsButton.tsx       // toolbar button + progress       │
│ └── index.ts                      // public re-exports               │
└──────────────────────────────────────────────────────────────────────┘
```

### Single flat IRI-keyed map

The bundled JSON and the runtime slice both use **one** flat map keyed by
**full IRI** — the same shape `ttl2json` emits in `node.id` and
`edge.predicate`. Lookup is a direct `byIri[id]`, no CURIE conversion
at the hot path.

```ts
type LabelsState = {
  byIri: Record<string, string>;   // "http://purl.obolibrary.org/obo/RO_0002333" → "enabled by"
};
```

The generator normalizes both ID shapes in `globalKnownRelations` to full
IRIs before writing:

| Source ID                                            | Generated key (full IRI)                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `BFO:0000050`                                        | `http://purl.obolibrary.org/obo/BFO_0000050`                            |
| `RO:0002333`                                         | `http://purl.obolibrary.org/obo/RO_0002333`                             |
| `obo:uberon/core#posteriorly_connected_to`           | `http://purl.obolibrary.org/obo/uberon/core#posteriorly_connected_to`   |
| `obo:wbphenotype/.../subq#during`                    | `http://purl.obolibrary.org/obo/wbphenotype/.../subq#during`            |

`obo:` expands to `http://purl.obolibrary.org/obo/` (from the GO @context).
Standard OBO CURIEs (`BFO:NNNNNNN` style) are expanded by replacing the
`:` with `_` after the prefix expansion. JSON wire shape:

```json
{
  "http://purl.obolibrary.org/obo/BFO_0000050": "part of",
  "http://purl.obolibrary.org/obo/RO_0002333": "enabled by",
  ...
}
```

GOlr responses (which come back keyed by CURIE) get the same
normalization on the way in: `annotation_class: "GO:0003674"` →
`http://purl.obolibrary.org/obo/GO_0003674` → store in `byIri`.

### Resolution order (selector logic)

```
selectResolvedLabel(iri, fallback?) =
  1. node/edge.label from the wire (the fallback param)        ← original TTL
  2. labels.byIri[iri]                                         ← bundled or GOlr
  3. undefined  → caller falls back to formatIri(iri, 'curie') ← unresolved
```

### Persistence

`labels.byIri` is mirrored to `localStorage` under `ttl-viz/labels/v1`
via a `store.subscribe` callback in `app/store.ts`, **alongside the
existing standaloneMode persistence**. The bundled `known-relations.json`
is *not* persisted — it's re-merged on every boot from the static import
(idempotent). Only GOlr-resolved entries genuinely need persistence; the
bundled ones are free on every load. We persist the merged map anyway
(simpler — one source of truth) and accept the ~15 KB localStorage cost
of duplicating the bundled set. Versioned key (`/v1`) so we can
invalidate on breaking changes.

### GOlr query shape

The URL the user pasted is the **autocomplete** endpoint (edismax over
many fields, `q=d`). For label-by-id we want the simpler ID lookup:

```
GET https://noctua-golr.berkeleybop.org/select
  ?wt=json
  &rows=200
  &fl=annotation_class,annotation_class_label
  &fq=document_category:"ontology_class"
  &fq=annotation_class:("GO:0003674" OR "GO:0008150" OR ... OR "CL:0000003")
  &q=*:*
```

Implementation notes:
- **Batch ~80 IDs per request.** Solr's `fq` Lucene parser handles long
  OR-clauses, but URLs over ~6 KB hit gateway limits. 80 × ~15 chars per
  CURIE leaves headroom.
- **Concurrency 4.** Don't hammer the public service; we're a dev tool.
- **No JSONP, no `callback_type=search`.** Use plain `fetch()` with
  `wt=json`. CORS on noctua-golr is permissive (`Access-Control-Allow-
  Origin: *`); confirm during phase 3.
- **Skip CURIEs whose prefix is unknown** to the prefix map — pass them
  through unresolved. (Avoids querying GOlr for `gomodel:`, `_:bnode`,
  `obo:` punning, etc.)
- **Cache misses are cached too.** Store negative results as an empty
  string `''` so we don't re-query terms GOlr doesn't know. Cleared by
  bumping `/v1` if we want to retry.

### Bundled relation labels: generator-driven, never copy-pasted

Source: `globalKnownRelations` in
`old-noctua-visual-pathway-editor/src/environments/environment-data.ts`
(760 entries, `[{id, label, relevant}]`).

**Generator script** —
`conversion/scripts/build_known_relations.py`. Why Python in
`conversion/` and not Node in `site/`?

- `conversion/` already has Poetry / `.venv/` set up — zero new toolchain.
- `site/` has no need for Python at runtime; pulling in a build-time JS
  parser to read a TS array literal is more code than the Python
  equivalent.
- The script is build-time only (manual, on-demand) — it has no business
  inside the `site/` source tree.

**What the script does**, in order:

1. Resolve the source path. Default:
   `<repo-root>/../old-noctua-visual-pathway-editor/src/environments/environment-data.ts`,
   resolved by walking up from the script's location until a directory
   named `ttl-quick-viz` is found, then going one level up. Override
   with `--src PATH`.
2. Resolve the destination path. Default:
   `<ttl-quick-viz>/site/src/features/labels/data/known-relations.json`.
   Override with `--out PATH`.
3. Read the source as text. Locate the `globalKnownRelations` array via
   regex (`r"export const globalKnownRelations\s*=\s*(\[)"`), then walk
   bracket-balanced to find the matching `]`. Slice and `json.loads` the
   array literal — it's plain JSON inside the TS file (no comments or
   trailing commas in this particular file; if that ever changes, fail
   loud and demand the user fix the source).
4. For each entry: drop entries with no `label`. Drop the `relevant`
   field. Normalize the `id` to a full IRI using the routing rules
   above. Collect into a dict.
5. Sort the dict by key (deterministic diffs).
6. **Skip-if-identical**: if the destination file exists and content
   matches byte-for-byte, do nothing — don't touch mtime. (Keeps git
   clean on no-op runs.)
7. Otherwise write the JSON (UTF-8, `indent=2`, sorted keys, trailing
   newline) and print a one-line summary:
   `wrote 743 relations to site/src/features/labels/data/known-relations.json (62.4 KB)`.
   Also print counts of skipped (no label) and unrouted (unknown id
   shape — should be 0; surface loudly if not).

**Failure modes**:

- Source file missing → exit 2 with `error: source not found at PATH;
  pass --src` and the resolved default.
- `globalKnownRelations` not found in source → exit 2 with `error:
  could not locate 'export const globalKnownRelations = [...]' in
  PATH; upstream format may have changed`.
- Entry with unrecognized id shape (neither CURIE nor `obo:.../#...`) →
  print to stderr, skip, count it; continue. Non-fatal so a single bad
  entry doesn't break the build.

**Invocation**:

```bash
# From repo root, with conversion/.venv activated:
python conversion/scripts/build_known_relations.py
# → wrote 743 relations to site/src/features/labels/data/known-relations.json (62.4 KB)

# Override paths:
python conversion/scripts/build_known_relations.py --src /path/to/environment-data.ts --out site/src/features/labels/data/known-relations.json
```

The site does **not** need to depend on this script — it depends on the
generated `known-relations.json` (committed). The script is a
re-generation tool, not a build-step. Run it whenever upstream noctua
publishes a new relation list.

Footprint: ~60 KB raw, ~15 KB gzipped in the bundle. Trivial.

## Steps

### Phase 1: CURIE utility + label registry (no UI yet)
- [ ] Create `site/src/features/labels/data/prefix-map.ts` — copy the
      `@context` map from `old-noctua-visual-pathway-editor/.../go-context.ts`
      verbatim into a TS const `GO_CONTEXT: Record<string, string>`. Keep the
      original obo URL prefixes; reverse-lookup table built once at module
      load.
- [ ] Add `iriToCurie(iri: string): string | null` and
      `curieToIri(curie: string): string | null`. Returns null for IRIs/CURIEs
      whose prefix isn't in the map.
- [ ] Add `labelsSlice.ts` with
      `{ byIri: Record<string, string> }` and reducers
      `addResolvedLabels(payload: Record<iri, label>)` and
      `clearResolvedLabels()`. Idempotent merge into `byIri`.
- [ ] Wire reducer into `app/store.ts`. Add `localStorage` mirror under
      `ttl-viz/labels/v1` in the existing `store.subscribe` block; hydrate
      the slice with `preloadedState` on store creation.
- [ ] Add `selectors.ts::selectResolvedLabel(state, iri, fallback?)`.
- [ ] Add `useResolvedLabel(iri, fallback?)` hook.
- [ ] Unit tests under `site/tests/features/labels/`:
      - `iriToCurie.test.ts` — round-trip, unknown prefixes, edge cases
        (BNode `_:`, IRIs without a known prefix).
      - `labelsSlice.test.ts` — add/clear, idempotent merge.
      - `selectors.test.ts` — fallback chain.

### Phase 2: Bundled relation labels (generator + bootstrap)

- [ ] Create `conversion/scripts/build_known_relations.py` per the
      "Bundled relation labels: generator-driven" spec above. Smart
      defaults for both `--src` and `--out` (walk up to find
      `ttl-quick-viz`, then sibling-step to `old-noctua-visual-pathway-
      editor`). Pure stdlib (no Poetry deps added). Skip-if-identical
      to keep git clean. Sorted output. Prints a summary line.
- [ ] Run the script once. Verify
      `site/src/features/labels/data/known-relations.json` exists, is
      valid JSON, contains `"http://purl.obolibrary.org/obo/RO_0002333":
      "enabled by"` and `"http://purl.obolibrary.org/obo/BFO_0000050":
      "part of"`.
- [ ] Document in `conversion/CLAUDE.md` under a new "Helper scripts"
      section: what `build_known_relations.py` does, when to re-run it,
      where its output lands.
- [ ] Add a `useLabelsBootstrap` hook (or a one-shot effect in `App.tsx`)
      that imports the JSON and `dispatch(addResolvedLabels(json))` on
      first mount. Idempotent — `addResolvedLabels` is a merge. Cheap
      presence check (`state.labels.byIri[BFO_PART_OF_IRI]`) lets us
      skip the dispatch on subsequent mounts to avoid the no-op merge.
- [ ] Test (`site/tests/features/labels/bootstrap.test.ts`): after
      `useLabelsBootstrap` runs, `selectResolvedLabel(state,
      "http://purl.obolibrary.org/obo/RO_0002333")` returns
      `"enabled by"`, and the OBO-fragment Uberon entries resolve too.
- [ ] Test (`conversion/tests/test_build_known_relations.py`): given a
      tiny synthetic `environment-data.ts` fixture with a 3-entry
      `globalKnownRelations` array (one CURIE, one OBO-fragment, one
      with no label), the generator writes the expected normalized
      JSON. Tests the parsing + routing logic without depending on the
      sibling repo being present.

### Phase 3: GOlr client + Resolve labels button
- [ ] `golrClient.ts::resolveLabels(curies: string[]): Promise<Record<string,
      string>>`:
      - Filter to CURIEs with known prefixes (skip `gomodel:`, `_:`,
        anonymous IRIs).
      - Chunk to 80 per request.
      - Fire up to 4 in parallel.
      - Build the URL with `URLSearchParams` (no JSONP, no callback). Use
        `wt=json`, `rows=200`, `fl=annotation_class,annotation_class_label`,
        `fq=document_category:"ontology_class"`,
        `fq=annotation_class:("ID1" OR "ID2" ...)`, `q=*:*`.
      - On HTTP error or empty response, log + skip (don't throw — partial
        progress is fine).
      - Return a flat `Record<curie, label>`. CURIEs missing from the
        response get an empty string (negative cache).
- [ ] Add a derived selector `selectUnresolvedCuries(state)`:
      collects every node/edge IRI in the **current** graph, converts to
      CURIE, drops bnodes + the model-internal `gomodel:` prefix, drops
      already-resolved entries, returns the dedup'd list. Memoize with
      `createSelector` keyed on `state.graph.current` and
      `state.labels.byCurie` length.
- [ ] `ResolveLabelsButton.tsx`: Mantine `ActionIcon` with `LuTags` icon,
      tooltip `"Resolve labels (N pending)"`, opens a small popover when
      pressed showing `Resolve N labels` action + a disabled-when-zero
      state. While running: spinner, progress text `"Resolved X of Y"`.
      Notification on completion using the existing `notifications` pattern.
- [ ] Wire it into `Toolbar.tsx`: place it left of the Rebuild button (so
      Rebuild stays adjacent to the More menu). Hide in standalone-only
      mode? — no, labels still matter in the orphan list. Show always.
- [ ] **No hotkey** — toolbar button only. Avoids hotkey collisions and
      keeps the action explicit.
- [ ] Tests:
      - `golrClient.test.ts` — chunking, URL construction, response
        parsing, negative caching. Mock `fetch`.
      - `selectUnresolvedCuries.test.ts` — bnodes excluded, gomodel
        excluded, already-resolved excluded.

### Phase 4: Thread resolved labels through every renderer
- [ ] Replace direct `formatIri(iri, mode, { label: node.label })` calls
      with a small wrapper that reads `useResolvedLabel(iri, node.label)`
      first, then passes the result. To avoid hooks-in-loops, do this at
      the *layer that builds the renderer's input* (e.g. the memoized
      `nodes` array passed to xyflow), reading the whole `byCurie` map
      once via `useAppSelector` and passing a `resolveLabel(iri,
      fallback)` function down. Each renderer's `useMemo` keys on
      `byCurie` along with the existing graph state.
- [ ] Apply to all seven renderers + inspector + search + TTL pane line
      annotations. **Do this renderer by renderer** — each is a separate
      commit so a regression in one is easy to bisect.
- [ ] Visual smoke test: open a Reactome fixture, press Resolve, check
      every renderer shows readable labels.

### Phase 5: Inspector + tooltips show CURIE alongside label
- [ ] Cosmetic: when a label is shown, render the CURIE as muted secondary
      text (e.g. `enabled by` with `RO:0002333` underneath in the
      inspector; tooltip on hover for canvas labels). This is the
      pathways2GO debugging payoff — you can copy the ID without flipping
      modes.
- [ ] Follow the Tailwind-for-layout, Mantine-for-Text pattern. No new
      libs.

## Out of scope (later phases / separate plans)

- **Webview / VSCode extension parity.** The webview's CSP blocks external
  fetches; the extension host has to do the GOlr request and ship results
  back via `postMessage`. That's a separate phase requiring:
    1. A new postMessage message type `resolveLabels` (extension → webview
       request, webview → extension response).
    2. `vscode/src/labels/golrClient.ts` mirroring the site one but
       running in extension host (`https.get`).
    3. A swap in `webviewBaseQuery` (or a parallel channel) so the
       `ResolveLabelsButton` action routes through postMessage when
       `isWebviewMode()`.
    4. Persistence in `ExtensionContext.globalState` instead of
       localStorage (or both — the webview is sandboxed but storage
       survives if we use globalState).
- **Conversion-time enrichment.** Baking labels into the JSON at conversion
  time would be faster on first load, but requires network during
  conversion (bad for offline / CI / snapshot tests) and stale snapshots.
  Defer indefinitely — view-time resolution with persistent cache is
  strictly better for a dev tool.
- **Definitions / synonyms / parent class.** GOlr returns these too; we
  could surface them in the inspector. Out of scope for this plan;
  bookmark for a follow-up `feature/inspector-ontology-detail.md`.
- **Server-side GOlr proxy** in `api/`. Not needed — CORS is open on
  GOlr, and a proxy adds ops cost. Skip.

## Recovery Checkpoint

✅ TASK COMPLETE — site phases 1–4 implemented.

- Phase 1 — `site/src/features/labels/` slice + `iriToCurie` + selectors +
  hooks; wired into `app/store.ts` with localStorage mirror under
  `ttl-quick-viz:labels:v1`. 15 tests passing.
- Phase 2 — `conversion/scripts/build_known_relations.py` generator (7
  tests, hits real upstream → 743 relations, 54.9 KB). Bootstrap effect
  in `App.tsx` via `useLabelsBootstrap`. Bootstrap test green (4 tests).
- Phase 3 — `golrClient.ts` (5 tests) + `ResolveLabelsButton` wired into
  `Toolbar.tsx` left of Rebuild. No hotkey.
- Phase 4 — `useFormatIri()` cache-aware hook threaded through 14 call
  sites: 7 renderers + Inspector × 2 + SearchBox + FocusControls +
  PredicateFilter + TypeLegend + StandaloneList. Default `labelMode`
  flipped to `'label'` so cache hits surface without a toggle. Memo
  deps updated.

**Final verification:** `npx tsc -b` clean, `npx vitest run` 129/129
passing, `npm run build` green.

## Failed Approaches

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `.plans/feature/resolve-labels.md` | create | done |
| `conversion/scripts/build_known_relations.py` | create | done |
| `conversion/tests/test_build_known_relations.py` | create | done |
| `site/src/features/labels/data/prefix-map.ts` | create | done |
| `site/src/features/labels/data/known-relations.json` | generated | done |
| `site/src/features/labels/iriToCurie.ts` | create | done |
| `site/src/features/labels/labelsSlice.ts` | create | done |
| `site/src/features/labels/selectors.ts` | create | done |
| `site/src/features/labels/useResolvedLabel.ts` | create | done |
| `site/src/features/labels/useFormatIri.ts` | create | done |
| `site/src/features/labels/useLabelsBootstrap.ts` | create | done |
| `site/src/features/labels/golrClient.ts` | create | done |
| `site/src/features/labels/ResolveLabelsButton.tsx` | create | done |
| `site/src/features/labels/index.ts` | create | done |
| `site/src/app/store.ts` | edit | wire labels reducer + persistence |
| `site/src/App.tsx` | edit | mount `useLabelsBootstrap` |
| `site/src/layout/Toolbar.tsx` | edit | mount `ResolveLabelsButton` |
| `site/src/features/view-config/viewConfigSlice.ts` | edit | default `labelMode = 'label'` |
| 7 renderers + 4 view-config consumers + 2 inspectors + search | edit | swap formatIri → useFormatIri |
| `site/tests/features/labels/*.test.ts` | create | 4 test files, 19 tests |
| `site/tests/features/graph/components/GraphCanvas.test.tsx` | edit | add labels reducer to test store |

## Blockers
- None.

## Notes / Design decisions

- **Why a separate `labels` slice and not extending `viewConfig`?** Labels
  are *content*, not view configuration — they survive renderer changes,
  graph changes, and reload. `viewConfig` is per-view state.
- **Why IRI keys, not CURIE keys?** `ttl2json` emits full IRIs in
  `node.id` and `edge.predicate`. Keying the cache by IRI means lookup
  is a direct `byIri[id]` — no per-call CURIE conversion, no two-tier
  fallback. CURIEs are still used at the GOlr boundary (where the
  protocol demands them), but they're an internal detail of the fetch
  client, not a runtime data shape. Tradeoff: keys are ~3–4× longer in
  localStorage (~50 KB instead of ~12 KB for 1k entries) — accepted
  given we're well under any quota.
- **Why a manual button instead of auto-resolving on graph load?** Two
  reasons: (1) network-blocking the canvas is a worse first impression
  than IRIs, especially when the user is debugging a converter and
  *wants* to see the raw IDs first. (2) explicit user intent makes it
  easy to skip resolution offline. The cache means the "manual" cost is
  paid once.
- **Why not import `@geneontology/curie-util-es5`?** It's another dep for
  what's a 30-line utility. `prefixes.ts::toPrefixed` already does
  IRI→CURIE in 8 lines; we just need a richer prefix map and a
  reverse helper.
- **Why bundle relations and not class labels?** Relation predicates are
  bounded (~760 in `globalKnownRelations`, covers everything noctua/GO-CAM
  models use). Class labels (GO, ChEBI, UBERON, CL terms) are unbounded
  — GO alone is 50k+ — and most graphs touch a small subset. Classes are
  the canonical GOlr-resolved case.

## Lessons Learned
- (fill during/after task)

## Additional Context (Claude)

- The user's reference URL was GOlr autocomplete (`q=d`,
  `qt=standard&defType=edismax` over many `qf` fields). For label
  resolution we want the much simpler ID-lookup form documented in the
  GOlr query shape section above. Worth verifying interactively with
  `curl 'https://noctua-golr.berkeleybop.org/select?...'` before writing
  the client.
- Consider exposing a "Force re-resolve" menu item under the More menu
  that calls `clearResolvedLabels()` — useful when GOlr labels change
  upstream and the cache is stale. Not in the critical path; add to
  Phase 5 if it's quick.
- The graph-tree renderer derives its tree shape in
  `features/graph-tree/buildTree.ts` — labels need to be threaded there
  too, not just at render time. Worth a check during phase 4.
