# Developer Guide — FastAPI / `api/`

Onboarding-style best-practice guide for the `api/` service. Read
`api/CLAUDE.md` first for the repo map and layer summary; this doc is the
deeper "how we do things here."

- Stack: **Python 3.11+**, **FastAPI**, **pydantic v2** (+ pydantic-settings),
  **uvicorn**, **pytest + httpx + TestClient**, **Poetry** (in-project `.venv/`).
- Linter: **ruff**. Type-check: **mypy** (non-strict).

---

## 1. Architecture — strict layered, one direction

```
        ┌─────────────────────────────────────────────┐
        │  api/          ← FastAPI-only layer         │
        │    routes/     ← thin HTTP wrappers         │
        │    errors.py   ← exception → HTTP mapping   │
        │    deps.py     ← DI wiring                  │
        │    app.py      ← create_app() factory       │
        └──────────┬──────────────────────────────────┘
                   ↓ depends on
        ┌──────────────────────────────────────────────┐
        │  services/     ← orchestration, no FastAPI  │
        └──────────┬───────────────────────────────────┘
                   ↓ depends on
        ┌──────────────────────────────────────────────┐
        │  repositories/ ← IO edge, only layer         │
        │                  that touches filesystem/DB │
        └──────────┬───────────────────────────────────┘
                   ↓ depends on
        ┌──────────────────────────────────────────────┐
        │  domain/       ← pure models + translators  │
        │                  no IO, no FastAPI           │
        └──────────────────────────────────────────────┘
```

**Arrows only go down.** `domain/` doesn't know `repositories/` exists;
`services/` doesn't know `api/` exists. This is the single most important
rule in the codebase.

---

## 2. Layer-by-layer rules

### 2.1 `domain/` — the pure core

`domain/models.py` and `domain/translate.py`. These are the **wire shape**
and the raw-JSON → model translator.

**Rules:**

- **No IO.** No file reads, no HTTP clients, no logging that matters for
  behavior (`logger.debug` for dev is fine).
- **No FastAPI.** Import FastAPI here and the layering breaks — domain
  becomes untestable without a web framework.
- **Pydantic with `extra="forbid"`** on every response model. We fail loud
  on unknown fields rather than silently shipping half-valid data.

```python
# domain/models.py
from pydantic import BaseModel, ConfigDict

class GraphNode(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    label: str | None = None
    types: list[str] = []
    attributes: dict[str, list[str]] = {}
```

- **One translator per shape transition.** `translate(raw: dict) -> Graph`
  is the only place that knows the rdf/`node_link_data` vocabulary. Don't
  sprinkle `raw.get("links", [])` across routes or services.

### 2.2 `repositories/` — the IO edge

`repositories/base.py` (Protocol) and `repositories/filesystem.py`
(implementation).

**Rules:**

- **Only layer that touches the filesystem** (or DB, or external API, when
  those arrive). If a service needs to read a file, it goes through a repo.
- **Protocol-based interface** so the service can be tested against a fake.
  ```python
  from typing import Protocol

  class GraphRepository(Protocol):
      def list_ids(self) -> list[str]: ...
      def count(self, graph_id: str) -> tuple[int, int]: ...
      def load_raw(self, graph_id: str) -> dict: ...
  ```
- **Raise domain exceptions**, not `HTTPException`. `GraphNotFound` is a
  repository concern; 404 is a transport concern.
- **Enforce path safety here, not in routes.** Repos own the "where is it
  safe to read from" invariant.
  ```python
  def _resolve(self, graph_id: str) -> Path:
      candidate = (self._dir / f"{graph_id}.json").resolve()
      base = self._dir.resolve()
      if base not in candidate.parents and candidate != base:
          raise GraphNotFound(graph_id)
      return candidate
  ```
- **Always specify encoding on file reads:** `path.read_text(encoding="utf-8")`.
  Platform defaults break on Windows with non-ASCII RDF content.
