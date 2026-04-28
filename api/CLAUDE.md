# api/ — engineering guidance

FastAPI service that serves graph JSON to the `site/` SPA and re-runs the
upstream `ttl2json` conversion on demand. Six routes total: `GET /api/healthz`,
`GET /api/graphs`, `GET /api/graphs/{id}`, `GET /api/graphs/{id}/ttl`,
`POST /api/convert`, `POST /api/graphs/{id}/rebuild`. Optionally watches
`INPUT_DIR` for `.ttl` changes and auto-reconverts in the background.

> **Developer guide:** See [`../docs/dev-guide-fastapi.md`](../docs/dev-guide-fastapi.md)
> for the deeper "how we build here" — layered architecture rules, pydantic
> config, error taxonomy, testing patterns, and a worked "add an endpoint"
> example. This file is the quick repo map; that file is the onboarding read.

## Layer map

Source lives under `src/app/`. Respect the direction of dependencies:
`api → services → repositories → domain` (and `api → domain` for response
models).

- `domain/` — pure business objects and the wire-shape translator.
  - `models.py` — `Graph`, `GraphNode`, `GraphEdge`, `GraphSummary`,
    `GraphConversionResult`, `ConvertResponse` (all pydantic, `extra="forbid"`).
    **This is the wire shape.**
  - `translate.py` — `translate(raw: dict) -> Graph` folds raw `node_link_data`
    JSON into the domain model. Edge ids are synthetic
    (`"{src}|{pred}|{tgt}|{idx}"`); `attributes` is flattened into `attrs`
    and `types` is promoted to `attrs["rdf:type"]`.
  - **Rules:** no IO, no FastAPI imports, no logging side effects.
- `repositories/` — the IO edge. Only layer that touches the filesystem.
  - `base.py` — `GraphRepository` Protocol (`list_ids`, `load_raw`, `count`,
    `mtime`) + `GraphNotFound`.
  - `filesystem.py` — `FilesystemGraphRepository` reads
    `<graphs_dir>/<id>.json`, has a mtime-keyed summary cache, and blocks
    path traversal in `_resolve`.
- `services/` — orchestration, transport-agnostic.
  - `graph_service.py` — `GraphService` validates ids
    (`^[A-Za-z0-9_.-]+$`, no `..`), calls the repo, invokes the translator.
    Raises `InvalidGraphId`. Skips malformed graphs on list with a warning.
  - `conversion_service.py` — `ConversionService` orchestrates calls into
    the `ttl2json` package: `rebuild_all(force)`, `rebuild_one(id, force)`,
    `get_ttl(id)`. Raises `InputDirNotConfigured`, `TtlNotFound`, or its own
    `InvalidGraphId`.
  - `watcher.py` — `ConversionWatcher` (uses `watchdog.Observer`). Debounces
    per-file via `threading.Timer`; fires `convert_file` in a background
    thread on change; deletes the corresponding `<id>.json` from
    `graphs_dir` on `.ttl` deletion. Started in the app lifespan when
    `enable_watcher=True`.
  - **Rules:** no `Request`/`Response`, no FastAPI. Take a `GraphRepository`
    Protocol where applicable.
- `api/` — REST transport. Only layer that imports FastAPI.
  - `app.py` — `create_app(settings)` factory. Validates `graphs_dir` exists,
    configures logging, registers a lifespan that starts/stops the watcher,
    adds permissive CORS, registers exception handlers, mounts routers under
    `/api`.
  - `deps.py` — `get_repository`, `get_service`, `get_conversion_service` DI
    wiring.
  - `errors.py` — maps `GraphNotFound → 404`, `TtlNotFound → 404`,
    `InvalidGraphId → 400` (both service-layer variants),
    `InputDirNotConfigured → 503`,
    `JSONDecodeError`/`ValueError → 500`.
  - `routes/graphs.py` — list / fetch / ttl / convert / rebuild.
  - `routes/health.py` — `/healthz`.

## Adding a new endpoint

Walk the layers in order. Do not skip a layer.

