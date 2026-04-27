# conversion/ — engineering notes

Standalone Python package (`ttl2json`) that parses GO-CAM / Reactome / pathways2GO
Turtle with `rdflib`, assembles a `networkx.MultiDiGraph`, and emits
`node_link_data` JSON. Upstream producer for `api/` (which both reads the JSON
**and** imports the package) and ultimately for `site/`.

## Layout

```
conversion/
├── pyproject.toml        # Poetry, Python ^3.11, deps: rdflib, networkx
├── poetry.toml           # in-project venv (.venv/), committed
├── src/ttl2json/
│   ├── __init__.py       # re-exports the public API
│   ├── core.py           # build_graph, convert_file, convert_dir, ConversionResult, needs_update
│   └── cli.py            # argparse main → convert_file / convert_dir
├── tests/
│   └── test_ttl2json.py  # unit + R-HSA snapshot tests
└── downloads/
    ├── input/            # drop .ttl here (Reactome fixtures committed for snapshot tests)
    └── output/           # <name>.json lands here (snapshots committed alongside)
```

The Reactome fixtures under `downloads/input/` and matching JSONs under
`downloads/output/` are intentionally committed — they back the snapshot tests
in `test_ttl2json.py` (`test_sample_*`). `.gitignore` excludes the directory
generally; the tracked fixtures are the exception. Don't dump arbitrary `.ttl`
files into the repo — drop them in `downloads/input/` locally and let
`.gitignore` keep them out.

## Public API

```python
from ttl2json import (
    ConversionResult,
    build_graph,
    convert_file,
    convert_dir,
    graph_to_json,
    needs_update,
)
```

All six are re-exported in `__init__.__all__`. `core.collapse_axioms` is module-private
(not re-exported) but the test suite imports it directly via `ttl2json.collapse_axioms`.

`ConversionResult` (dataclass) fields: `id`, `ok`, `input_path`, `output_path`,
`node_count`, `edge_count`, `duration_ms`, `skipped`, `error`. Has a `to_dict()`
helper. On per-file failure `ok=False` and `error` is set — `convert_file` and
`convert_dir` never raise on conversion errors (they do raise `NotADirectoryError`
when invoked on a non-directory input).

## How conversion works

- `build_graph(ttl_path: Path) -> nx.MultiDiGraph` parses the file with
  `rdflib.Graph().parse(format="turtle")`.
- `collapse_axioms(g)` walks `owl:Axiom` reifications first. Each axiom's
  `(annotatedSource, annotatedProperty, annotatedTarget)` becomes the key for
  an `edge_annotations[(s,p,o)] = {predicate_uri: [values]}` map; the axiom
  bnodes themselves are recorded so their triples are skipped in the main walk.
  Axioms missing any of the three annotation triples are skipped with a
  warning log.
- Main walk over `g`: triples whose subject is an axiom bnode are skipped. For
  each remaining `(s, p, o)`:
  - literal object → added to `attributes[sid][str(p)]`; `rdfs:label` also
    seeds `labels[sid]` (first wins).
  - `rdf:type` → appended to `types[sid]`.
  - IRI/BNode object → added as edge `(sid, tid)` with `predicate=str(p)` and
    `annotations=edge_annotations.get((s,p,o), {})`.
- Nodes are materialized from the union of referenced subjects/objects
  **sorted** for determinism.
- `graph_to_json` calls `nx.node_link_data(graph, edges="links")`; the writer
  uses `json.dumps(..., indent=2, ensure_ascii=False, sort_keys=True)`.

IDs: URIRefs use their string form; BNodes become `_:<id>`. Literals are
stringified (language tags are currently stripped — known limitation).

## Emitted JSON shape

