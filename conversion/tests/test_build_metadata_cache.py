"""Tests for scripts/build_metadata_cache.py — YAML parsing, merge, file I/O."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import build_metadata_cache as bmc  # noqa: E402

USERS_YAML = """\
- nickname: 'Alice Example'
  uri: 'https://orcid.org/0000-0000-0000-0001'
  xref: 'GOC:ax'
- nickname: 'Bob Builder'
  uri: 'GOC:bb'
- uri: 'https://orcid.org/0000-0000-0000-0002'
  # missing nickname — should be skipped
"""

GROUPS_YAML = """\
- label: 'GO Central'
  id: http://geneontology.org
  shorthand: GO_Central
- label: 'LBL'
  id: http://lbl.gov
  shorthand: LBL
- label: 'No-shorthand Org'
  id: http://noshorthand.example
  # no shorthand → falls back to label
"""


def test_parse_users_skips_missing_fields():
    out = bmc.parse_users(USERS_YAML)
    assert out == {
        "https://orcid.org/0000-0000-0000-0001": "Alice Example",
        "GOC:bb": "Bob Builder",
    }


def test_parse_groups_falls_back_to_label_when_shorthand_missing():
    out = bmc.parse_groups(GROUPS_YAML)
    assert out == {
        "http://geneontology.org": "GO_Central",
        "http://lbl.gov": "LBL",
        "http://noshorthand.example": "No-shorthand Org",
    }


def test_main_writes_merged_json(tmp_path: Path):
    users = tmp_path / "users.yaml"
    groups = tmp_path / "groups.yaml"
    out = tmp_path / "metadata.json"
    users.write_text(USERS_YAML, encoding="utf-8")
    groups.write_text(GROUPS_YAML, encoding="utf-8")

    rc = bmc.main(
        [
            "--users-path",
            str(users),
            "--groups-path",
            str(groups),
            "--out",
            str(out),
        ]
    )
    assert rc == 0
    parsed = json.loads(out.read_text(encoding="utf-8"))
    assert parsed["https://orcid.org/0000-0000-0000-0001"] == "Alice Example"
    assert parsed["http://geneontology.org"] == "GO_Central"
    assert "https://orcid.org/0000-0000-0000-0002" not in parsed


def test_main_skips_when_identical(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    users = tmp_path / "users.yaml"
    groups = tmp_path / "groups.yaml"
    out = tmp_path / "metadata.json"
    users.write_text(USERS_YAML, encoding="utf-8")
    groups.write_text(GROUPS_YAML, encoding="utf-8")

    bmc.main(
        ["--users-path", str(users), "--groups-path", str(groups), "--out", str(out)]
    )
    mtime_first = out.stat().st_mtime_ns
    capsys.readouterr()
    rc = bmc.main(
        ["--users-path", str(users), "--groups-path", str(groups), "--out", str(out)]
    )
    assert rc == 0
    captured = capsys.readouterr()
    assert "no change" in captured.out
    assert out.stat().st_mtime_ns == mtime_first
