# Task: Restructure api/ into a layered Poetry-managed package

**Status:** ACTIVE
**Issue:** —
**Branch:** init-feel

## Goal
Restructure `api/` from a flat layout into a layered package (`domain → repositories → services → transports`) shipped with a Dockerfile, keeping tests green and the site working at every checkpoint.

## Context
- **Spec:** `.specs/2026-04-23-api-restructure-design.md` (single source of truth for shapes, signatures, and test content)
- **Related files:** `api/src/app/*.py`, `api/tests/*.py`, `api/pyproject.toml`, `site/vite.config.ts`
- **Triggered by:** structure review — flat layout blocks adding a second transport. Also fixes deprecated `on_event`, `sys.exit` inside a handler, regex-only traversal guard, `GET /graphs` re-parsing every file per call, and the missing `/api` route prefix.

## Current State
- **What works now:** Poetry scaffold (`pyproject.toml`, `poetry.toml` with in-project venv), `src/app/` layout, full test suite passing. Phases 1–2 below are complete.
- **What's broken/missing:** no layer boundaries — FastAPI, IO, and business logic are tangled; no `/api` route prefix; no `.env.example`; no Dockerfile; `graphs_dir` has a hard-coded default coupling the API to `conversion/`; `GET /graphs` re-parses every file on every request.

## Steps

> Each phase ends at a **Checkpoint** for the owner's manual commit. Green signal between phases is `poetry run pytest`.

### Phase 1: Poetry scaffold + tooling — DONE
- [x] `pyproject.toml` with Poetry, Ruff, mypy, pytest config
- [x] `poetry.toml` pinning in-project venv (`.venv/` inside `api/`)
- [x] `requirements*.txt` removed; console script `ttl-viz-api` wired

### Phase 2: `src/` layout — DONE
- [x] Package relocated to `api/src/app/`
- [x] Poetry `packages = [{ include = "app", from = "src" }]`

### Phase 3: Extract `domain/` (pure layer) — DONE
- [x] Move `schemas.py` → `domain/models.py`, `translate.py` → `domain/translate.py`
- [x] Update `routes.py` imports to the new module paths
- [ ] Relocate translator test into `tests/unit/` — deferred (tests later)

### Phase 4: Extract `repositories/` (IO edge, with hardening + cache) — DONE
- [x] Split `store.py` → `repositories/base.py` (`GraphRepository` Protocol + `GraphNotFound`) and `repositories/filesystem.py`
- [x] Harden `FilesystemGraphRepository`: UTF-8 reads, `resolve()`-based traversal guard, mtime-keyed summary cache exposed as `count()`
- [x] Wire `routes.py` to the repository; `GET /graphs` uses `count()` instead of re-parsing
- [ ] Migrate + expand store tests — deferred (tests later)

### Phase 5: Introduce `services/` (orchestration) — DONE
- [x] Create `GraphService` with `list_graphs()` / `get_graph(id)`; move id validation (regex + `..` guard) here as an `InvalidGraphId` exception
- [x] Thin `routes.py` to delegate to `GraphService`
- [ ] Add `tests/unit/test_graph_service.py` — deferred (tests later)

### Phase 6: Refactor transport into `api/` module — DONE
- [x] Build `api/app.py::create_app()` factory with lifespan; validate `graphs_dir` **before** `FastAPI()` is constructed (no `sys.exit` in a handler)
- [x] Centralize domain-exception → HTTP mapping in `api/errors.py`
- [x] Split routes: `api/routes/health.py`, `api/routes/graphs.py`; mount both with `prefix="/api"`
- [x] Move DI into `api/deps.py` (repository + service providers)
- [x] Add `logging.py` (`configure_logging`) and `__main__.py` entry point; point `[tool.poetry.scripts]` at it
- [x] Expand `config.py` with `host`, `port`, `log_level`
- [x] Remove old `main.py` + `routes.py`
- [ ] Migrate integration tests — deferred (tests later)

### Phase 7: Require `GRAPHS_DIR` + docs — DONE
- [x] Drop default from `Settings.graphs_dir` (severs hard-coded coupling to `conversion/`)
- [x] Ship `api/.env.example` and rewrite `api/README.md` to match the new run loop

### Phase 8: Site — drop Vite proxy `rewrite` — DONE
- [x] `site/vite.config.ts`: `'/api': 'http://localhost:8000'` pass-through (no `rewrite`)

