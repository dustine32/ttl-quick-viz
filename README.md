# ttl-quick-viz

A local dev tool for visually inspecting property graphs converted from
RDF/Turtle — originally built to unblock manual inspection of GO-CAM and
Reactome `.ttl` files during development.

The pipeline is three small, independent pieces: a Python CLI converts Turtle
to node-link JSON, a FastAPI service serves that JSON, and a React SPA renders
it as an interactive graph. Each piece installs and runs on its own — there is
no root-level tooling, no monorepo workspace, no `docker-compose`.

## Architecture

```
  ┌──────────────┐   JSON files   ┌──────────┐   HTTP (/api/*)   ┌──────────┐
  │  conversion  │ ─────────────► │   api    │ ────────────────► │   site   │
  │  (Python)    │  on filesystem │ (FastAPI)│   Vite dev proxy  │  (React) │
  └──────────────┘                └──────────┘                   └──────────┘
     ttl2json.py                   GET /api/graphs                browser UI
                                   GET /api/graphs/{id}
```

- `conversion/` writes `<id>.json` into `conversion/downloads/output/`.
- `api/` reads that directory (via the `GRAPHS_DIR` env var) and exposes it as
  a read-only HTTP API on port `8000`.
- `site/` is a Vite + React 19 + TypeScript SPA. The Vite dev server proxies
  `/api/*` to `http://localhost:8000`, so in dev you just run both and hit the
  Vite URL.

## Getting started

Each subproject has its own quick-start. Pick them up in order:

1. **[`conversion/`](./conversion/README.md)** — install, point it at your
   `.ttl` files, produce JSON.
2. **[`api/`](./api/README.md)** — install, set `GRAPHS_DIR` to the conversion
   output directory, run the FastAPI service.
3. **[`site/`](./site/README.md)** — install, `npm run dev`, open the browser.

Requirements at a glance: Python 3.11+ and [Poetry](https://python-poetry.org/)
for the two Python subprojects; Node.js (current LTS) and `npm` for the site.

## How the pieces fit together

- **conversion → api**: filesystem handoff. There is no shared Python package
  and no import boundary — `api/` just reads whatever JSON files are in
  `GRAPHS_DIR`. In practice point `GRAPHS_DIR` at
  `conversion/downloads/output/` (or a copy of it).
- **api → site**: HTTP. The graph wire shape is defined by Pydantic models
  under `api/src/app/domain/` and consumed by TypeScript types under
  `site/src/features/graph/`. Changes to the shape must touch both sides.

## Layout

```
ttl-quick-viz/
├── conversion/        # Python CLI (ttl2json.py) — ttl → node-link JSON
├── api/               # FastAPI read-only service over the JSON output
├── site/              # Vite + React 19 + TS SPA
├── .specs/            # design specs (forward-looking)
├── .plans/            # dated implementation plans
├── docs/              # reviews, audits, retrospectives
├── CLAUDE.md          # guidance for Claude Code sessions
└── README.md          # you are here
```

## Notes

- The repository path contains `go\` for historical reasons — **there is no Go
  code here.** The stack is Python + TypeScript.
- `api/` includes a `Dockerfile`; see [`api/README.md`](./api/README.md) for how
  to run the service in a container. `conversion/` and `site/` are run directly
  on the host during development.