See [`README.md`](./README.md#output-json-shape) for the full shape. Summary:

- Top-level: `{ directed: true, multigraph: true, graph: {}, nodes: [...], links: [...] }`.
- Node: `{ id, label, types[], attributes{} }`.
- Link: `{ source, target, key, predicate, annotations{} }`.

## Contract with `api/` and `site/`

- `api/pyproject.toml` declares `ttl-quick-viz-conversion` as a path-dep
  (`{ path = "../conversion", develop = true }`). The api imports
  `from ttl2json import convert_file, convert_dir, ConversionResult` — so any
  rename in `__init__.__all__` breaks the api at import time.
- `api/` also reads the JSON output directory directly via `GRAPHS_DIR` (the
  filesystem handoff is still load-bearing for serving graphs).
- `api/`'s `POST /api/convert` and `POST /api/graphs/{id}/rebuild` go through
  `ConversionService.rebuild_all` / `rebuild_one` (which call
  `convert_file` / `convert_dir`). The `ConversionWatcher` (started in the
  app lifespan when `ENABLE_WATCHER=true`) calls the same functions on
  `.ttl` change events.
- Changing node/link shape requires coordinated edits to
  `api/src/app/domain/models.py` + `domain/translate.py` and
  `site/src/features/graph/types.ts`. Touch all three before shipping a shape
  change.

## CLI behavior

`cli.py::main(argv)` returns:

- `0` — every file converted (or skipped) successfully.
- `1` — bad invocation: input path missing, `--output` exists but is not a
  directory, or directory mode found no `.ttl` files.
- `2` — at least one per-file conversion failed (errors printed to stderr).

`_print_result` formats each result: `skip` / `ok` / `error` lines with node
and edge counts plus duration in ms. Errors go to stderr; ok/skip lines go to
stdout.

## Common commands

Assumes `.venv/` exists (`poetry install` once). Prefer activating the venv
over `poetry run` — `poetry run` interacts badly with pyenv shims.

```bash
# First time
poetry install
source .venv/Scripts/activate    # Git Bash / Windows. macOS/Linux: .venv/bin/activate

# Convert a directory
ttl-viz-convert downloads/input/ -o downloads/output/

# Single file
ttl-viz-convert downloads/input/R-HSA-69273.ttl -o downloads/output/

# Force reconvert (skip up-to-date check)
ttl-viz-convert downloads/input/ -o downloads/output/ --force

# Module form
python -m ttl2json.cli downloads/input/ -o downloads/output/

# Tests
pytest
ruff check src tests
mypy
```

The top-level `ttl2json.py` script does **not** exist — the entry points are
`ttl-viz-convert` (Poetry script in `pyproject.toml`) and `python -m ttl2json.cli`.
A top-level file of that name would shadow the package on import.

`needs_update(src, dst)` returns True iff `dst` is missing or older than `src`
by mtime. Use `--force` to bypass.

## Gotchas

- **`poetry install` lands packages under `...\uv\python\...` instead of `.venv/`.**
  VSCode is auto-activating a uv-managed base Python via `VIRTUAL_ENV`. Fix:
  `unset VIRTUAL_ENV`, or point VSCode's interpreter at
  `.\.venv\Scripts\python.exe` (*Python: Select Interpreter*).
- **`downloads/` is gitignored, but the Reactome fixtures are intentionally
  tracked.** Don't add new fixtures casually — they're committed for the
  snapshot tests, not as a general dump ground.
- **MultiDiGraph key matters.** Two triples `(s, p1, o)` and `(s, p2, o)`
  produce two links; a `key` disambiguates. Downstream code must key on
  `(source, target, key)` or `(source, target, predicate)`, never just
  `(source, target)`.
- **Deterministic output.** Nodes are emitted in sorted order and
  `json.dumps(..., sort_keys=True)` is used — diffs on the JSON output are
  stable.
- **`ensure_ascii=False`** — output is UTF-8; anything reading the JSON must
  not assume ASCII.
- **Language tags stripped.** `Literal` values are serialized via plain
  `str()`; `@en`/`@fr` tags are lost. Fix requires a shape change and
  coordination with api + site.
- **Never raise on per-file conversion errors.** `convert_file` captures the
  exception into `ConversionResult.error`. Callers (api, CLI, watcher) must
  consult `result.ok` and surface errors without aborting the batch.
- **Test-suite uses `_needs_update` (private alias).** The exported name is
  `needs_update`; if you rename, update both the test and `__all__`.
