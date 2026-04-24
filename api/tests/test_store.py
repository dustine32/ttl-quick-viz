from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.store import GraphNotFound, GraphStore


def _write(dir_: Path, name: str, payload) -> None:
    path = dir_ / f"{name}.json"
    if isinstance(payload, (dict, list)):
        path.write_text(json.dumps(payload))
    else:
        path.write_text(payload)


def test_list_ids_returns_filename_stems(tmp_path):
    _write(tmp_path, "one", {})
    _write(tmp_path, "two", {})
    store = GraphStore(tmp_path)
    assert store.list_ids() == ["one", "two"]


def test_list_ids_is_sorted(tmp_path):
    _write(tmp_path, "zeta", {})
    _write(tmp_path, "alpha", {})
    store = GraphStore(tmp_path)
    assert store.list_ids() == ["alpha", "zeta"]


def test_list_ids_empty_dir(tmp_path):
    assert GraphStore(tmp_path).list_ids() == []


def test_list_ids_ignores_non_json(tmp_path):
    _write(tmp_path, "good", {})
    (tmp_path / "README.md").write_text("nope")
    (tmp_path / "subdir").mkdir()
    assert GraphStore(tmp_path).list_ids() == ["good"]


def test_load_raw_returns_parsed_json(tmp_path):
    _write(tmp_path, "g", {"nodes": [], "links": []})
    assert GraphStore(tmp_path).load_raw("g") == {"nodes": [], "links": []}


def test_load_raw_missing_raises_graph_not_found(tmp_path):
    with pytest.raises(GraphNotFound):
        GraphStore(tmp_path).load_raw("nope")


def test_load_raw_malformed_raises_value_error(tmp_path):
    _write(tmp_path, "bad", "not-json-at-all")
    with pytest.raises(ValueError):
        GraphStore(tmp_path).load_raw("bad")


def test_load_raw_rejects_subdirectory(tmp_path):
    (tmp_path / "sub").mkdir()
    (tmp_path / "sub" / "x.json").write_text("{}")
    with pytest.raises(GraphNotFound):
        GraphStore(tmp_path).load_raw("sub")
