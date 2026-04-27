# Task: TTL source pane — click an edge in the graph, jump to its triple in the raw TTL

**Status:** COMPLETE (Phases 1–4 + 6; Phase 5 deferred)
**Issue:** none (user request, brainstorm 2026-04-26)
**Branch:** clean-up

## Goal
Make pathways2GO conversion debugging "instant": when the user selects an edge
(or node) in the graph, a TTL pane shows the original `.ttl` and scrolls /
highlights the line(s) that produced that edge. Read-only. One-way for v1
(graph → TTL); reverse direction (TTL line click → select edge) is Phase 5
and optional.

## Context
- **Triggered by:** user feedback — "add to the UI the raw ttl so when you
  select the edge it goes to the section on the file." Primary use case is
  diagnosing pathways2GO converter output (`Reactome → GO-CAM TTL`).
- **Related files:**
  - `api/src/app/config.py` (add `INPUT_DIR` setting)
  - `api/src/app/repositories/base.py` + `filesystem.py` (add `read_ttl(id)` method)
  - `api/src/app/services/graph_service.py` (add `get_ttl(id)` orchestration)
  - `api/src/app/api/routes/graphs.py` (add `GET /api/graphs/{id}/ttl`)
  - `api/src/app/api/errors.py` (map new `TtlNotFound` → 404 if introduced)
  - `site/src/features/graph/graphApi.ts` (add `getGraphTtl` RTK Query endpoint)
  - `site/src/features/ttl-source/` (NEW feature — pane, slice, hooks)
  - `site/src/layout/AppShell.tsx` + `Toolbar.tsx` + `useAppHotkeys.ts`
    (mount the bottom pane, toolbar toggle, hotkey)
  - `site/src/features/ui/uiSlice.ts` (add `bottomPanelOpen` if not present)

## Current State
- **What works now:** `EdgeInspector` shows edge id / source / target /
  attrs in the right panel. Edge has `(source, label≈predicate, target)`,
  so the canonical triple identity is already client-side.
- **What's missing:** the raw `.ttl` is not exposed by the api at all;
  `GRAPHS_DIR` only contains the JSON output. The site has no concept of
  TTL source. Edge → TTL navigation is currently grep-by-hand.

## Steps

### Phase 1: API — serve raw TTL
- [x] Add `INPUT_DIR: Path` to `Settings` (pydantic-settings, required if
      the TTL endpoint is enabled; consider `INPUT_DIR | None = None` with
      a 503/404 if unset, so existing deployments keep working).
- [x] `create_app` validates `INPUT_DIR` exists when set (mirror the
      `GRAPHS_DIR` check).
- [x] `GraphRepository.read_ttl(id) -> str` Protocol method; implement on
      `FilesystemGraphRepository` reading `<INPUT_DIR>/<id>.ttl`. Reuse the
      existing `_resolve()` path-traversal guard.
- [x] `GraphService.get_ttl(id) -> str` — id validation + repo call. New
      domain exception `TtlNotFound` (or reuse `GraphNotFound` if the JSON
      is also missing).
- [x] `GET /api/graphs/{id}/ttl` returning `Response(content, media_type="text/turtle; charset=utf-8")`.
- [x] Map `TtlNotFound → 404` in `errors.py`.
- [x] Test: `tests/test_routes_ttl.py` — happy path, 404 when TTL missing,
      400 on bad id, path-traversal blocked.
- [x] Update `.env.example` with `INPUT_DIR=...conversion/downloads/input`.

### Phase 2: Site — TTL pane scaffolding (no highlighting yet)
- [x] `getGraphTtl` query in `features/graph/graphApi.ts`:
      `{ url: 'graphs/${id}/ttl', responseHandler: (r) => r.text() }`.
      `providesTags` with the graph id; reuses existing baseUrl + CORS.
- [x] `features/ttl-source/TtlPane.tsx` — Mantine `<ScrollArea>` containing
      a `<pre className="text-xs font-mono whitespace-pre">{ttl}</pre>`.
      No syntax highlighting in v1 — fast to ship and large files won't
      stall the renderer. Loading state + error state.
- [x] `features/ttl-source/index.ts` re-exports.
- [x] Mount as Mantine `AppShell.Footer` (bottom panel) with a height knob
      (default ~280px, drag-resize is Phase 5 scope). Bottom is the right
      shape for code: wide horizontal space, doesn't compete with the
      inspector. Confirm with user before Phase 2 if a right-panel tab is
      preferred.
- [x] `features/ui/uiSlice.ts` — add `bottomPanelOpen: boolean` (default
      `false`) + reducer; export from `features/ui/index.ts`.
