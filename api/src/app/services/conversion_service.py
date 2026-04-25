from __future__ import annotations

import logging
import re
from pathlib import Path

from ttl2json import ConversionResult, convert_dir, convert_file

from app.domain.models import ConvertResponse, GraphConversionResult

logger = logging.getLogger(__name__)

_ID_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


class InputDirNotConfigured(Exception):
    pass


class InvalidGraphId(Exception):
    pass


class TtlNotFound(Exception):
    pass


def _to_api_result(r: ConversionResult) -> GraphConversionResult:
    return GraphConversionResult(
        id=r.id,
        ok=r.ok,
        skipped=r.skipped,
        nodeCount=r.node_count,
        edgeCount=r.edge_count,
        durationMs=r.duration_ms,
        error=r.error,
    )


class ConversionService:
    """Drives ttl2json on demand; writes into graphs_dir."""

    def __init__(self, input_dir: Path | None, graphs_dir: Path) -> None:
        self._input_dir = Path(input_dir) if input_dir is not None else None
        self._graphs_dir = Path(graphs_dir)

    def rebuild_all(self, *, force: bool = False) -> ConvertResponse:
        input_dir = self._require_input_dir()
        results = convert_dir(input_dir, self._graphs_dir, force=force)
        return _summarize(results)

    def rebuild_one(self, graph_id: str, *, force: bool = True) -> GraphConversionResult:
        self._validate_id(graph_id)
        input_dir = self._require_input_dir()
        ttl_path = input_dir / f"{graph_id}.ttl"
        if not ttl_path.is_file():
            raise TtlNotFound(graph_id)
        result = convert_file(ttl_path, self._graphs_dir, force=force)
        return _to_api_result(result)

    def _require_input_dir(self) -> Path:
        if self._input_dir is None:
            raise InputDirNotConfigured("INPUT_DIR is not set")
        if not self._input_dir.is_dir():
            raise InputDirNotConfigured(
                f"INPUT_DIR does not exist or is not a directory: {self._input_dir}"
            )
        return self._input_dir

    @staticmethod
    def _validate_id(graph_id: str) -> None:
        if not _ID_RE.match(graph_id) or ".." in graph_id:
            raise InvalidGraphId(graph_id)


def _summarize(results: list[ConversionResult]) -> ConvertResponse:
    api_results = [_to_api_result(r) for r in results]
    ok = sum(1 for r in results if r.ok and not r.skipped)
    skipped = sum(1 for r in results if r.skipped)
    errors = sum(1 for r in results if not r.ok)
    return ConvertResponse(
        results=api_results,
        okCount=ok,
        errorCount=errors,
        skippedCount=skipped,
    )
