# App review — 2026-04-24

Scope: whole-repo review of structure, code quality, and functionality across `conversion/`, `api/`, and `site/`. Findings are ordered by what to fix first.

## Structure

**The three-project split is right, but the seams are loose.** Wire shape is defined three times (`conversion/ttl2json.py` serializer, `api/src/app/domain/models.py`, `site/src/features/graph/types.ts`) with no single source of truth. Fix: emit OpenAPI from FastAPI and codegen the TS types in `site/`. One file to edit, drift caught at build time.

**No root dev orchestration.** Three terminals, three installs, relative-path coupling between `api` and `conversion/downloads/output/`. A 30-line root `Makefile` (`make dev`, `make convert`, `make test`) pays for itself the first time someone onboards.

**No sample data committed.** `conversion/downloads/input/` is gitignored, so a fresh clone has nothing to render. Commit one small representative `.ttl` (under `conversion/fixtures/`) — unblocks the first 10 minutes.

**`site/package.json` name is still `"vite-scaffold"`** — leftover from template.

## Coding

**Stale tests in `api/`** after the layered restructure. `test_store.py` imports `app.store.GraphStore`, `test_translate.py` imports `app.translate`, `conftest.py` imports `app.main` — none exist. Route tests hit `/graphs` but routers mount at `/api`. The entire suite won't run. Restore first, then extend.

**Path traversal in `api/src/app/repositories/filesystem.py:39-46`** — parent-based check allows symlinks to escape `GRAPHS_DIR`. Use `.resolve(strict=True)` on both paths and compare.

**Exception handler leakage in `api/src/app/api/errors.py:29,37`** — raw `JSONDecodeError`/`ValueError` messages returned to client. Log server-side, return generic message.

**File encoding not pinned** in the api's JSON reader. On Windows `read_text()` defaults to cp1252; non-ASCII labels (common in GO-CAM/Reactome) silently mangle. Force `encoding="utf-8"`.

**Two renderers duplicate real logic.** `GraphCanvas.tsx` (267 lines) and `CytoscapeCanvas.tsx` (227 lines) both reimplement selection dispatch, filtering, color mapping, fit/reveal nonce subscriptions. Extract a `useGraphRenderer` hook; keep only the library-specific drawing in each canvas.

**Granular selectors in both canvases** — 12–13 separate `useAppSelector` calls per render. Any `ui` change re-renders the whole canvas. Combine with `createSelector`.

**No runtime validation of API responses in `site/`.** TypeScript erases; a field rename in `api` silently yields `undefined` at render time. Zod schema in `graphApi.ts` turns it into a clear error.

**`GraphCanvas.tsx` doesn't relayout on algorithm change** — `useElkLayout` dependency array misses `layoutAlgo`. `CytoscapeCanvas` does it correctly. Asymmetric behavior.

**Both graph libraries ship in the main bundle** (~836 KB gzipped). The user only ever uses one renderer at a time. `lazy()` the two canvases + `manualChunks` in `vite.config.ts`.

## Functionality

**JSON output is non-deterministic** (`conversion/ttl2json.py:119`). Node/link order follows rdflib's triple-iteration order. Sort by id before `json.dumps`, and pass `sort_keys=True`. Makes diffs useful and keeps downstream caches stable.

**Only the first `rdfs:label` wins** (`ttl2json.py:84`, `setdefault`). Language tags (`@en`, `@fr`) stripped via plain `str()` at line 46. For multilingual RDF that's data loss. Either prefer `@en` when present or store `{value, lang}` in attributes.

**Malformed `owl:Axiom` triples silently dropped** (`ttl2json.py:32-33`). Log + count them in the summary so corrupt input is visible.

**Batch conversion aborts on first bad file** (`ttl2json.py:164-169`). One junk `.ttl` kills a 100-file run. Per-file try/except, report failures at the end.

**`/api/healthz` always returns 200** even if `GRAPHS_DIR` is unmounted. K8s/docker liveness will lie. Have it probe `list_graphs()`.

**Response shape mismatch** — list returns `nodeCount`/`edgeCount` (camelCase), detail returns `nodes`/`edges` (snake_case). Pick one.

**No pagination on `GET /api/graphs`** — fine today, but at N=10k the response is huge.

**Repository instantiated per-request** (`api/src/app/api/deps.py:10-13`) — kills the mtime summary cache. Hoist to `app.state`.

**No layout-failure feedback in the UI** — `useElkLayout.ts:170-185` logs and falls back to `(0,0)`; user sees a stuck graph with no hint why.

## Suggested triage

**One afternoon — correctness + onboarding:**
- Restore `api/` tests
- Lock JSON ordering in `conversion/`
- Force UTF-8 reads in the api
- Fix path traversal in `filesystem.py`
- Commit a sample `.ttl`
- Rename `vite-scaffold`

**One week on top — drift safety + perf:**
- OpenAPI → TS codegen
- Extract the shared renderer hook
- Lazy-load the two canvas chunks
- Zod-validate api responses
