# Task: Rebuild button in UI + api-side file watcher

**Status:** ACTIVE
**Issue:** —
**Branch:** init-feel (or new branch once started)

## Goal

Close the "edit ttl → see updated graph" loop two ways:

1. **Button (A):** a toolbar button in the SPA that triggers conversion via the api and refreshes the view.
2. **Watcher (B):** api-side file watcher that auto-runs conversion when `.ttl` files in the input dir change; SPA picks up the new data by refetching on window focus.

"Done" = user edits `R-HSA-xxx.ttl`, hits Rebuild (or just switches back to the browser tab) and sees the new graph, with errors visible if conversion fails.

## Context

- **Related files (api):**
  - `api/src/app/api/routes/graphs.py` — add new POST routes here
  - `api/src/app/api/app.py` — register watcher on startup
  - `api/src/app/services/graph_service.py` — add conversion orchestration method
  - `api/src/app/repositories/filesystem.py` — may need an input-dir aware variant
  - `api/src/app/core/config.py` (or wherever settings live) — add `INPUT_DIR` setting
  - `api/pyproject.toml` — add `watchdog` dep (for B)
- **Related files (conversion):**
  - `conversion/ttl2json.py` — current script, needs repackaging so api can `import` it
  - `conversion/pyproject.toml` — script entry + package metadata
- **Related files (site):**
  - `site/src/features/graph/graphApi.ts` — add `POST` mutation(s), cache invalidation tags
  - `site/src/layout/Toolbar.tsx` — add the Rebuild button
  - `site/src/features/ui/uiSlice.ts` — possibly a `conversionStatus` field (idle/running/error)
  - `site/src/app/store.ts` — RTK Query `refetchOnFocus` + `refetchOnReconnect` setup
- **Triggered by:** user wants an "inspect while editing" loop; review in `docs/2026-04-24-app-review.md` and design in `docs/2026-04-24-dev-loop-design.md`.
- **Precondition:** `ttl2json.py` is currently a single script with no package layout, so it's not importable. Phase 1 repackages it.

## Current State

### What works now
- Conversion is a standalone CLI (`ttl-viz-convert`, `python ttl2json.py`) run manually.
- Api reads pre-converted `.json` from `GRAPHS_DIR`; has no idea the source `.ttl` exists.
- SPA has no trigger for conversion. Refresh only picks up new data if the user manually re-runs the CLI.

### What's broken/missing
- No import seam into the conversion logic from the api.
- No mutation endpoint on the api.
- No button in the SPA.
- No watcher.
- No user-visible error surface when conversion fails.

## Steps

### Phase 1: Package `ttl2json` so it's importable

- [ ] Restructure `conversion/` to a package layout:
  - `conversion/src/ttl2json/__init__.py` — exports `convert_file(input_path, output_dir, force=False) -> ConversionResult`, `convert_dir(input_dir, output_dir, force=False) -> list[ConversionResult]`
  - `conversion/src/ttl2json/core.py` — move the RDF parsing + `nx.node_link_data` serialization logic out of the script
  - `conversion/src/ttl2json/cli.py` — keep argparse CLI, calls into `core`
- [ ] Update `conversion/pyproject.toml`:
  - `packages = [{ include = "ttl2json", from = "src" }]`
  - Keep `ttl-viz-convert = "ttl2json.cli:main"` entry point
- [ ] Define a `ConversionResult` dataclass: `{ id, ok, input_path, output_path, error, node_count, edge_count }`.
- [ ] Sanity: `poetry install && ttl-viz-convert downloads/input -o downloads/output` still works.
- [ ] Add a smoke test: `from ttl2json import convert_file` + run on a fixture.

**Checkpoint:** CLI still works, `convert_file` importable from Python repl.

### Phase 2: Add conversion service + endpoints in api

- [ ] Add `INPUT_DIR` to settings (`api/src/app/core/config.py` — or equivalent). Required when conversion endpoints are enabled; otherwise optional. Default to `../conversion/downloads/input` resolved relative to `GRAPHS_DIR`'s parent (or make it fully required).
- [ ] Add `conversion` dep in `api/pyproject.toml`: `ttl2json = { path = "../conversion", develop = true }` (Poetry path dep). Confirm this works with Docker — may need to adjust Dockerfile to copy `conversion/` too.
- [ ] New service method in `graph_service.py`:
  - `rebuild_all() -> list[ConversionResult]` — converts every `.ttl` in `INPUT_DIR`.
  - `rebuild_one(graph_id) -> ConversionResult` — converts `<graph_id>.ttl` → `<graph_id>.json`.
  - Both delegate to `ttl2json.convert_file` / `convert_dir`.
- [ ] New routes in `api/src/app/api/routes/graphs.py`:
  - `POST /api/convert` → rebuild all. Returns `{ results: [ConversionResult], ok_count, error_count }`.
  - `POST /api/graphs/{graph_id}/rebuild` → rebuild one. 404 if no matching `.ttl`; 200 with the result otherwise.
  - Both validate `graph_id` the same way GET does (path traversal guard).
- [ ] Invalidate the repository's summary cache after a successful rebuild (if the caching fix from the review is in place; otherwise add a minimal cache-clear hook).
- [ ] Return `422` on validation errors, `500` with a generic message on unexpected, detailed per-file errors inside the 200 result body.

**Checkpoint:** `curl -X POST localhost:8000/api/convert` rebuilds all graphs; `GET /api/graphs` reflects the new node/edge counts.

### Phase 3: Wire the Rebuild button (Option A)

- [ ] Extend `graphApi.ts`:
  - Add `rebuildAll` and `rebuildOne` mutations.
  - Tag the existing `getGraphs` / `getGraph` queries; mutations invalidate them.
