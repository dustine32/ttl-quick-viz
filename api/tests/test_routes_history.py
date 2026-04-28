"""Tests for GET /api/graphs/{id}/history.

Builds an ephemeral git repo with two commits of one TTL file so the
endpoint has real history to read.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.app import create_app
from app.config import Settings, get_settings


_TTL_V1 = """\
@prefix : <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:a a owl:NamedIndividual ;
   rdfs:label "Alpha" ;
   :rel :b .

:b a owl:NamedIndividual ;
   rdfs:label "Beta" .
"""

_TTL_V2 = """\
@prefix : <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:a a owl:NamedIndividual ;
   rdfs:label "Alpha (v2)" ;
   :rel :b ,
        :c .

:b a owl:NamedIndividual ;
   rdfs:label "Beta" .

:c a owl:NamedIndividual ;
   rdfs:label "Gamma" .
"""


def _git_available() -> bool:
    try:
        subprocess.run(
            ["git", "--version"], check=True, capture_output=True, text=True
        )
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


pytestmark = pytest.mark.skipif(
    not _git_available(),
    reason="git CLI not available on this machine",
)


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


@pytest.fixture
def models_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "models-repo"
    repo.mkdir()
    _git(repo, "init", "-q")
    _git(repo, "config", "user.email", "tests@example.com")
    _git(repo, "config", "user.name", "Tests")
    _git(repo, "config", "commit.gpgsign", "false")

    models_dir = repo / "models"
    models_dir.mkdir()

    target = models_dir / "R-HSA-test.ttl"
    target.write_text(_TTL_V1, encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "release v1")

    target.write_text(_TTL_V2, encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "release v2 — added gamma")

    return repo


@pytest.fixture
def history_settings(graphs_dir: Path, input_dir: Path, models_repo: Path) -> Settings:
    return Settings(
        graphs_dir=graphs_dir,
        input_dir=input_dir,
        models_git_repo=models_repo,
        models_git_subdir="models",
        host="127.0.0.1",
        port=8000,
        log_level="INFO",
    )


@pytest.fixture
def history_client(history_settings: Settings):
    app = create_app(history_settings)
    app.dependency_overrides[get_settings] = lambda: history_settings
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_history_returns_two_commits(history_client: TestClient):
    resp = history_client.get("/api/graphs/R-HSA-test/history?n=5")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 2
    # Most recent first.
    assert "v2" in body[0]["subject"]
    assert "v1" in body[1]["subject"]


def test_history_entries_have_graph_shape(history_client: TestClient):
    resp = history_client.get("/api/graphs/R-HSA-test/history?n=5")
    body = resp.json()
    for entry in body:
        assert isinstance(entry["sha"], str) and len(entry["sha"]) >= 7
        assert isinstance(entry["subject"], str)
        assert isinstance(entry["date"], str)
        graph = entry["graph"]
        assert "nodes" in graph and "edges" in graph
        assert isinstance(graph["nodes"], list)
        assert isinstance(graph["edges"], list)


def test_history_v2_has_more_nodes_than_v1(history_client: TestClient):
    resp = history_client.get("/api/graphs/R-HSA-test/history?n=5")
    body = resp.json()
    v2_nodes = len(body[0]["graph"]["nodes"])
    v1_nodes = len(body[1]["graph"]["nodes"])
    assert v2_nodes > v1_nodes  # Gamma added in v2.


def test_history_n_clamps(history_client: TestClient):
    resp = history_client.get("/api/graphs/R-HSA-test/history?n=1")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_history_n_validation_below_range(history_client: TestClient):
    resp = history_client.get("/api/graphs/R-HSA-test/history?n=0")
    assert resp.status_code == 422


def test_history_n_validation_above_range(history_client: TestClient):
    resp = history_client.get("/api/graphs/R-HSA-test/history?n=99")
    assert resp.status_code == 422


def test_history_404_when_file_not_in_repo(history_client: TestClient):
    resp = history_client.get("/api/graphs/no-such-model/history")
    assert resp.status_code == 404
    assert "history" in resp.json()["detail"].lower()


def test_history_400_on_bad_id(history_client: TestClient):
    resp = history_client.get("/api/graphs/bad@id/history")
    assert resp.status_code == 400


def test_history_503_when_repo_unset(graphs_dir: Path):
    settings_no_repo = Settings(
        graphs_dir=graphs_dir,
        input_dir=None,
        models_git_repo=None,
        host="127.0.0.1",
        port=8000,
        log_level="INFO",
    )
    app = create_app(settings_no_repo)
    app.dependency_overrides[get_settings] = lambda: settings_no_repo
    try:
        with TestClient(app) as c:
            resp = c.get("/api/graphs/anything/history")
        assert resp.status_code == 503
        assert "MODELS_GIT_REPO" in resp.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_history_503_when_repo_not_a_git_tree(graphs_dir: Path, tmp_path: Path):
    not_a_repo = tmp_path / "not-a-repo"
    not_a_repo.mkdir()
    settings = Settings(
        graphs_dir=graphs_dir,
        input_dir=None,
        models_git_repo=not_a_repo,
        host="127.0.0.1",
        port=8000,
        log_level="INFO",
    )
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        with TestClient(app) as c:
            resp = c.get("/api/graphs/anything/history")
        assert resp.status_code == 503
    finally:
        app.dependency_overrides.clear()
