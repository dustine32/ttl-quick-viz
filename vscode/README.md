# TTL Quick Viz — VSCode extension

Open any `.ttl` (Turtle / RDF) file as an interactive property-graph view
in a VSCode editor tab. Built for debugging GO-CAM / Reactome /
pathways2GO converter output without leaving the editor.

## Quick install (packaged `.vsix`)

If you already have a `.vsix` (e.g. `ttl-quick-viz-0.1.0.vsix`):

```bash
code --install-extension ttl-quick-viz-0.1.0.vsix
```

Restart VSCode (or reload the window with `Ctrl+Shift+P` → **Developer:
Reload Window**). Then in any folder with `.ttl` files, right-click a
file in the explorer → **Open as Graph**.

You can also drag the `.vsix` onto VSCode's **Extensions** panel, or
open the panel (`Ctrl+Shift+X`), click the `…` menu → **Install from
VSIX…**.

## Build a `.vsix` from source

First time, install dependencies (in this directory and in `../site/`):

```bash
cd vscode/
npm install
cd ../site/
npm install
cd ../vscode/
```

Then build + package:

```bash
npm run package
```

This:
1. Runs `npm run build:webview` (which calls `vite build` in `../site/`
   and copies the bundle into `vscode/media/`).
2. Compiles the extension TypeScript (`tsc -p ./`).
3. Runs `vsce package` → produces `ttl-quick-viz-<version>.vsix` in this
   directory.

## Update an installed extension

`code --install-extension` happily overwrites the previous version, so:

```bash
# Bump the version so the .vsix has a new filename (avoids confusion):
npm version patch --no-git-tag-version    # 0.1.0 → 0.1.1
npm run package                            # builds ttl-quick-viz-0.1.1.vsix
code --install-extension ttl-quick-viz-0.1.1.vsix
# Reload VSCode: Ctrl+Shift+P → "Developer: Reload Window"
```

`patch` for bug fixes, `minor` for new features, `major` for breaking
changes. The git tag is intentionally skipped (`--no-git-tag-version`)
since this is a sideloaded extension, not a published one.

## Uninstall

Either:

```bash
code --uninstall-extension tmushayahama.ttl-quick-viz
```

Or open the **Extensions** panel, find "TTL Quick Viz", click the gear
icon → **Uninstall**.

## Develop locally (no install needed)

Open `vscode/` in VSCode and press **F5**. A second VSCode window opens
labeled `[Extension Development Host]` with the extension auto-loaded.
Open any `.ttl` in that window and right-click → **Open as Graph**.

Edit code in the original window, then `Ctrl+Shift+F5` to relaunch the
host. For pure HTML / extension-host changes, `Ctrl+R` in the graph tab
reloads just the webview.

The output channel **TTL Quick Viz** in the dev host streams diagnostic
messages (parse counts, webview errors, etc.) — open via **View →
Output**, then pick the channel from the dropdown.

## Use

1. Right-click a `.ttl` in the explorer → **Open as Graph**.
2. The graph opens in a new editor tab (the file's text editor stays
   available — pick which one is default via "Reopen with…").
3. Switch renderers (React Flow, Cytoscape, Force, Sigma, Graphin, Tree)
   from the toolbar dropdown.
4. The bottom **TTL source pane** shows the raw turtle synced to your
   selection. The right pane shows node / edge attributes.

Alternative entry points:

- Command palette → **TTL Quick Viz: Open as Graph** (acts on the
  active `.ttl` editor).
- Editor title bar button on any `.ttl` text editor.

## Status

v0.1 — sideloaded `.vsix` only. Marketplace publish is deferred. See
`.plans/feature/vscode-extension.md` for the build-out plan and
follow-up work (bundle code-splitting, tighter CSP, etc.).
