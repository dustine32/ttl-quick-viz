from __future__ import annotations

import pytest

from app.translate import translate


def _raw(nodes=None, links=None):
    return {
        "directed": True,
        "multigraph": True,
        "graph": {},
        "nodes": nodes or [],
        "links": links or [],
    }


def test_node_id_and_label_pass_through():
    out = translate(_raw(nodes=[{"id": "a", "label": "Alpha"}]))
    assert out.nodes[0].id == "a"
    assert out.nodes[0].label == "Alpha"


def test_null_label_becomes_none():
    out = translate(_raw(nodes=[{"id": "a", "label": None}]))
    assert out.nodes[0].label is None


def test_types_and_attributes_fold_into_attrs():
    raw = _raw(nodes=[{
        "id": "a",
        "label": "A",
        "types": ["http://example.com/T"],
        "attributes": {"http://example.com/p": ["v"]},
    }])
    attrs = translate(raw).nodes[0].attrs
    assert attrs["rdf:type"] == ["http://example.com/T"]
    assert attrs["http://example.com/p"] == ["v"]


def test_empty_types_not_added_to_attrs():
    raw = _raw(nodes=[{"id": "a", "types": [], "attributes": {"k": ["v"]}}])
    assert "rdf:type" not in translate(raw).nodes[0].attrs


def test_predicate_becomes_edge_label():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": "p"}],
    )
    assert translate(raw).edges[0].label == "p"


def test_annotations_become_edge_attrs():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": "p",
                "annotations": {"note": ["hi"]}}],
    )
    assert translate(raw).edges[0].attrs == {"note": ["hi"]}


def test_edge_id_is_deterministic_single():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": "p"}],
    )
    assert translate(raw).edges[0].id == "a|p|b|0"


def test_parallel_edges_get_incrementing_index():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[
            {"source": "a", "target": "b", "predicate": "p"},
            {"source": "a", "target": "b", "predicate": "p"},
            {"source": "a", "target": "b", "predicate": "q"},
        ],
    )
    ids = [e.id for e in translate(raw).edges]
    assert ids == ["a|p|b|0", "a|p|b|1", "a|q|b|0"]


def test_missing_source_raises():
    raw = _raw(
        nodes=[{"id": "a"}],
        links=[{"target": "a", "predicate": "p"}],
    )
    with pytest.raises(ValueError, match="source"):
        translate(raw)


def test_missing_target_raises():
    raw = _raw(
        nodes=[{"id": "a"}],
        links=[{"source": "a", "predicate": "p"}],
    )
    with pytest.raises(ValueError, match="target"):
        translate(raw)
