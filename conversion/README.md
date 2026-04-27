# ttl-quick-viz — conversion

Python package (`ttl2json`) that parses GO-CAM / Reactome / pathways2GO Turtle
files with `rdflib`, builds a `networkx.MultiDiGraph`, and writes node-link
JSON for the [`site/`](../site) SPA to render via the [`api/`](../api).

It exposes both:

- a CLI entry point `ttl-viz-convert` (and `python -m ttl2json.cli`), and
- an importable Python API (`convert_file`, `convert_dir`, `ConversionResult`,
  `build_graph`, `graph_to_json`, `needs_update`) used by the sibling api as a
  Poetry path-dep.

## Quick start

Prerequisites: Python 3.11+, [Poetry](https://python-poetry.org/).

```bash
poetry install                   # creates .venv/ in-project
source .venv/Scripts/activate    # Git Bash on Windows
# .venv\Scripts\activate         # PowerShell
# source .venv/bin/activate      # macOS / Linux
```

Then run:

```bash
ttl-viz-convert downloads/input/ -o downloads/output/         # Poetry script
python -m ttl2json.cli downloads/input/ -o downloads/output/  # module form
```

Each invocation writes `<name>.json` for every `<name>.ttl` under the input
path. The output directory is created if missing. Already-converted files are
skipped when the `<name>.json` is newer than the source `<name>.ttl`; pass
`--force` to override.

## CLI

```
ttl-viz-convert PATH -o OUTPUT [--force]
```

| Arg              | Required | Meaning                                             |
|------------------|----------|-----------------------------------------------------|
| `path`           | yes      | A single Turtle file or a directory of `*.ttl`.     |
| `-o`, `--output` | yes      | Output directory for `<name>.json` files.           |
| `--force`        | no       | Reconvert even if the `.json` is up-to-date.        |

Exit codes: `0` on success, `1` on bad invocation (missing path, output is not
a directory, no `.ttl` files found), `2` if any per-file conversion failed.
Per-file errors are reported on the result, not raised.

## Importable API

```python
from pathlib import Path
from ttl2json import convert_file, convert_dir, ConversionResult

result: ConversionResult = convert_file(
    Path("downloads/input/R-HSA-69273.ttl"),
    Path("downloads/output/"),
    force=False,
)

results: list[ConversionResult] = convert_dir(
    Path("downloads/input/"),
    Path("downloads/output/"),
    force=False,
)
```

`ConversionResult` fields: `id`, `ok`, `input_path`, `output_path`,
`node_count`, `edge_count`, `duration_ms`, `skipped`, `error`. On per-file
failure `ok=False` and `error` is a string — `convert_file` and `convert_dir`
**never raise** on conversion errors (they do raise on bad invocation, e.g.
input dir missing).

The api uses these directly (see `api/src/app/services/conversion_service.py`)
to power `POST /api/convert` and `POST /api/graphs/{id}/rebuild`.

## Layout

```
conversion/
├── pyproject.toml
├── poetry.toml                   # in-project venv, committed
├── src/ttl2json/
│   ├── __init__.py               # public re-exports
│   ├── core.py                   # build_graph, convert_file, convert_dir, …
│   └── cli.py                    # argparse → ttl-viz-convert
├── tests/
│   └── test_ttl2json.py          # unit + snapshot tests
└── downloads/
    ├── input/                    # drop .ttl here (sample fixtures committed)
    └── output/                   # api reads <id>.json from here
```

## Output JSON shape

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

Link (MultiDiGraph — `key` disambiguates parallel edges):

```json
{
  "source": "<node id>",
  "target": "<node id>",
  "key": 0,
  "predicate": "<predicate IRI>",
  "annotations": { "<predicate-IRI>": ["<value>", ...], ... }
}
```

Notes on the shape:

- **`owl:Axiom` reifications are collapsed.** Each axiom's
  `(annotatedSource, annotatedProperty, annotatedTarget)` becomes the matching
  edge's `annotations` map; the axiom bnode itself is dropped.
- **Deterministic.** Nodes are sorted by id; JSON is dumped with
  `sort_keys=True`, `indent=2`, `ensure_ascii=False` — diffs are stable.
- **MultiDiGraph keys matter.** Two triples `(s, p1, o)` and `(s, p2, o)`
  produce two links with different `key`. Downstream code must key on
  `(source, target, key)` (or include `predicate`), not just `(source, target)`.
- **Language tags are stripped.** `Literal` values are stringified via `str()`
  — `@en` / `@fr` are lost. Fixing this is a wire-shape change and requires
  coordinated edits in api + site.

## Troubleshooting

- **`poetry install` lands packages in `...\uv\python\...` instead of `.venv/`.**
  `VIRTUAL_ENV` is set to a uv-managed Python (often by the VSCode Python
  extension). Run `echo $VIRTUAL_ENV` — if it points inside `uv\python\`, either
  point VSCode's interpreter at `.\.venv\Scripts\python.exe` (Command Palette →
  *Python: Select Interpreter*) or `unset VIRTUAL_ENV` before `poetry install`.
- **`poetry: command not found`.** Install Poetry as a uv tool so it lands on
  `PATH`: `uv tool install poetry`.
- **`poetry run ttl-viz-convert ...` picks the wrong interpreter.** With pyenv
  shims on `PATH`, `poetry run` can resolve `python` to a shim rather than the
  in-project venv. Activate the venv directly (`source .venv/Scripts/activate`)
  and run `ttl-viz-convert ...`.
- **Up-to-date check stuck.** `needs_update(src, dst)` returns False when
  `dst.mtime >= src.mtime`. Touch the source or pass `--force`.
