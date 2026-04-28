"""ttl2json — convert GO-CAM / Reactome Turtle files to networkx node-link JSON."""

from __future__ import annotations

from ttl2json.core import (
    ConversionResult,
    build_graph,
    build_graph_from_string,
    convert_dir,
    convert_file,
    graph_to_json,
    needs_update,
)

__all__ = [
    "ConversionResult",
    "build_graph",
    "build_graph_from_string",
    "convert_dir",
    "convert_file",
    "graph_to_json",
    "needs_update",
]
