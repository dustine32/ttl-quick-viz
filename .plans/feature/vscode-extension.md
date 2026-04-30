# Task: VSCode extension — open `.ttl` files in a graph view tab

**Status:** COMPLETE (Phases 1–7 — all v1 goals shipped)
**Issue:** none (user request, brainstorm 2026-04-29)
**Branch:** TBD (suggest `feature/vscode-extension`)

## Goal
Right-click a `.ttl` file in the VSCode explorer (or use "Reopen with…") and
get the `ttl-quick-viz` graph in a new editor tab. Conversion happens in the
extension host (TypeScript port of `ttl2json` using `n3` quad parser); no
FastAPI service, no localhost, no Vite proxy. Distributable as a sideloaded
`.vsix` — Marketplace publishing is out of scope for v1.

## Context
- **Triggered by:** user request — drop the api/site dev-server flow for
  personal pathways2GO debugging; just open a TTL file as a graph in VSCode.
- **Constraint from user:** "I don't want to host any webview" — interpreted
  as: no separate server / browser tab. VSCode's Custom Editor API is still
  a webview under the hood, but presents as a native-looking tab. This is
  the only way to render a graph in a VSCode tab.
- **Related files (existing, to reuse / mirror):**
  - `conversion/src/ttl2json/core.py` — reference for the TS port (axiom
    collapse, walk, sorting, JSON shape).
  - `api/src/app/domain/translate.py` — reference for the normalization
    from `node_link_data` shape into the site wire shape (the TS port can
    skip this step by producing site shape directly).
  - `site/src/features/graph/types.ts` — `Graph`, `GraphNode`, `GraphEdge`
    are the wire shape the extension must produce.
  - `site/src/main.tsx`, `App.tsx`, `app/store.ts` — need a webview entry
    that reuses the Redux store + renderer switch but skips the RTK Query
    layer.
  - `site/src/features/graph/slices/graphApiSlice.ts` — hooks
    (`useGetGraphQuery`, `useGetGraphTtlQuery`, etc.) need a parallel "from
    postMessage" path or a stubbed baseQuery that resolves from a static
    payload posted by the extension host.

## Current State
- **What works now:** end-to-end pipeline is `conversion` (Python CLI) →
  filesystem JSON → `api` (FastAPI) → `site` (Vite SPA). Three subprojects,
  all running as separate processes. Conversion uses `rdflib` + `networkx`.
- **What's missing:** no VSCode integration, no TS converter, no in-process
  graph rendering. Opening a `.ttl` always means starting api + site +
  having JSON pre-converted in `GRAPHS_DIR`.

## Steps

### Phase 1: scaffold `vscode/` subproject
- [ ] Create `vscode/` sibling to `conversion/`, `api/`, `site/`. Add to
      root `CLAUDE.md` cross-cutting note (sibling, not workspace).
- [ ] `npx --package yo --package generator-code -- yo code` — scaffold
      a TypeScript extension. Strip the boilerplate hello-world command.
- [ ] `package.json`:
  - `engines.vscode`: pin to a recent stable (e.g. `^1.95.0`).
  - `activationEvents`: `onCustomEditor:ttlQuickViz.graph`.
  - `contributes.customEditors`: register `ttlQuickViz.graph` with
    `viewType` priority `option`, `selector: [{ filenamePattern: "*.ttl" }]`.
  - `contributes.commands`: `ttlQuickViz.openGraph` for explorer
    right-click.
  - `contributes.menus`:
    - `explorer/context` — "Open as Graph" when `resourceExtname == .ttl`.
    - `editor/title` — toolbar button on TTL editors.
- [ ] `tsconfig.json`, `eslint`, `.vscodeignore`, `.gitignore` (exclude
      `out/`, `*.vsix`, `node_modules/`).
- [ ] Add `vsce` as devDep for packaging.
- [ ] Add `vscode/CLAUDE.md` mirroring the per-subproject pattern (layout,
      common commands, contract with `site/`).

### Phase 2: TS port of `ttl2json`
- [ ] Add `n3` (parser) as a runtime dep in `vscode/`.
- [ ] `vscode/src/conversion/parse.ts`:
  - `parseTurtle(text: string): Quad[]` using `N3.Parser` (sync mode is
    fine for small files; stream-mode for large ones — start sync).
- [ ] `vscode/src/conversion/buildGraph.ts`:
  - Port `collapse_axioms` — iterate quads, find subjects with
    `rdf:type owl:Axiom`, collect `annotatedSource/Property/Target`,
    produce `Map<key, annotations>` keyed on stringified `(s,p,o)`.
  - Port main walk — skip axiom bnodes; literal objects → attributes
    (rdfs:label seeds node label, first wins); `rdf:type` → types[];
    IRI/BNode objects → edges with `predicate` + `annotations`.
  - Sort nodes by id for deterministic output (mirror Python `sorted()`).
