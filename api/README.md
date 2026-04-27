# TTL Quick Viz API

Read-only FastAPI service that serves graph JSON (produced by
`../conversion/ttl2json.py`) to the `site/` SPA.

## Quick start

Prerequisites: Python 3.11+, [Poetry](https://python-poetry.org/). Optionally [uv](https://docs.astral.sh/uv/) to manage Python itself.

```bash
poetry install                   # creates .venv/ in-project
cp .env.example .env             # then edit — GRAPHS_DIR is required
```

Activate the venv once, then pick whichever run style you prefer:

```bash
source .venv/Scripts/activate    # Git Bash on Windows
# .venv\Scripts\activate         # PowerShell
# source .venv/bin/activate      # macOS / Linux

python main.py                   # plain script
python -m app                    # module form (uses src/app/__main__.py)
uvicorn main:app --reload        # dev: auto-reload on file change
ttl-viz-api                      # Poetry script entry point
```

All four launch the same FastAPI app. Server listens on <http://127.0.0.1:8000> by default; OpenAPI docs at `/docs`.

> `main.py` and `src/app/__main__.py` are thin entry points over `app.api.app.create_app`. Choose by taste — `python main.py` if you like a top-level script, `python -m app` if you prefer module form, `uvicorn main:app --reload` during active development.

## Layout

```
api/
├── pyproject.toml
├── .env.example
├── Dockerfile
├── src/app/
│   ├── domain/             # pure business objects + translator
│   ├── repositories/       # IO edge
│   ├── services/           # orchestration, transport-agnostic
│   └── api/                # REST transport (FastAPI)
└── tests/
    ├── unit/
    └── integration/
```

## Endpoints

- `GET /api/graphs` — list available graphs as `[{ id, nodeCount, edgeCount }]`.
- `GET /api/graphs/{id}` — one graph as `{ nodes, edges }`.
- `GET /api/healthz` — liveness probe.

## Configuration

| Env var | Default | Required | Meaning |
|---|---|---|---|
| `GRAPHS_DIR` | — | yes | Directory scanned for `<id>.json` files. |
| `HOST` | — | yes | Bind address. |
| `PORT` | — | yes | Bind port. |
| `LOG_LEVEL` | `INFO` | no | stdlib logging level. |

CORS is open to all origins — this is a local dev tool, not a production service.

Settings load from `.env` if present; env vars override.

## Tests

```bash
source .venv/Scripts/activate    # if not already active
pytest                           # full suite
pytest tests/test_translate.py   # one file
```

Suite lives under `tests/` (flat — `conftest.py`, `test_routes.py`, `test_store.py`, `test_translate.py`). `ruff check src tests` lints; `mypy` type-checks.

## Docker

```bash
docker build -t ttl-viz-api .
docker run --rm -p 8000:8000 \
  -e GRAPHS_DIR=/data/graphs \
  -e HOST=0.0.0.0 \
  -v /abs/path/to/graphs:/data/graphs \
  ttl-viz-api
```

## Troubleshooting

- **`poetry install` lands packages in `...\uv\python\...` instead of `.venv/`.** Your shell has `VIRTUAL_ENV` set to a uv-managed Python install directory (often set by the VSCode Python extension). Check with `echo $VIRTUAL_ENV`. Fix by either pointing VSCode's interpreter at `.\.venv\Scripts\python.exe` (Command Palette → *Python: Select Interpreter*) or running `unset VIRTUAL_ENV` before `poetry install`.
- **`poetry: command not found`.** Install as a uv tool so it lands on `PATH`: `uv tool install poetry`.
- **Startup fails with a pydantic validation error.** Intentional — `GRAPHS_DIR`, `HOST`, and `PORT` are all required, no defaults. Copy `.env.example` to `.env` or export them in your shell.