- **Cache smartly.** The summary list is mtime-keyed; don't re-parse
  untouched files on every request.

### 2.3 `services/` — orchestration

`services/graph_service.py`.

**Rules:**

- **Transport-agnostic.** No `Request`, `Response`, `HTTPException`,
  `Depends`, or any other FastAPI symbol. You should be able to call a
  service from a CLI, a background job, or a test without booting FastAPI.
- **Takes a Protocol, not a concrete repo.** Swapping in a fake repo is
  how we test services.
  ```python
  class GraphService:
      def __init__(self, repo: GraphRepository) -> None:
          self._repo = repo
  ```
- **Validate domain invariants here.** ID shape, business rules,
  cross-field checks.
- **Raise domain exceptions.** `InvalidGraphId`, `GraphNotFound`. Never
  `HTTPException` — the API layer maps them.
- **Skip malformed data, log it, and keep going** when listing is a
  best-effort operation; fail hard when the caller explicitly asked for
  a specific broken graph.

```python
def list_graphs(self) -> list[GraphSummary]:
    summaries: list[GraphSummary] = []
    for graph_id in self._repo.list_ids():
        try:
            nodes, edges = self._repo.count(graph_id)
        except (JSONDecodeError, ValueError) as exc:
            logger.warning("skipping malformed graph %r: %s", graph_id, exc)
            continue
        summaries.append(GraphSummary(id=graph_id, nodeCount=nodes, edgeCount=edges))
    return summaries
```

### 2.4 `api/` — HTTP transport

`api/app.py`, `api/deps.py`, `api/errors.py`, `api/routes/`.

**Rules:**

- **`create_app(settings)` factory.** Don't instantiate `FastAPI()` at
  module import time — it makes tests and startup validation harder.
  Validate config before building the app.
- **Thin routes.** A route function unpacks DI, calls a service method,
  returns. No business logic, no file IO, no for-loops over domain objects.
  ```python
  @router.get("/graphs/{graph_id}", response_model=Graph)
  def get_graph(graph_id: str, service: GraphService = Depends(get_service)) -> Graph:
      return service.get_graph(graph_id)
  ```
- **Map exceptions in one place** (`errors.py`). Services raise
  `GraphNotFound`; `errors.py` converts it to a 404 with a clean body.
  Routes never `raise HTTPException` directly.
  ```python
  @app.exception_handler(GraphNotFound)
  def _not_found(_: Request, exc: GraphNotFound) -> JSONResponse:
      return JSONResponse(status_code=404, content={"detail": f"Graph '{exc}' not found"})
  ```
- **Mount routers under `/api`** to match the site's proxy and prod routing.
- **Use `response_model`** on every endpoint so the OpenAPI schema stays
  honest.

---

## 3. Dependency injection

Keep DI trivial and explicit.

```python
# api/deps.py
from functools import lru_cache
from app.config import get_settings
from app.repositories.filesystem import FilesystemGraphRepository
from app.services.graph_service import GraphService

@lru_cache(maxsize=1)
def get_repository() -> FilesystemGraphRepository:
    return FilesystemGraphRepository(get_settings().graphs_dir)

def get_service(repo: FilesystemGraphRepository = Depends(get_repository)) -> GraphService:
    return GraphService(repo)
```

- Caches live in `deps.py`, not in business code. Tests clear them.
- Inject the `GraphRepository` **Protocol** type-hint in services; inject
  the concrete class only at the DI boundary.

---

## 4. Config — pydantic-settings

