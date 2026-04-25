from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.domain.models import Graph, GraphEdge, GraphNode


def translate(raw: dict[str, Any]) -> Graph:
    nodes = [_translate_node(n) for n in raw.get("nodes", [])]
    edges = _translate_links(raw.get("links", []))
    return Graph(nodes=nodes, edges=edges)


def _translate_node(raw_node: dict[str, Any]) -> GraphNode:
    attrs: dict[str, object] = dict(raw_node.get("attributes") or {})
    types = raw_node.get("types") or []
    if types:
        attrs["rdf:type"] = list(types)
    return GraphNode(
        id=str(raw_node["id"]),
        label=raw_node.get("label"),
        attrs=attrs,
    )


def _translate_links(raw_links: list[dict[str, Any]]) -> list[GraphEdge]:
    counts: dict[tuple[str, str, str], int] = defaultdict(int)
    edges: list[GraphEdge] = []
    for link in raw_links:
        if "source" not in link:
            raise ValueError("edge is missing 'source'")
        if "target" not in link:
            raise ValueError("edge is missing 'target'")
        src = str(link["source"])
        tgt = str(link["target"])
        pred = str(link.get("predicate", ""))
        idx = counts[(src, pred, tgt)]
        counts[(src, pred, tgt)] = idx + 1
        edges.append(GraphEdge(
            id=f"{src}|{pred}|{tgt}|{idx}",
            source=src,
            target=tgt,
            label=pred if pred != "" else None,
            attrs=dict(link.get("annotations") or {}),
        ))
    return edges
