from __future__ import annotations


def test_healthz_returns_ok(client):
    resp = client.get("/api/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_healthz_works_on_empty_graphs_dir(client):
    # The endpoint must not depend on there being any graphs.
    resp = client.get("/api/healthz")
    assert resp.status_code == 200
