# ttl-quick-viz

Local dev tool for visually inspecting property graphs converted from RDF/Turtle
— originally built to unblock manual inspection of GO-CAM and Reactome `.ttl`
files (and to give the [pathways2GO](https://github.com/geneontology/pathways2go)
converter a fast feedback loop).

The pipeline is three small, independent pieces: a Python package converts
Turtle to node-link JSON, a FastAPI service serves that JSON (and can re-run
the conversion on demand), and a React SPA renders it as an interactive graph
across **seven interchangeable renderers** with a live TTL source pane.

Each piece installs and runs on its own — no root-level tooling, no monorepo
workspace, no `docker-compose`.

## Architecture

```
  ┌──────────────┐                ┌────────────┐                ┌──────────┐
  │  conversion  │   reads /      │    api     │   HTTP /api/*  │   site   │
  │   (Python    │   writes JSON  │  (FastAPI) │ ──────────────►│  (React) │
  │   package)   │ ──────────────►│            │     CORS       │          │
  └──────────────┘  filesystem    └────────────┘                └──────────┘
   ttl2json pkg     handoff via    list / fetch graphs           7 renderers
   ttl-viz-convert  GRAPHS_DIR     rebuild on demand             + TTL pane
                                   serve raw .ttl
```

- `conversion/` writes `<id>.json` into `conversion/downloads/output/`.
- `api/` reads that directory (via `GRAPHS_DIR`), and — when `INPUT_DIR` is set
  — can re-run conversion through `POST /api/convert` and
  `POST /api/graphs/{id}/rebuild`. With `ENABLE_WATCHER=true` it watches
  `INPUT_DIR` for `.ttl` changes and reconverts in the background.
- `api/` also imports the `ttl2json` package directly (path-dep in
  `api/pyproject.toml`) so rebuild endpoints don't shell out.
- `site/` is a Vite + React 19 + TypeScript SPA. The browser hits the api
  directly using `VITE_API_URL` — no Vite proxy. CORS is wide open in dev.

## Getting started

Each subproject has its own quick-start. Pick them up in order:

1. **[`conversion/`](./conversion/README.md)** — install, drop `.ttl` files in
   `downloads/input/`, run `ttl-viz-convert downloads/input/ -o downloads/output/`.
2. **[`api/`](./api/README.md)** — install, copy `.env.example` → `.env`
   (`GRAPHS_DIR`, `HOST`, `PORT` are required), run the server.
3. **[`site/`](./site/README.md)** — `npm install`, copy `.env.example` → `.env`
   if defaults don't fit, `npm run dev`, open the browser.

Requirements: Python 3.11+ and [Poetry](https://python-poetry.org/) for the two
Python subprojects; Node.js (current LTS) and `npm` for the site.

## How the pieces fit together

- **conversion → api (filesystem + import).** The api both reads the JSON
  output directory **and** imports the `ttl2json` package. Wire-shape JSON
  travels via `GRAPHS_DIR`; the rebuild endpoints call `convert_file` /
  `convert_dir` directly using `INPUT_DIR`.
- **api → site (HTTP).** The graph wire shape is defined by Pydantic models
  under `api/src/app/domain/models.py` and consumed by TypeScript types under
  `site/src/features/graph/types.ts`. Any change to the shape touches **both**
  sides, plus the upstream `conversion/` JSON producer if the change starts
  there.

## Renderers, panels, and shortcuts (site)

The SPA ships seven graph renderers selectable from the toolbar:

| Renderer       | Library                                          |
|----------------|--------------------------------------------------|
| React Flow     | `@xyflow/react` + `elkjs` (default)              |
| Cytoscape      | `cytoscape` + cola/dagre/fcose/cose-bilkent…     |
| Force 2D       | `react-force-graph-2d`                           |
| Force 3D       | `react-force-graph-3d`                           |
| Sigma (WebGL)  | `@react-sigma/core` + `graphology`               |
| Graphin (G6)   | `@antv/graphin`                                  |
| Tree / MindMap | custom (`features/graph-tree/`)                  |

Layout: header toolbar, collapsible left panel (graph list), collapsible right
panel (inspector), collapsible **bottom panel** with a syntax-highlighted TTL
source viewer, and a footer status bar.

Hotkeys: `Ctrl+B` left panel · `Ctrl+Alt+B` right panel · `Ctrl+J` bottom
(TTL) panel · `Ctrl+K` command palette · `F` fit view · `R` re-run layout ·
`Shift+R` rebuild all graphs · `Esc` clear selection.

## Layout

```
ttl-quick-viz/
├── conversion/        # Python package (ttl2json) — ttl → node-link JSON
├── api/               # FastAPI service: list / fetch / rebuild / watch
├── site/              # Vite + React 19 + TS SPA (7 renderers + TTL pane)
├── .specs/            # design specs (forward-looking)
├── .plans/            # dated implementation plans
├── docs/              # reviews, audits, retrospectives, dev guides
├── CLAUDE.md          # cross-cutting guidance for Claude Code sessions
└── README.md          # you are here
```

## Notes

- The repository path contains `go\` for historical reasons — **there is no Go
  code here.** The stack is Python + TypeScript.
- `api/` includes a `Dockerfile`; see [`api/README.md`](./api/README.md) for
  container usage. `conversion/` and `site/` are run directly on the host
  during development.
- The bundled fixtures under `conversion/downloads/input/` are real Reactome
  `.ttl` files used as integration snapshots; the matching JSONs live in
  `conversion/downloads/output/`. Either re-run conversion or point
  `GRAPHS_DIR` straight at `output/` to get the api going without doing any
  conversion of your own.
