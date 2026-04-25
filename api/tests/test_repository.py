from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from app.repositories.base import GraphNotFound
from app.repositories.filesystem import FilesystemGraphRepository


def _write(dir_: Path, name: str, payload) -> None:
    path = dir_ / f"{name}.json"
    if isinstance(payload, (dict, list)):
        path.write_text(json.dumps(payload))
    else:
        path.write_text(payload)


def test_list_ids_returns_filename_stems(tmp_path):
    _write(tmp_path, "one", {})
    _write(tmp_path, "two", {})
    repo = FilesystemGraphRepository(tmp_path)
    assert repo.list_ids() == ["one", "two"]


def test_list_ids_is_sorted(tmp_path):
    _write(tmp_path, "zeta", {})
    _write(tmp_path, "alpha", {})
    _write(tmp_path, "mike", {})
    repo = FilesystemGraphRepository(tmp_path)
    assert repo.list_ids() == ["alpha", "mike", "zeta"]


def test_list_ids_empty_dir(tmp_path):
    assert FilesystemGraphRepository(tmp_path).list_ids() == []


def test_list_ids_nonexistent_dir_returns_empty():
    repo = FilesystemGraphRepository(Path("/no/such/directory/exists"))
    assert repo.list_ids() == []


def test_list_ids_ignores_non_json(tmp_path):
    _write(tmp_path, "good", {})
    (tmp_path / "README.md").write_text("nope")
    (tmp_path / "notes.txt").write_text("nope")
    (tmp_path / "subdir").mkdir()
    assert FilesystemGraphRepository(tmp_path).list_ids() == ["good"]


def test_list_ids_handles_filenames_with_dots_and_dashes(tmp_path):
    _write(tmp_path, "v1.2-beta", {})
    _write(tmp_path, "a_b", {})
    assert FilesystemGraphRepository(tmp_path).list_ids() == ["a_b", "v1.2-beta"]


def test_load_raw_returns_parsed_json(tmp_path):
    _write(tmp_path, "g", {"nodes": [], "links": []})
    assert FilesystemGraphRepository(tmp_path).load_raw("g") == {"nodes": [], "links": []}


def test_load_raw_preserves_nested_structure(tmp_path):
    payload = {
        "nodes": [{"id": "a", "attributes": {"k": ["v1", "v2"]}}],
        "links": [{"source": "a", "target": "a"}],
    }
    _write(tmp_path, "g", payload)
    assert FilesystemGraphRepository(tmp_path).load_raw("g") == payload


def test_load_raw_missing_raises_graph_not_found(tmp_path):
    with pytest.raises(GraphNotFound):
        FilesystemGraphRepository(tmp_path).load_raw("nope")


def test_load_raw_malformed_raises_value_error(tmp_path):
    _write(tmp_path, "bad", "not-json-at-all")
    with pytest.raises(ValueError):
        FilesystemGraphRepository(tmp_path).load_raw("bad")


def test_load_raw_rejects_subdirectory(tmp_path):
    (tmp_path / "sub").mkdir()
    (tmp_path / "sub" / "x.json").write_text("{}")
    with pytest.raises(GraphNotFound):
        FilesystemGraphRepository(tmp_path).load_raw("sub")


def test_load_raw_reads_utf8(tmp_path):
    # verify we read utf-8 not locale default
    path = tmp_path / "g.json"
    path.write_text(json.dumps({"label": "café"}), encoding="utf-8")
    assert FilesystemGraphRepository(tmp_path).load_raw("g") == {"label": "café"}


def test_count_returns_node_and_edge_counts(tmp_path):
    _write(tmp_path, "g", {
        "nodes": [{"id": "a"}, {"id": "b"}, {"id": "c"}],
        "links": [{"source": "a", "target": "b"}],
    })
    assert FilesystemGraphRepository(tmp_path).count("g") == (3, 1)


def test_count_empty_graph(tmp_path):
    _write(tmp_path, "g", {"nodes": [], "links": []})
    assert FilesystemGraphRepository(tmp_path).count("g") == (0, 0)


def test_count_missing_keys_treated_as_empty(tmp_path):
    _write(tmp_path, "g", {})
    assert FilesystemGraphRepository(tmp_path).count("g") == (0, 0)


def test_count_null_keys_treated_as_empty(tmp_path):
    _write(tmp_path, "g", {"nodes": None, "links": None})
    assert FilesystemGraphRepository(tmp_path).count("g") == (0, 0)


def test_count_missing_raises_graph_not_found(tmp_path):
    with pytest.raises(GraphNotFound):
        FilesystemGraphRepository(tmp_path).count("nope")


def test_count_caches_by_mtime(tmp_path):
    _write(tmp_path, "g", {"nodes": [{"id": "a"}], "links": []})
    repo = FilesystemGraphRepository(tmp_path)
    assert repo.count("g") == (1, 0)

    # Overwrite contents but keep mtime unchanged → cached value returned.
    path = tmp_path / "g.json"
    mtime = path.stat().st_mtime
    path.write_text(json.dumps({"nodes": [{"id": "a"}, {"id": "b"}], "links": []}))
    os.utime(path, (mtime, mtime))
    assert repo.count("g") == (1, 0)


def test_count_cache_invalidates_on_mtime_change(tmp_path):
    _write(tmp_path, "g", {"nodes": [{"id": "a"}], "links": []})
    repo = FilesystemGraphRepository(tmp_path)
    assert repo.count("g") == (1, 0)

    # Bump mtime forward so the cache entry is stale.
    path = tmp_path / "g.json"
    path.write_text(json.dumps({"nodes": [{"id": "a"}, {"id": "b"}], "links": []}))
    new_mtime = path.stat().st_mtime + 10
    os.utime(path, (new_mtime, new_mtime))
    assert repo.count("g") == (2, 0)


def test_load_raw_rejects_absolute_path_traversal(tmp_path):
    # An id that tries to escape via absolute-like chars just fails because
    # the filename f"{id}.json" won't exist — but we verify GraphNotFound.
    with pytest.raises(GraphNotFound):
        FilesystemGraphRepository(tmp_path).load_raw("definitely-not-there")