1. **domain/** — add/extend a pydantic model in `models.py` if the response
   shape is new. Extend `translate.py` if the raw-JSON mapping changes.
2. **repositories/** — add a method to the `GraphRepository` Protocol and
   implement it on `FilesystemGraphRepository` if new data needs to be read.
3. **services/** — add a method on `GraphService` (or a new service) that
   orchestrates repo + translator + `ttl2json` package. Raise domain
   exceptions, not `HTTPException`.
4. **api/** — add the route in `src/app/api/routes/`, include it in `app.py`,
   and map any new exceptions in `errors.py`.

## Common commands

Activate the venv once per shell — **do not use `poetry run`** (pyenv shims
break it).

```bash
source .venv/Scripts/activate    # Git Bash on Windows; .venv\Scripts\activate in PowerShell; .venv/bin/activate on *nix

poetry install                   # install/refresh deps (venv must be active or unset VIRTUAL_ENV first)
python main.py                   # run dev server (with banner)
python -m app                    # equivalent module form (used by Docker CMD)
uvicorn main:app --reload        # auto-reload during development
ttl-viz-api                      # Poetry script alias (= app.__main__:run)
pytest                           # run the test suite (flat under tests/)
ruff check src tests             # lint
mypy                             # type-check (non-strict, see pyproject.toml)

docker build -t ttl-viz-api .    # build runtime image
```

## Testing

- Framework: `pytest` + `httpx` + `fastapi.testclient`.
- Layout: **flat** under `tests/` (no `unit/` / `integration/` subdirs).
- `conftest.py` provides `graphs_dir` (tmp dir), `write_graph(name, payload)`
  (writes a `<name>.json`), and `client` (a `TestClient` with `GRAPHS_DIR`
  monkeypatched and the `get_settings` lru_cache cleared).
- Files: `test_health.py`, `test_repository.py`, `test_routes.py`,
  `test_routes_ttl.py`, `test_service.py`, `test_translate.py`.

## Config (`src/app/config.py`)

`pydantic-settings` `Settings` (loads `.env` if present; env vars override).
Cached via `lru_cache` on `get_settings()` — **clear the cache in tests**
(`get_settings.cache_clear()`) after mutating env.

| Field                  | Type        | Required |
|------------------------|-------------|----------|
| `graphs_dir`           | `Path`      | yes      |
| `input_dir`            | `Path \| None` | no   |
| `enable_watcher`       | `bool`      | no (default `False`) |
| `watcher_debounce_ms`  | `int`       | no (default `2000`) |
| `host`                 | `str`       | yes      |
| `port`                 | `int`       | yes      |
| `log_level`            | `str`       | no (default `"INFO"`) |

`extra="ignore"` — unknown env vars are silently ignored. `create_app` refuses
to start if `graphs_dir` does not exist or is not a directory.

CORS allows all origins/methods/headers — local dev tool. **Don't tighten
CORS in dev** — the site has no proxy and ports vary.

## Gotchas

- **Won't start without `GRAPHS_DIR`** pointing at an existing directory —
  pydantic validates the env, then `create_app` checks `is_dir()`.
- **VSCode `VIRTUAL_ENV` trap.** The Python extension auto-activates a
  uv-managed base Python via `VIRTUAL_ENV`, which makes `poetry install` drop
  packages into `...\uv\python\...` instead of `.venv/`. Symptom: imports
  resolve outside the project venv and `.venv/` is missing or stale. Fix:
  `unset VIRTUAL_ENV` before `poetry install`, or point the VSCode interpreter
  at `.\.venv\Scripts\python.exe`.
- **Wire-shape changes are cross-cutting.** `domain/models.py` and
  `domain/translate.py` define what the SPA receives. Any field rename or
  addition needs a coordinated edit in `site/src/features/graph/types.ts`
  (and possibly the upstream `conversion/src/ttl2json/core.py` if the change
  starts there).
- **`api/` imports `conversion/` as a path-dep.** `pyproject.toml` declares
  `ttl-quick-viz-conversion = { path = "../conversion", develop = true }`.
  Renaming a re-export in `conversion/src/ttl2json/__init__.py` breaks api
  startup at import time. Run the api after touching `conversion/`.
- **Path-traversal is enforced** in `FilesystemGraphRepository._resolve` and
  `ConversionService.get_ttl` — do not bypass it by reading files directly
  from a route.
- **Edge ids are synthetic** (`"{src}|{pred}|{tgt}|{idx}"`, deterministic per
  source JSON). Don't rely on them matching anything in the raw file.
- **The watcher is best-effort.** If `ConversionWatcher.start()` raises during
  app startup, the lifespan logs the exception and continues without the
  watcher (the app still serves graphs).

## Entry points

`main.py` (at the api/ root) and `src/app/__main__.py` are **equivalent thin
wrappers** over `app.api.app.create_app` + `uvicorn.run`. `main.py` prints a
startup banner; `__main__.py` is the bare `python -m app` form invoked by the
Docker `CMD`. Do not add real logic to either — put it in `create_app` or a
layer module.
