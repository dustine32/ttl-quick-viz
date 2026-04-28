"""Orchestrates git history lookup + in-memory ttl2json conversion + translate.

Consumes :class:`GitHistoryService` for the git side and reuses
``ttl2json.build_graph_from_string`` + ``app.domain.translate.translate`` for
the conversion side, so historical graphs land in the same wire shape as
``GET /api/graphs/{id}``.
"""

from __future__ import annotations

import logging

from ttl2json import build_graph_from_string, graph_to_json

from app.domain.models import HistoryEntry
from app.domain.translate import translate
from app.services.git_history_service import GitHistoryService

logger = logging.getLogger(__name__)


class DiffService:
    def __init__(self, git: GitHistoryService) -> None:
        self._git = git

    def get_history(self, graph_id: str, n: int) -> list[HistoryEntry]:
        commits = self._git.list_history(graph_id, n)
        entries: list[HistoryEntry] = []
        for c in commits:
            ttl = self._git.read_ttl_at(c.sha, graph_id)
            try:
                nx_graph = build_graph_from_string(ttl)
                raw = graph_to_json(nx_graph)
                graph = translate(raw)
            except Exception:
                logger.exception("conversion failed for %s @ %s; skipping entry", graph_id, c.sha)
                continue
            entries.append(
                HistoryEntry(sha=c.sha, subject=c.subject, date=c.date, graph=graph)
            )
        return entries
