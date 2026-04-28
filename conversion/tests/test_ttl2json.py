"""Tests for ttl2json — covers helpers, build_graph, CLI, and sample snapshots."""

from __future__ import annotations

import json
import time
from pathlib import Path

import networkx as nx
import pytest
from rdflib import Graph

import ttl2json

ROOT = Path(__file__).resolve().parent.parent
DOWNLOADS = ROOT / "downloads"

MINIMAL_TTL = """\
@prefix : <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

:a a owl:NamedIndividual ;
   rdfs:label "Alpha" ;
   rdfs:comment "about a" , "more about a" ;
   :rel :b .

:b a owl:NamedIndividual ;
   rdfs:label "Beta" .

[ a owl:Axiom ;
  owl:annotatedSource :a ;
  owl:annotatedProperty :rel ;
  owl:annotatedTarget :b ;
  rdfs:comment "edge note" ;
  :evidence :ev1 ] .
"""


def _normalize(data: dict) -> dict:
    """Normalize a node-link dict for order-insensitive comparison."""
    nodes = [
        {
            **n,
            "types": sorted(n.get("types", [])),
            "attributes": {k: sorted(v) for k, v in n.get("attributes", {}).items()},
        }
        for n in data["nodes"]
    ]
    nodes.sort(key=lambda n: n["id"])
    links = [
        {
            **l,
            "annotations": {k: sorted(v) for k, v in l.get("annotations", {}).items()},
        }
        for l in data["links"]
    ]
    links.sort(key=lambda l: (l["source"], l["target"], l["predicate"], l.get("key", 0)))
    return {
        "directed": data["directed"],
        "multigraph": data["multigraph"],
        "graph": data["graph"],
        "nodes": nodes,
        "links": links,
    }


@pytest.fixture
def minimal_ttl(tmp_path: Path) -> Path:
    p = tmp_path / "minimal.ttl"
    p.write_text(MINIMAL_TTL)
    return p


# --- collapse_axioms -------------------------------------------------------


def test_collapse_axioms_extracts_annotations(minimal_ttl: Path) -> None:
    g = Graph()
    g.parse(str(minimal_ttl), format="turtle")
    annotations, axiom_nodes = ttl2json.collapse_axioms(g)

    assert len(axiom_nodes) == 1
    assert len(annotations) == 1

    (s, p, o), ann = next(iter(annotations.items()))
    assert str(s) == "http://example.org/a"
    assert str(p) == "http://example.org/rel"
    assert str(o) == "http://example.org/b"
    assert ann["http://www.w3.org/2000/01/rdf-schema#comment"] == ["edge note"]
    assert ann["http://example.org/evidence"] == ["http://example.org/ev1"]


def test_collapse_axioms_skips_incomplete(tmp_path: Path) -> None:
    """owl:Axiom missing annotatedTarget should be ignored entirely."""
    content = """\
@prefix : <http://ex/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
[ a owl:Axiom ;
  owl:annotatedSource :a ;
  owl:annotatedProperty :p ] .
"""
    p = tmp_path / "partial.ttl"
    p.write_text(content)
    g = Graph()
    g.parse(str(p), format="turtle")
    annotations, axiom_nodes = ttl2json.collapse_axioms(g)
    assert annotations == {}
    assert axiom_nodes == set()


# --- build_graph -----------------------------------------------------------


def test_build_graph_returns_multidigraph(minimal_ttl: Path) -> None:
    g = ttl2json.build_graph(minimal_ttl)
    assert isinstance(g, nx.MultiDiGraph)


def test_build_graph_collects_labels_types_attributes(minimal_ttl: Path) -> None:
    g = ttl2json.build_graph(minimal_ttl)
    a = g.nodes["http://example.org/a"]
    assert a["label"] == "Alpha"
    assert "http://www.w3.org/2002/07/owl#NamedIndividual" in a["types"]
    comments = a["attributes"]["http://www.w3.org/2000/01/rdf-schema#comment"]
    assert sorted(comments) == ["about a", "more about a"]
    # literal-typed label is also recorded under attributes
    assert a["attributes"]["http://www.w3.org/2000/01/rdf-schema#label"] == ["Alpha"]


