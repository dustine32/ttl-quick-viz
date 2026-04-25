from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_conversion_service, get_service
from app.domain.models import ConvertResponse, Graph, GraphConversionResult, GraphSummary
from app.services.conversion_service import ConversionService
from app.services.graph_service import GraphService

router = APIRouter(tags=["graphs"])


@router.get("/graphs", response_model=list[GraphSummary])
def list_graphs(service: GraphService = Depends(get_service)) -> list[GraphSummary]:
    return service.list_graphs()


@router.get("/graphs/{graph_id}", response_model=Graph)
def get_graph(graph_id: str, service: GraphService = Depends(get_service)) -> Graph:
    return service.get_graph(graph_id)


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
