# Changelog

What's changed in **TTL Quick Viz**, the VSCode extension that opens
`.ttl` files as an interactive graph.

> Looking for the technical write-up (file paths, message wiring, design
> notes)? See [`CHANGELOG-dev.md`](./CHANGELOG-dev.md).

## 0.2.0 — Unreleased

### Readable names for IRIs (GOlr lookup)

Bare IRIs like `GO:0008150` can now be resolved to readable names like
"biological_process".

**Where to click:**

1. Open a `.ttl` file as a graph (right-click → **Open as Graph**).
2. In the toolbar at the top of the editor tab, click the new
   **Resolve labels** button (just left of the gear icon, between the
   renderer dropdown and the settings gear).
3. A toast appears in the bottom-right: *"Resolved X of Y from GOlr"*.
   Resolved names appear on nodes and edges immediately — no reload.

The lookup is incremental: only IRIs that don't already have a label get
sent. You can click it again later if the graph picks up new terms.

### New "Display settings" popover for label rendering

Three switches control how labels and IDs are drawn on the graph.

**Where to click:**

1. In the toolbar, click the **gear icon** (tooltip: *Display settings*).
2. A popover opens with three switches under **Label display**:
   - **Show labels** — draw the human-readable name when one is known.
   - **Show IDs** — draw the term identifier (e.g. `GO:0008150`) on the
     node/edge.
   - **Use full IRI** — when *Show IDs* is on, draw the full URL instead
     of the short CURIE form. Greyed out when *Show IDs* is off.

The same three switches also live in the right-side **View** panel under
the **Labels** section, if you prefer a non-popover view.

## 0.1.0

First release. Sideloaded `.vsix` — install with
`code --install-extension ttl-quick-viz-0.1.0.vsix` and reload the
window.

### Open a `.ttl` file as a graph

**Where to click:**

- In the file explorer, right-click any `.ttl` file → **Open as Graph**.
- Or, with a `.ttl` already open in the text editor, click the
  graph icon in the editor's title bar.
- Or, command palette (`Ctrl+Shift+P`) → **TTL Quick Viz: Open as
  Graph**.

The graph opens in a new editor tab. The plain text editor is still
available — use **Reopen with…** on the file to switch between the two.

### Switch between seven graph renderers

In the toolbar, click the **renderer dropdown** (the `Select` next to
the layout picker) to choose:

- React Flow (default)
- Cytoscape
- Force 2D
- Force 3D
- Sigma (WebGL)
- Graphin (G6)
- Tree / Mind map

Each renderer has its own layout options that show up automatically when
you pick it.

### Inspect a node or edge

- **Click any node or edge** in the graph → the right panel populates
  with its attributes, and the bottom **TTL source pane** scrolls to and
  highlights the matching line in the original Turtle file.
- Click empty canvas to clear the selection.

### Show / hide the side panels

- **Left panel** (graphs list, etc.) — `Ctrl+B`.
- **Right panel** (inspector, view config) — `Ctrl+Alt+B`.
- **Bottom TTL source pane** — `Ctrl+J`.

The panels are also draggable — grab the divider between panels to
resize.

### Search

- Click the **search box** in the center of the toolbar to find a node
  by name or IRI.
- Or press `Ctrl+K` to open the **command palette** for quick actions.

### Live updates

Edit the `.ttl` file in another editor tab — the graph view re-parses
and updates automatically (after a brief debounce).

### Runs entirely inside VSCode

No server, no browser tab, no network — parsing happens in the
extension itself.