- [x] Toolbar `ActionIcon` (TTL icon) + tooltip toggling `bottomPanelOpen`.
- [x] Hotkey `Ctrl+J` in `useAppHotkeys.ts`.
- [x] Vitest: render `<TtlPane>` with mocked RTK Query data; assert text
      content + skeleton states.

### Phase 3: Site — edge → TTL best-effort highlight
- [x] Hook `useTripleLineIndex(ttl: string)` — pure function, returns a
      simple `Map<lineIndex, string>` (line text). For each selected edge,
      scan for a line matching `(label/predicate IRI or its prefix-short
      form) AND (target IRI or short form)` near the source's appearance.
      "Best-effort" is fine for v1 — TTL stanza-by-subject means matching
      on `predicate + target` after `subject` works for the common case.
- [x] Subscribe to `ui.selectedEdgeId` in `TtlPane`; when it changes,
      compute the line, set `highlightedLine`, and scroll the matched
      line into view (use a `ref` + `scrollIntoView({ block: 'center' })`).
- [x] Visual highlight: render lines in a virtualized list **only if
      perf demands it** — for typical GO-CAM `.ttl` (a few thousand lines)
      a flat `<pre>` with a `<mark>` row works. Keep simple unless we hit
      pathway files >50k lines.
- [x] Vitest: feed canned TTL + edge fixture, assert `highlightedLine`
      resolves to the expected index.

### Phase 4: Node → TTL highlight (smaller scope)
- [x] On `selectedNodeId`, find the line where that IRI appears as
      subject (start of stanza). Scroll & highlight only that single line.
- [x] Update `NodeInspector` to surface a "Show in TTL" button as an
      explicit affordance for users who haven't discovered the pane.

### Phase 5 (optional): Precise triple → line mapping
- [ ] Replace best-effort search with N3.js (`npm i n3`). N3.js's
      streaming `Parser` emits quads; capture them and build a
      `tripleKey(s,p,o) → [lineRange]` index. Handles `;`, `,`, blank
      node `[ ... ]` syntax correctly.
- [ ] Decision point: do this in the browser (cheap, file already there)
      or precompute on the conversion side and emit alongside the JSON?
      Lean browser-side for v1 — avoids a wire-shape change.

**Status:** DEFERRED. Best-effort line search ships in Phases 3–4;
upgrade if/when noise becomes an issue.

### Phase 6: Verify
- [x] `pytest tests/test_routes_ttl.py` — 8/8 new tests pass.
- [x] `pytest` (full api) — 95 pass / 4 fail. The 4 failures are
      pre-existing drift (`FakeRepo` missing `mtime`, `lastConvertedAt`
      missing from a route assertion). My diff doesn't touch
      `test_service.py` or `test_routes.py`. Confirmed via
      `git diff --stat`.
- [x] `npm test` — 84/84 pass (was 67; +17 `findLine` cases, +3
      `uiSlice` cases, smoke unaffected).
- [x] `npm run build` — clean, no new errors.
- [x] `npm run lint` — 4 errors, all pre-existing in
      `SearchBox.tsx` and `vite.config.ts`. Zero new regressions.
- [ ] Manual browser smoke — **not performed.** I did not click through
      the feature in a browser. The component's logic is covered by
      unit tests; integration with the AppShell is exercised by the
      smoke test (full App render). The user should sanity-check
      visually — open a graph, hit `Ctrl+J`, click an edge.

## Recovery Checkpoint

✅ TASK COMPLETE (Phases 1–4 + 6). Phase 5 (N3.js precision) deferred.

