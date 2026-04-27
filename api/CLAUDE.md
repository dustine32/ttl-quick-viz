# api/ — engineering guidance

Read-only FastAPI service that scans a directory of `node_link_data`-style graph
JSON files (produced by `../conversion/ttl2json.py`) and serves them to the
`site/` SPA. Three endpoints, all under `/api`: `GET /graphs` (list),
`GET /graphs/{id}` (one), `GET /healthz`. No writes, no database.

> **Developer guide:** See [`../docs/dev-guide-fastapi.md`](../docs/dev-guide-fastapi.md)
> for the deeper "how we build here" — layered architecture rules, pydantic
> config, error taxonomy, testing patterns, and a worked "add an endpoint"
> example. This file is the quick repo map; that file is the onboarding read.

## Layer map

Source lives under `src/app/`. Respect the direction of dependencies:
`api → services → repositories → domain` (and `api → domain` for response models).

- `domain/` — pure business objects and the wire-shape translator.
  - `models.py` — `Graph`, `GraphNode`, `GraphEdge`, `GraphSummary` (pydantic, `extra="forbid"`). **This is the wire shape.**
  - `translate.py` — `translate(raw: dict) -> Graph` folds raw `node_link_data` JSON into the domain model.
  - **Rules:** no IO, no FastAPI imports, no logging side effects.
- `repositories/` — the IO edge. Only layer that touches the filesystem.
  - `base.py` — `GraphRepository` Protocol + `GraphNotFound`.
  - `filesystem.py` — `FilesystemGraphRepository` reads `<graphs_dir>/<id>.json`, has a mtime-keyed summary cache, and blocks path traversal in `_resolve`.
- `services/` — orchestration, transport-agnostic.
  - `graph_service.py` — `GraphService` validates ids (`^[A-Za-z0-9_.-]+$`, no `..`), calls the repo, invokes the translator. Raises `InvalidGraphId`. Skips malformed graphs on list.
  - **Rules:** no `Request`/`Response`, no FastAPI. Takes a `GraphRepository` Protocol.
- `api/` — REST transport. Only layer that imports FastAPI.
  - `app.py` — `create_app(settings)` factory. Validates `graphs_dir` exists, registers handlers, mounts routers under `/api`.
  - `deps.py` — `get_repository`, `get_service` DI wiring.
  - `errors.py` — maps `GraphNotFound → 404`, `InvalidGraphId → 400`, `JSONDecodeError`/`ValueError → 500`.
  - `routes/graphs.py`, `routes/health.py` — thin routers; delegate to the service.

## Adding a new endpoint

Walk the layers in order. Do not skip a layer.

1. **domain/** — add/extend a pydantic model in `models.py` if the response shape is new. Extend `translate.py` if the raw-JSON mapping changes.
2. **repositories/** — add a method to the `GraphRepository` Protocol and implement it on `FilesystemGraphRepository` if new data needs to be read.
3. **services/** — add a method on `GraphService` that orchestrates repo + translator. Raise domain exceptions, not `HTTPException`.
4. **api/** — add the route in `src/app/api/routes/`, include it in `app.py`, and map any new exceptions in `errors.py`.

## Common commands

Activate the venv once per shell — **do not use `poetry run`** (pyenv shims break it).

```bash
source .venv/Scripts/activate   # Git Bash on Windows; .venv\Scripts\activate in PowerShell; .venv/bin/activate on *nix

poetry install                  # install/refresh deps (venv must be active or unset VIRTUAL_ENV first)
python main.py                  # run dev server
python -m app                   # equivalent module form
uvicorn main:app --reload       # auto-reload during development
ttl-viz-api                     # Poetry script alias (= app.__main__:run)
pytest                          # run the test suite
ruff check src tests            # lint
mypy                            # type-check (non-strict, see pyproject.toml)

docker build -t ttl-viz-api .   # build runtime image
```

## Testing

- Framework: `pytest` + `httpx` + `fastapi.testclient`.
- Layout: **flat** under `tests/` (no `unit/` or `integration/` subdirs despite what older docs may say).
- `conftest.py` provides `graphs_dir` (tmp dir), `write_graph` (writes a `<name>.json`), and `client` (a `TestClient` with `GRAPHS_DIR` monkeypatched and the `get_settings` lru_cache cleared).
- Heads-up: several test files were written against an older module layout and currently reference paths like `app.store`, `app.translate`, `app.main` that no longer exist. If you run the suite and see `ModuleNotFoundError`, those imports need to be rewritten to target `app.repositories.filesystem`, `app.domain.translate`, and the real `create_app` wiring — and route tests need the `/api` prefix.

## Config

- `src/app/config.py` — pydantic-settings `Settings` loads `.env` if present; env vars always win. Cached via `lru_cache` on `get_settings()` — **clear the cache in tests** (`get_settings.cache_clear()`) after mutating env.
- `GRAPHS_DIR` is required. `create_app` refuses to start if the path does not exist or is not a directory.
- `HOST` and `PORT` are also required — no defaults. The app refuses to start without them. `.env.example` lists working dev values; copy it to `.env` or export them in the shell. `LOG_LEVEL` defaults to `INFO`. CORS allows all origins — local dev tool, not a setting.

## Gotchas

- **Won't start without `GRAPHS_DIR`** pointing at an existing directory — pydantic raises before the app is built.
- **VSCode `VIRTUAL_ENV` trap.** The Python extension auto-activates a uv-managed base Python via `VIRTUAL_ENV`, which makes `poetry install` drop packages into `...\uv\python\...` instead of `.venv/`. Symptom: imports resolve outside the project venv and `.venv/` is missing or stale. Fix: `unset VIRTUAL_ENV` before `poetry install`, or point the VSCode interpreter at `.\.venv\Scripts\python.exe`.
- **Wire-shape changes are cross-cutting.** `domain/models.py` and `domain/translate.py` define what the SPA receives. Any field rename or addition needs a coordinated edit in `site/src/features/graph/types.ts` (and whatever consumes it).
- **Path-traversal is enforced in `FilesystemGraphRepository._resolve`** — do not bypass it by reading files directly from a route.
- **Edge ids are synthetic** (`"{src}|{pred}|{tgt}|{idx}"`, deterministic per source JSON). Don't rely on them matching anything in the raw file.

## Entry points

`main.py` (at the api/ root) and `src/app/__main__.py` are **equivalent thin wrappers** over `app.api.app.create_app` + `uvicorn.run`. `main.py` prints a startup banner; `__main__.py` is the bare `python -m app` form invoked by the Docker `CMD`. Do not add real logic to either — put it in `create_app` or a layer module.
