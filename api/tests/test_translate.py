from __future__ import annotations

import pytest

from app.domain.translate import translate


def _raw(nodes=None, links=None):
    return {
        "directed": True,
        "multigraph": True,
        "graph": {},
        "nodes": nodes or [],
        "links": links or [],
    }


def test_empty_graph():
    out = translate(_raw())
    assert out.nodes == []
    assert out.edges == []


def test_missing_nodes_and_links_keys():
    out = translate({"graph": {}})
    assert out.nodes == []
    assert out.edges == []


def test_node_id_and_label_pass_through():
    out = translate(_raw(nodes=[{"id": "a", "label": "Alpha"}]))
    assert out.nodes[0].id == "a"
    assert out.nodes[0].label == "Alpha"


def test_null_label_becomes_none():
    out = translate(_raw(nodes=[{"id": "a", "label": None}]))
    assert out.nodes[0].label is None


def test_missing_label_defaults_to_none():
    out = translate(_raw(nodes=[{"id": "a"}]))
    assert out.nodes[0].label is None


def test_integer_id_is_stringified():
    out = translate(_raw(nodes=[{"id": 42}]))
    assert out.nodes[0].id == "42"


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


def test_null_types_not_added_to_attrs():
    raw = _raw(nodes=[{"id": "a", "types": None, "attributes": {"k": ["v"]}}])
    assert "rdf:type" not in translate(raw).nodes[0].attrs


def test_null_attributes_becomes_empty_dict():
    raw = _raw(nodes=[{"id": "a", "attributes": None}])
    assert translate(raw).nodes[0].attrs == {}


def test_missing_attributes_becomes_empty_dict():
    out = translate(_raw(nodes=[{"id": "a"}]))
    assert out.nodes[0].attrs == {}


def test_multiple_types_preserved_as_list():
    raw = _raw(nodes=[{"id": "a", "types": ["T1", "T2", "T3"]}])
    assert translate(raw).nodes[0].attrs["rdf:type"] == ["T1", "T2", "T3"]


def test_node_order_is_preserved():
    raw = _raw(nodes=[{"id": "c"}, {"id": "a"}, {"id": "b"}])
    assert [n.id for n in translate(raw).nodes] == ["c", "a", "b"]


def test_predicate_becomes_edge_label():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": "p"}],
    )
    assert translate(raw).edges[0].label == "p"


def test_missing_predicate_yields_none_label():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b"}],
    )
    assert translate(raw).edges[0].label is None


def test_empty_predicate_yields_none_label():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": ""}],
    )
    assert translate(raw).edges[0].label is None


def test_annotations_become_edge_attrs():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": "p",
                "annotations": {"note": ["hi"]}}],
    )
    assert translate(raw).edges[0].attrs == {"note": ["hi"]}


def test_null_annotations_become_empty_dict():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": "p",
                "annotations": None}],
    )
    assert translate(raw).edges[0].attrs == {}


def test_missing_annotations_become_empty_dict():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": "p"}],
    )
    assert translate(raw).edges[0].attrs == {}


def test_edge_source_and_target_stringified():
    raw = _raw(
        nodes=[{"id": 1}, {"id": 2}],
        links=[{"source": 1, "target": 2, "predicate": "p"}],
    )
    edge = translate(raw).edges[0]
    assert edge.source == "1"
    assert edge.target == "2"


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


def test_parallel_edges_reverse_direction_counted_separately():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[
            {"source": "a", "target": "b", "predicate": "p"},
            {"source": "b", "target": "a", "predicate": "p"},
        ],
    )
    ids = [e.id for e in translate(raw).edges]
    assert ids == ["a|p|b|0", "b|p|a|0"]


def test_edge_order_is_preserved():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}, {"id": "c"}],
        links=[
            {"source": "a", "target": "b", "predicate": "p"},
            {"source": "c", "target": "a", "predicate": "q"},
            {"source": "b", "target": "c", "predicate": "r"},
        ],
    )
    srcs = [e.source for e in translate(raw).edges]
    assert srcs == ["a", "c", "b"]


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