`app/config.py`:

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")
    graphs_dir: Path
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "INFO"

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
```

- **Env vars always win** over `.env`.
- **Fail at startup** if required config is missing or invalid. Validate
  `graphs_dir` actually exists inside `create_app`.
- **Tests must clear the cache:**
  ```python
  monkeypatch.setenv("GRAPHS_DIR", str(tmp_path))
  get_settings.cache_clear()
  ```

---

## 5. Errors — taxonomy and mapping

Exception types are owned by the layer that raises them:

| Exception          | Raised in      | Maps to     |
|--------------------|----------------|-------------|
| `GraphNotFound`    | `repositories` | 404         |
| `InvalidGraphId`   | `services`     | 400         |
| `ValueError`       | various        | 400 or 500  |
| `JSONDecodeError`  | `repositories` | 500         |
| uncaught           | anywhere       | 500         |

- **Domain / service exceptions are just `Exception` subclasses** — they
  don't know about HTTP.
- **`api/errors.py` is the single place** that maps them. All mappers go
  through FastAPI's `exception_handler`.
- **Error responses are structured:** `{"detail": "human-readable message"}`.
  Don't leak tracebacks to clients, but **do** log them server-side.

---

## 6. Logging

```python
import logging
logger = logging.getLogger(__name__)
```

- Use `logger`, not `print`.
- **`logger.warning`** for recoverable problems (malformed file skipped).
- **`logger.error`** for unexpected failures (include `exc_info=True` when
  catching).
- **`logger.debug`** for developer tracing — off in prod.
- **No logging from `domain/`**. Pure modules stay pure.

---

## 7. Testing

Framework: **pytest + httpx + `fastapi.testclient.TestClient`**.

Layout: **flat** under `tests/`. Tests are grouped by layer they exercise:
`test_service.py`, `test_repository.py`, `test_routes.py`, `test_health.py`,
`test_translate.py`.

### 7.1 Conftest fixtures

`tests/conftest.py` provides:

- `graphs_dir` — a pytest `tmp_path` that serves as the graphs directory.
- `write_graph(name, payload)` — helper that writes a fixture JSON into
  `graphs_dir`.
- `client` — a `TestClient` with `GRAPHS_DIR` monkeypatched and the
  `get_settings` lru_cache cleared.

```python
# test_routes.py
def test_get_graph_returns_translated_shape(client, write_graph):
    write_graph("demo", {"directed": True, "nodes": [...], "links": [...]})
    res = client.get("/api/graphs/demo")
    assert res.status_code == 200
    assert res.json()["nodes"][0]["id"] == "..."
```

### 7.2 What to test at each layer

- **`domain/translate.py`** — pure function, table-driven unit tests.
  The most important tests in the codebase; lock down the wire shape.
- **`repositories/`** — against `tmp_path`. Cover path traversal, missing
  files, malformed JSON, encoding, mtime cache invalidation.
- **`services/`** — with a **fake repo** implementing the Protocol. No
  real filesystem.
  ```python
  class FakeRepo:
      def list_ids(self): return ["a", "b"]
      def count(self, id): return (1, 1)
      def load_raw(self, id): return {...}
  ```
- **`api/routes/`** — with `TestClient`. Assert status codes, response
  shape, and that errors map correctly.

### 7.3 What NOT to test

- Don't duplicate domain tests at the route layer. If
  `translate.py` has 30 cases, the route layer needs ~2 smoke tests, not 30.
- Don't test FastAPI itself. Trust the framework; test your code.

---

## 8. Adding an endpoint — worked example

Say we want `GET /api/graphs/{id}/neighbors/{node_id}`.

1. **`domain/`** — if the response shape is new, add a pydantic model:
   ```python
   class Neighbors(BaseModel):
       model_config = ConfigDict(extra="forbid")
       node_id: str
       neighbors: list[GraphNode]
   ```
   If the translator needs changes, extend `translate.py`.

2. **`repositories/`** — if new data needs reading, extend the Protocol
   and the concrete implementation. In this case, `load_raw` already
   returns the full graph, so probably no change.

3. **`services/`** — add a method on `GraphService`:
   ```python
   def get_neighbors(self, graph_id: str, node_id: str) -> Neighbors:
       self._validate_id(graph_id)
       graph = self.get_graph(graph_id)
       if node_id not in {n.id for n in graph.nodes}:
           raise NodeNotFound(node_id)
       # ... compute neighbors from graph.edges
       return Neighbors(node_id=node_id, neighbors=[...])
   ```

4. **`api/`** — add a route, include it, map the new exception:
   ```python
   @router.get("/graphs/{graph_id}/neighbors/{node_id}", response_model=Neighbors)
   def get_neighbors(
       graph_id: str,
       node_id: str,
       service: GraphService = Depends(get_service),
   ) -> Neighbors:
       return service.get_neighbors(graph_id, node_id)
   ```

5. **Tests** — a unit test on the service (with a fake repo), a route test
   with `TestClient`, and cover the new error path.

6. **Update `site/src/features/graph/graphApi.ts`** — add the endpoint and
   the TS type in `types.ts`. **Do not** skip this step; the wire shape
   must match.

---

## 9. Python style

- **`from __future__ import annotations`** at the top of every module.
  Keeps runtime cheap and lets us reference types that are imported
  only for type-checking.
- **Type-hint everything public.** Argument types + return types on every
  function in `services/`, `repositories/`, `api/`. Mypy is non-strict but
  readability is not.
- **Use `Protocol`** for interfaces instead of `ABC` — it's duck-typed and
  avoids boilerplate.
- **Use `@staticmethod`** for helpers that don't touch `self`.
- **Use the `|` union syntax** (`str | None`, not `Optional[str]`) —
  Python 3.10+ only, and we're 3.11+.
- **Ruff** enforces imports and basic style. `ruff check src tests` in CI;
  run it before committing.

---

## 10. Commands reference

Activate the venv once per shell — **do not use `poetry run`**.

```bash
source .venv/Scripts/activate   # Git Bash on Windows
# .venv\Scripts\activate        # PowerShell
# .venv/bin/activate            # macOS / Linux

