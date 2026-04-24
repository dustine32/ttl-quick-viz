from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app


@pytest.fixture
def graphs_dir(tmp_path: Path) -> Path:
    return tmp_path


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
def client(graphs_dir: Path, monkeypatch: pytest.MonkeyPatch):
    # The startup handler in main.py calls get_settings() directly, bypassing
    # dependency_overrides. Set GRAPHS_DIR in the env so Settings() picks up
    # graphs_dir at startup, and clear the lru_cache so the override takes effect.
    monkeypatch.setenv("GRAPHS_DIR", str(graphs_dir))
    get_settings.cache_clear()

    def override() -> Settings:
        return Settings(graphs_dir=graphs_dir)

    app.dependency_overrides[get_settings] = override
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        get_settings.cache_clear()
