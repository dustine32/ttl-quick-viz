# API Restructure — Design Spec

**Date:** 2026-04-23
**Scope:** The `api/` subproject only. `conversion/` and `site/` are untouched.
**Supersedes:** `.specs/2026-04-23-ttl-quick-viz-api-design.md` (original design)
**Status:** Design — pending approval before implementation plan

## Purpose

Restructure `api/` from a flat Vite-scaffold-style layout into a layered, deployable, Poetry-managed Python package. The current code works, but the internal shape doesn't support adding a second transport (GraphQL, gRPC, a Python CLI) later without a refactor, and the tooling is not publishable or containerizable.

This restructure establishes clean internal boundaries now so future growth is *additive* (drop in a `graphql/` module beside `api/`) rather than *surgical* (tear apart `routes.py` to extract business logic).

## Goals

- `src/` layout with package name `app`.
- Poetry for dependency management + virtual env.
- Layered architecture: **domain → repositories → services → transports**. Today's only transport is REST; the layout supports more.
- Deployable as a Docker image. Ships a `Dockerfile` even if CI isn't wired yet.
- Factory-based app construction (`create_app()`) so tests and different entry points build their own instances without global state pitfalls.
- Fix the issues identified in the 2026-04-23 structure review: deprecated `on_event`, `sys.exit` in a handler, encoding-less file reads, regex-only traversal guard, routes not under `/api` prefix, `list_graphs` re-parsing every file on every request.

## Non-goals

- **No conversion changes.** `conversion/` stays exactly as it is. It will get its own restructure later (separate brainstorm, own spec).
- **No new transports.** No GraphQL, gRPC, or CLI module in this work. The layout makes them easy to add, but they are not added now.
- **No auth, no CORS, no rate limiting.** Same scope as original API.
- **No database.** Filesystem-backed only. A database repository is a future follow-on; the interface supports it.
- **No CI.** No GitHub Actions workflows added in this work.
- **No site changes beyond the Vite proxy.** The Vite proxy's `rewrite` rule is removed (see section 5.2). Type contracts are unchanged.
- **No migration of `.specs/` or `.plans/` directories.** The original spec + plan stay on disk as historical record.

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Language | Python 3.11+ | Pinned via `.python-version` and `pyproject.toml` |
| Dependency manager | Poetry 1.8+ | Replaces `requirements.txt` + `requirements-dev.txt` |
| Framework | FastAPI | Unchanged |
| Server | Uvicorn | Unchanged, run via entry point |
| Config | `pydantic-settings` | Unchanged |
| Validation | Pydantic v2 | Unchanged |
| Testing | pytest + FastAPI `TestClient` | Unchanged; tests reorganized into `unit/` + `integration/` |
| Lint/format | Ruff | New. Configured in `pyproject.toml`, no separate file |
| Type check | mypy | New. Configured in `pyproject.toml`, strict on `src/app/` |
| Containerization | Docker (multi-stage) | New. Not required for local dev |

## Folder layout

```
api/
├── pyproject.toml                    # Poetry; ruff + mypy config
├── poetry.lock
├── .python-version
├── .env.example                      # GRAPHS_DIR=... sample, copy to .env locally
├── .gitignore                        # keep as-is
├── README.md                         # rewritten to match new run loop
├── Dockerfile                        # multi-stage build
├── .dockerignore
├── src/
│   └── app/
│       ├── __init__.py               # __version__ only
│       ├── __main__.py               # `python -m app` → uvicorn.run(create_app(), ...)
│       ├── config.py                 # Settings, get_settings()
│       ├── logging.py                # configure_logging() — structured logs
│       ├── domain/
│       │   ├── __init__.py
│       │   ├── models.py             # Graph, GraphNode, GraphEdge, GraphSummary (pydantic)
│       │   └── translate.py          # translate(raw: dict) -> Graph  (pure fn)
│       ├── repositories/
│       │   ├── __init__.py
│       │   ├── base.py               # GraphRepository (Protocol) + GraphNotFound
│       │   └── filesystem.py         # FilesystemGraphRepository
│       ├── services/
│       │   ├── __init__.py
│       │   └── graph_service.py      # GraphService.list_graphs(), GraphService.get_graph(id)
│       └── api/                      # REST transport — the ONE place that imports FastAPI
│           ├── __init__.py
│           ├── app.py                # create_app() factory with lifespan
│           ├── deps.py               # DI: get_settings, get_repository, get_service
│           ├── errors.py             # domain exception → HTTPException mapping
│           └── routes/
│               ├── __init__.py
│               ├── graphs.py         # /api/graphs, /api/graphs/{id}
│               └── health.py         # /api/healthz
└── tests/
    ├── __init__.py
    ├── conftest.py                   # shared fixtures
    ├── unit/
    │   ├── __init__.py
    │   ├── test_translate.py         # migrated from tests/test_translate.py
    │   └── test_filesystem_repository.py  # migrated from tests/test_store.py
    └── integration/
        ├── __init__.py
        └── test_routes.py            # migrated from tests/test_routes.py
```

