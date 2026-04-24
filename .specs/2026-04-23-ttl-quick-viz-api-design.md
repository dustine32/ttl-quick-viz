# TTL Quick Viz — API Design Spec

**Date:** 2026-04-23
**Scope:** The `api/` FastAPI service that bridges `conversion/` (Turtle → NetworkX JSON) and `site/` (React SPA). The site and conversion tool are out of scope except for the specific integration touchpoints called out here.

## Purpose

A thin Python FastAPI service in `api/` that serves graph JSON to the `site/` SPA. Read-only. Exposes two endpoints (list + one) backed by a directory of NetworkX `node_link_data` files produced by `conversion/ttl2json.py`. The API translates those files into the UI's `{nodes, edges}` shape on the wire, so the site's existing types are untouched — this honors the "future API flip" pointer in the existing UI spec.

## Goals

- Unblock the UI's flip from bundled JSON fixture to real HTTP data fetch.
- Keep the site's `Graph` / `GraphNode` / `GraphEdge` types unchanged.
- Keep `conversion/ttl2json.py` unchanged — the API is a pure read-side consumer of its output.
- Minimal surface area that composes well with future upload / refresh / inspector features.

## Non-goals (v1)

- No upload endpoint. Conversion stays a manual step (`python ttl2json.py ...`).
- No refresh / trigger-conversion endpoint.
- No auth.
- No CORS middleware — dev uses a Vite proxy; prod is out of scope.
- No caching beyond what FastAPI gives for free.
- No multi-format support; only NetworkX `node_link_data` input.
- No deployment / packaging / containerization.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Language | Python 3.11+ | Matches `conversion/` toolchain |
| Framework | FastAPI (latest) | Typed, OpenAPI for free at `/docs`, pydantic models mirror the wire contract |
| Server | Uvicorn (`uvicorn[standard]`) | Default FastAPI pairing, hot reload in dev |
| Config | `pydantic-settings` | Env-var loading with defaults, typed |
| Test | pytest + FastAPI `TestClient` | Standard stack, no async plumbing needed |
| Dep mgmt | `requirements.txt` + separate `.venv` in `api/` | Mirrors how `conversion/` is organized; each tool installable on its own |

## Folder layout

```
api/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI() app, route registration, startup config check
│   ├── config.py         # Settings: GRAPHS_DIR
│   ├── routes.py         # GET /graphs, GET /graphs/{id}
│   ├── store.py          # GraphStore — directory adapter: list_ids(), load_raw(id)
│   ├── translate.py      # node_link_data -> {nodes, edges} translator (pure fn)
│   └── schemas.py        # Pydantic: Graph, GraphNode, GraphEdge, GraphSummary
├── tests/
│   ├── __init__.py
│   ├── conftest.py       # fixture data dir + TestClient with dependency override
│   ├── fixtures/
│   │   ├── good.json     # small valid node_link_data sample
│   │   └── malformed.json
│   ├── test_routes.py
│   └── test_translate.py
├── requirements.txt      # fastapi, uvicorn[standard], pydantic-settings
├── requirements-dev.txt  # pytest, httpx
├── .python-version       # pin Python version
└── README.md             # run instructions
```

Small, flat, each file one responsibility. `store.py` and `translate.py` are IO-at-the-edges / pure-function so they test without a running server.

## Endpoints

### `GET /graphs` → `200 GraphSummary[]`

```json
[
  { "id": "R-HSA-1059683", "nodeCount": 1423, "edgeCount": 2891 }
]
```

- Lists `*.json` files in `GRAPHS_DIR`. Filename stem is the id.
- Counts come from parsing each file (`len(data["nodes"])`, `len(data["links"])`) without running the full translator.
- Results sorted alphabetically by id.
- Empty directory returns `200 []`.

### `GET /graphs/{id}` → `200 Graph`

```json
{
  "nodes": [
    { "id": "http://model.geneontology.org/R-HSA-1112538",
      "label": "Phosphorylated STAT1, STAT3 form dimers",
      "attrs": { "rdf:type": ["..."], "http://...label": ["..."] } }
  ],
  "edges": [
    { "id": "src|predicate|tgt|0",
      "source": "...", "target": "...",
      "label": "http://...hasInput",
      "attrs": {} }
  ]
}
```

Translator details in the next section.

