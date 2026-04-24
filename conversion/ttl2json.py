#!/usr/bin/env python3
"""Convert GO-CAM / Reactome Turtle files to networkx node-link JSON."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import networkx as nx
from rdflib import Graph, Literal, URIRef
from rdflib.namespace import OWL, RDF
from rdflib.term import BNode, Node


def collapse_axioms(g: Graph) -> tuple[dict, set]:
    """Find owl:Axiom reifications and return (edge_annotations, axiom_bnodes).

    edge_annotations maps (s, p, o) -> {predicate_uri: [values]} for each reified edge.
    axiom_bnodes is the set of bnodes that ARE the axioms themselves — their triples
    must be excluded from the main graph walk.
    """
    annotations: dict[tuple, dict[str, list]] = {}
    axiom_nodes: set[Node] = set()

    for axiom in g.subjects(RDF.type, OWL.Axiom):
        src = g.value(axiom, OWL.annotatedSource)
        prop = g.value(axiom, OWL.annotatedProperty)
        tgt = g.value(axiom, OWL.annotatedTarget)
        if src is None or prop is None or tgt is None:
            continue
        axiom_nodes.add(axiom)
        ann: dict[str, list] = defaultdict(list)
        for _, p, o in g.triples((axiom, None, None)):
            if p in (RDF.type, OWL.annotatedSource, OWL.annotatedProperty, OWL.annotatedTarget):
                continue
            ann[str(p)].append(_term_to_json(o))
        annotations[(src, prop, tgt)] = dict(ann)
    return annotations, axiom_nodes


def _term_to_json(term: Node) -> str:
    if isinstance(term, Literal):
        return str(term)
    if isinstance(term, URIRef):
        return str(term)
    if isinstance(term, BNode):
        return f"_:{term}"
    return str(term)


def _node_id(term: Node) -> str:
    return _term_to_json(term)


def build_graph(ttl_path: Path) -> nx.MultiDiGraph:
    g = Graph()
    g.parse(str(ttl_path), format="turtle")

    edge_annotations, axiom_nodes = collapse_axioms(g)

    # Per-subject accumulators
    labels: dict[str, str] = {}
    types: dict[str, list] = defaultdict(list)
    attributes: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    referenced: set[str] = set()  # subjects/objects that should exist as nodes

    RDFS_LABEL = URIRef("http://www.w3.org/2000/01/rdf-schema#label")

    out = nx.MultiDiGraph()

    for s, p, o in g:
        if s in axiom_nodes:
            continue  # axiom internals handled via collapse

        sid = _node_id(s)
        referenced.add(sid)

        if isinstance(o, Literal):
            if p == RDFS_LABEL:
                # Prefer first label seen; keep the rest in attributes too for fidelity.
                labels.setdefault(sid, str(o))
            attributes[sid][str(p)].append(str(o))
            continue

        # Object is IRI or BNode
        if p == RDF.type:
            types[sid].append(str(o))
            continue

        # Structural edge
        tid = _node_id(o)
        referenced.add(tid)
        ann = edge_annotations.get((s, p, o), {})
        out.add_edge(sid, tid, predicate=str(p), annotations=ann)

    # Materialize nodes with collected data
    for nid in referenced:
        out.add_node(
            nid,
            label=labels.get(nid),
            types=types.get(nid, []),
            attributes={k: v for k, v in attributes.get(nid, {}).items()},
        )

    return out


def graph_to_json(graph: nx.MultiDiGraph) -> dict:
    data = nx.node_link_data(graph, edges="links")
    return data


def convert_file(ttl_path: Path, out_path: Path) -> None:
    graph = build_graph(ttl_path)
    data = graph_to_json(graph)
    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _needs_update(src: Path, dst: Path) -> bool:
    return not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("path", type=Path, help="Turtle file or directory of .ttl files")
    ap.add_argument(
        "--force", action="store_true", help="Reconvert even if output is newer than source"
    )
    args = ap.parse_args(argv)

    path: Path = args.path
    if not path.exists():
        print(f"error: {path} does not exist", file=sys.stderr)
        return 1

    if path.is_file():
        targets = [path]
    else:
        targets = sorted(path.glob("*.ttl"))
        if not targets:
            print(f"error: no .ttl files in {path}", file=sys.stderr)
            return 1

    for ttl in targets:
        out = ttl.with_suffix(".json")
        if not args.force and not _needs_update(ttl, out):
            continue
        try:
            convert_file(ttl, out)
            print(f"{ttl} -> {out}")
        except Exception as e:
            print(f"error converting {ttl}: {e}", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
