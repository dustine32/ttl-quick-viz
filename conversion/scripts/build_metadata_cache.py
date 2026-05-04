"""Build site/src/features/labels/data/metadata.json from geneontology/go-site.

Fetches users.yaml + groups.yaml from the GO metadata repo, projects to a
flat IRI->label map, and writes it to the site so the labels feature can
display contributor nicknames and group shorthands inline.

Source format (users.yaml entry):
    - nickname: 'Anushya Muruganujan'
      uri: 'https://orcid.org/0000-0001-7169-5864'
      ...

Source format (groups.yaml entry):
    - label: 'GO Central'
      id: http://geneontology.org
      shorthand: GO_Central

Output:
    {
      "https://orcid.org/0000-0001-7169-5864": "Anushya Muruganujan",
      "http://geneontology.org": "GO_Central",
      ...
    }

Same conventions as build_known_relations.py: smart defaults for --src/--out
inferred from script location, skip-if-identical, sorted output. Unlike that
script, this one fetches over HTTP (GitHub raw) by default, so it requires
network. Pass --users-path / --groups-path to use local YAML files instead
(useful for offline regeneration or testing).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

import yaml

DEFAULT_USERS_URL = (
    "https://raw.githubusercontent.com/geneontology/go-site/master/metadata/users.yaml"
)
DEFAULT_GROUPS_URL = (
    "https://raw.githubusercontent.com/geneontology/go-site/master/metadata/groups.yaml"
)


def find_repo_root(start: Path) -> Path | None:
    cur = start.resolve()
    for parent in (cur, *cur.parents):
        if parent.name == "ttl-quick-viz":
            return parent
    return None


def default_out() -> Path:
    here = Path(__file__).resolve()
    repo_root = find_repo_root(here)
    if repo_root is None:
        repo_root = here.parent.parent.parent
    return repo_root / "site" / "src" / "features" / "labels" / "data" / "metadata.json"


def _fetch(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": "ttl-quick-viz-build/1.0"})
    with urlopen(req, timeout=30) as resp:
        return resp.read()


def parse_users(text: str) -> dict[str, str]:
    """Return {uri: nickname}. Skip entries missing either field."""
    entries = yaml.safe_load(text) or []
    out: dict[str, str] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        uri = entry.get("uri")
        nickname = entry.get("nickname")
        if isinstance(uri, str) and isinstance(nickname, str) and uri and nickname:
            out[uri] = nickname
    return out


def parse_groups(text: str) -> dict[str, str]:
    """Return {id: shorthand}. Falls back to label when shorthand is missing."""
    entries = yaml.safe_load(text) or []
    out: dict[str, str] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        gid = entry.get("id")
        shorthand = entry.get("shorthand") or entry.get("label")
        if isinstance(gid, str) and isinstance(shorthand, str) and gid and shorthand:
            out[gid] = shorthand
    return out


def render_json(merged: dict[str, str]) -> str:
    sorted_map = dict(sorted(merged.items()))
    return json.dumps(sorted_map, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--users-url", default=DEFAULT_USERS_URL)
    parser.add_argument("--groups-url", default=DEFAULT_GROUPS_URL)
    parser.add_argument(
        "--users-path",
        type=Path,
        help="Local users.yaml path; overrides --users-url",
    )
    parser.add_argument(
        "--groups-path",
        type=Path,
        help="Local groups.yaml path; overrides --groups-url",
    )
    parser.add_argument("--out", type=Path, default=default_out())
    args = parser.parse_args(argv)

    try:
        users_text = (
            args.users_path.read_text(encoding="utf-8")
            if args.users_path
            else _fetch(args.users_url).decode("utf-8")
        )
        groups_text = (
            args.groups_path.read_text(encoding="utf-8")
            if args.groups_path
            else _fetch(args.groups_url).decode("utf-8")
        )
    except (URLError, OSError) as exc:
        print("error: could not load metadata source: " + str(exc), file=sys.stderr)
        return 2

    users = parse_users(users_text)
    groups = parse_groups(groups_text)

    merged: dict[str, str] = {}
    merged.update(users)
    # Group ids and user URIs don't overlap in practice, but if they ever did,
    # let users win (more specific identity).
    for k, v in groups.items():
        merged.setdefault(k, v)

    rendered = render_json(merged)
    out: Path = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists() and out.read_text(encoding="utf-8") == rendered:
        print(
            "no change: " + str(out)
            + " already matches " + str(len(users)) + " users + "
            + str(len(groups)) + " groups"
        )
        return 0

    out.write_text(rendered, encoding="utf-8")
    size_kb = len(rendered.encode("utf-8")) / 1024.0
    print(
        "wrote " + str(len(merged)) + " metadata entries ("
        + str(len(users)) + " users + "
        + str(len(groups)) + " groups) to " + str(out)
        + " (" + str(round(size_kb, 1)) + " KB)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
