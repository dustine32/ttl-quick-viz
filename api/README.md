# TTL Quick Viz API

Read-only FastAPI service that serves graph JSON (produced by
`../conversion/ttl2json.py`) to the `site/` SPA.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

OpenAPI docs: http://localhost:8000/docs

## Endpoints

- `GET /graphs` — list available graphs as `[{ id, nodeCount, edgeCount }]`.
- `GET /graphs/{id}` — return one graph as `{ nodes, edges }` (translated into the site's shape).
- `GET /healthz` — liveness probe.

## Config

| Env var | Default | Meaning |
|---|---|---|
| `GRAPHS_DIR` | `../conversion/downloads/output` | Directory scanned for `<id>.json` files. |

## Test

```bash
pytest -v
```