### Phase 9: `Dockerfile` + `.dockerignore` — DONE
- [x] Multi-stage Dockerfile — builder installs deps via Poetry; runtime copies `.venv` + `src/`, runs non-root, `CMD ["python", "-m", "app"]`
- [x] `.dockerignore` excluding `.venv`, caches, `tests/`, `.env*` (keep `.env.example`)

### Phase 10: Final verification
- [ ] `poetry run pytest`, `ruff check src tests`, `mypy src` all clean
- [ ] AST check: `domain/`, `repositories/`, `services/` contain zero `fastapi` imports
- [ ] End-to-end browser smoke with real graphs
- [ ] File layout matches the spec's tree

## Recovery Checkpoint

> **⚠ UPDATE THIS AFTER EVERY CHANGE**

- **Last completed action:** Phases 3–9 feature code in place (domain, repositories, services, api transport, Dockerfile, `.env.example`, README, Vite proxy). Test migration skipped at user's direction — old flat tests under `api/tests/` still reference removed modules and will fail `pytest` until rewritten.
- **Next immediate action:** Phase 10 verification once tests are rewritten; or start fresh tests under `tests/unit/` + `tests/integration/`.
- **Recent commands run:**
  - `poetry install`
- **Uncommitted changes:** new `api/pyproject.toml`, `api/poetry.toml`, `api/Dockerfile`, `api/.dockerignore`, `api/.env.example`, `api/README.md`, `api/src/app/**`; old flat `api/app/*.py` deleted; `site/vite.config.ts` modified.
- **Environment state:** `.venv/` at `api/.venv/`; `GRAPHS_DIR` must be set (no default).

## Failed Approaches
<!-- Fill in as execution surfaces problems. -->

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `api/pyproject.toml`, `api/poetry.toml`, `api/poetry.lock` | create | done |
| `api/requirements.txt`, `api/requirements-dev.txt` | delete | done |
| `api/src/app/*` | relocate from flat to src layout | done |
| `api/src/app/domain/{models,translate}.py` | create | done |
| `api/src/app/repositories/{base,filesystem}.py` | create | done |
| `api/src/app/services/graph_service.py` | create | done |
| `api/src/app/api/{app,deps,errors}.py` + `api/routes/{graphs,health}.py` | create | done |
| `api/src/app/logging.py`, `api/src/app/__main__.py` | create | done |
| `api/src/app/{main,routes,store,schemas,translate}.py` | delete (after moves) | done |
| `api/src/app/config.py` | modify (add host/port/log_level; drop `graphs_dir` default) | done |
| `api/tests/` | restructure into `unit/` + `integration/` | deferred (tests later) |
| `api/.env.example`, `api/Dockerfile`, `api/.dockerignore`, `api/README.md` | create / rewrite | done |
| `site/vite.config.ts` | modify (drop proxy `rewrite`) | done |

## Blockers
- None currently

## Notes
- **Layer invariant:** `domain/`, `repositories/`, `services/` must not import from `fastapi`. Enforced by the AST check in Phase 10.
- **Breaking change:** the `GRAPHS_DIR` default is removed in Phase 7. `.env.example` is the local-dev migration path.
- `GraphRepository` is a `Protocol`, so `S3GraphRepository` / `PostgresGraphRepository` can drop in without touching the service layer.
- Routes mount under `/api/*` so the Vite proxy collapses to a pass-through — dev and prod agree on URLs.
- Id validation lives in the service (not the transport), so a future GraphQL/CLI transport picks it up for free.
- `FilesystemGraphRepository.count()` caches `(mtime, nodes, edges)` per id; `GET /api/graphs` no longer re-parses unchanged files.

## Lessons Learned
<!-- Fill in during and after execution. -->

## Additional Context (Claude)
- The design rationale lives in `.specs/2026-04-23-api-restructure-design.md` — consult it for signatures, concrete test fixtures, and the "why" behind each phase. This plan is the step ledger; the spec is the argument.
- **Non-goals for this work:** no auth, no CORS, no database, no CI, no new transports, no `conversion/` changes. The layout *enables* those; they are not added here.
- **Deferred design notes from the spec:** Pydantic camelCase via `Field(alias=...)`, sync-vs-async handlers, `/v1` versioning — none block this restructure.
