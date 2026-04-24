from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class GraphNotFound(Exception):
    """Raised when a requested graph id does not map to a readable file."""


class GraphStore:
    def __init__(self, graphs_dir: Path) -> None:
        self._dir = Path(graphs_dir)

    def list_ids(self) -> list[str]:
        if not self._dir.is_dir():
            return []
        return sorted(
            p.stem for p in self._dir.iterdir()
            if p.is_file() and p.suffix == ".json"
        )

    def load_raw(self, graph_id: str) -> dict[str, Any]:
        path = self._dir / f"{graph_id}.json"
        if not path.is_file():
            raise GraphNotFound(graph_id)
        return json.loads(path.read_text())