def test_build_graph_excludes_axiom_bnodes(minimal_ttl: Path) -> None:
    g = ttl2json.build_graph(minimal_ttl)
    # axioms are bnode-only subjects — none of the node ids should be bnode-shaped
    assert not any(nid.startswith("_:") for nid in g.nodes)


def test_build_graph_edge_carries_axiom_annotations(minimal_ttl: Path) -> None:
    g = ttl2json.build_graph(minimal_ttl)
    edges = list(g.edges("http://example.org/a", keys=True, data=True))
    assert len(edges) == 1
    _, tgt, _, data = edges[0]
    assert tgt == "http://example.org/b"
    assert data["predicate"] == "http://example.org/rel"
    assert data["annotations"]["http://www.w3.org/2000/01/rdf-schema#comment"] == ["edge note"]
    assert data["annotations"]["http://example.org/evidence"] == ["http://example.org/ev1"]


def test_build_graph_edge_without_axiom_has_empty_annotations(tmp_path: Path) -> None:
    content = """\
@prefix : <http://ex/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
:a a owl:NamedIndividual .
:b a owl:NamedIndividual .
:a :rel :b .
"""
    p = tmp_path / "plain.ttl"
    p.write_text(content)
    g = ttl2json.build_graph(p)
    edges = list(g.edges(data=True))
    assert len(edges) == 1
    _, _, data = edges[0]
    assert data["predicate"] == "http://ex/rel"
    assert data["annotations"] == {}


# --- build_graph_from_string ----------------------------------------------


def test_build_graph_from_string_matches_build_graph(minimal_ttl: Path) -> None:
    """In-memory parse should produce the same MultiDiGraph as the file path
    parse — they share the same walk."""
    from_path = ttl2json.build_graph(minimal_ttl)
    from_string = ttl2json.build_graph_from_string(MINIMAL_TTL)

    assert isinstance(from_string, nx.MultiDiGraph)
    assert sorted(from_path.nodes) == sorted(from_string.nodes)
    assert sorted(from_path.edges(data=True)) == sorted(from_string.edges(data=True))

    for nid in from_path.nodes:
        assert from_path.nodes[nid] == from_string.nodes[nid]


def test_build_graph_from_string_rejects_non_turtle() -> None:
    with pytest.raises(Exception):
        ttl2json.build_graph_from_string("this is not turtle { } @@@")


# --- graph_to_json / convert_file -----------------------------------------


def test_graph_to_json_shape(minimal_ttl: Path) -> None:
    g = ttl2json.build_graph(minimal_ttl)
    data = ttl2json.graph_to_json(g)
    assert data["directed"] is True
    assert data["multigraph"] is True
    assert isinstance(data["nodes"], list) and data["nodes"]
    assert isinstance(data["links"], list) and data["links"]
    for n in data["nodes"]:
        assert set(n).issuperset({"id", "label", "types", "attributes"})
    for link in data["links"]:
        assert set(link).issuperset({"source", "target", "predicate", "annotations"})


def test_convert_file_writes_valid_json(minimal_ttl: Path, tmp_path: Path) -> None:
    out = tmp_path / "m.json"
    ttl2json.convert_file(minimal_ttl, out)
    data = json.loads(out.read_text())
    ids = {n["id"] for n in data["nodes"]}
    assert {"http://example.org/a", "http://example.org/b"} <= ids


# --- _needs_update ---------------------------------------------------------


def test_needs_update_when_dst_missing(tmp_path: Path) -> None:
    src = tmp_path / "s.ttl"
    src.write_text("x")
    assert ttl2json._needs_update(src, tmp_path / "nope.json") is True