- [ ] `vscode/src/conversion/toSiteShape.ts`:
  - Produce **site wire shape directly** (not `node_link_data` then
    translate). `GraphNode = { id, label?, attrs? }`,
    `GraphEdge = { id, source, target, label?, attrs? }`.
  - Edge `id` = `${source}|${predicate}|${target}|${key}` to stay unique
    under MultiDiGraph.
  - Edge `label` = local-name of `predicate` (mirror `translate.py`).
  - Node `attrs` flattens `types` + `attributes` (key collisions: prefer
    `types`).
  - BNodes serialize as `_:<id>` (mirror Python).
- [ ] Tests with `vitest`:
  - Snapshot one of the committed `conversion/downloads/input/*.ttl`
    fixtures and assert the TS output matches the python output after
    normalization through `translate.py`. (Bring a fixture JSON over;
    don't shell out to Python in CI.)
  - Edge case: `owl:Axiom` annotations, multiple predicates between same
    pair (MultiDiGraph key disambiguation), language-tagged literals
    (currently stripped in Python — keep parity).

### Phase 3: Custom editor wiring (extension host side)
- [ ] `vscode/src/extension.ts`:
  - `activate()` registers `TtlGraphEditorProvider` via
    `vscode.window.registerCustomEditorProvider`.
  - Provider implements `CustomTextEditorProvider.resolveCustomTextEditor`:
    - read `document.getText()` → `parseTurtle` → `buildGraph` →
      `toSiteShape` → `Graph`.
    - load webview HTML (Phase 4 bundle) via
      `webview.asWebviewUri` for the bundled JS/CSS.
    - `webview.postMessage({ type: 'graph/load', graph, ttlText, fileName })`.
    - subscribe to `workspace.onDidChangeTextDocument` for the bound
      document → re-convert + repost. Debounce 300ms.
    - listen for `webview.onDidReceiveMessage` for round-trip messages
      (e.g. selection → reveal in editor; jump-to-line on edge click).
- [ ] CSP nonce: generate per-resolve, set `Content-Security-Policy` on
      webview HTML restricting to `self` + the nonce. No external CDNs;
      everything bundled.
- [ ] Optional v1.5: register `ttlQuickViz.openGraph` command for explorer
      right-click → `vscode.commands.executeCommand('vscode.openWith',
      uri, 'ttlQuickViz.graph')`.

### Phase 4: webview bundle from `site/`
Decision point: **reuse `site/` as a library** or **fork into `vscode/webview/`**.
Recommended: reuse via a new Vite entry that imports from `site/src/` —
same components, different bootstrap, no FastAPI dependency.

- [ ] Add `site/src/webview/main.tsx` — alternate entry that:
  - Skips RTK Query / `graphApiSlice.ts`.
  - Pre-populates `state.graph` with whatever the extension host posts
    via `window.addEventListener('message', ...)`.
  - Sends selection / open-line events back via
    `acquireVsCodeApi().postMessage(...)`.
- [ ] Decide where `useGetGraphQuery` / `useGetGraphTtlQuery` callers
      should fork. Two options:
  - (a) Replace those hooks with a thin context (`useGraph()`,
        `useGraphTtl()`) that the SPA also implements over RTK Query.
        Cleaner; touches every call site.
  - (b) Stub `graphApi`'s `baseQuery` in the webview to resolve from a
        local in-memory cache populated by postMessage. Less invasive;
        keeps RTK Query but its network layer is a no-op.
  - Pick (b) for v1 — fewer site/ edits, easier to keep both shells in
    sync. Revisit if the abstraction leaks.
- [ ] Add `site/vite.config.webview.ts` (or a mode flag in the existing
      config) that builds the webview entry to a single bundled JS + CSS
      under `site/dist-webview/`, hashing disabled or stable for cleaner
      `webview.asWebviewUri` calls.
- [ ] `vscode/` build step copies `site/dist-webview/*` into
      `vscode/media/` at extension package time. Consider a
      `vscode/scripts/build-webview.mjs` that runs `npm run
      build:webview` in `site/` then copies.
- [ ] CSP-friendly: ensure Mantine's emotion-based styles, Tailwind v4
      output, and any web fonts work without `'unsafe-inline'`. Mantine
      v9 supports nonce — wire it through the
      `MantineProvider`'s `getRootElement` / nonce prop.

### Phase 5: TTL source pane parity
- [ ] The existing TTL pane reads via api `GET /graphs/{id}/ttl`. In the
      extension, the source is just `document.getText()` — post it
      alongside `graph/load`. The pane already accepts `ttlText` as an
      input; if not, refactor `useGetGraphTtlQuery` callers to a small
      hook that returns either the RTK Query result (SPA) or the
      postMessage-supplied text (webview). See decision (b) above.
- [ ] Edge → TTL line: `findLine.ts` already handles this client-side.
      Confirm it doesn't depend on api-side metadata.
- [ ] Optional: TTL line click → reveal in *real* VSCode editor via
      `postMessage` → host calls `vscode.window.showTextDocument(uri,
      { selection: range })`. Nice-to-have.

### Phase 6: packaging + distribution
- [ ] `vscode/` script: `npm run package` → `vsce package` → produces
      `ttl-quick-viz-<version>.vsix`.
- [ ] Local install: `code --install-extension
      ttl-quick-viz-<version>.vsix`. Document in `vscode/CLAUDE.md` and
      a brief `vscode/README.md`.
- [ ] No Marketplace publish for v1. Note in plan that publishing
      requires Azure DevOps publisher + PAT and is deferred.

### Phase 7: docs
- [ ] Update root `CLAUDE.md` cross-cutting section to mention `vscode/`
      as a fourth subproject (sibling, not workspace).
- [ ] Update `docs/structure-review.md` to cover the new shape (api/site
      remain for browser dev; extension is the single-user path).
- [ ] `vscode/README.md` — install + usage.

## Recovery Checkpoint

> ✅ TASK COMPLETE

## Failed Approaches
<!-- Prevent repeating mistakes after context reset -->

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `.plans/feature/vscode-extension.md` | create | done |
| `vscode/package.json` | create | done |
| `vscode/tsconfig.json` | create | done |
| `vscode/vitest.config.ts` | create | done |
| `vscode/.gitignore`, `.vscodeignore` | create | done |
| `vscode/.vscode/launch.json`, `tasks.json` | create | done |
| `vscode/CLAUDE.md`, `README.md` | create | done |
| `vscode/src/extension.ts` | create | done |
| `vscode/src/editor/ttlGraphEditorProvider.ts` | create | done |
| `vscode/src/conversion/{convert,types,index}.ts` | create | done |
| `vscode/src/conversion/convert.test.ts` | create | done (7/7 pass) |

## Blockers
- None currently. Phase 4 has the biggest unknown — the
  reuse-vs-fork-`site/` decision. Mitigation: prototype option (b) on a
  branch first; if RTK Query stub turns ugly, fall back to (a).

## Notes
- **The user said "I don't want to host any webview."** Interpreted as
  *no separate server / browser*, not literally *no webview* — VSCode has
  no native graph primitive, so anything richer than tree text needs a
  webview. Custom Editor API gives a native-feeling tab; that satisfies
  the intent.
- **Do not add api/ as a runtime dependency of the extension.** The whole
  point is to skip it. The api keeps existing for the SPA dev workflow.
- **Keep `conversion/` (Python) as the canonical converter for now.** The
  TS port is a parallel implementation for the extension; the Python one
  still backs the SPA + tests + snapshot fixtures. If they diverge, the
  Python one wins — cross-check via the snapshot test in Phase 2.
- **Wire shape lives in `site/src/features/graph/types.ts`.** The TS port
  produces *that* shape directly, skipping the `node_link_data` →
  translate hop. If `types.ts` changes, the extension breaks — same risk
  the SPA already has.
- **MultiDiGraph keys.** TS port must emit a key per parallel edge, just
  like the Python side. Edge id should incorporate the key so the
  renderer can disambiguate.

## Summary

All seven phases shipped:

1. **Scaffold (`vscode/`)** — Custom editor manifest, explorer right-click
   menu, command, F5 launch config, strict TS, vitest.
2. **TS port of `ttl2json`** — `vscode/src/conversion/convert.ts` using `n3`
   parser. Produces site wire shape directly (skips `node_link_data` →
   `translate.py`). 7/7 unit tests including a Reactome-fixture parity test
   that compares against the Python output post-translate.
3. **Custom editor** — `TtlGraphEditorProvider` parses on open and on document
   change (300ms debounce); posts `{graph, ttlText, fileName}` over the
   ready/load handshake. Reveal-line listener wired (host side).
4. **Webview bundle** — `site/src/webview/main.tsx` alternate entry +
   `webviewBaseQuery.ts` (postMessage cache, satisfies the same `BaseQueryFn`
   contract as `fetchBaseQuery`). `vite.config.webview.ts` aliases
   `graphApiBaseQuery` to the webview version, builds to
   `site/dist-webview/`. `vscode/scripts/build-webview.mjs` runs the site
   build and copies output into `vscode/media/`. Editor provider reads the
   Vite manifest and generates HTML referencing the hashed assets via
   `webview.asWebviewUri`. CSP allows `'unsafe-inline'` styles (Mantine
   emotion) and `'unsafe-eval'` scripts (weaverjs), with nonce on the
   entry `<script>`.
5. **TTL pane parity** — free, since the webview baseQuery routes
   `/graphs/{id}/ttl` to `cache.ttl`; `useGetGraphTtlQuery` works without
   modification.
6. **Packaging** — `npm run package` builds the webview, compiles TS,
   runs `vsce package` → `ttl-quick-viz-0.1.0.vsix` (~2.1 MB).
   Documented in `vscode/README.md`. Marketplace publish deferred.
7. **Docs** — root `CLAUDE.md`, `docs/structure-review.md` (addendum),
   `site/CLAUDE.md` (webview build section + four-way wire-shape gotcha),
   `vscode/CLAUDE.md`, `vscode/README.md`.

Tests: vscode 7/7, site 105/105, all clean.

## Follow-up work (not shipped, optional)

- **TTL line click → reveal in real VSCode editor.** `TtlPane.tsx` would
  need to call `postToHost({type:'reveal/line', line})` on line click; host
  listener already wired.
- **Bundle size.** 7 MB JS (1.97 MB gzipped) is large. Most renderers and
  diff/history features are unused in the webview. Code-split `react-diff-
  viewer-continued`, `react-force-graph-3d`, `cytoscape-spread`, etc. — drops
  the bundle ~50% and removes the `weaverjs` eval (lets us tighten CSP).
- **Mantine nonce wiring.** Replace `'unsafe-inline'` style-src with a
  proper emotion nonce. Mantine v9 needs a custom `getRootElement` /
  emotion cache.
- **Marketplace publish.** Set up an Azure DevOps publisher + PAT;
  `vsce publish`. Worth it once the extension has been used personally for
  a few weeks.
- **Open-as-graph default.** Currently `priority: option` — user has to
  pick "Reopen with…" or use the right-click. Consider switching to
  `priority: default` for users who only want graph view.

## Lessons Learned
<!-- Fill during and after task. -->
- **rdflib walk order ≠ n3 walk order.** Snapshot tests must compare as
  sets / sort multi-valued attrs, not as ordered lists. Python's
  `sorted(referenced)` doesn't determine final node order in the
  `node_link_data` JSON because `nx.MultiDiGraph.add_edge` adds nodes
  implicitly in walk order; the later `add_node` calls only set attributes.
- **`spawnSync('npm.cmd', …)` on Windows needs `shell: true`.** Without it,
  `result.status` is `null` and you get a silent failure.
- **VSCode webview bundle reuse via Vite alias is clean.** A single alias
  (`graphApiBaseQuery → webviewBaseQuery`) swaps HTTP for postMessage with
  zero changes to renderer code. RTK Query's `BaseQueryFn` contract is the
  abstraction boundary.
- **n3.js doesn't ship its own types.** Add `@types/n3`.

## Additional Context (Claude)

**Alternative considered: bundle Python in the extension.** Tools like
`pyodide` could run `rdflib` in the webview, or we could shell out to a
user-installed Python. Both have ugly trade-offs (pyodide payload is
massive; shelling out makes the extension fragile across OSes and
environments). The TS port is ~200 lines and has no install footprint —
this is the right call.

**Alternative considered: skip the SPA reuse, hand-roll a minimal
webview.** Tempting for a v1, but throws away the seven renderers, TTL
pane, layout picker, search, inspector, view-config — everything that
makes this tool useful. Reuse the SPA.

**Risk: Mantine + CSP.** Mantine v9 uses emotion under the hood; emotion
needs a nonce or `'unsafe-inline'` to inject styles. VSCode webviews
disallow `'unsafe-inline'` by default. Verify Mantine's nonce wiring
works inside the webview before going deep on Phase 4 — if it doesn't, a
v1 fallback is to pre-render Mantine styles to a static CSS bundle.

**Risk: large TTL files.** `n3.js` parses synchronously by default.
Reactome `R-HSA-*.ttl` fixtures are small but real-world pathways2GO
output can hit MBs. If parse blocks the extension host, switch
`N3.Parser` to streaming and post incremental progress to the webview.
Don't optimize prematurely — measure first.

**Future: bidirectional sync.** Once the extension can read the file, it
could also *edit* it (e.g. rename a node, add a triple) and write back
through `WorkspaceEdit`. Out of scope for v1; the custom editor API
already sets up the contract for it.

**Future: extension Marketplace.** Once stable, publishing is mostly
ceremony — Azure DevOps publisher, PAT, `vsce publish`. Defer until the
extension has been used personally for a few weeks.
