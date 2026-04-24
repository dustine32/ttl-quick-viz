from __future__ import annotations


def _good_graph():
    return {
        "directed": True,
        "multigraph": True,
        "graph": {},
        "nodes": [
            {"id": "a", "label": "Alpha",
             "types": ["http://example.com/T"],
             "attributes": {"p": ["v"]}},
            {"id": "b", "label": None, "types": [], "attributes": {}},
        ],
        "links": [
            {"source": "a", "target": "b", "predicate": "p",
             "annotations": {"n": ["x"]}},
            {"source": "a", "target": "b", "predicate": "p", "annotations": {}},
        ],
    }


def test_list_graphs_returns_summaries_with_counts(client, write_graph):
    write_graph("good", _good_graph())
    resp = client.get("/graphs")
    assert resp.status_code == 200
    assert resp.json() == [
        {"id": "good", "nodeCount": 2, "edgeCount": 2}
    ]


def test_list_graphs_empty_dir(client):
    resp = client.get("/graphs")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_graphs_is_sorted(client, write_graph):
    write_graph("zeta", _good_graph())
    write_graph("alpha", _good_graph())
    ids = [s["id"] for s in client.get("/graphs").json()]
    assert ids == ["alpha", "zeta"]


def test_get_graph_returns_translated_shape(client, write_graph):
    write_graph("good", _good_graph())
    resp = client.get("/graphs/good")
    assert resp.status_code == 200
    body = resp.json()
    assert [n["id"] for n in body["nodes"]] == ["a", "b"]
    assert body["nodes"][0]["attrs"]["rdf:type"] == ["http://example.com/T"]
    assert body["nodes"][1]["label"] is None
    assert [e["id"] for e in body["edges"]] == ["a|p|b|0", "a|p|b|1"]
    assert body["edges"][0]["label"] == "p"
    assert body["edges"][0]["attrs"] == {"n": ["x"]}


def test_get_graph_404_on_unknown_id(client):
    resp = client.get("/graphs/does-not-exist")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "graph not found"}


def test_get_graph_blocks_dot_dot_traversal(client):
    # '..' is a traversal attempt. The HTTPX/ASGI transport normalises
    # '/graphs/..' → '/' before Starlette routing, so our handler never
    # receives the segment; the framework issues a 404 instead of our 400.
    # Either way the traversal is blocked (non-200), which is the safety
    # invariant we care about.
    resp = client.get("/graphs/..")
    assert resp.status_code in (400, 404)


def test_get_graph_400_on_id_with_disallowed_chars(client):
    # '@' is not in the allowed charset.
    resp = client.get("/graphs/bad@id")
    assert resp.status_code == 400
    assert resp.json() == {"detail": "invalid graph id"}


def test_get_graph_500_on_malformed_json(client, write_graph):
    write_graph("broken", "{not valid json")
    resp = client.get("/graphs/broken")
    assert resp.status_code == 500
    assert "failed to read graph" in resp.json()["detail"]


def test_get_graph_500_on_translator_failure(client, write_graph):
    # missing target on the single edge triggers translator ValueError
    write_graph("bad-edge", {
        "nodes": [{"id": "a"}],
        "links": [{"source": "a", "predicate": "p"}],
    })
    resp = client.get("/graphs/bad-edge")
    assert resp.status_code == 500
    assert "failed to read graph" in resp.json()["detail"]


def test_list_graphs_skips_malformed_entries_gracefully(client, write_graph):
    write_graph("good", {
        "directed": True, "multigraph": True, "graph": {},
        "nodes": [{"id": "a"}], "links": [],
    })
    write_graph("broken", "{not valid json")
    # list endpoint should still return a result for 'good' and either skip
    # or 500 on 'broken' — we assert the safe behavior: skip broken entries.
    resp = client.get("/graphs")
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert "good" in ids
    assert "broken" not in ids