### Where old files move

| Old | New |
|---|---|
| `api/app/main.py` | split: `src/app/api/app.py` (factory), `src/app/__main__.py` (entry), `src/app/api/routes/health.py` (healthz) |
| `api/app/routes.py` | `src/app/api/routes/graphs.py` + `src/app/api/errors.py` |
| `api/app/store.py` | `src/app/repositories/filesystem.py` + `src/app/repositories/base.py` |
| `api/app/translate.py` | `src/app/domain/translate.py` |
| `api/app/schemas.py` | `src/app/domain/models.py` |
| `api/app/config.py` | `src/app/config.py` (kept flat — only one settings class) |
| `api/tests/test_translate.py` | `tests/unit/test_translate.py` |
| `api/tests/test_store.py` | `tests/unit/test_filesystem_repository.py` |
| `api/tests/test_routes.py` | `tests/integration/test_routes.py` |
| `api/tests/conftest.py` | `tests/conftest.py` (updated for the factory + new DI) |
| `api/requirements.txt` + `requirements-dev.txt` | `pyproject.toml` `[tool.poetry.dependencies]` + `[tool.poetry.group.dev.dependencies]` |

## Layers

### Domain (`src/app/domain/`)

Pure business objects + pure functions. No FastAPI, no IO, no logging. Reusable from any caller.

**`models.py`** — Pydantic v2 models: `Graph`, `GraphNode`, `GraphEdge`, `GraphSummary`. Identical to current `schemas.py` content. The name "models" reflects that these are the domain representation, not just HTTP schemas — in practice they also serve as FastAPI response models today.

**`translate.py`** — `translate(raw: dict) -> Graph`. Identical to current logic; moves unchanged. Raises `ValueError` for structural problems; callers map to HTTP codes.

### Repositories (`src/app/repositories/`)

The IO edge. "Where graphs live." Swap implementations via DI.

**`base.py`**:

```python
from typing import Protocol
from app.domain.models import Graph

class GraphNotFound(Exception):
    pass

class GraphRepository(Protocol):
    def list_ids(self) -> list[str]: ...
    def load_raw(self, graph_id: str) -> dict: ...
```

**`filesystem.py`** — `FilesystemGraphRepository(graphs_dir: Path)`. Same behavior as current `GraphStore`, with three fixes baked in:

1. `path.read_text(encoding="utf-8")` — no platform default.
2. Path traversal: `resolved = (self._dir / f"{id}.json").resolve()`; raise `GraphNotFound` if `self._dir.resolve()` is not a parent.
3. `list_ids()` caches summary metadata keyed by `(path, mtime)` so repeated `GET /graphs` calls don't re-parse every file. Cache lives on the instance; invalidates on mtime change.

### Services (`src/app/services/`)

Orchestration. Transport-agnostic. REST calls it today; a future GraphQL resolver or CLI command would call the same methods.

**`graph_service.py`**:

```python
class GraphService:
    def __init__(self, repo: GraphRepository) -> None:
        self._repo = repo

    def list_graphs(self) -> list[GraphSummary]:
        # returns domain objects, not HTTP responses
        ...

    def get_graph(self, graph_id: str) -> Graph:
        # raises GraphNotFound | ValueError; transport maps to HTTP
        ...
```

Id validation (the `^[A-Za-z0-9_.-]+$` + `..` check) lives here — because id validity is a domain rule, not an HTTP concern. Raises a new `InvalidGraphId` exception. This makes the same guard apply to any future transport without duplication.

### API / transport (`src/app/api/`)

REST-only. The one folder that imports FastAPI.

**`app.py`**:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.config import Settings, get_settings
from app.logging import configure_logging
from app.api.routes import graphs, health
from app.api.errors import register_exception_handlers


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging()

    if not settings.graphs_dir.is_dir():
        raise RuntimeError(
            f"GRAPHS_DIR does not exist or is not a directory: {settings.graphs_dir}"
        )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield  # startup currently has no async work; placeholder for future

    app = FastAPI(title="TTL Quick Viz API", lifespan=lifespan)
    register_exception_handlers(app)
    app.include_router(health.router, prefix="/api")
    app.include_router(graphs.router, prefix="/api")
    return app