def test_needs_update_when_dst_older(tmp_path: Path) -> None:
    dst = tmp_path / "d.json"
    dst.write_text("old")
    time.sleep(0.1)
    src = tmp_path / "s.ttl"
    src.write_text("newer")
    assert ttl2json._needs_update(src, dst) is True


def test_needs_update_when_dst_newer(tmp_path: Path) -> None:
    src = tmp_path / "s.ttl"
    src.write_text("old")
    time.sleep(0.1)
    dst = tmp_path / "d.json"
    dst.write_text("new")
    assert ttl2json._needs_update(src, dst) is False


# --- CLI main() ------------------------------------------------------------


def test_main_converts_single_file(tmp_path: Path, minimal_ttl: Path) -> None:
    outdir = tmp_path / "out"
    rc = ttl2json.main([str(minimal_ttl), "-o", str(outdir)])
    assert rc == 0
    assert (outdir / f"{minimal_ttl.stem}.json").exists()


def test_main_converts_directory(tmp_path: Path) -> None:
    src = tmp_path / "in"
    src.mkdir()
    (src / "a.ttl").write_text(MINIMAL_TTL)
    (src / "b.ttl").write_text(MINIMAL_TTL)
    outdir = tmp_path / "out"
    rc = ttl2json.main([str(src), "-o", str(outdir)])
    assert rc == 0
    assert (outdir / "a.json").exists()
    assert (outdir / "b.json").exists()


def test_main_errors_on_missing_path(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    rc = ttl2json.main([str(tmp_path / "missing"), "-o", str(tmp_path / "out")])
    assert rc == 1
    assert "does not exist" in capsys.readouterr().err


def test_main_errors_on_empty_directory(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    src = tmp_path / "in"
    src.mkdir()
    rc = ttl2json.main([str(src), "-o", str(tmp_path / "out")])
    assert rc == 1
    assert "no .ttl files" in capsys.readouterr().err


def test_main_errors_when_output_is_file(
    tmp_path: Path, minimal_ttl: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    bad = tmp_path / "out"
    bad.write_text("not a dir")
    rc = ttl2json.main([str(minimal_ttl), "-o", str(bad)])
    assert rc == 1
    assert "not a directory" in capsys.readouterr().err


def test_main_skips_up_to_date(tmp_path: Path, minimal_ttl: Path) -> None:
    outdir = tmp_path / "out"
    assert ttl2json.main([str(minimal_ttl), "-o", str(outdir)]) == 0
    dst = outdir / f"{minimal_ttl.stem}.json"
    mtime_first = dst.stat().st_mtime
    time.sleep(0.15)
    assert ttl2json.main([str(minimal_ttl), "-o", str(outdir)]) == 0
    assert dst.stat().st_mtime == mtime_first  # unchanged


def test_main_force_rewrites(tmp_path: Path, minimal_ttl: Path) -> None:
    outdir = tmp_path / "out"
    ttl2json.main([str(minimal_ttl), "-o", str(outdir)])
    dst = outdir / f"{minimal_ttl.stem}.json"
    mtime_first = dst.stat().st_mtime
    time.sleep(0.15)
    assert ttl2json.main([str(minimal_ttl), "-o", str(outdir), "--force"]) == 0
    assert dst.stat().st_mtime > mtime_first


# --- snapshot tests against committed sample conversions -------------------

SAMPLES = ["R-HSA-69563", "R-HSA-69478"]


@pytest.mark.parametrize("name", SAMPLES)
def test_sample_conversion_matches_expected(name: str, tmp_path: Path) -> None:
    src = DOWNLOADS / "input" / f"{name}.ttl"
    expected_path = DOWNLOADS / "output" / f"{name}.json"
    if not src.exists() or not expected_path.exists():
        pytest.skip(f"sample {name} not present in downloads/")

    out = tmp_path / f"{name}.json"
    ttl2json.convert_file(src, out)

    actual = json.loads(out.read_text())
    expected = json.loads(expected_path.read_text())
    assert _normalize(actual) == _normalize(expected)