- [ ] Add `conversionStatus` to `uiSlice`: `{ kind: 'idle' | 'running' | 'success' | 'error', message?: string, lastRunAt?: number }`.
- [ ] Add a "Rebuild" button to `Toolbar.tsx`:
  - Mantine `Button` with a refresh icon.
  - Loading state while the mutation is in flight.
  - On success: update `conversionStatus` to `success`, show a Mantine notification with `ok_count` / `error_count`.
  - On error: `conversionStatus = error`, red notification with server message.
  - Tooltip: "Re-run conversion on all .ttl files in the input dir".
- [ ] Add a hotkey in `useAppHotkeys`: `R` triggers rebuild (and check collisions — `R` is currently relayout, so use `Shift+R` or `Ctrl+R` override).
- [ ] Optional per-graph: "Rebuild this graph" action in the right-panel graph header (uses `rebuildOne`).

**Checkpoint:** Click button → loading spinner → graph list and current graph update with new counts. Test with a deliberately broken `.ttl` to confirm the error toast fires.

### Phase 4: File watcher in api (Option B)

- [ ] Add `watchdog` to `api/pyproject.toml`.
- [ ] New module `api/src/app/services/watcher.py`:
  - `ConversionWatcher` class wrapping `watchdog.observers.Observer`.
  - Watches `INPUT_DIR` for `*.ttl` changes (create/modify/delete).
  - Debounces events per-file with a 500ms window (coalesce rapid editor saves).
  - On debounced event: call `graph_service.rebuild_one(stem_of(path))`. On delete: unlink the corresponding `.json`.
  - Log each conversion: start, result (ok_count/error_count), duration.
- [ ] Start the watcher in `app.py` `lifespan`:
  - On startup: build, register, start the observer. Gate behind a setting (`ENABLE_WATCHER: bool = True`); easy to disable in prod.
  - On shutdown: `observer.stop(); observer.join()`.
- [ ] Guard against the "write-in-progress" race: check file size is stable across two 100ms polls before converting, OR catch parse errors gracefully and log.
- [ ] Write path-traversal guards on emitted paths (watchdog can surface odd paths on some filesystems).

**Checkpoint:** Run api with watcher on, edit a `.ttl` in the input dir, see log lines showing conversion run. `GET /api/graphs/{id}` returns the new shape without any manual intervention.

### Phase 5: SPA auto-pickup + polish

- [ ] In `store.ts` RTK Query setup: enable `refetchOnFocus: true`, `refetchOnReconnect: true`. This catches watcher-driven updates when the user tabs back to the browser.
- [ ] Optional: poll `GET /api/graphs` every 10s while the SPA is in the foreground (use RTK Query `pollingInterval`), only for the list — not per-graph. Gate behind a setting if it feels wasteful.
- [ ] Add `lastConvertedAt` to the api list response (from `Path.stat().st_mtime` of the `.json`), display it in the graph list row in relative time ("2m ago").
- [ ] Error surface: if the last `rebuild_all` had per-file errors, expose them via a small badge on the graph list entry; clicking shows the full error in a panel.
- [ ] README updates:
  - `api/README.md`: document `INPUT_DIR`, `ENABLE_WATCHER`, new endpoints.
  - `site/README.md`: mention the Rebuild button and the expected backend support.
  - Root `README.md`: mention the new loop.

**Checkpoint:** Full user flow works end to end: edit → (watcher auto-converts OR click button) → badge/list updates → refresh on focus → inspect.

## Recovery Checkpoint

> **⚠ UPDATE THIS AFTER EVERY CHANGE**

- **Last completed action:** plan drafted
- **Next immediate action:** Phase 1 step 1 — restructure `conversion/` to package layout
- **Recent commands run:** none
- **Uncommitted changes:** (pre-existing site diffs only; no plan-related changes yet)
- **Environment state:** none

## Failed Approaches

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
|      |        |        |

## Blockers

- None.

## Notes

- **Why package `ttl2json` instead of subprocess:** faster per call, typed results, unified exception handling, easier testing. The refactor is small and needed for tests anyway.
- **Docker implications:** the api image currently doesn't include `conversion/`. If watcher/convert endpoints are needed in the container, the Dockerfile must `COPY conversion/` and install it. Alternative: keep conversion endpoints dev-only (`ENABLE_CONVERT=False` in prod). Decide per deployment.
- **INPUT_DIR vs GRAPHS_DIR:** two distinct settings. `INPUT_DIR` = source `.ttl`s. `GRAPHS_DIR` = generated `.json`s. Default relative resolution should be documented.
- **Debounce window:** 500ms is a starting point. Mantine/VSCode saves fire multiple events; measure on real edits.
- **Security:** conversion runs arbitrary file parsing. If the api is ever exposed beyond localhost, the POST endpoints must be gated (auth, local-only bind, or disabled). Add a note in the README.
- **Error surface philosophy:** conversion errors are per-file and should NOT fail the batch. Watcher errors should log + continue. Button errors should toast. Never let a bad `.ttl` 500 the api.

## Additional Context (Claude)

- Worth revisiting the path-traversal guard in `filesystem.py:39-46` before shipping the new endpoints — symlink escape is currently possible. The new POST endpoints expand the attack surface.
- The review also flagged that repositories are instantiated per-request; watcher-driven cache invalidation is much easier if the repo is a singleton in `app.state`. Might be worth combining.
- Mantine has a `Notifications` system (`@mantine/notifications`) — confirm it's installed, add it if not. It's the right primitive for conversion result toasts.
- If you don't want `ttl2json` as a path dep in `api/`, an alternative is a narrow shared `conversion-py` package published locally. Overkill for now — path dep is fine.
- The watcher is the riskier of the two phases (threading, fs oddities, debounce bugs). If time-boxed, ship Phase 1–3 first and treat Phase 4 as a separate follow-up PR.
