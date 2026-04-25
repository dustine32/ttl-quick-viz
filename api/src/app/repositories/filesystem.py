from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.repositories.base import GraphNotFound


class FilesystemGraphRepository:
    def __init__(self, graphs_dir: Path) -> None:
        self._dir = Path(graphs_dir)
        self._summary_cache: dict[str, tuple[float, int, int]] = {}

    def list_ids(self) -> list[str]:
        if not self._dir.is_dir():
            return []
        return sorted(
            p.stem for p in self._dir.iterdir()
            if p.is_file() and p.suffix == ".json"
        )

    def load_raw(self, graph_id: str) -> dict[str, Any]:
        path = self._resolve(graph_id)
        return json.loads(path.read_text(encoding="utf-8"))

    def count(self, graph_id: str) -> tuple[int, int]:
        path = self._resolve(graph_id)
        mtime = path.stat().st_mtime
        cached = self._summary_cache.get(graph_id)
        if cached is not None and cached[0] == mtime:
            return cached[1], cached[2]
        raw = json.loads(path.read_text(encoding="utf-8"))
        nodes = len(raw.get("nodes") or [])
        edges = len(raw.get("links") or [])
        self._summary_cache[graph_id] = (mtime, nodes, edges)
        return nodes, edges

    def mtime(self, graph_id: str) -> float:
        return self._resolve(graph_id).stat().st_mtime

    def _resolve(self, graph_id: str) -> Path:
        candidate = (self._dir / f"{graph_id}.json").resolve()
        root = self._dir.resolve()
        if root != candidate.parent and root not in candidate.parents:
            raise GraphNotFound(graph_id)
        if not candidate.is_file():
            raise GraphNotFound(graph_id)
        return candidate