## Format translation

Pure function `translate(raw: dict) -> Graph` in `app/translate.py`. Never mutates input. Raises on structural violations (missing `source`/`target` on an edge) — these surface as 500 per the error-handling table.

### Nodes (NetworkX → UI)

- `raw_node["id"]` → `node["id"]`.
- `raw_node["label"]` → `node["label"]`. Pass through. If `null`, the field is omitted from the response (`label` is optional in the UI type).
- Fold `types` + `attributes` into `attrs`:

  ```python
  attrs = {**raw_node.get("attributes", {})}
  types = raw_node.get("types") or []
  if types:
      attrs["rdf:type"] = types
  ```

  `"rdf:type"` is chosen as the key so a future inspector panel can surface RDF types without ambiguity. This string is load-bearing; consumers (inspector UI) will match on it exactly.

### Edges (NetworkX `links` → UI `edges`)

- `raw_link["source"]` → `edge["source"]`; same for `target`. Required. Missing either is a translation error.
- `raw_link["predicate"]` → `edge["label"]`.
- `raw_link.get("annotations", {})` → `edge["attrs"]`.
- `edge["id"]` is derived deterministically: `f"{source}|{predicate}|{target}|{index}"` where `index` is the 0-based position among edges sharing the same `(source, predicate, target)` triple. This supports the multigraph case and is stable across requests given the same input file.

### What is NOT translated

`raw["directed"]`, `raw["multigraph"]`, `raw["graph"]` top-level fields are dropped. The UI doesn't consume them in v1. If later needed, they'd be added to `Graph` as optional fields.

## Configuration

Single setting via `pydantic-settings`:

| Env var | Default | Meaning |
|---|---|---|
| `GRAPHS_DIR` | `../conversion/downloads/output` (resolved relative to `api/`) | Directory scanned for graph JSON files |

Settings are loaded once at app startup. The `GraphStore` receives the resolved absolute path via FastAPI dependency injection, which lets tests override it with a fixture directory.

At startup, if `GRAPHS_DIR` does not exist or is not a directory, the app logs and exits (uvicorn process dies). Failing fast beats serving 500s on every request.

## Error handling

| Case | Status | Body |
|---|---|---|
| Unknown id (file not found) | 404 | `{"detail": "graph not found"}` |
| Invalid id (regex `^[A-Za-z0-9_.-]+$` fails) | 400 | `{"detail": "invalid graph id"}` |
| Id resolves to a non-file, a subdirectory, or a non-`.json` entry | 404 | `{"detail": "graph not found"}` |
| File exists, fails JSON parse or translation | 500 | `{"detail": "failed to read graph: <reason>"}` |
| Empty `GRAPHS_DIR` | 200 | `[]` |
| `GRAPHS_DIR` missing at startup | Fail fast | Uvicorn exits with clear message |

Path traversal is prevented by the id regex, not by ad-hoc string checks. The store never calls `Path.joinpath` on unvalidated input.

## Site-side changes

Exactly the "future API flip" pointer already written into the existing UI spec. Mechanical.

### 1. `site/src/features/graph/graphApi.ts`

Replace `fakeBaseQuery` with `fetchBaseQuery` and add the list endpoint:

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Graph, GraphSummary } from '@/features/graph/types';

export const graphApi = createApi({
  reducerPath: 'graphApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (build) => ({
    getGraphs: build.query<GraphSummary[], void>({ query: () => '/graphs' }),
    getGraph: build.query<Graph, string>({ query: (id) => `/graphs/${id}` }),
  }),
});

export const { useGetGraphsQuery, useGetGraphQuery } = graphApi;
```

### 2. `site/src/features/graph/types.ts`

Add `GraphSummary`:

```ts
export type GraphSummary = {
  id: string;
  nodeCount: number;
  edgeCount: number;
};
```

Re-export from `features/graph/index.ts`.

### 3. `site/vite.config.ts`

Add dev proxy:

```ts
server: {
  proxy: { '/api': 'http://localhost:8000' },
},
```

### 4. `site/src/features/graph/GraphCanvas.tsx`

Fetch the list, take the first id, fetch that graph. Exercises both endpoints and avoids a hardcoded id that may not exist on disk:

```tsx
const { data: list, isLoading: listLoading } = useGetGraphsQuery();
const firstId = list?.[0]?.id;
const { data, isLoading, error } = useGetGraphQuery(firstId ?? '', { skip: !firstId });
const layout = useElkLayout(data);

