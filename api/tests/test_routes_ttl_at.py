"""Tests for GET /api/graphs/{id}/ttl/at/{sha}.

Reuses the ephemeral-git-repo fixture pattern from `test_routes_history.py`.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.app import create_app
from app.config import Settings, get_settings


_TTL_V1 = "@prefix : <http://example.org/> .\n:a a :Thing .\n"
_TTL_V2 = "@prefix : <http://example.org/> .\n:a a :Thing .\n:b a :Thing .\n"


def _git_available() -> bool:
    try:
        subprocess.run(["git", "--version"], check=True, capture_output=True, text=True)
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
def models_repo_with_shas(tmp_path: Path) -> tuple[Path, str, str]:
    """Returns (repo_path, sha_v1, sha_v2)."""
    repo = tmp_path / "models-repo"
    repo.mkdir()
    _git(repo, "init", "-q")
    _git(repo, "config", "user.email", "tests@example.com")
    _git(repo, "config", "user.name", "Tests")
    _git(repo, "config", "commit.gpgsign", "false")
    (repo / "models").mkdir()

    target = repo / "models" / "R-HSA-test.ttl"
    target.write_text(_TTL_V1, encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "v1")
    sha_v1 = _git(repo, "rev-parse", "HEAD").stdout.strip()

    target.write_text(_TTL_V2, encoding="utf-8")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "v2")
    sha_v2 = _git(repo, "rev-parse", "HEAD").stdout.strip()

    return repo, sha_v1, sha_v2


@pytest.fixture
def ttl_at_client(graphs_dir: Path, input_dir: Path, models_repo_with_shas):
    repo, _, _ = models_repo_with_shas
    settings = Settings(
        graphs_dir=graphs_dir,
        input_dir=input_dir,
        models_git_repo=repo,
        models_git_subdir="models",
        host="127.0.0.1",
        port=8000,
        log_level="INFO",
    )
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        yield TestClient(app), models_repo_with_shas
    finally:
        app.dependency_overrides.clear()


def test_ttl_at_returns_v1_content(ttl_at_client):
    client, (_, sha_v1, _) = ttl_at_client
    resp = client.get(f"/api/graphs/R-HSA-test/ttl/at/{sha_v1}")
    assert resp.status_code == 200
    assert resp.text == _TTL_V1


def test_ttl_at_returns_v2_content(ttl_at_client):
    client, (_, _, sha_v2) = ttl_at_client
    resp = client.get(f"/api/graphs/R-HSA-test/ttl/at/{sha_v2}")
    assert resp.status_code == 200
    assert resp.text == _TTL_V2


def test_ttl_at_media_type_is_turtle(ttl_at_client):
    client, (_, sha_v1, _) = ttl_at_client
    resp = client.get(f"/api/graphs/R-HSA-test/ttl/at/{sha_v1}")
    assert resp.headers["content-type"].startswith("text/turtle")


def test_ttl_at_404_when_file_not_in_repo(ttl_at_client):
    client, (_, sha_v1, _) = ttl_at_client
    resp = client.get(f"/api/graphs/no-such-model/ttl/at/{sha_v1}")
    assert resp.status_code == 404


def test_ttl_at_400_on_bad_sha(ttl_at_client):
    client, _ = ttl_at_client
    resp = client.get("/api/graphs/R-HSA-test/ttl/at/HEAD~1")
    # SHA regex rejects refs like HEAD~1; service raises InvalidGraphId → 400.
    assert resp.status_code == 400


def test_ttl_at_400_on_bad_id(ttl_at_client):
    client, (_, sha_v1, _) = ttl_at_client
    resp = client.get(f"/api/graphs/bad@id/ttl/at/{sha_v1}")
    assert resp.status_code == 400


def test_ttl_at_503_when_repo_unset(graphs_dir: Path):
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
            resp = c.get("/api/graphs/anything/ttl/at/abcdef0")
        assert resp.status_code == 503
    finally:
        app.dependency_overrides.clear()
