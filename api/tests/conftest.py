from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

import pytest
from fastapi.testclient import TestClient

from app.api.app import create_app
from app.config import Settings, get_settings


@pytest.fixture
def graphs_dir(tmp_path: Path) -> Path:
    return tmp_path


@pytest.fixture
def input_dir(tmp_path: Path) -> Path:
    d = tmp_path / "input"
    d.mkdir()
    return d


@pytest.fixture
def write_graph(graphs_dir: Path) -> Callable[[str, Any], None]:
    def _write(name: str, payload: Any) -> None:
        path = graphs_dir / f"{name}.json"
        if isinstance(payload, (dict, list)):
            path.write_text(json.dumps(payload))
        else:
            path.write_text(payload)
    return _write


@pytest.fixture
def write_ttl(input_dir: Path) -> Callable[[str, str], None]:
    def _write(name: str, content: str) -> None:
        (input_dir / f"{name}.ttl").write_text(content, encoding="utf-8")
    return _write


@pytest.fixture
def settings(graphs_dir: Path, input_dir: Path) -> Settings:
    return Settings(
        graphs_dir=graphs_dir,
        input_dir=input_dir,
        host="127.0.0.1",
        port=8000,
        log_level="INFO",
    )


@pytest.fixture
def client(settings: Settings):
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