```

Config validation happens **before** `FastAPI()` is constructed. No `sys.exit` inside a handler — a raised `RuntimeError` at factory time fails uvicorn cleanly.

**`deps.py`** — FastAPI dependencies:

```python
def get_repository(settings = Depends(get_settings)) -> GraphRepository:
    return FilesystemGraphRepository(settings.graphs_dir)

def get_service(repo = Depends(get_repository)) -> GraphService:
    return GraphService(repo)
```

**`errors.py`** — central place to map domain exceptions to HTTP responses:

```python
def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(GraphNotFound)
    async def _(request, exc): return JSONResponse(status_code=404, content={"detail": "graph not found"})

    @app.exception_handler(InvalidGraphId)
    async def _(request, exc): return JSONResponse(status_code=400, content={"detail": "invalid graph id"})

    @app.exception_handler(ValueError)
    async def _(request, exc): return JSONResponse(status_code=500, content={"detail": f"failed to read graph: {exc}"})
```

Routes become thin — they call the service and return its result. No `try/except` ladders duplicated across endpoints.

**`routes/graphs.py`**:

```python
router = APIRouter(tags=["graphs"])

@router.get("/graphs", response_model=list[GraphSummary])
def list_graphs(service: GraphService = Depends(get_service)) -> list[GraphSummary]:
    return service.list_graphs()

@router.get("/graphs/{graph_id}", response_model=Graph)
def get_graph(graph_id: str, service: GraphService = Depends(get_service)) -> Graph:
    return service.get_graph(graph_id)
```

**`routes/health.py`**:

```python
router = APIRouter(tags=["health"])

@router.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
```

### Entry point (`src/app/__main__.py`)

```python
import uvicorn
from app.api.app import create_app
from app.config import get_settings

def main() -> None:
    settings = get_settings()
    uvicorn.run(create_app(settings), host=settings.host, port=settings.port)

if __name__ == "__main__":
    main()
```

Exposed as the Poetry script `ttl-viz-api` (in `pyproject.toml`'s `[tool.poetry.scripts]`). Local dev: `poetry run ttl-viz-api` or `poetry run python -m app`.

## Configuration

**`config.py`** — unchanged in spirit, expanded in scope:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    graphs_dir: Path          # REQUIRED — no default (breaks filesystem coupling to conversion/)
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "INFO"
```

### The default path change (breaking)

The current default for `graphs_dir` is `../conversion/downloads/output`. That default is removed. `GRAPHS_DIR` becomes required. An `.env.example` ships with a sensible local value the developer copies to `.env`.

**Why:** it severs the hard-coded filesystem coupling to `conversion/` flagged in the structure review. The API knows where to read graphs from because it's *told*, not because it assumes.

**Migration:** the README includes a one-liner for local dev (`cp .env.example .env`). For the dev loop this is a one-time step.

## Error handling

Same HTTP taxonomy as the original spec:

| Case | Status | Body |
|---|---|---|
| Unknown id | 404 | `{"detail": "graph not found"}` |
| Invalid id | 400 | `{"detail": "invalid graph id"}` |
| File exists but unreadable / malformed JSON | 500 | `{"detail": "failed to read graph: <reason>"}` |
| Translator `ValueError` | 500 | `{"detail": "failed to read graph: <reason>"}` |
| Empty `GRAPHS_DIR` | 200 | `[]` |
| `GRAPHS_DIR` missing at startup | Fail fast | `RuntimeError` from `create_app()`; uvicorn exits |

The handlers live once in `api/errors.py` instead of repeated in each route.

## Logging

New module `src/app/logging.py`. Configures stdlib logging once at app start:

- `INFO` default, configurable via `LOG_LEVEL` env.
- Structured format: `%(asctime)s %(levelname)s %(name)s %(message)s`. Not JSON — plain text with a consistent shape, because "scalable" here means "readable + greppable when a future tail/journalctl is involved," not "shipped to Splunk."
- Uvicorn's loggers are *not* overridden; they compose naturally.

## Site-side changes

### Routes now mount under `/api`

The API router currently mounts at root (`/graphs`). The Vite proxy compensates with a `rewrite: (p) => p.replace(/^\/api/, '')`. That rewrite disappears when prod serves both from the same origin.

New behavior: routes mount at `/api/graphs`. Vite proxy becomes a trivial pass-through:

```ts
server: {
  proxy: { '/api': 'http://localhost:8000' },
},
```

No `rewrite`. Dev and prod agree on URLs.

This is the only site change required. `graphApi.ts` already uses `baseUrl: '/api'`, so nothing breaks.

## Testing

Test layout mirrors the layer boundaries:

