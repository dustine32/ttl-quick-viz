"""Tests for scripts/build_known_relations.py — parsing and routing."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import build_known_relations as brk  # noqa: E402

SYNTHETIC_TS = """\
export const somethingElse = [];

export const globalKnownRelations = [
  {
    "id": "BFO:0000050",
    "label": "part of",
    "relevant": true
  },
  {
    "id": "RO:0002333",
    "label": "enabled by",
    "relevant": true
  },
  {
    "id": "obo:uberon/core#posteriorly_connected_to",
    "label": "posteriorly connected to",
    "relevant": false
  },
  {
    "id": "BFO:0000070",
    "relevant": false
  },
  {
    "id": "WEIRD:1234",
    "label": "weird",
    "relevant": false
  }
]

export const trailing = "x";
"""


def test_extract_array_literal_finds_balanced_brackets():
    literal = brk.extract_array_literal(SYNTHETIC_TS, "globalKnownRelations")
    parsed = json.loads(literal)
    assert isinstance(parsed, list)
    assert len(parsed) == 5


def test_normalize_id_routes_curies_and_obo_fragments():
    assert brk.normalize_id("BFO:0000050") == "http://purl.obolibrary.org/obo/BFO_0000050"
    assert brk.normalize_id("RO:0002333") == "http://purl.obolibrary.org/obo/RO_0002333"
    assert (
        brk.normalize_id("obo:uberon/core#posteriorly_connected_to")
        == "http://purl.obolibrary.org/obo/uberon/core#posteriorly_connected_to"
    )
    assert brk.normalize_id("WEIRD:1234") is None
    assert brk.normalize_id("") is None


def test_build_map_skips_no_label_and_collects_unrouted():
    entries = json.loads(brk.extract_array_literal(SYNTHETIC_TS, "globalKnownRelations"))
    iri_to_label, skipped, unrouted = brk.build_map(entries)
    assert iri_to_label == {
        "http://purl.obolibrary.org/obo/BFO_0000050": "part of",
        "http://purl.obolibrary.org/obo/RO_0002333": "enabled by",
        "http://purl.obolibrary.org/obo/uberon/core#posteriorly_connected_to": (
            "posteriorly connected to"
        ),
    }
    assert skipped == 1  # BFO:0000070 has no label
    assert unrouted == ["WEIRD:1234"]


def test_render_json_is_sorted_and_newline_terminated():
    rendered = brk.render_json(
        {
            "http://b": "B",
            "http://a": "A",
        }
    )
    assert rendered.endswith("\n")
    parsed = json.loads(rendered)
    assert list(parsed.keys()) == ["http://a", "http://b"]


def test_main_writes_file(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    src = tmp_path / "environment-data.ts"
    src.write_text(SYNTHETIC_TS, encoding="utf-8")
    out = tmp_path / "out" / "known-relations.json"
    rc = brk.main(["--src", str(src), "--out", str(out)])
    assert rc == 0
    assert out.exists()
    parsed = json.loads(out.read_text(encoding="utf-8"))
    assert parsed["http://purl.obolibrary.org/obo/RO_0002333"] == "enabled by"


def test_main_skips_when_identical(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    src = tmp_path / "environment-data.ts"
    src.write_text(SYNTHETIC_TS, encoding="utf-8")
    out = tmp_path / "out" / "known-relations.json"
    brk.main(["--src", str(src), "--out", str(out)])
    mtime_first = out.stat().st_mtime_ns
    capsys.readouterr()
    rc = brk.main(["--src", str(src), "--out", str(out)])
    assert rc == 0
    captured = capsys.readouterr()
    assert "no change" in captured.out
    assert out.stat().st_mtime_ns == mtime_first


def test_main_errors_on_missing_source(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    rc = brk.main(["--src", str(tmp_path / "missing.ts"), "--out", str(tmp_path / "out.json")])
    assert rc == 2
    captured = capsys.readouterr()
    assert "source not found" in captured.err
