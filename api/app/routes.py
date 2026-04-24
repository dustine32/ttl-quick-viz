from __future__ import annotations

import logging
import re
from json import JSONDecodeError

from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.schemas import Graph, GraphSummary
from app.store import GraphNotFound, GraphStore
from app.translate import translate

logger = logging.getLogger(__name__)

_ID_RE = re.compile(r"^[A-Za-z0-9_.-]+$")

router = APIRouter()


def get_store(settings: Settings = Depends(get_settings)) -> GraphStore:
    return GraphStore(settings.graphs_dir)


def _validate_id(graph_id: str) -> None:
    # The regex already forbids '/' etc.; '..' passes the regex (dots allowed),
    # so block it explicitly as a belt-and-braces traversal guard.
    if not _ID_RE.match(graph_id) or ".." in graph_id:
        raise HTTPException(status_code=400, detail="invalid graph id")


@router.get("/graphs", response_model=list[GraphSummary])
def list_graphs(store: GraphStore = Depends(get_store)) -> list[GraphSummary]:
    summaries: list[GraphSummary] = []
    for graph_id in store.list_ids():
        try:
            raw = store.load_raw(graph_id)
        except (JSONDecodeError, ValueError) as exc:
            logger.warning("skipping malformed graph %r: %s", graph_id, exc)
            continue
        summaries.append(GraphSummary(
            id=graph_id,
            nodeCount=len(raw.get("nodes") or []),
            edgeCount=len(raw.get("links") or []),
        ))
    return summaries


@router.get("/graphs/{graph_id}", response_model=Graph)
def get_graph(graph_id: str, store: GraphStore = Depends(get_store)) -> Graph:
    _validate_id(graph_id)
    try:
        raw = store.load_raw(graph_id)
    except GraphNotFound:
        raise HTTPException(status_code=404, detail="graph not found")
    except (JSONDecodeError, ValueError) as exc:
        # json.JSONDecodeError is a subclass of ValueError; both surface here
        # if the file exists but is unreadable.
        logger.exception("failed to read graph %r", graph_id)
        raise HTTPException(
            status_code=500,
            detail=f"failed to read graph: {exc}",
        )
    try:
        return translate(raw)
    except ValueError as exc:
        logger.exception("failed to translate graph %r", graph_id)
        raise HTTPException(
            status_code=500,
            detail=f"failed to read graph: {exc}",
        )
