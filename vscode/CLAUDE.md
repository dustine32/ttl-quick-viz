# vscode/ — engineering notes

VSCode extension that registers a Custom Editor for `.ttl` files. Opening a
TTL file (right-click → "Open as Graph", or "Reopen with…" → TTL Quick Viz)
shows the graph view in a new editor tab. The graph is built **in the
extension host** by a TypeScript port of `conversion/src/ttl2json/core.py`
(parser: `n3`); no FastAPI service, no localhost, no Vite proxy.

This is a fourth sibling subproject — peer to `conversion/`, `api/`, `site/`.
Not a workspace child, no shared root tooling.

## Layout

```
vscode/
├── package.json          # extension manifest (customEditors, commands, menus)
├── tsconfig.json         # commonjs, ES2022, strict
├── .vscodeignore         # files excluded from the .vsix bundle
├── .gitignore            # out/, node_modules/, *.vsix
├── src/
│   ├── extension.ts                       # activate / command registration
│   ├── editor/
│   │   └── ttlGraphEditorProvider.ts      # CustomTextEditorProvider impl
│   └── conversion/                        # (Phase 2) TS port of ttl2json
└── media/                                 # (Phase 4) webview bundle from site/
```

The `media/` folder is populated by a build step that copies
`site/dist-webview/` in. It's not generated yet — the placeholder HTML in
`ttlGraphEditorProvider.resolveCustomTextEditor` runs until then.

## Public surface (extension manifest)

- **Custom editor:** `viewType = "ttlQuickViz.graph"`, selector
  `*.ttl`, priority `option` (so it doesn't replace the user's normal
  text editor — they pick it via "Reopen with…" or the explorer
  context menu).
- **Command:** `ttlQuickViz.openGraph` — opens the active or
  right-clicked `.ttl` with the custom editor. Surfaced in the
  `explorer/context` and `editor/title` menus when
  `resourceExtname == .ttl`.
- **Activation:** `onCustomEditor:ttlQuickViz.graph` only — the
  extension stays dormant until a TTL graph view is requested.

## Contract with `site/`

The extension reuses the `site/` SPA's renderer code via a webview
bundle. The wire shape between extension host (TS) and webview
(React) **must match** `site/src/features/graph/types.ts`
(`Graph`, `GraphNode`, `GraphEdge`).

- The TS converter (`src/conversion/`) produces site shape **directly**
  — it does not emit `node_link_data` and then translate. Skipping the
  intermediate shape avoids duplicating `api/src/app/domain/translate.py`.
- Edge id format mirrors `translate.py`: `"{src}|{predicate}|{tgt}|{idx}"`.
- The host posts `{ type: 'graph/load', graph, ttlText, fileName }` on
  open; the webview replies with selection / line-reveal events.

If `site/src/features/graph/types.ts` changes, the TS port must change
in lockstep — same risk model as the SPA / api / conversion triangle.

## Common commands

Run from `vscode/`:

```bash
npm install            # install deps (n3 + dev tooling)
npm run compile        # tsc → out/
npm run watch          # tsc --watch
npm run lint           # eslint
npm run package        # vsce package → ttl-quick-viz-<version>.vsix
```

To test locally, open `vscode/` in VSCode and press **F5** — this
launches an Extension Development Host with the extension loaded. Open
any `.ttl` file there, right-click → "Open as Graph".

To install the packaged `.vsix`:

```bash
code --install-extension ttl-quick-viz-<version>.vsix
```

## Distribution

`.vsix` sideload only for v1. Marketplace publishing requires an Azure
DevOps publisher + PAT and is deferred until the extension has been
exercised personally for a few weeks. See `.plans/feature/vscode-extension.md`.

## Gotchas

- **Webviews look native but are sandboxed.** They run with a strict
  CSP (no `unsafe-inline` styles or scripts). Mantine v9 uses emotion
  under the hood — the webview entry must wire emotion's nonce through
  `MantineProvider`. If styles don't apply, suspect this first.
- **`localResourceRoots` is restrictive.** The webview can only load
  resources via `webview.asWebviewUri` for paths under
  `extensionUri/media`. The site bundle must land there at package time.
- **Don't import api/ or run a server.** The whole point of the
  extension is to skip the FastAPI layer. The site webview entry must
  not depend on `import.meta.env.VITE_API_URL` or any
  `useGetGraphsQuery` / `useGetGraphTtlQuery` paths that hit HTTP.
- **Document changes need debouncing.** The provider re-converts on
  `workspace.onDidChangeTextDocument`; large pathways2GO TTLs can be
  multi-MB and re-parsing on every keystroke is wasteful. Debounce
  ~300ms.
- **CSP nonce per-resolve.** Generate a fresh nonce in
  `resolveCustomTextEditor` and inject into both the CSP header and the
  `<script>` / `<style>` tags. Reusing a nonce across resolves defeats
  the purpose.
- **N3 parser is sync by default.** Fine for small files; switch to
  streaming if pathways2GO output blocks the host. Measure first.
