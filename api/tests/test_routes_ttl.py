from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.app import create_app
from app.config import Settings, get_settings


_SAMPLE_TTL = """\
@prefix ex: <http://example.com/> .
@prefix obo: <http://purl.obolibrary.org/obo/> .

ex:a obo:RO_0002411 ex:b ;
     obo:RO_0002233 ex:c .
"""


def test_get_ttl_returns_raw_content(client: TestClient, write_ttl):
    write_ttl("good", _SAMPLE_TTL)
    resp = client.get("/api/graphs/good/ttl")
    assert resp.status_code == 200
    assert resp.text == _SAMPLE_TTL


def test_get_ttl_media_type_is_turtle(client: TestClient, write_ttl):
    write_ttl("good", _SAMPLE_TTL)
    resp = client.get("/api/graphs/good/ttl")
    assert resp.headers["content-type"].startswith("text/turtle")


def test_get_ttl_preserves_utf8(client: TestClient, write_ttl):
    content = "@prefix ex: <http://example.com/> .\nex:a ex:label \"éclat\" .\n"
    write_ttl("utf8", content)
    resp = client.get("/api/graphs/utf8/ttl")
    assert resp.status_code == 200
    assert resp.text == content


def test_get_ttl_404_when_file_missing(client: TestClient):
    resp = client.get("/api/graphs/does-not-exist/ttl")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "source ttl not found"}


def test_get_ttl_400_on_disallowed_chars(client: TestClient):
    resp = client.get("/api/graphs/bad@id/ttl")
    assert resp.status_code == 400
    assert resp.json() == {"detail": "invalid graph id"}


def test_get_ttl_blocks_dot_dot(client: TestClient):
    resp = client.get("/api/graphs/../ttl")
    # ASGI routing may normalise '..' before the handler runs, returning 404.
    # Either way the traversal is blocked (non-200) — that is the safety
    # invariant we care about.
    assert resp.status_code in (400, 404)


def test_get_ttl_503_when_input_dir_unset(graphs_dir: Path):
    settings_no_input = Settings(
        graphs_dir=graphs_dir,
        input_dir=None,
        host="127.0.0.1",
        port=8000,
        log_level="INFO",
    )
    app = create_app(settings_no_input)
    app.dependency_overrides[get_settings] = lambda: settings_no_input
    try:
        with TestClient(app) as c:
            resp = c.get("/api/graphs/anything/ttl")
        assert resp.status_code == 503
        assert "INPUT_DIR" in resp.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_get_ttl_does_not_resolve_symlink_outside_input_dir(
    client: TestClient, input_dir: Path, tmp_path: Path
):
    """Defense in depth: a symlink whose target is outside INPUT_DIR is not served."""
    outside = tmp_path / "secret.ttl"
    outside.write_text("SECRET", encoding="utf-8")
    link = input_dir / "leak.ttl"
    try:
        link.symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not supported on this platform / process")

    resp = client.get("/api/graphs/leak/ttl")
    # Either 404 (symlink resolves outside root → blocked) or 200 + secret
    # would be a vulnerability. Assert we never hand the secret back.
    assert resp.status_code == 404 or resp.text != "SECRET"