poetry install                   # install / refresh deps
python main.py                   # run dev server (banner)
python -m app                    # equivalent module form
uvicorn main:app --reload        # hot-reload during development
ttl-viz-api                      # Poetry script alias
pytest                           # full test suite
pytest tests/test_service.py -v  # one file
pytest -k neighbors              # by substring
ruff check src tests             # lint
ruff check --fix src tests       # auto-fix what's safe
mypy                             # type-check

docker build -t ttl-viz-api .    # build runtime image
```

---

## 11. Gotchas

- **`VIRTUAL_ENV` trap.** VSCode auto-activates a uv-managed base Python
  and `poetry install` silently drops packages there. Symptom: `.venv/`
  is empty or imports resolve outside the project. Fix:
  `unset VIRTUAL_ENV` before `poetry install`, or point VSCode's
  interpreter at `.\.venv\Scripts\python.exe` first.
- **Don't `poetry run`.** Pyenv shims interfere. Activate the venv.
- **`GRAPHS_DIR` is required.** Pydantic raises before the app builds if
  it's missing or points at a non-directory.
- **Wire-shape changes are cross-cutting.** `domain/models.py` +
  `domain/translate.py` + `site/src/features/graph/types.ts` +
  `conversion/ttl2json.py` JSON output all have to move together.
- **Edge ids are synthetic.** `{src}|{pred}|{tgt}|{idx}` — deterministic
  from the source JSON but meaningless to the raw TTL. Don't assume
  they're stable across conversion regenerations unless the source is
  identical.
- **Path traversal is belt-and-braces.** Regex + `".." in id` + resolve
  check. Don't remove any of the three.

---

## 12. Anti-patterns we avoid

- `HTTPException` inside services or repos — cross-layer leak.
- `os.path.join` / string path concat — use `pathlib.Path`.
- Unencoded `read_text()` — UTF-8 always.
- Module-level `app = FastAPI()` — use `create_app()`.
- Catching `Exception` broadly — catch what you can actually handle.
- Business logic in routes — routes unpack and delegate.
- Real filesystem in service tests — use a fake repo.
- Mutable default arguments (`def f(x=[])`) — the Python classic.
- `print` for debugging that survives the commit — use `logger`.