if (listLoading || isLoading || layout.status === 'laying-out' || layout.status === 'idle') {
  return (
    <div className="flex h-full items-center justify-center text-neutral-500">
      Loading…
    </div>
  );
}
if (!firstId) {
  return (
    <div className="flex h-full items-center justify-center text-neutral-500">
      No graphs available.
    </div>
  );
}
// existing error + <ReactFlow> render path unchanged
```

The empty-state copy is the only net-new UI text; it reuses the existing Tailwind classes.

### 5. `site/src/data/sample-graph.json`

No longer load-bearing. Can stay as a test fixture for now; removal is future work.

### 6. `graphApi.test.ts`

Update to mock `fetch` (e.g., via MSW or a manual `globalThis.fetch` stub) instead of relying on the fake base query. Shape assertion remains the same.

## Dev loop

Two terminals:

```bash
# terminal 1 — API
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# terminal 2 — site
cd site
npm run dev
```

- Site at `http://localhost:5173`; `/api/*` is proxied to `:8000`.
- OpenAPI docs at `http://localhost:8000/docs`.
- Editing `.ttl` → re-run `python conversion/ttl2json.py conversion/downloads/input/` → reload the site.

A root-level `README.md` section (or a new top-level README) documents this flow. No Makefile in v1.

## Testing

Minimal and hand-chosen, matching the existing UI spec's philosophy.

### `test_translate.py` (pure function)

Fixture: a synthetic `node_link_data` dict with one labeled node, one unlabeled node, two edges between the same pair with different predicates (tests edge id determinism), one edge between the same pair with the same predicate repeated (tests the multigraph index increment), and one node with `types` + `attributes` (tests the `rdf:type` fold).

Assertions:
- Output conforms to the `Graph` pydantic schema.
- `attrs["rdf:type"]` matches the input `types` list.
- Edge ids are `source|predicate|target|0` and `source|predicate|target|1` for the parallel pair.
- Missing `source` on an edge raises.

### `test_routes.py` (integration via `TestClient`)

Using a `conftest.py` that constructs a `TestClient` with `GRAPHS_DIR` overridden to `tests/fixtures/`:

- `GET /graphs` → 200 with one `GraphSummary` for `good.json`, counts matching the fixture. (Malformed file is in a separate fixture subdir used only by the error test.)
- `GET /graphs/good` → 200, shape conforms to `Graph`.
- `GET /graphs/does-not-exist` → 404.
- `GET /graphs/../etc/passwd` → 400 (URL-encoded in the client to force the raw path).
- `GET /graphs/malformed` (using a second fixture dir) → 500 with `"failed to read graph"` in the detail.

### Explicitly out of scope for v1 tests

- No live-disk tests against `conversion/downloads/output/`.
- No load / perf tests.
- No contract tests between `api/` and `site/` (the shared shape is small enough that type drift is caught by human review).

## Data flow

1. `conversion/ttl2json.py` produces `conversion/downloads/output/<id>.json`.
2. `api/` Uvicorn starts; `GraphStore` binds to `GRAPHS_DIR`.
3. Site mounts; `GraphCanvas` calls `useGetGraphsQuery()`.
4. RTK Query hits `/api/graphs`; Vite proxies to `:8000`; FastAPI returns `GraphSummary[]`.
5. Site picks `list[0].id`; `useGetGraphQuery(id)` fires.
6. FastAPI reads `{id}.json`, runs `translate()`, returns `Graph` in the UI's shape.
7. `useElkLayout(data)` runs; React Flow renders.

## Future work (not in v1)

- `POST /graphs` — upload `.ttl`, call `ttl2json.convert_file` in-process, return new id.
- `POST /graphs/refresh` — rescan `downloads/input/`, convert missing/stale outputs.
- Fixture picker UI (Mantine `Select`) in site once >1 graph is common.
- Richer wire shape exposing `predicate` / `types` / `annotations` as first-class fields for an inspector panel.
- In-memory LRU cache on `GraphStore` if very large files and repeated reads become a visible cost.
- CORS middleware if a non-Vite-proxied client ever needs to hit the API.
- Production deployment (container, reverse proxy, config hardening).
