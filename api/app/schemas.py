from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class GraphNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    label: str | None = None
    attrs: dict[str, object] = {}


class GraphEdge(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    source: str
    target: str
    label: str | None = None
    attrs: dict[str, object] = {}


class Graph(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nodes: list[GraphNode]
    edges: list[GraphEdge]


class GraphSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    nodeCount: int
    edgeCount: int
