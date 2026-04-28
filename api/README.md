# ttl-quick-viz — api

FastAPI service that serves graph JSON to the `site/` SPA and — when
`INPUT_DIR` is configured — also runs the upstream `ttl2json` conversion on
demand. Five endpoints under `/api`: list, fetch, fetch-source-`.ttl`,
convert-all, rebuild-one, plus `/api/healthz`.

## Quick start

Prerequisites: Python 3.11+, [Poetry](https://python-poetry.org/). Optionally
[uv](https://docs.astral.sh/uv/) to manage Python itself.

```bash
poetry install                   # creates .venv/ in-project; pulls ../conversion as path-dep
cp .env.example .env             # then edit — GRAPHS_DIR, HOST, PORT are required
```

Activate the venv once, then pick whichever run style you prefer:

```bash
source .venv/Scripts/activate    # Git Bash on Windows
# .venv\Scripts\activate         # PowerShell
# source .venv/bin/activate      # macOS / Linux

python main.py                   # plain script (prints a startup banner)
python -m app                    # module form (used by the Dockerfile CMD)
uvicorn main:app --reload        # dev: auto-reload on file change
ttl-viz-api                      # Poetry script entry point
```

All four launch the same FastAPI app. Server listens on
<http://127.0.0.1:8000> by default; OpenAPI docs at `/docs`.

> `main.py` and `src/app/__main__.py` are thin wrappers over
> `app.api.app.create_app`. Choose by taste — `python main.py` if you like a
> top-level script, `python -m app` if you prefer module form, `uvicorn
> main:app --reload` during active development.

## Endpoints

All under `/api`:

| Method | Path                              | Returns                  |
|--------|-----------------------------------|--------------------------|
| GET    | `/healthz`                        | `{"status": "ok"}`       |
| GET    | `/graphs`                         | `list[GraphSummary]`     |
| GET    | `/graphs/{id}`                    | `Graph`                  |
| GET    | `/graphs/{id}/ttl`                | `text/turtle` source     |
| POST   | `/convert?force=false`            | `ConvertResponse`        |
| POST   | `/graphs/{id}/rebuild?force=true` | `GraphConversionResult`  |

Wire-shape models live in `src/app/domain/models.py`:

- `GraphSummary` — `{ id, nodeCount, edgeCount, lastConvertedAt }`
- `Graph` — `{ nodes: GraphNode[], edges: GraphEdge[] }`
  - `GraphNode` — `{ id, label, attrs }`
  - `GraphEdge` — `{ id, source, target, label, attrs }` (synthetic id
    `"{src}|{pred}|{tgt}|{idx}"`)
- `GraphConversionResult` — `{ id, ok, skipped, nodeCount?, edgeCount?, durationMs?, error? }`
- `ConvertResponse` — `{ results: GraphConversionResult[], okCount, errorCount, skippedCount }`

The conversion / TTL endpoints require `INPUT_DIR` to be set. Without it they
return `503 {"detail": "conversion unavailable: INPUT_DIR not configured"}`.

## Layout

```
api/
├── pyproject.toml             # path-dep on ../conversion (ttl-quick-viz-conversion)
├── .env.example               # GRAPHS_DIR, HOST, PORT (required) + INPUT_DIR, ENABLE_WATCHER, …
├── Dockerfile                 # multi-stage; CMD = python -m app
├── main.py                    # thin entry: banner + uvicorn.run(create_app(...))
├── src/app/
│   ├── __main__.py            # equivalent thin entry for `python -m app`
│   ├── config.py              # pydantic-settings Settings + lru-cached get_settings
│   ├── logging.py             # configure_logging(level)
│   ├── api/
│   │   ├── app.py             # create_app: lifespan starts ConversionWatcher when enabled
│   │   ├── deps.py            # get_repository / get_service / get_conversion_service
│   │   ├── errors.py          # exception → JSONResponse mapping
│   │   └── routes/
│   │       ├── graphs.py      # 5 routes (list / fetch / ttl / convert / rebuild)
│   │       └── health.py      # /healthz
│   ├── domain/
│   │   ├── models.py          # pydantic wire-shape models
│   │   └── translate.py       # translate(raw_node_link_data) -> Graph
│   ├── repositories/
│   │   ├── base.py            # GraphRepository Protocol + GraphNotFound
│   │   └── filesystem.py      # FilesystemGraphRepository (mtime-keyed summary cache)
│   └── services/
│       ├── graph_service.py     # list_graphs / get_graph + InvalidGraphId
│       ├── conversion_service.py# rebuild_all / rebuild_one / get_ttl + InputDirNotConfigured, TtlNotFound, InvalidGraphId
│       └── watcher.py           # ConversionWatcher (watchdog + debounced rebuild)
└── tests/
    ├── conftest.py
    ├── test_health.py
    ├── test_repository.py
    ├── test_routes.py
    ├── test_routes_ttl.py
    ├── test_service.py
    └── test_translate.py
```

## Configuration

Loaded by `src/app/config.py` (pydantic-settings). `.env` is read if present;
env vars always win.

| Env var               | Default | Required | Meaning |
|-----------------------|---------|----------|---------|
| `GRAPHS_DIR`          | —       | yes      | Directory scanned for `<id>.json` files. |
| `INPUT_DIR`           | unset   | no       | Directory of `.ttl` sources. Required for `POST /convert`, `POST /graphs/{id}/rebuild`, `GET /graphs/{id}/ttl`, and the watcher. |
| `ENABLE_WATCHER`      | `false` | no       | When true (and `INPUT_DIR` is set), starts a `watchdog` thread on app startup that auto-reconverts on `.ttl` change. |
| `WATCHER_DEBOUNCE_MS` | `2000`  | no       | Per-file debounce window. Editors often write the same file multiple times per save. |
| `HOST`                | —       | yes      | Bind address. |
| `PORT`                | —       | yes      | Bind port. |
| `LOG_LEVEL`           | `INFO`  | no       | stdlib logging level. |

CORS is wide open (`allow_origins=["*"]`) — this is a local dev tool, not a
production service. The site doesn't use a Vite proxy, so dev origins
(`http://localhost:5173`, `http://localhost:4242`, etc.) all work without
configuration.

`get_settings()` is `@lru_cache`d. **In tests, clear it** after mutating env
(`get_settings.cache_clear()`) — `tests/conftest.py` does this automatically
inside the `client` fixture.

## Tests

```bash
source .venv/Scripts/activate    # if not already active
pytest                           # full suite
pytest tests/test_translate.py   # one file
ruff check src tests             # lint
mypy                             # type-check (non-strict, see pyproject.toml)
```

Suite is **flat** under `tests/` — no `unit/` or `integration/` subdirs.
`conftest.py` provides:

- `graphs_dir` — a tmp dir
- `write_graph(name, payload)` — writes `<graphs_dir>/<name>.json`
- `client` — a `TestClient` with `GRAPHS_DIR` monkeypatched and the
  `get_settings` lru_cache cleared.

## Docker

```bash
docker build -t ttl-viz-api .
docker run --rm -p 8000:8000 \
  -e GRAPHS_DIR=/data/graphs \
  -e HOST=0.0.0.0 \
  -e PORT=8000 \
  -v /abs/path/to/graphs:/data/graphs \
  ttl-viz-api
```

Add `-e INPUT_DIR=/data/input -v /abs/path/to/input:/data/input` (and
`-e ENABLE_WATCHER=true` for auto-reconvert) if you want the rebuild / TTL
endpoints inside the container.

## Troubleshooting

- **`poetry install` lands packages in `...\uv\python\...` instead of `.venv/`.**
  `VIRTUAL_ENV` is set to a uv-managed Python install (often by the VSCode
  Python extension). Check with `echo $VIRTUAL_ENV`. Fix by either pointing
  VSCode's interpreter at `.\.venv\Scripts\python.exe` (Command Palette →
  *Python: Select Interpreter*) or `unset VIRTUAL_ENV` before `poetry install`.
- **`poetry: command not found`.** Install as a uv tool so it lands on `PATH`:
  `uv tool install poetry`.
- **Startup fails with a pydantic validation error.** Intentional —
  `GRAPHS_DIR`, `HOST`, and `PORT` are all required, no defaults. Copy
  `.env.example` to `.env` or export them in your shell.
- **`create_app` raises `RuntimeError: GRAPHS_DIR does not exist or is not a
  directory`.** The directory must exist at startup; `create_app` validates it
  before constructing the app.
- **`POST /api/convert` returns 503 `INPUT_DIR not configured`.** Set
  `INPUT_DIR` in `.env` (or unset to disable the rebuild endpoints).
- **Watcher doesn't fire on save.** Editors sometimes write the file via a
  rename; `WATCHER_DEBOUNCE_MS` waits for the dust to settle. Increase the
  value if rebuilds run mid-save and miss the final state.
