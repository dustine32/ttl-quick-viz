from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.api.deps import (
    get_conversion_service,
    get_diff_service,
    get_git_history_service,
    get_service,
)
from app.domain.models import (
    ConvertResponse,
    Graph,
    GraphConversionResult,
    GraphSummary,
    HistoryEntry,
)
from app.services.conversion_service import ConversionService
from app.services.diff_service import DiffService
from app.services.git_history_service import GitHistoryService
from app.services.graph_service import GraphService

router = APIRouter(tags=["graphs"])


@router.get("/graphs", response_model=list[GraphSummary])
def list_graphs(service: GraphService = Depends(get_service)) -> list[GraphSummary]:
    return service.list_graphs()


@router.get("/graphs/{graph_id}", response_model=Graph)
def get_graph(graph_id: str, service: GraphService = Depends(get_service)) -> Graph:
    return service.get_graph(graph_id)


@router.get("/graphs/{graph_id}/ttl", response_class=Response)
def get_graph_ttl(
    graph_id: str,
    conversion: ConversionService = Depends(get_conversion_service),
) -> Response:
    ttl = conversion.get_ttl(graph_id)
    return Response(content=ttl, media_type="text/turtle; charset=utf-8")


@router.post("/convert", response_model=ConvertResponse)
def convert_all(
    force: bool = Query(default=False),
    conversion: ConversionService = Depends(get_conversion_service),
) -> ConvertResponse:
    """Re-run ttl2json on every .ttl in INPUT_DIR. Per-file errors are reported, not raised."""
    return conversion.rebuild_all(force=force)


@router.post("/graphs/{graph_id}/rebuild", response_model=GraphConversionResult)
def rebuild_graph(
    graph_id: str,
    force: bool = Query(default=True),
    conversion: ConversionService = Depends(get_conversion_service),
) -> GraphConversionResult:
    """Re-run ttl2json on <INPUT_DIR>/<graph_id>.ttl."""
    return conversion.rebuild_one(graph_id, force=force)


@router.get("/graphs/{graph_id}/history", response_model=list[HistoryEntry])
def get_graph_history(
    graph_id: str,
    n: int = Query(default=5, ge=1, le=20),
    diff: DiffService = Depends(get_diff_service),
) -> list[HistoryEntry]:
    """Last `n` commits in MODELS_GIT_REPO that touched models/<id>.ttl,
    each converted to a Graph in-memory."""
    return diff.get_history(graph_id, n)


@router.get("/graphs/{graph_id}/ttl/at/{sha}", response_class=Response)
def get_graph_ttl_at(
    graph_id: str,
    sha: str,
    git: GitHistoryService = Depends(get_git_history_service),
) -> Response:
    """Raw TTL of `<subdir>/<graph_id>.ttl` at commit `sha`. Powers the
    side-by-side TTL diff pane."""
    ttl = git.read_ttl_at(sha, graph_id)
    return Response(content=ttl, media_type="text/turtle; charset=utf-8")
