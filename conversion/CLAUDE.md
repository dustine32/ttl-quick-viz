# conversion/ — engineering notes

Standalone Python package (`ttl2json`) that parses GO-CAM / Reactome Turtle with `rdflib`, assembles a `networkx.MultiDiGraph`, and emits `node_link_data` JSON. It is the upstream producer for `api/` (which reads the JSON) and `site/` (which renders it). Since the repackage (Phase 1), `api/` also imports `ttl2json.convert_file` / `convert_dir` directly to support rebuild-on-demand.

## Layout

```
conversion/
├── pyproject.toml        # Poetry, Python ^3.11, deps: rdflib, networkx
├── poetry.toml           # in-project venv (.venv/), committed
├── src/ttl2json/
│   ├── __init__.py       # re-exports the public API
│   ├── core.py           # build_graph, convert_file, convert_dir, ConversionResult
│   └── cli.py            # argparse main → convert_file / convert_dir
├── downloads/
│   ├── input/            # drop .ttl here (contents gitignored)
│   └── output/           # <name>.json lands here (contents gitignored)
└── README.md
```

`downloads/` is gitignored (see `.gitignore`); the two subdirs are tracked via `.gitkeep`-style convention — do not commit ttl/json fixtures.

## Public API

```python
from ttl2json import convert_file, convert_dir, ConversionResult

result: ConversionResult = convert_file(Path("foo.ttl"), Path("out/"), force=False)
results: list[ConversionResult] = convert_dir(Path("in/"), Path("out/"))
```

`ConversionResult` fields: `id`, `ok`, `input_path`, `output_path`, `node_count`, `edge_count`, `duration_ms`, `skipped`, `error`. On per-file failure `ok=False` and `error` is set — `convert_file` and `convert_dir` never raise for conversion errors (they do raise for bad invocation, e.g. input dir missing).

## How conversion works

- `build_graph(ttl_path)` loads the file with `rdflib.Graph().parse(format="turtle")`.
- `collapse_axioms(g)` walks `owl:Axiom` reifications first. Each axiom's `(annotatedSource, annotatedProperty, annotatedTarget)` becomes the key for an `edge_annotations[(s,p,o)] = {predicate_uri: [values]}` map; the axiom bnodes themselves are recorded in `axiom_nodes` so their triples get skipped in the main walk. Axioms missing any of the three annotation triples are skipped with a warning log.
- Main walk over `g`: triples whose subject is an axiom bnode are skipped. For each remaining `(s, p, o)`:
  - literal object → added to `attributes[sid][str(p)]`; `rdfs:label` also seeds `labels[sid]` (first wins).
  - `rdf:type` → appended to `types[sid]`.
  - IRI/BNode object → added as edge `(sid, tid)` with `predicate=str(p)` and `annotations=edge_annotations.get((s,p,o), {})`.
- Nodes are materialized from the union of referenced subjects/objects **sorted** for determinism.
- `graph_to_json` calls `nx.node_link_data(graph, edges="links")` and we `json.dumps(..., indent=2, ensure_ascii=False, sort_keys=True)`.

IDs: URIRefs use their string form; BNodes become `_:<id>`. Literals are stringified (language tags are currently stripped — known limitation).

## Emitted JSON shape

Top-level: `{ "directed": true, "multigraph": true, "graph": {}, "nodes": [...], "links": [...] }`.

Node:
```json
{
  "id": "<IRI or _:bnode>",
  "label": "<rdfs:label or null>",
  "types": ["<rdf:type IRI>", ...],
  "attributes": { "<predicate-IRI>": ["<literal>", ...], ... }
}
```

Link (MultiDiGraph, so `key` disambiguates parallel edges):
```json
{
  "source": "<node id>",
  "target": "<node id>",
  "key": 0,
  "predicate": "<predicate IRI>",
  "annotations": { "<predicate-IRI>": ["<value>", ...], ... }
}
```

## Contract with `api/` and `site/`

- `api/` imports the package (path dep in its `pyproject.toml`) AND reads the JSON it produces from `GRAPHS_DIR`.
- Changing node/link shape requires coordinated edits to `api/src/app/domain/` (translate + models) and `site/src/features/graph/types.ts`. Check all three before shipping a shape change.
- Conversion endpoints on the api call into `convert_file` / `convert_dir` on demand; the watcher (if enabled) also does.

## Common commands

Assumes `.venv/` exists (`poetry install` once). Prefer activating the venv over `poetry run` — `poetry run` interacts badly with pyenv shims.

```bash
# First time
poetry install
source .venv/Scripts/activate   # Git Bash / Windows. mac/linux: .venv/bin/activate

# Convert a directory
ttl-viz-convert downloads/input/ -o downloads/output/

# Single file
ttl-viz-convert downloads/input/R-HSA-69273.ttl -o downloads/output/

# Force reconvert (skip up-to-date check)
ttl-viz-convert downloads/input/ -o downloads/output/ --force

# Module form
python -m ttl2json.cli downloads/input/ -o downloads/output/
```

The top-level `ttl2json.py` script no longer exists — `ttl-viz-convert` and `python -m ttl2json.cli` are the entry points. (A top-level file of the same name would shadow the package in imports.)

Up-to-date check (`needs_update`) skips any `<name>.ttl` whose `<name>.json` has `mtime >= .ttl.mtime`. Use `--force` to override.

## Gotchas

- **`poetry install` lands packages under `...\uv\python\...` instead of `.venv/`.** VSCode is auto-activating a uv-managed base Python via `VIRTUAL_ENV`. Fix: `unset VIRTUAL_ENV`, or point VSCode's interpreter at `.\.venv\Scripts\python.exe` (*Python: Select Interpreter*).
- **`downloads/input/` and `downloads/output/` contents are gitignored** — don't commit fixtures into the repo.
- **MultiDiGraph key matters.** Two triples `(s, p1, o)` and `(s, p2, o)` produce two links; a `key` disambiguates. Downstream code must key on `(source, target, key)` (or `(source, target, predicate)`), not just `(source, target)`.
- **Deterministic output.** Nodes are emitted in sorted order and `json.dumps(..., sort_keys=True)` is used — diffs on the JSON output are stable.
- **`ensure_ascii=False`** — output is UTF-8; anything reading the JSON must not assume ASCII.
- **Language tags stripped.** `Literal` values are serialized via plain `str()`; `@en`/`@fr` tags are lost. Fix requires a shape change and coordination with api/site.
- **Never raise on per-file conversion errors.** `convert_file` captures the exception into `ConversionResult.error`. Callers (api, CLI, watcher) should consult `result.ok` and surface errors without aborting the batch.
