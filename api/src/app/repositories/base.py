from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


class GraphNotFound(Exception):
    pass


@runtime_checkable
class GraphRepository(Protocol):
    def list_ids(self) -> list[str]: ...
    def load_raw(self, graph_id: str) -> dict[str, Any]: ...
    def count(self, graph_id: str) -> tuple[int, int]: ...
    def mtime(self, graph_id: str) -> float: ...
