# CLAUDE.md — ttl-quick-viz (repo root)

Local dev tool for visually inspecting property graphs converted from RDF/Turtle
(GO-CAM / Reactome / pathways2GO output). **Three sibling subprojects**, not a
monorepo workspace:

- `conversion/` — Python package `ttl2json` (CLI entry `ttl-viz-convert`,
  importable API `convert_file` / `convert_dir` / `ConversionResult`). Reads
  `.ttl`, writes node-link JSON to `conversion/downloads/output/`. Source under
  `src/ttl2json/` (`core.py`, `cli.py`).
- `api/` — FastAPI service. Reads `GRAPHS_DIR`, optionally re-runs conversion
  via the `ttl2json` path-dep (`POST /api/convert`,
  `POST /api/graphs/{id}/rebuild`), and optionally watches `INPUT_DIR` with
  `watchdog` when `ENABLE_WATCHER=true`. Endpoints listed in `api/CLAUDE.md`.
- `site/` — Vite + React 19 + TS SPA. Redux Toolkit + RTK Query; **seven**
  renderers (`xyflow | cytoscape | force | force3d | sigma | graphin | tree`)
  selectable from the toolbar; bottom **TTL source pane** synced to selection.
  Browser hits the api directly via `VITE_API_URL` (default
  `http://localhost:8000/api`) — **no Vite proxy.**

Pipeline: `conversion` → filesystem JSON (`GRAPHS_DIR`) → `api` (HTTP, CORS=*) → `site`.
Conversion can also be triggered through the api (which imports `ttl2json`) so
the site has a "Rebuild all" affordance (`Shift+R` / toolbar More menu).

## Authority: per-subproject CLAUDE.md wins

When working **inside** a subproject, `api/CLAUDE.md`, `conversion/CLAUDE.md`,
and `site/CLAUDE.md` are authoritative for that subtree. This file is only for
cross-cutting concerns.

## Cross-cutting invariants

- **No root tooling.** No root `package.json`, `Makefile`, `docker-compose`, or
  workspace config. Each subproject installs and runs independently. Do not
  fabricate root-level commands.
- **Wire-shape changes are multi-subproject changes.** The graph JSON shape is
  produced by `conversion/src/ttl2json/core.py` (`build_graph` →
  `node_link_data`), normalized in `api/src/app/domain/translate.py` into
  `api/src/app/domain/models.py` (`Graph`, `GraphNode`, `GraphEdge`,
  `GraphSummary`, `GraphConversionResult`, `ConvertResponse`), and consumed by
  `site/src/features/graph/types.ts`. Any change to one requires coordinated
  edits across all three — otherwise the site breaks at runtime.
- **`api/` imports `conversion/` as a path-dep.** See `api/pyproject.toml`
  (`ttl-quick-viz-conversion = { path = "../conversion", develop = true }`).
  Renaming a public symbol in `conversion/src/ttl2json/__init__.py` breaks the
  api. The conversion → api filesystem handoff still exists too: `GRAPHS_DIR`
  must point at (or be a copy of) `conversion/downloads/output/`.
- **CORS is wide open (`allow_origins=["*"]`).** This is a local dev tool, not
  a production service. Don't tighten CORS in dev — the site doesn't proxy and
  ports vary.
- **Python: 3.11+, Poetry, in-project `.venv/`.** `poetry.toml` is committed in
  each Python subproject to force `virtualenvs.in-project = true`. Activate the
  venv directly (`source .venv/Scripts/activate`) rather than using `poetry run`
  — pyenv/uv shims interfere otherwise. If `poetry install` lands packages in a
  uv Python path, `VIRTUAL_ENV` is set by VSCode; unset it or select `.venv/`
  as the interpreter first.

## Repo conventions

- `.plans/` — dated implementation plans (markdown). `.plans/feature/` and
  `.plans/refactor/` for in-flight work; `.plans/template.md` is the starting
  shape.
- `.specs/` — design specs (markdown). Forward-looking.
- `docs/` — reviews, audits, retrospectives, and the developer guides
  (`dev-guide-react.md`, `dev-guide-fastapi.md`, `structure-review.md`,
  retros). Keep **distinct** from `.specs/` — don't mix design docs into
  `docs/` or audits into `.specs/`.
- Commit messages: **no** `Co-Authored-By: Claude` trailer. Plain messages only.
- The `go\` in the repo path (`C:\work\go\ttl-quick-viz\`) is a filesystem
  artifact — this repo has **no Go code**. It's Python + TypeScript.

## Developer onboarding guides

Authoritative "how we build here" references for new contributors. Per-subproject
`CLAUDE.md` files still win for tree-local concerns; these are the deeper guides.

- [docs/dev-guide-react.md](docs/dev-guide-react.md) — React / `site/` best
  practices: feature-first layout, Mantine vs Tailwind split, Redux Toolkit,
  RTK Query, nonce pattern, testing.
- [docs/dev-guide-fastapi.md](docs/dev-guide-fastapi.md) — FastAPI / `api/`
  best practices: layered architecture (domain → repositories → services →
  api), pydantic config, error taxonomy, testing.
- [docs/structure-review.md](docs/structure-review.md) — overview of how the
  three subprojects coordinate.

## Where to look first

- Graph JSON shape: `conversion/src/ttl2json/core.py` (producer) ↔
  `api/src/app/domain/models.py` + `domain/translate.py` (normalizer) ↔
  `site/src/features/graph/types.ts` (consumer).
- Conversion API: `conversion/src/ttl2json/__init__.py` re-exports
  `convert_file`, `convert_dir`, `ConversionResult`, `build_graph`,
  `graph_to_json`, `needs_update`.
- Conversion CLI: `conversion/src/ttl2json/cli.py` (entry point
  `ttl-viz-convert`; exit codes 0/1/2).
- API entry: `api/src/app/api/app.py::create_app` (lifespan starts/stops
  `ConversionWatcher` when `enable_watcher=True`).
- API routes: `api/src/app/api/routes/graphs.py` and `routes/health.py`.
- Site root wiring: `site/src/main.tsx` → `App.tsx` (renderer switch is a
  7-way `if` cascade on `state.graph.renderer`).
- Site shell: `site/src/layout/AppShell.tsx` (`react-resizable-panels`,
  vertical: upper + bottom-TTL-pane; horizontal: left + main + right) and
  `Toolbar.tsx` (renderer `Select`, standalone-mode `SegmentedControl`,
  layout picker, More menu with Rebuild-all + Copy link).
