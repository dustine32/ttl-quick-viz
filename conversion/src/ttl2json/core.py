"""Core conversion: TTL -> networkx MultiDiGraph -> node_link_data JSON."""

from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path

import networkx as nx
from rdflib import Graph, Literal, URIRef
from rdflib.namespace import OWL, RDF
from rdflib.term import BNode, Node

logger = logging.getLogger(__name__)

RDFS_LABEL = URIRef("http://www.w3.org/2000/01/rdf-schema#label")


@dataclass
class ConversionResult:
    id: str
    ok: bool
    input_path: Path
    output_path: Path
    node_count: int | None = None
    edge_count: int | None = None
    duration_ms: float | None = None
    skipped: bool = False
    error: str | None = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["input_path"] = str(self.input_path)
        d["output_path"] = str(self.output_path)
        return d


def collapse_axioms(g: Graph) -> tuple[dict, set]:
    """Find owl:Axiom reifications and return (edge_annotations, axiom_bnodes).

    edge_annotations maps (s, p, o) -> {predicate_uri: [values]}.
    axiom_bnodes is the set of bnodes that ARE the axioms themselves — their
    triples are excluded from the main graph walk.
    """
    annotations: dict[tuple, dict[str, list]] = {}
    axiom_nodes: set[Node] = set()

    for axiom in g.subjects(RDF.type, OWL.Axiom):
        src = g.value(axiom, OWL.annotatedSource)
        prop = g.value(axiom, OWL.annotatedProperty)
        tgt = g.value(axiom, OWL.annotatedTarget)
        if src is None or prop is None or tgt is None:
            logger.warning("axiom %r missing source/property/target; skipping", axiom)
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
    return _walk_rdflib_graph(g)


def build_graph_from_string(ttl_text: str) -> nx.MultiDiGraph:
    """Build the same MultiDiGraph as `build_graph` from in-memory TTL text.

    Useful for callers that have the TTL bytes already (e.g. via `git show`)
    and don't want to round-trip through a temp file.
    """
    g = Graph()
    g.parse(data=ttl_text, format="turtle")
    return _walk_rdflib_graph(g)


def _walk_rdflib_graph(g: Graph) -> nx.MultiDiGraph:
    edge_annotations, axiom_nodes = collapse_axioms(g)

    labels: dict[str, str] = {}
    types: dict[str, list] = defaultdict(list)
    attributes: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    referenced: set[str] = set()

    out = nx.MultiDiGraph()

    for s, p, o in g:
        if s in axiom_nodes:
            continue

        sid = _node_id(s)
        referenced.add(sid)

        if isinstance(o, Literal):
            if p == RDFS_LABEL:
                labels.setdefault(sid, str(o))
            attributes[sid][str(p)].append(str(o))
            continue

        if p == RDF.type:
            types[sid].append(str(o))
            continue

        tid = _node_id(o)
        referenced.add(tid)
        ann = edge_annotations.get((s, p, o), {})
        out.add_edge(sid, tid, predicate=str(p), annotations=ann)

    for nid in sorted(referenced):
        out.add_node(
            nid,
            label=labels.get(nid),
            types=types.get(nid, []),
            attributes=dict(attributes.get(nid, {})),
        )

    return out


def graph_to_json(graph: nx.MultiDiGraph) -> dict:
    return nx.node_link_data(graph, edges="links")


def needs_update(src: Path, dst: Path) -> bool:
    return not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime


def convert_file(
    input_path: Path,
    output_dir: Path,
    *,
    force: bool = False,
) -> ConversionResult:
    """Convert one `.ttl` to `<stem>.json` in `output_dir`.

    Returns a `ConversionResult`; on failure `ok=False` and `error` is set.
    Never raises for per-file conversion errors.
    """
    input_path = Path(input_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{input_path.stem}.json"

    if not force and not needs_update(input_path, output_path):
        return ConversionResult(
            id=input_path.stem,
            ok=True,
            input_path=input_path,
            output_path=output_path,
            skipped=True,
        )

    start = time.perf_counter()
    try:
        graph = build_graph(input_path)
        data = graph_to_json(graph)
        output_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True),
            encoding="utf-8",
        )
        duration_ms = (time.perf_counter() - start) * 1000.0
        return ConversionResult(
            id=input_path.stem,
            ok=True,
            input_path=input_path,
            output_path=output_path,
            node_count=len(data.get("nodes") or []),
            edge_count=len(data.get("links") or []),
            duration_ms=duration_ms,
        )
    except Exception as exc:
        logger.exception("conversion failed for %s", input_path)
        return ConversionResult(
            id=input_path.stem,
            ok=False,
            input_path=input_path,
            output_path=output_path,
            error=str(exc),
            duration_ms=(time.perf_counter() - start) * 1000.0,
        )


def convert_dir(
    input_dir: Path,
    output_dir: Path,
    *,
    force: bool = False,
) -> list[ConversionResult]:
    """Convert every `*.ttl` in `input_dir`. Continues on per-file failure."""
    input_dir = Path(input_dir)
    if not input_dir.is_dir():
        raise NotADirectoryError(f"input is not a directory: {input_dir}")

    results: list[ConversionResult] = []
    for ttl in sorted(input_dir.glob("*.ttl")):
        results.append(convert_file(ttl, output_dir, force=force))
    return results
