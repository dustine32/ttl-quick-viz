from __future__ import annotations

import logging
import re
from json import JSONDecodeError

from app.domain.models import Graph, GraphSummary
from app.domain.translate import translate
from app.repositories.base import GraphRepository

logger = logging.getLogger(__name__)

_ID_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


class InvalidGraphId(Exception):
    pass


class GraphService:
    def __init__(self, repo: GraphRepository) -> None:
        self._repo = repo

    def list_graphs(self) -> list[GraphSummary]:
        summaries: list[GraphSummary] = []
        for graph_id in self._repo.list_ids():
            try:
                nodes, edges = self._repo.count(graph_id)
                mtime = self._repo.mtime(graph_id)
            except (JSONDecodeError, ValueError) as exc:
                logger.warning("skipping malformed graph %r: %s", graph_id, exc)
                continue
            summaries.append(GraphSummary(
                id=graph_id,
                nodeCount=nodes,
                edgeCount=edges,
                lastConvertedAt=mtime,
            ))
        return summaries

    def get_graph(self, graph_id: str) -> Graph:
        self._validate_id(graph_id)
        raw = self._repo.load_raw(graph_id)
        return translate(raw)

    @staticmethod
    def _validate_id(graph_id: str) -> None:
        if not _ID_RE.match(graph_id) or ".." in graph_id:
            raise InvalidGraphId(graph_id)
