# TTL Quick Viz Conversion

CLI that parses GO-CAM / Reactome Turtle files with `rdflib`, builds a `networkx.MultiDiGraph`, and writes `node-link` JSON for the [`site/`](../site) SPA to consume via the [`api/`](../api).

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
ttl-viz-convert downloads/input/ -o downloads/output/         # Poetry script entry point
python -m ttl2json.cli downloads/input/ -o downloads/output/  # module form
```

You can also import the package directly:

```python
from ttl2json import convert_file, convert_dir, ConversionResult
```

The sibling `api/` depends on this for its rebuild endpoints.

Each invocation writes `<name>.json` into the `--output` directory for each input `<name>.ttl`. The directory is created if it doesn't exist. Already-converted files are skipped unless their `.ttl` source is newer (override with `--force`).

## Arguments

| Arg              | Required | Meaning                                             |
|------------------|----------|-----------------------------------------------------|
| `path`           | yes      | A Turtle file or a directory containing `*.ttl`.    |
| `-o`, `--output` | yes      | Output directory for `<name>.json` files.           |
| `--force`        | no       | Reconvert even if the `.json` output is up-to-date. |

## Layout

```
conversion/
├── pyproject.toml
├── src/ttl2json/
│   ├── __init__.py        # public API: convert_file, convert_dir, ConversionResult
│   ├── core.py            # build_graph, convert_file, convert_dir
│   └── cli.py             # argparse CLI (ttl-viz-convert entry point)
└── downloads/
    ├── input/              # drop .ttl files here
    └── output/             # api/ reads <id>.json from here
```

Both `downloads/input/` and `downloads/output/` are tracked as empty directories; their contents are gitignored.

## Troubleshooting

- **`poetry install` lands packages in `...\uv\python\...` instead of `.venv/`.** Your shell has `VIRTUAL_ENV` set to a uv-managed Python install directory. Run `echo $VIRTUAL_ENV` — if it points inside `uv\python\`, either point VSCode's interpreter at `.\.venv\Scripts\python.exe` (Command Palette → *Python: Select Interpreter*) or `unset VIRTUAL_ENV` before running `poetry install`.
- **`poetry: command not found`.** Install Poetry as a uv tool so it lands on `PATH`: `uv tool install poetry`.
- **`poetry run ttl-viz-convert ...` picks the wrong interpreter.** If you have pyenv shims on `PATH`, `poetry run` can resolve `python` to a shim rather than the in-project venv. Activate the venv directly (`source .venv/Scripts/activate`) and run `ttl-viz-convert ...` instead.
