# Changelog (developer notes)

Internal companion to [`CHANGELOG.md`](./CHANGELOG.md). The user-facing
changelog stays short and plain-language; this file is where the wiring,
file paths, and "why we built it this way" live.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/).

## [0.2.0] — Unreleased

Labels feature: resolve raw IRIs to human-readable labels via the Noctua
GOlr service.

### Added

- **Label resolution.** Reuses the `site/` labels feature so node/edge IRIs
  display as readable strings (e.g. `GO:0008150` → "biological_process").
  Resolved labels stream in asynchronously and don't block the initial
  graph render.
- **Per-axis label display toggles.** Independent on/off for nodes and
  edges, surfaced through the existing site view-config controls.
- **Host-side GOlr fetch bridge** (`src/labels/hostFetch.ts`). The webview
  CSP blocks both JSONP (`<script src=external>`) and `fetch()` to non-
  cspSource origins, so the extension host performs the GOlr call in Node
  and posts the JSON back to the webview via `labels/fetched` messages.
  The host-side bridge:
  - Allowlists `noctua-golr.berkeleybop.org` only.
  - Times out after 30s via `AbortController`.
  - Returns a tagged `{ ok, json } | { ok: false, error }` result so the
    webview shim can reassemble a `Promise<unknown>` for `golrClient.ts`
    to consume unchanged.
- **Webview-side label transport shim** (`site/src/webview/labelsHostFetch.ts`,
  aliased into the webview build via `site/vite.config.webview.ts`). Swaps
  the SPA's `@/features/labels/jsonpRequest` for a postMessage round-trip
  to the host, keeping `golrClient.ts` and the rest of the labels pipeline
  identical between SPA and webview builds.

### Changed

- `TtlGraphEditorProvider` now routes a `labels/fetch` message type from
  the webview to `labelsFetch()` and replies with `labels/fetched`, in
  addition to the existing `graph/load`, `reveal/line`, and webview
  log/error channels.

## [0.1.0] — 2025

Initial extension subproject — fourth sibling to `conversion/`, `api/`,
`site/`. Sideloaded `.vsix` only.

### Added

- **Custom editor for `*.ttl` files** (`viewType: ttlQuickViz.graph`,
  priority `option`). Right-click a `.ttl` in the explorer → **Open as
  Graph**, or use **Reopen with…** to pick TTL Quick Viz over the text
  editor. Editor title-bar button and command-palette entry
  (`TTL Quick Viz: Open as Graph`) are also wired up.
- **TypeScript port of `ttl2json`** (`src/conversion/`). Parses Turtle in
  the extension host using `n3` and emits the site wire shape directly —
  skipping the intermediate `node_link_data` form that `api/` translates.
  Edge id format mirrors `api/src/app/domain/translate.py`
  (`{src}|{predicate}|{tgt}|{idx}`).
- **Webview reuse of the `site/` SPA.** A second Vite build
  (`site/vite.config.webview.ts`, output `site/dist-webview/`) produces a
  webview-ready bundle whose RTK Query baseQuery is swapped for a
  postMessage-backed transport (`site/src/webview/webviewBaseQuery.ts`).
  All seven renderers (xyflow, cytoscape, force, force3d, sigma, graphin,
  tree), the TTL pane, the inspector, and view-config work unchanged in
  the webview.
- **Build pipeline.** `npm run build:webview` invokes the site's webview
  Vite build and copies `dist-webview/` into `vscode/media/`.
  `npm run package` runs the full build (webview → typecheck → esbuild
  bundle of the extension) and then `vsce package`.
- **Document change handling.** The provider re-converts on
  `workspace.onDidChangeTextDocument` with a 300ms debounce, posts
  `graph/load` (or `graph/error` on parse failure) to the webview, and
  responds to `reveal/line` messages by opening the source file beside
  the graph and selecting the requested line.
- **Diagnostics output channel.** `View → Output → TTL Quick Viz` streams
  parse counts, webview ready/error events, and host↔webview message
  traces.

### Known limitations

- Diff / history features in the site bundle (`useGetGraphHistoryQuery`,
  `useGetGraphTtlAtQuery`) are no-ops in the webview — there is no `api/`
  or git layer in the extension. Those panels render but report empty.
- N3 parsing is synchronous; large pathways2GO TTLs (multi-MB) re-parse on
  each debounced edit. Switch to streaming if it becomes a bottleneck.
- Marketplace publish deferred until the extension has been exercised
  personally for a few weeks. See `.plans/feature/vscode-extension.md`.