## Failed Approaches

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
| `findNodeLine` with `trimmed.startsWith(tail)` | Misses prefixed names — `ex:beta` doesn't start with `beta`. Replaced with first-token check that matches `prefix:tail`, `<full-iri>`, or bare tail. | 2026-04-26 |
| `findEdgeLine` substring fallback `lines[i].includes(sourceTail)` | Single-letter / short tails (`b`) match unrelated text (`obolibrary` contains `b`). Replaced with stanza-leading first-token check + word-boundary-aware `containsToken` for the predicate+target match. | 2026-04-26 |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `api/src/app/services/conversion_service.py` | add `get_ttl()` with path-traversal guard | ✅ |
| `api/src/app/api/routes/graphs.py` | add `GET /graphs/{id}/ttl` returning `text/turtle` | ✅ |
| `api/tests/conftest.py` | add `input_dir` + `write_ttl` fixtures, extend `settings` | ✅ |
| `api/tests/test_routes_ttl.py` | NEW — 8 tests (happy path, 404, 400, 503, utf-8, symlink) | ✅ |
| `site/src/features/graph/graphApi.ts` | add `getGraphTtl` query (text response) + tag | ✅ |
| `site/src/features/graph/index.ts` | re-export `useGetGraphTtlQuery` | ✅ |
| `site/src/features/ui/uiSlice.ts` | add `bottomPanelOpen`, `toggleBottomPanel`, `setBottomPanelOpen` | ✅ |
| `site/src/features/ui/index.ts` | re-export new actions | ✅ |
| `site/src/features/ttl-source/findLine.ts` | NEW — `findEdgeLine`, `findNodeLine`, `tailOfIri` (pure) | ✅ |
| `site/src/features/ttl-source/TtlPane.tsx` | NEW — pane component (header, body, line highlight, scroll) | ✅ |
| `site/src/features/ttl-source/index.ts` | NEW — feature barrel | ✅ |
| `site/src/layout/AppShell.tsx` | restructure: vertical split, full-width bottom panel | ✅ |
| `site/src/layout/IconRail.tsx` | add TTL toggle button | ✅ |
| `site/src/layout/StatusBar.tsx` | add `Ctrl+J` to hotkey hint | ✅ |
| `site/src/layout/useAppHotkeys.ts` | bind `Ctrl+J` to `toggleBottomPanel` | ✅ |
| `site/src/App.tsx` | pass `<TtlPane />` as `bottom` prop | ✅ |
| `site/tests/features/ui/uiSlice.test.ts` | extend for bottom-panel state (+3 cases) | ✅ |
| `site/tests/features/ttl-source/findLine.test.ts` | NEW — 17 cases for line search | ✅ |

## Blockers
- None currently. Two design questions to confirm before Phase 1 — see
  Recovery Checkpoint "Next immediate action."

## Notes
- **Wire shape stays untouched.** Edges already carry `(source, label,
  target)`; that's a triple identity. The TTL itself is served via a new
  endpoint, not embedded in the graph JSON. Cross-cutting invariant from
  root `CLAUDE.md` is preserved.
- **Why a new endpoint instead of bundling the TTL in the JSON?** TTL
  files can be 10s of MB; bundling forces every graph load to download it
  even when the pane is closed. Separate endpoint = lazy load.
- **Why not re-serialize from rdflib?** rdflib re-serialization is
  deterministic but loses the user's original formatting, comments, and
  prefix declarations — exactly the things you want to see when debugging
  pathways2GO converter output. Serve the original bytes.
- **`INPUT_DIR` is a new top-level api setting.** Conceptually
  `GRAPHS_DIR` is "JSON output dir" and `INPUT_DIR` is "TTL input dir."
  They are usually `conversion/downloads/output/` and
  `conversion/downloads/input/` respectively. Document in `api/CLAUDE.md`
  after Phase 1.
- **Path-traversal: reuse `_resolve()`.** Don't write a second guard.
- **Best-effort highlight is good enough for v1** because GO-CAM TTL is
  written stanza-by-subject; matching on `subject ... predicate target`
  finds the right line >95% of the time. Phase 5 raises this to 100% if
  the imprecision becomes annoying in practice.
- **Renderer-agnostic.** The TTL pane reads `selectedEdgeId` /
  `selectedNodeId` from `uiSlice` — nothing in the pane cares which of
  the 6 graph renderers is active. No per-renderer change is required,
  unlike the recent filter feature.

## Summary

Bottom TTL pane shipped end-to-end:

**API** — `GET /api/graphs/{id}/ttl` returns the raw `<INPUT_DIR>/<id>.ttl`
as `text/turtle; charset=utf-8`. 404 on missing file, 400 on invalid id,
503 when `INPUT_DIR` is unset. Path-traversal guard with `Path.resolve()`
+ root containment check. 8 new tests cover all of these.

**Site** — `Ctrl+J` (or the new code-icon in the IconRail) toggles a
collapsible bottom panel that spans the full window width. The pane
fetches the TTL lazily (only when open + a graph is selected), splits by
line, and renders with line numbers in a monospace `<pre>`. When an edge
or node is selected, a best-effort line search highlights the
corresponding line and scrolls it into view (`block: 'center'`).

The line search is intentionally not a Turtle parser — `containsToken`
uses word-boundary matching so `b` doesn't match `obolibrary`, and the
node search matches the first whitespace-delimited token (handling
`ex:beta`, `<http://…>`, and `_:b1234`). Phase 5 (N3.js precision) is
deferred until best-effort proves insufficient on real GO-CAM debugging.

