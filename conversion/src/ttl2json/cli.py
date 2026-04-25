"""CLI entry point for ttl2json."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from ttl2json.core import ConversionResult, convert_dir, convert_file


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Convert GO-CAM / Reactome Turtle files to networkx node-link JSON.",
    )
    ap.add_argument("path", type=Path, help="Turtle file or directory of .ttl files")
    ap.add_argument(
        "-o",
        "--output",
        type=Path,
        required=True,
        help="Output directory for <name>.json files",
    )
    ap.add_argument(
        "--force",
        action="store_true",
        help="Reconvert even if output is newer than source",
    )
    args = ap.parse_args(argv)

    path: Path = args.path
    if not path.exists():
        print(f"error: {path} does not exist", file=sys.stderr)
        return 1

    out_dir: Path = args.output
    if out_dir.exists() and not out_dir.is_dir():
        print(f"error: --output {out_dir} is not a directory", file=sys.stderr)
        return 1

    if path.is_file():
        results = [convert_file(path, out_dir, force=args.force)]
    else:
        try:
            results = convert_dir(path, out_dir, force=args.force)
        except NotADirectoryError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        if not results:
            print(f"error: no .ttl files in {path}", file=sys.stderr)
            return 1

    any_error = False
    for r in results:
        _print_result(r)
        if not r.ok:
            any_error = True
    return 2 if any_error else 0


def _print_result(r: ConversionResult) -> None:
    if r.skipped:
        print(f"skip   {r.input_path} (up-to-date)")
    elif r.ok:
        print(
            f"ok     {r.input_path} -> {r.output_path} "
            f"({r.node_count} nodes, {r.edge_count} edges, {r.duration_ms:.0f}ms)"
        )
    else:
        print(f"error  {r.input_path}: {r.error}", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
