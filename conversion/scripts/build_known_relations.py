"""Build site/src/features/labels/data/known-relations.json from the upstream
noctua-visual-pathway-editor `globalKnownRelations` snapshot.

Reads the TS source as text, regex-locates the `globalKnownRelations = [...]`
array, parses it as JSON (the array body is JSON-shaped), normalizes each
entry's id to a full IRI, and writes a flat `{ iri: label }` map.

Smart defaults:

- `--src` walks up from this script to find a directory named `ttl-quick-viz`,
  then sibling-steps to `old-noctua-visual-pathway-editor/src/environments/
  environment-data.ts`.
- `--out` writes to `<ttl-quick-viz>/site/src/features/labels/data/
  known-relations.json`.

Skip-if-identical: if the destination already matches byte-for-byte, do
nothing (don't touch mtime). Output is sorted for deterministic diffs.

Routing:

- `BFO:0000050`  -> `http://purl.obolibrary.org/obo/BFO_0000050`
- `obo:uberon/core#X` -> `http://purl.obolibrary.org/obo/uberon/core#X`
- Anything else -> warned + skipped (counted in the summary).

Pure stdlib, no Poetry deps. Run from anywhere; resolution is from the script
location.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

OBO_NAMESPACE = "http://purl.obolibrary.org/obo/"

# CURIEs that expand directly to OBO PURLs by replacing `:` with `_` in the
# local part (e.g. `BFO:0000050` -> `obo/BFO_0000050`). This list is the
# union of obo prefixes that show up in `globalKnownRelations`.
OBO_PURL_PREFIXES = {
    "BFO",
    "BSPO",
    "CARO",
    "CHEBI",
    "CL",
    "DDANAT",
    "ECO",
    "EMAPA",
    "ENVO",
    "FBbt",
    "FMA",
    "FYPO",
    "GO",
    "HP",
    "IAO",
    "MA",
    "MP",
    "NCBITaxon",
    "PATO",
    "PO",
    "PR",
    "RO",
    "SO",
    "UBERON",
    "WBPhenotype",
    "WBls",
    "XAO",
    "ZFA",
}


def find_repo_root(start: Path) -> Path | None:
    """Walk up from `start` looking for a directory named `ttl-quick-viz`."""
    cur = start.resolve()
    for parent in (cur, *cur.parents):
        if parent.name == "ttl-quick-viz":
            return parent
    return None


def default_paths() -> tuple[Path, Path]:
    here = Path(__file__).resolve()
    repo_root = find_repo_root(here)
    if repo_root is None:
        # Fallback: assume this file lives at <repo>/conversion/scripts/.
        repo_root = here.parent.parent.parent
    src = (
        repo_root.parent
        / "old-noctua-visual-pathway-editor"
        / "src"
        / "environments"
        / "environment-data.ts"
    )
    out = repo_root / "site" / "src" / "features" / "labels" / "data" / "known-relations.json"
    return src, out


def extract_array_literal(text: str, name: str) -> str:
    """Locate `export const NAME = [` and return the matching `[...]` slice.

    Bracket-balanced, ignores brackets inside strings.
    """
    pattern = re.compile(r"export\s+const\s+" + re.escape(name) + r"\s*=\s*\[")
    m = pattern.search(text)
    if not m:
        raise ValueError(
            "could not locate 'export const " + name + " = [...]' in source"
        )
    start = m.end() - 1  # position of the opening `[`
    depth = 0
    in_str: str | None = None
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str is not None:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_str:
                in_str = None
            continue
        if ch in ('"', "'"):
            in_str = ch
            continue
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    raise ValueError("unterminated array literal for " + name)


def normalize_id(raw_id: str) -> str | None:
    """Map a `globalKnownRelations` id to a full IRI. Returns None if the id
    shape is unrecognized.
    """
    if not raw_id:
        return None
    if raw_id.startswith("obo:"):
        # `obo:uberon/core#X` -> `http://purl.obolibrary.org/obo/uberon/core#X`
        return OBO_NAMESPACE + raw_id[len("obo:") :]
    colon = raw_id.find(":")
    if colon > 0:
        prefix = raw_id[:colon]
        local = raw_id[colon + 1 :]
        if prefix in OBO_PURL_PREFIXES:
            return OBO_NAMESPACE + prefix + "_" + local
    return None


def build_map(entries: list[dict]) -> tuple[dict[str, str], int, list[str]]:
    """Return (iri_to_label, skipped_no_label, unrouted_ids)."""
    iri_to_label: dict[str, str] = {}
    skipped = 0
    unrouted: list[str] = []
    for entry in entries:
        raw_id = entry.get("id")
        label = entry.get("label")
        if not isinstance(raw_id, str) or not raw_id:
            skipped += 1
            continue
        if not isinstance(label, str) or not label.strip():
            skipped += 1
            continue
        iri = normalize_id(raw_id)
        if iri is None:
            unrouted.append(raw_id)
            continue
        iri_to_label[iri] = label
    return iri_to_label, skipped, unrouted


def render_json(iri_to_label: dict[str, str]) -> str:
    sorted_map = dict(sorted(iri_to_label.items()))
    return json.dumps(sorted_map, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    default_src, default_out = default_paths()
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--src", type=Path, default=default_src)
    parser.add_argument("--out", type=Path, default=default_out)
    args = parser.parse_args(argv)

    src: Path = args.src
    out: Path = args.out

    if not src.exists():
        print("error: source not found at " + str(src), file=sys.stderr)
        print("       pass --src PATH to override", file=sys.stderr)
        return 2

    text = src.read_text(encoding="utf-8")
    try:
        literal = extract_array_literal(text, "globalKnownRelations")
    except ValueError as exc:
        print("error: " + str(exc), file=sys.stderr)
        print("       upstream format may have changed; inspect " + str(src), file=sys.stderr)
        return 2

    try:
        entries = json.loads(literal)
    except json.JSONDecodeError as exc:
        print("error: globalKnownRelations is not valid JSON: " + str(exc), file=sys.stderr)
        return 2
    if not isinstance(entries, list):
        print("error: globalKnownRelations is not a JSON array", file=sys.stderr)
        return 2

    iri_to_label, skipped, unrouted = build_map(entries)
    rendered = render_json(iri_to_label)

    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        existing = out.read_text(encoding="utf-8")
        if existing == rendered:
            print(
                "no change: " + str(out) + " already matches "
                + str(len(iri_to_label)) + " relations"
            )
            _print_skipped(skipped, unrouted)
            return 0

    out.write_text(rendered, encoding="utf-8")
    size_kb = len(rendered.encode("utf-8")) / 1024.0
    print(
        "wrote " + str(len(iri_to_label)) + " relations to " + str(out)
        + " (" + str(round(size_kb, 1)) + " KB)"
    )
    _print_skipped(skipped, unrouted)
    return 0


def _print_skipped(skipped: int, unrouted: list[str]) -> None:
    if skipped:
        print("  skipped " + str(skipped) + " entries with no label")
    if unrouted:
        print(
            "  WARNING: " + str(len(unrouted)) + " entries had unrecognized id shape:",
            file=sys.stderr,
        )
        for rid in unrouted[:10]:
            print("    " + rid, file=sys.stderr)
        if len(unrouted) > 10:
            print("    ... (" + str(len(unrouted) - 10) + " more)", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