- **`tests/unit/`** — pure-function and single-adapter tests. No HTTP. Fast.
  - `test_translate.py` (migrated unchanged)
  - `test_filesystem_repository.py` (migrated from `test_store.py`; adds tests for the new traversal guard and mtime cache)
- **`tests/integration/`** — `TestClient`-backed route tests.
  - `test_routes.py` (migrated; uses `create_app(Settings(graphs_dir=tmp_path))` instead of global app + dependency override)

`tests/conftest.py`:

```python
@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    settings = Settings(graphs_dir=tmp_path)
    return TestClient(create_app(settings))
```

The factory pattern eliminates the current `app.dependency_overrides.clear()` dance and the `get_settings.cache_clear()` workaround. Each test gets its own app instance.

All existing tests continue to pass (same behavior, same HTTP surface). The restructure is a refactor, not a feature change.

## Deployment artifact

**`Dockerfile`** — multi-stage:

1. `builder` stage: Python 3.11-slim, Poetry, `poetry install --only main`.
2. `runtime` stage: Python 3.11-slim, copy `/app/.venv` + `/app/src` from builder, non-root user, `CMD ["python", "-m", "app"]`.

**`.dockerignore`** — excludes `tests/`, `docs/`, `.venv/`, `__pycache__/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.git/`.

Not wired into CI. Present for when you run `docker build` yourself.

## What this *enables* (no code today)

- **GraphQL:** new sibling `src/app/graphql/` that imports `GraphService` and exposes it via Strawberry/Ariadne. No change to `domain/`, `repositories/`, `services/`.
- **CLI:** new sibling `src/app/cli/` with a `typer` app. Same service layer. Could print JSON, upload graphs to the repo, etc.
- **Second repository:** an `S3GraphRepository` or `PostgresGraphRepository` drops into `repositories/`. The service layer + routes don't change.
- **Second data source in one deployment:** a fanout repository (`UnionGraphRepository(fs, s3)`) composes cleanly because the interface is a Protocol.

Each of these is a new folder, not a surgical edit. That's the measure of "scalable" this design cares about.

## Migration approach (not the plan — the shape of it)

The implementation plan will follow the usual discipline: one-thing-at-a-time, tests green at every checkpoint, no commits in-plan. Rough phases:

1. Poetry + `pyproject.toml` in place, existing code still working from the old `app/` directory, `pytest` green.
2. Introduce `src/app/` skeleton; move `domain/` (translate, models) first because it has zero dependencies.
3. Move `repositories/` (filesystem store + base Protocol).
4. Introduce `services/` — new code, carved out of `routes.py`.
5. Move `api/` (factory, routes, errors, deps) with `/api` prefix.
6. Remove old `api/app/` tree; update test layout.
7. Drop default `graphs_dir`, add `.env.example`, update README.
8. Update Vite proxy to drop the `rewrite`.
9. Add `Dockerfile` + `.dockerignore`.

The plan spec will expand each phase into executable steps.

## Success criteria

- [ ] `poetry install` brings up a working dev env; no pip/requirements.txt left in `api/`.
- [ ] `poetry run ttl-viz-api` (or `poetry run python -m app`) boots the API; `curl http://localhost:8000/api/healthz` returns 200.
- [ ] `curl http://localhost:8000/api/graphs` lists summaries (requires `GRAPHS_DIR` set).
- [ ] All tests in `tests/unit/` and `tests/integration/` pass: translator, filesystem repo (with new traversal + mtime tests), routes.
- [ ] `ruff check src tests` and `mypy src` both clean.
- [ ] Site renders the same as before with the updated Vite proxy.
- [ ] `docker build -t ttl-viz-api .` succeeds and the container responds to `/api/healthz`.
- [ ] No file under `src/app/domain/`, `repositories/`, or `services/` imports from `fastapi`.

## Open design notes (worth flagging, not worth blocking on)

- **Pydantic `camelCase` fields.** `GraphSummary.nodeCount` / `edgeCount` use camelCase to match the wire contract. Python-side usage is awkward. A cleaner option is `Field(alias="nodeCount")` with `snake_case` attrs + `model_config = ConfigDict(populate_by_name=True)`. Deferred — easy to change later, currently green.
- **`asyncio` vs sync routes.** All handlers are sync today (`def`, not `async def`). FastAPI handles that fine. Keeping sync is correct because the IO is synchronous `path.read_text`. Revisit if a repo becomes async (e.g., an S3 client).
- **Versioning the API.** No `/v1` prefix today. If a second version is ever needed, `app.include_router(graphs_v1.router, prefix="/api/v1")` is trivial. Adding `/v1` today would be premature.