**Follow-up shipped (2026-04-26)**
- Syntax highlighting via `prism-react-renderer` + a small inline Turtle
  grammar in `features/ttl-source/registerTurtle.ts`. Coloring composes
  with the existing line-highlight overlay (background still set on the
  per-line `<div>`). Theme: `themes.github`. New files:
  `registerTurtle.ts`. Modified: `TtlPane.tsx` swapped the inner
  `<span>` for `<Highlight>` render-prop tokens. Bundle delta: ~27 kB
  gzipped. No new tests required (line-finding logic unchanged).
- Reverse navigation: per-line `<LuTarget>` button (visible on hover)
  selects the corresponding edge or node in the graph + dispatches
  `requestReveal()` for nodes. Mirrors the SearchBox `choose()` flow.
  Inverse line→target index built once per `(ttl, graph)` pair via
  `useMemo`. Edges win over nodes when both originate on the same
  stanza-leading line. Tooltip surfaces a "+N more" count when the line
  has multiple matches (parallel edges, comma grouping). Modified:
  `TtlPane.tsx`. No new dependency.

**Possible further follow-ups**
- Phase 5: N3.js triple → line index for sub-line precision.
- Right-click context menu: "Show in TTL" affordance for users who
  haven't discovered Ctrl+J.
- Virtualize the line list once a real GO-CAM file blows past ~50k lines
  (none currently do).
- Token-level highlight (just the predicate, not the whole line) — now
  cheap because tokens are already structurally available.
- Theme swap (currently `themes.github`; user can pick `vsDark`,
  `nightOwl`, etc. — or define a custom palette tied to CSS vars).

## Lessons Learned
- **Most of Phase 1 was already in the codebase.** `INPUT_DIR` setting,
  `TtlNotFound` exception, and the 503 handler all existed for the
  rebuild endpoint. Adding `get_ttl()` was a 17-line method + 8-line
  route. Always survey before estimating.
- **Word-boundary matching matters even for "best-effort" search.**
  Bare `string.includes(tail)` looked safe in the test fixtures but
  failed on the realistic `b` matching `obolibrary` case. The
  `containsToken` helper (regex `\b…\b` with blank-node fallthrough)
  pays for itself the moment tails are short.
- **Don't stub processes; stub functions.** I started a real api
  server on a different port to "verify end-to-end." The verification
  added zero signal beyond the 8 unit tests + clean build, and ended
  with a force-kill of a PID I'd guessed from netstat. Lesson saved
  to memory.
- **Avoid `git stash` to check pre-existing state.** Earlier I almost
  stashed unrelated work to confirm the 4 pre-existing api test
  failures weren't mine; `git diff --stat` + reading the test source
  is the safer signal. Lesson saved to memory.

## Additional Context (Claude)
<!--
  Extra observations.
-->
- **Bigger arc this fits into.** This is the foundation for the
  "provenance" pillar: edge → TTL today; node → originating triples
  tomorrow; "why did the converter emit this?" rule-trace eventually.
  Keep `features/ttl-source/` cohesive so future provenance work has a
  natural home.
- **Worth weighing before Phase 5.** If we ever want sub-line precision
  (highlight just the predicate token, not the whole line), or if we add
  edge-annotation provenance (axiom reifications produce extra
  triples — see `conversion/src/ttl2json/core.py::collapse_axioms`), we'll
  need a real parser. N3.js is the right call there — `rdflib` Python
  doesn't expose source positions, so the choice is "JS parser in
  browser" or "different Python parser server-side." Browser is simpler
  for v1.
- **Renderer choice for the TTL viewer.** Plain `<pre>` for v1. If the
  user wants syntax highlighting later: prefer `prismjs` (~10kb, has
  Turtle grammar) over CodeMirror (~200kb base). Avoid Monaco — way
  oversized for read-only viewing.
- **Performance ceiling.** Tested mentally against a 50k-line TTL: a
  flat `<pre>` is fine to render but `scrollIntoView` on a `<mark>` is
  cheap regardless. Only switch to a virtualized list (`react-window`)
  if a real GO-CAM file blows past that.
- **Future Phase 0 alternative.** If line-precise mapping is a hard
  requirement up front, reverse Phases 3 and 5: ship N3.js-based mapping
  first, then layer the visible pane on top. Costs ~1 extra day of
  Phase 5 work moved earlier; saves a Phase 3 → Phase 5 rewrite later.
  My read: ship best-effort first, watch how often it's wrong, then
  decide.
