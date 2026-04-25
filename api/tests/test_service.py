from __future__ import annotations

from typing import Any

import pytest

from app.domain.models import Graph, GraphSummary
from app.repositories.base import GraphNotFound
from app.services.graph_service import GraphService, InvalidGraphId


class FakeRepo:
    """In-memory repository that satisfies the GraphRepository protocol."""

    def __init__(self, graphs: dict[str, dict[str, Any]]) -> None:
        self._graphs = graphs
        self.count_errors: dict[str, Exception] = {}

    def list_ids(self) -> list[str]:
        return sorted(self._graphs.keys())

    def load_raw(self, graph_id: str) -> dict[str, Any]:
        if graph_id not in self._graphs:
            raise GraphNotFound(graph_id)
        return self._graphs[graph_id]

    def count(self, graph_id: str) -> tuple[int, int]:
        if graph_id in self.count_errors:
            raise self.count_errors[graph_id]
        raw = self._graphs[graph_id]
        return len(raw.get("nodes") or []), len(raw.get("links") or [])


def test_list_graphs_returns_summary_per_id():
    repo = FakeRepo({
        "a": {"nodes": [{"id": "x"}], "links": []},
        "b": {"nodes": [], "links": [{"source": "x", "target": "y"}]},
    })
    result = GraphService(repo).list_graphs()
    assert result == [
        GraphSummary(id="a", nodeCount=1, edgeCount=0),
        GraphSummary(id="b", nodeCount=0, edgeCount=1),
    ]


def test_list_graphs_empty_when_no_graphs():
    assert GraphService(FakeRepo({})).list_graphs() == []


def test_list_graphs_skips_entries_that_fail_to_count():
    repo = FakeRepo({
        "good": {"nodes": [{"id": "x"}], "links": []},
        "broken": {"nodes": [], "links": []},
    })
    import json
    repo.count_errors["broken"] = json.JSONDecodeError("bad", "doc", 0)
    result = GraphService(repo).list_graphs()
    assert [s.id for s in result] == ["good"]


def test_list_graphs_skips_entries_with_value_error():
    repo = FakeRepo({
        "good": {"nodes": [{"id": "x"}], "links": []},
        "broken": {"nodes": [], "links": []},
    })
    repo.count_errors["broken"] = ValueError("malformed")
    result = GraphService(repo).list_graphs()
    assert [s.id for s in result] == ["good"]


def test_list_graphs_does_not_swallow_unexpected_exceptions():
    repo = FakeRepo({"x": {"nodes": [], "links": []}})
    repo.count_errors["x"] = RuntimeError("boom")
    with pytest.raises(RuntimeError):
        GraphService(repo).list_graphs()


def test_get_graph_translates_raw():
    repo = FakeRepo({"g": {
        "nodes": [{"id": "a", "label": "A"}],
        "links": [],
    }})
    result = GraphService(repo).get_graph("g")
    assert isinstance(result, Graph)
    assert result.nodes[0].id == "a"
    assert result.nodes[0].label == "A"


def test_get_graph_rejects_empty_id():
    with pytest.raises(InvalidGraphId):
        GraphService(FakeRepo({})).get_graph("")


def test_get_graph_rejects_double_dot():
    with pytest.raises(InvalidGraphId):
        GraphService(FakeRepo({})).get_graph("..")


def test_get_graph_rejects_dot_dot_slash():
    with pytest.raises(InvalidGraphId):
        GraphService(FakeRepo({})).get_graph("../secret")


@pytest.mark.parametrize("bad_id", [
    "a/b",        # slash
    "a\\b",       # backslash
    "a b",        # space
    "a@b",        # at-sign
    "a#b",        # hash
    "a?b",        # question mark
    "a:b",        # colon
    "a;b",        # semicolon
    "a$b",        # dollar
])
def test_get_graph_rejects_disallowed_chars(bad_id):
    with pytest.raises(InvalidGraphId):
        GraphService(FakeRepo({})).get_graph(bad_id)


@pytest.mark.parametrize("good_id", [
    "simple",
    "with_underscores",
    "with-dashes",
    "with.dots",
    "UPPER",
    "mixed_Case.v1-2",
    "123numeric",
    "a",
])
def test_get_graph_accepts_valid_ids(good_id):
    repo = FakeRepo({good_id: {"nodes": [], "links": []}})
    result = GraphService(repo).get_graph(good_id)
    assert result.nodes == []


def test_get_graph_missing_raises_graph_not_found():
    # Valid id format but repo doesn't have it → repo raises GraphNotFound.
    with pytest.raises(GraphNotFound):
        GraphService(FakeRepo({})).get_graph("missing")
