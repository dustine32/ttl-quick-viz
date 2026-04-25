# Dev-loop design: ttl edit → convert → inspect

Date: 2026-04-24
Status: design exploration, not yet implemented

## Problem

The use case is: edit a `.ttl` file, see the updated graph in the SPA. The current flow is broken for this loop:

1. User edits a file in `conversion/downloads/input/`.
2. User runs `ttl2json.py` manually.
3. Api doesn't know the file changed — no invalidation, no list refresh.
4. User refreshes the SPA to see stale or new data.

There is no signal from conversion → api → SPA.

## Options (cheap → fancy)

### A. Manual button in the UI

- New endpoints: `POST /api/convert` (all files) and/or `POST /api/graphs/{id}/rebuild` (one file).
- Api shells out to `ttl2json.py` or imports it (see precondition below).
- Toolbar button in the SPA: "Rebuild". On success, invalidate RTK Query cache for `getGraphs` + current graph.
- **Pro:** explicit, zero background processes, matches the inspection-driven workflow.
- **Con:** still manual. Acceptable for a human-in-the-loop tool.

### B. Api-side file watcher (automatic)

- On api startup, spawn a `watchdog` thread on `conversion/downloads/input/`.
- On `.ttl` change → trigger conversion → write to `GRAPHS_DIR`.
- SPA polls `GET /api/graphs` on window focus (RTK Query `refetchOnFocus`) or every 5s.
- **Pro:** fully automatic, no button.
- **Con:** background work in the api; needs debounce (editors write multiple times per save); race against partial writes.

### C. SSE push from api to SPA

- Api exposes `GET /api/events` (text/event-stream). On conversion completion, emit `{event: "graphs-changed"}`.
- SPA subscribes once, invalidates cache on event.
- **Pro:** instant UI update without polling.
- **Con:** overkill for a single-user local tool. Polling latency is fine.

### D. Convert-on-read (lazy)

- `GET /api/graphs/{id}`: if `<id>.ttl` mtime > `<id>.json` mtime, reconvert before serving.
- `GET /api/graphs`: scan `input/` too so new `.ttl` files show up in the list.
- **Pro:** no watcher, always fresh, no button.
- **Con:** couples api tightly to conversion; first request after edit is slow; deletions handled poorly.

### E. One-shot dev script (no code change in api)

- Root `scripts/dev.sh` or `Makefile` target runs: `watchexec -w conversion/downloads/input -e ttl -- ttl-viz-convert ...` alongside the api and vite. SPA polls on focus.
- **Pro:** zero code changes. Composes existing CLIs. Fits the no-monorepo structure.
- **Con:** another dep (`watchexec` or `entr`) for the user to install.

## Precondition: make `ttl2json.py` importable

Currently a single script — no `__init__.py`, no package layout. For A/B/C/D, pick one:

1. **Subprocess it** from the api. Simplest, but slower per invocation; error surface is messier.
2. **Package it** (`conversion/src/ttl2json/__init__.py` with `convert_file(input, output)`; keep the CLI as a thin wrapper). Then `from ttl2json import convert_file` in the api.

Option 2 is the better path — you want it anyway for testing.

## Recommendation: A + B, in that order

1. **Ship the Rebuild button first (A).** ~2 hours: package `ttl2json`, add two endpoints, add a toolbar button with a Mantine loader state. This alone makes the tool usable.
2. **Add the watcher later (B)** with a 500ms debounce. Keep the button as a manual override.

Skip SSE. Skip convert-on-read. Dev script (E) is a reasonable alternative to B if you'd rather keep the api dumb.

## Bonus UX worth stealing from similar tools

- **Per-graph "last converted" timestamp** in the list, so stale data is visible.
- **Conversion errors surfaced in the UI** — not just a toast, but a pinned banner on the affected graph. Today errors go to stderr and vanish.
- **A "source" panel** in the inspector showing the raw `.ttl` for the selected graph (read-only). Closes the loop — edit in editor, inspect in browser, confirm in panel.
