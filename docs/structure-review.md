# ttl-quick-viz — Project Structure Review

**Date:** 2026-04-23
**Scope:** Repo-wide — `api/`, `site/`, `conversion/`, root

## TL;DR

The three sub-projects work in isolation but are glued together by convention, not contract. There is no root-level scaffolding, the frontend has two parallel renderers that duplicate data-fetching, and the "sample graph" placeholder is still leaking into production state. None of it is broken — it just doesn't scale past the current size.

---

## 1. Root-level gaps

### 1.1 No root README
Landing at `C:\work\go\ttl-quick-viz\` gives you `.gitignore` + three directories and nothing explaining what the project is, how the pieces connect, or how to run them. `site/README.md` is the default Vite template — not project docs.

**Fix:** Add a root `README.md` with a one-paragraph pitch, an architecture diagram (`conversion/ → filesystem → api/ → site/`), and a "run it locally" section that names all three processes.

### 1.2 No dev orchestration
Running the stack requires three terminals and remembering: `python ttl2json.py ...`, `uvicorn app.main:app --reload --port 8000`, `npm run dev`. No `Makefile`, no `docker-compose.yml`, no root `package.json` workspace, no `scripts/`.

**Fix:** Add a root `Makefile` (or `justfile`) with `make dev`, `make test`, `make convert`. Zero runtime cost, huge ergonomic win.

### 1.3 Directory name lies
`C:\work\go\ttl-quick-viz\` — the `go\` parent suggests a Go project. There's no Go. Cosmetic but confusing for anyone grepping the filesystem.

---

## 2. Cross-cutting issues

### 2.1 Duplicated Python tooling
`api/` and `conversion/` each have their own `requirements.txt`, their own `.gitignore` (with near-identical Python boilerplate that's already drifted — only `api/` has `.tox/`, `.pyre/`), and expect their own venvs. Two copies of everything Python-related.

**Fix:** Root-level `pyproject.toml` with uv/poetry workspaces, or at minimum a shared `.gitignore` and a single venv. Collapse the drift.

### 2.2 Tight coupling through filesystem paths
`api/app/config.py` defaults `graphs_dir` to `../conversion/downloads/output` — the API reaches directly into the conversion tool's internals. The two supposedly-independent subprojects are joined by a hard-coded relative path.

**Fix:** Promote a top-level `data/` directory (or make `GRAPHS_DIR` required with no default). Draw the boundary explicitly.

### 2.3 No shared schema
The site's `Graph` / `GraphEdge` / `GraphSummary` TypeScript types are hand-maintained to match `api/app/schemas.py`. The API design doc even acknowledges: "the shared shape is small enough that type drift is caught by human review." That's fine at 3 endpoints; it's a scalability trap at 10.

**Fix:** Either generate TS types from the FastAPI OpenAPI schema (`openapi-typescript`), or define the schema once in JSON Schema / protobuf and generate both sides.

### 2.4 `conversion/` is a script pretending to be a package
`ttl2json.py` sits alone — no `__init__.py`, no `pyproject.toml`, no tests. The API design mentions a future `POST /graphs` endpoint that would call `ttl2json.convert_file` in-process, but that import path is fragile across separate venvs.

**Fix:** Promote `conversion/` to a proper package (`conversion/src/ttl2json/…` + `pyproject.toml`) so `api/` can depend on it.

---

## 3. `site/` (frontend) issues

### 3.1 Two renderers, duplicated plumbing
`features/graph/GraphCanvas.tsx` (React Flow + ELK) and `features/graph-cytoscape/CytoscapeCanvas.tsx` both:
- call `useGetGraphsQuery()`, pick `list[0].id`, call `useGetGraphQuery(id, { skip })`
- re-render the loading / empty / error ladder

A third renderer = a third copy-paste.

**Fix:** Hoist data fetching into a parent (`features/viewer/` or `App.tsx`) that resolves `{ data, status, error }` and passes it down. Each canvas becomes a pure view.

### 3.2 Circular-ish feature coupling
The renderer selector (`renderer: 'xyflow' | 'cytoscape'`) lives in `features/graph/graphSlice.ts`, then `features/graph-cytoscape/` has to import back through `features/graph/index.ts` to do its own thing. The renderer toggle is a viewer-level concern, not a graph-data concern.

**Fix:** Move `renderer` into a new `features/viewer/viewerSlice.ts` (or into `app/`). Keep `graphSlice` about graph data only.

### 3.3 Dead "sample" wiring
`graphSlice.initialState.selectedGraphId = 'sample'`. Nothing reads `selectedGraphId` anywhere — `GraphCanvas` uses `list?.[0]?.id`. The tests still assert the `'sample'` default, locking the dead code in place.

**Fix:** Either (a) wire `selectedGraphId` into the canvas and build a picker UI, or (b) delete the field + its action + its test.

### 3.4 Stale sample fixture
`site/src/data/sample-graph.json` still exists even though the API is wired up. The API plan literally says "can stay as a test fixture for now; removal is future work." That was the right call to *keep* it, not the right call to *leak* it into the main bundle — it's currently imported nowhere.

**Fix:** Delete it, or move it to `site/src/test/fixtures/`.

### 3.5 Package name is "vite-scaffold"
`site/package.json` → `"name": "vite-scaffold"`. Literally the default. Small, but telling.

**Fix:** Rename to `ttl-quick-viz-site`.

### 3.6 Dev dependency versions look aspirational
`typescript: ~6.0.2`, `vite: ^8.0.9`, `vitest: ^4.1.5`, `jsdom: ^29.0.2`. Worth verifying these are actually published rather than hallucinated versions — if `npm install` has been running clean these are fine, but the numbers read high.

### 3.7 Minor: `useMemo` over a module-scoped constant
`GraphCanvas.tsx` line ~10: `const nodeTypes = { pretty: PrettyNode };` is module-scoped (already stable), then `useMemo(() => nodeTypes, [])` inside the component. The memo is a no-op. Drop it or pass `nodeTypes` directly.

### 3.8 Thin error copy
"Failed to load graph." with no detail. For a dev tool, surface the RTK Query error body (status + message). Saves F12 trips.

---

## 4. `api/` (backend) issues

### 4.1 Deprecated startup hook
`api/app/main.py` uses `@app.on_event("startup")`, deprecated since FastAPI 0.93 in favor of the `lifespan` context manager.

**Fix:** Migrate to `lifespan`.

### 4.2 `sys.exit(1)` inside a startup handler
Failing fast this way doesn't play cleanly with all ASGI servers / orchestrators. It works with uvicorn locally; it's flakier in a container.

**Fix:** Validate the config *before* building the `FastAPI()` instance (e.g. in a `create_app()` factory), or raise a proper exception that uvicorn reports cleanly.

### 4.3 Path traversal relies on a substring check
`_validate_id` uses `^[A-Za-z0-9_.-]+$` (dots allowed) plus `".." in graph_id` as a belt-and-braces guard. The store then does `self._dir / f"{graph_id}.json"` without resolving and confirming the result is actually inside `self._dir`.

**Fix:** In `GraphStore.load_raw`, compute `path = (self._dir / f"{graph_id}.json").resolve()` and assert `self._dir.resolve()` is one of its parents. Belt, braces, *and* suspenders.

### 4.4 Encoding not specified on file reads
`GraphStore.load_raw` calls `path.read_text()` — uses platform default. On Windows that's often cp1252, not UTF-8. RDF data routinely has non-ASCII labels.

**Fix:** `path.read_text(encoding="utf-8")`.

### 4.5 Lists endpoint parses every file on every request
`GET /graphs` loads and JSON-parses every `.json` file in the directory just to count `nodes` / `links`. On a directory of 100+ large graphs, this becomes a real cost.

**Fix:** Either (a) cache the summaries by `(path, mtime)`, or (b) store a small sidecar `*.meta.json` written by the conversion step.

### 4.6 No root router prefix
Routes are mounted at `/graphs`, not `/api/graphs`. The Vite proxy then has to strip `/api`:

```ts
rewrite: (p) => p.replace(/^\/api/, '')
```

This is the kind of thing that breaks silently in production when the frontend is served from the same origin.

**Fix:** Mount the router at `/api` on the FastAPI side (`app.include_router(router, prefix="/api")`), drop the rewrite. Dev and prod match.

---

## 5. Testing gaps

- No automated end-to-end test — Task 13 in the API plan is a manual browser smoke.
- No contract test between `api/` and `site/` (see 2.3).
- Site tests mock `useGetGraphsQuery` / `useGetGraphQuery` at the canvas level but never exercise the real RTK Query middleware against a mock server (MSW).

**Fix:** Add one Playwright smoke that boots both services against a tiny fixture dir and asserts a node renders. One test covers ~80% of regression risk.

---

## 6. Suggested target structure

```
ttl-quick-viz/
├── README.md                  # NEW — one-page overview + diagram
├── Makefile                   # NEW — make dev / test / convert
├── pyproject.toml             # NEW — python workspace, shared tooling
├── docker-compose.yml         # NEW (optional) — one-command stack
├── data/                      # RENAMED from conversion/downloads/
│   ├── input/
│   └── output/
├── packages/
│   ├── conversion/            # MOVED, promoted to a package
│   │   ├── src/ttl2json/
│   │   └── tests/
│   ├── api/                   # unchanged internal layout
│   └── site/
│       └── src/
│           ├── features/
│           │   ├── viewer/    # NEW — owns data fetch + renderer state
│           │   ├── graph-xyflow/     # RENAMED — pure view
│           │   └── graph-cytoscape/  # pure view
│           └── shared/schema/ # generated from API OpenAPI
└── e2e/                       # NEW — playwright smoke
```

---

## 7. Priority order

If you only fix three things:

1. **Root README + Makefile.** The "it doesn't look like a project" complaint is 70% this. An hour of work.
2. **Lift data fetching out of the two canvases into a `features/viewer/`.** Fixes the duplicated plumbing and the cytoscape-imports-from-graph coupling. Half a day.
3. **Generate TS types from the FastAPI OpenAPI schema.** Prevents drift before it starts. An hour.

Everything else is polish.

---

## Addendum (2026-04-30): `vscode/` subproject

A fourth subproject was added: `vscode/` — a VSCode extension that registers
a Custom Editor for `*.ttl` files. Right-click a `.ttl` in the explorer →
"Open as Graph" opens the file as a graph view in a new editor tab.

How it changes the structure:

- **No api/ in the extension path.** The extension host parses TTL with a TS
  port of `ttl2json` (`vscode/src/conversion/`, uses `n3`). Conversion runs
  in-process; the rendered graph is posted to a webview via `postMessage`.
- **Webview reuses `site/` as a library.** A second Vite build
  (`site/vite.config.webview.ts`, output `site/dist-webview/`) emits a bundle
  that uses the same renderers, layout, TTL pane, etc. — but with a
  postMessage-backed RTK Query `baseQuery`
  (`site/src/webview/webviewBaseQuery.ts`) instead of the HTTP one.
- **Wire shape now has a fourth consumer.** `vscode/src/conversion/convert.ts`
  produces the site's `Graph`/`GraphNode`/`GraphEdge` shape **directly**,
  skipping the `node_link_data` → `translate.py` hop. Wire-shape changes now
  require coordinated edits in *four* places, not three.
- **Distribution.** `.vsix` sideload only for v1
  (`code --install-extension ttl-quick-viz-<version>.vsix`). No Marketplace
  publish yet — that's deferred.

Plan: `.plans/feature/vscode-extension.md`. The original audit's
recommendation #2 (lift data fetching into `features/viewer/`) is partially
mooted by the webview pattern: the webview's baseQuery is itself the data
fetching abstraction, so renderers don't need to be refactored. Still worth
doing for SPA hygiene.
