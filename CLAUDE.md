# CLAUDE.md — ttl-quick-viz (repo root)

Local dev tool for visually inspecting property graphs converted from RDF/Turtle
(GO-CAM / Reactome). **Three sibling subprojects**, not a monorepo workspace:

- `conversion/` — Python CLI (`ttl2json.py`). Reads `.ttl`, writes node-link JSON
  to `conversion/downloads/output/`.
- `api/` — FastAPI service. Reads that output dir, serves `GET /api/graphs` and
  `GET /api/graphs/{id}`. Reads `GRAPHS_DIR` env var.
- `site/` — Vite + React 19 + TS SPA. Redux Toolkit + RTK Query hits `/api/*`
  through a Vite dev proxy (target `http://localhost:8000`).

Pipeline: `conversion` → filesystem JSON → `api` (HTTP) → `site`.

## Authority: per-subproject CLAUDE.md wins

When working **inside** a subproject, `api/CLAUDE.md`, `conversion/CLAUDE.md`,
and `site/CLAUDE.md` are authoritative for that subtree. This file is only for
cross-cutting concerns.

## Cross-cutting invariants

- **No root tooling.** No root `package.json`, `Makefile`, `docker-compose`, or
  workspace config. Each subproject installs and runs independently. Do not
  fabricate root-level commands.
- **Wire-shape changes are two-subproject changes.** The graph JSON shape is
  defined by `api/src/app/domain/` (schemas + translator) and consumed by
  `site/src/features/graph/types.ts`. Any change to one requires a coordinated
  edit in the other — otherwise the site breaks at runtime. Verify exact paths
  when touching these.
- **Conversion → api handoff is filesystem-based.** `api`'s `GRAPHS_DIR` must
  point at (or be a copy of) `conversion/downloads/output/`. No shared import —
  `conversion/` has no `__init__.py` and is not a package.
- **Python: 3.11+, Poetry, in-project `.venv/`.** `poetry.toml` is committed in
  each Python subproject to force `virtualenvs.in-project = true`. Activate the
  venv directly (`source .venv/Scripts/activate`) rather than using `poetry run`
  — pyenv/uv shims can interfere otherwise. If `poetry install` lands packages
  in a uv Python path, `VIRTUAL_ENV` is set by VSCode; unset it or select
  `.venv/` as the interpreter first.

## Repo conventions

- `.plans/` — dated implementation plans (markdown).
- `.specs/` — design specs (markdown). Forward-looking.
- `docs/` — reviews, audits, retrospectives, and developer guides. Keep
  **distinct** from `.specs/` — don't mix design docs into `docs/` or
  audits into `.specs/`.
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

## Where to look first

- Graph JSON shape: `api/src/app/domain/` ↔ `site/src/features/graph/types.ts`
- Conversion entry: `conversion/ttl2json.py` (single file, no package)
- API entry: `api/src/app/api/app.py::create_app`
- Site renderers: `site/src/features/graph/` (React Flow + elkjs) and
  `site/src/features/graph-cytoscape/` (Cytoscape) — coexisting; a header
  SegmentedControl toggles between them.
