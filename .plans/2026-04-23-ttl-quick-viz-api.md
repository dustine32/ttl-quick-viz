# TTL Quick Viz — API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commits:** This project's owner handles all git operations. Do NOT run `git add` or `git commit`. End each task at the "Checkpoint" marker and stop.

**Goal:** Stand up a read-only FastAPI service in `api/` that serves graph JSON produced by `conversion/ttl2json.py` to the `site/` React SPA, and flip the site from its bundled-fixture data source to real HTTP.

**Architecture:** FastAPI app with a directory-backed graph store, a pure-function translator from NetworkX `node_link_data` into the site's `{nodes, edges}` shape, two endpoints (`GET /graphs`, `GET /graphs/{id}`), and a Vite dev proxy (`/api/*` → `:8000`). Site keeps its existing types; the API reshapes on the wire.

**Tech Stack:**
- API: Python 3.11+, FastAPI, Uvicorn, pydantic, pydantic-settings, pytest, httpx (via FastAPI `TestClient`)
- Site (existing): React 19, Vite, TypeScript, Redux Toolkit + RTK Query, Vitest

**Spec:** `.specs/2026-04-23-ttl-quick-viz-api-design.md`

---

## File structure

```
api/
├── .python-version          [Task 1]
├── requirements.txt         [Task 1]
├── requirements-dev.txt     [Task 1]
├── README.md                [Task 9]
├── app/
│   ├── __init__.py          [Task 1]
│   ├── main.py              [Task 1, Task 6, Task 8]
│   ├── config.py            [Task 3]
│   ├── schemas.py           [Task 2]
│   ├── translate.py         [Task 2]
│   ├── store.py             [Task 4]
│   └── routes.py            [Task 5, Task 6]
└── tests/
    ├── __init__.py          [Task 1]
    ├── conftest.py          [Task 5]
    ├── test_translate.py    [Task 2]
    ├── test_store.py        [Task 4]
    └── test_routes.py       [Task 5, Task 6, Task 8]

site/
├── vite.config.ts                              [modify: Task 11]
└── src/
    └── features/
        └── graph/
            ├── types.ts                        [modify: Task 10]
            ├── index.ts                        [modify: Task 10]
            ├── graphApi.ts                     [modify: Task 12]
            ├── graphApi.test.ts                [modify: Task 12]
            ├── GraphCanvas.tsx                 [modify: Task 13]
            └── GraphCanvas.test.tsx            [modify: Task 13]
```

Each `api/app/*.py` has a single responsibility:
- `schemas.py`: pydantic response models only.
- `translate.py`: pure function from raw dict → `Graph` model.
- `store.py`: filesystem adapter, no framework knowledge.
- `config.py`: settings.
- `routes.py`: HTTP layer, DI wiring, error mapping.
- `main.py`: app construction, startup check.

---

## Task 1: Scaffold `api/` and bring up a hello-world FastAPI app

**Files:**
- Create: `api/.python-version`
- Create: `api/requirements.txt`
- Create: `api/requirements-dev.txt`
- Create: `api/app/__init__.py`
- Create: `api/app/main.py`
- Create: `api/tests/__init__.py`

- [ ] **Step 1.1: Create `api/.python-version`**

Content:

```
3.11
```

- [ ] **Step 1.2: Create `api/requirements.txt`**

Content:

```
fastapi>=0.110
uvicorn[standard]>=0.29
pydantic-settings>=2.2
```

- [ ] **Step 1.3: Create `api/requirements-dev.txt`**

Content:

```
-r requirements.txt
pytest>=8.0
httpx>=0.27
```

- [ ] **Step 1.4: Create `api/app/__init__.py`**

Empty file.

- [ ] **Step 1.5: Create `api/tests/__init__.py`**

Empty file.

- [ ] **Step 1.6: Create minimal `api/app/main.py`**

```python
from fastapi import FastAPI

app = FastAPI(title="TTL Quick Viz API")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 1.7: Create the venv and install deps**

Run:

```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

Expected: pip installs without error.

- [ ] **Step 1.8: Boot the app to verify the scaffold**

Run (from `api/`, venv active):

```bash
uvicorn app.main:app --port 8000 &
sleep 1
curl -s http://localhost:8000/healthz
kill %1
```

Expected output: `{"status":"ok"}`

- [ ] **Checkpoint 1:** `api/` has a working hello-world FastAPI app, venv installed, `/healthz` returns 200. No translation, storage, or domain routes yet. Hand off for commit.

---

## Task 2: Pydantic schemas + translator (TDD)

**Files:**
- Create: `api/app/schemas.py`
- Create: `api/app/translate.py`
- Create: `api/tests/test_translate.py`

Build the pure-function translator first because it has no dependencies and the rest of the API is a shell around it.

- [ ] **Step 2.1: Create `api/app/schemas.py`**

```python
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class GraphNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    label: str | None = None
    attrs: dict[str, object] = {}


class GraphEdge(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    source: str
    target: str
    label: str | None = None
    attrs: dict[str, object] = {}


class Graph(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nodes: list[GraphNode]
    edges: list[GraphEdge]


class GraphSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    nodeCount: int
    edgeCount: int
```

- [ ] **Step 2.2: Write failing tests in `api/tests/test_translate.py`**

```python
from __future__ import annotations

import pytest

from app.translate import translate


def _raw(nodes=None, links=None):
    return {
        "directed": True,
        "multigraph": True,
        "graph": {},
        "nodes": nodes or [],
        "links": links or [],
    }


def test_node_id_and_label_pass_through():
    out = translate(_raw(nodes=[{"id": "a", "label": "Alpha"}]))
    assert out.nodes[0].id == "a"
    assert out.nodes[0].label == "Alpha"


def test_null_label_becomes_none():
    out = translate(_raw(nodes=[{"id": "a", "label": None}]))
    assert out.nodes[0].label is None


def test_types_and_attributes_fold_into_attrs():
    raw = _raw(nodes=[{
        "id": "a",
        "label": "A",
        "types": ["http://example.com/T"],
        "attributes": {"http://example.com/p": ["v"]},
    }])
    attrs = translate(raw).nodes[0].attrs
    assert attrs["rdf:type"] == ["http://example.com/T"]
    assert attrs["http://example.com/p"] == ["v"]


def test_empty_types_not_added_to_attrs():
    raw = _raw(nodes=[{"id": "a", "types": [], "attributes": {"k": ["v"]}}])
    assert "rdf:type" not in translate(raw).nodes[0].attrs


def test_predicate_becomes_edge_label():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": "p"}],
    )
    assert translate(raw).edges[0].label == "p"


def test_annotations_become_edge_attrs():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": "p",
                "annotations": {"note": ["hi"]}}],
    )
    assert translate(raw).edges[0].attrs == {"note": ["hi"]}


def test_edge_id_is_deterministic_single():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[{"source": "a", "target": "b", "predicate": "p"}],
    )
    assert translate(raw).edges[0].id == "a|p|b|0"


def test_parallel_edges_get_incrementing_index():
    raw = _raw(
        nodes=[{"id": "a"}, {"id": "b"}],
        links=[
            {"source": "a", "target": "b", "predicate": "p"},
            {"source": "a", "target": "b", "predicate": "p"},
            {"source": "a", "target": "b", "predicate": "q"},
        ],
    )
    ids = [e.id for e in translate(raw).edges]
    assert ids == ["a|p|b|0", "a|p|b|1", "a|q|b|0"]


def test_missing_source_raises():
    raw = _raw(
        nodes=[{"id": "a"}],
        links=[{"target": "a", "predicate": "p"}],
    )
    with pytest.raises(ValueError, match="source"):
        translate(raw)


def test_missing_target_raises():
    raw = _raw(
        nodes=[{"id": "a"}],
        links=[{"source": "a", "predicate": "p"}],
    )
    with pytest.raises(ValueError, match="target"):
        translate(raw)
```

- [ ] **Step 2.3: Run tests, confirm they fail with ImportError**

Run (from `api/`, venv active):

```bash
pytest tests/test_translate.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.translate'` (or tests collected and all fail on import).

- [ ] **Step 2.4: Implement `api/app/translate.py`**

```python
from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.schemas import Graph, GraphEdge, GraphNode


def translate(raw: dict[str, Any]) -> Graph:
    nodes = [_translate_node(n) for n in raw.get("nodes", [])]
    edges = _translate_links(raw.get("links", []))
    return Graph(nodes=nodes, edges=edges)


def _translate_node(raw_node: dict[str, Any]) -> GraphNode:
    attrs: dict[str, object] = dict(raw_node.get("attributes") or {})
    types = raw_node.get("types") or []
    if types:
        attrs["rdf:type"] = list(types)
    return GraphNode(
        id=str(raw_node["id"]),
        label=raw_node.get("label"),
        attrs=attrs,
    )


def _translate_links(raw_links: list[dict[str, Any]]) -> list[GraphEdge]:
    counts: dict[tuple[str, str, str], int] = defaultdict(int)
    edges: list[GraphEdge] = []
    for link in raw_links:
        if "source" not in link:
            raise ValueError("edge is missing 'source'")
        if "target" not in link:
            raise ValueError("edge is missing 'target'")
        src = str(link["source"])
        tgt = str(link["target"])
        pred = str(link.get("predicate", ""))
        idx = counts[(src, pred, tgt)]
        counts[(src, pred, tgt)] = idx + 1
        edges.append(GraphEdge(
            id=f"{src}|{pred}|{tgt}|{idx}",
            source=src,
            target=tgt,
            label=pred if pred != "" else None,
            attrs=dict(link.get("annotations") or {}),
        ))
    return edges
```

- [ ] **Step 2.5: Run tests, confirm they all pass**

Run:

```bash
pytest tests/test_translate.py -v
```

Expected: 10 passed.

- [ ] **Checkpoint 2:** Translator is a tested pure function. Schemas are defined. Hand off for commit.

---

## Task 3: Configuration

**Files:**
- Create: `api/app/config.py`

- [ ] **Step 3.1: Create `api/app/config.py`**

```python
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


_DEFAULT_GRAPHS_DIR = (Path(__file__).resolve().parent.parent.parent
                       / "conversion" / "downloads" / "output")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore")

    graphs_dir: Path = Field(default=_DEFAULT_GRAPHS_DIR)


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

The default resolves `api/` → `../conversion/downloads/output`. Env var `GRAPHS_DIR` overrides it. `get_settings` is a FastAPI-friendly dependency; tests override it.

- [ ] **Step 3.2: Sanity-check the default path resolves**

Run:

```bash
python -c "from app.config import get_settings; s = get_settings(); print(s.graphs_dir)"
```

Expected: `/.../ttl-quick-viz/conversion/downloads/output`

- [ ] **Checkpoint 3:** Settings loadable with sensible default. Hand off for commit.

---

## Task 4: `GraphStore` filesystem adapter (TDD)

**Files:**
- Create: `api/app/store.py`
- Create: `api/tests/test_store.py`

- [ ] **Step 4.1: Write failing tests in `api/tests/test_store.py`**

```python
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.store import GraphNotFound, GraphStore


def _write(dir_: Path, name: str, payload) -> None:
    path = dir_ / f"{name}.json"
    if isinstance(payload, (dict, list)):
        path.write_text(json.dumps(payload))
    else:
        path.write_text(payload)


def test_list_ids_returns_filename_stems(tmp_path):
    _write(tmp_path, "one", {})
    _write(tmp_path, "two", {})
    store = GraphStore(tmp_path)
    assert store.list_ids() == ["one", "two"]


def test_list_ids_is_sorted(tmp_path):
    _write(tmp_path, "zeta", {})
    _write(tmp_path, "alpha", {})
    store = GraphStore(tmp_path)
    assert store.list_ids() == ["alpha", "zeta"]


def test_list_ids_empty_dir(tmp_path):
    assert GraphStore(tmp_path).list_ids() == []


def test_list_ids_ignores_non_json(tmp_path):
    _write(tmp_path, "good", {})
    (tmp_path / "README.md").write_text("nope")
    (tmp_path / "subdir").mkdir()
    assert GraphStore(tmp_path).list_ids() == ["good"]


def test_load_raw_returns_parsed_json(tmp_path):
    _write(tmp_path, "g", {"nodes": [], "links": []})
    assert GraphStore(tmp_path).load_raw("g") == {"nodes": [], "links": []}


def test_load_raw_missing_raises_graph_not_found(tmp_path):
    with pytest.raises(GraphNotFound):
        GraphStore(tmp_path).load_raw("nope")


def test_load_raw_malformed_raises_value_error(tmp_path):
    _write(tmp_path, "bad", "not-json-at-all")
    with pytest.raises(ValueError):
        GraphStore(tmp_path).load_raw("bad")


def test_load_raw_rejects_subdirectory(tmp_path):
    (tmp_path / "sub").mkdir()
    (tmp_path / "sub" / "x.json").write_text("{}")
    with pytest.raises(GraphNotFound):
        GraphStore(tmp_path).load_raw("sub")
```

- [ ] **Step 4.2: Run tests, confirm they fail on import**

Run:

```bash
pytest tests/test_store.py -v
```

Expected: import error for `app.store`.

- [ ] **Step 4.3: Implement `api/app/store.py`**

```python
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
```

- [ ] **Step 4.4: Run tests, confirm they pass**

Run:

```bash
pytest tests/test_store.py -v
```

Expected: 8 passed.

- [ ] **Checkpoint 4:** Store adapter tested. Hand off for commit.

---

## Task 5: Routes + app wiring (TDD the happy path)

**Files:**
- Create: `api/app/routes.py`
- Create: `api/tests/conftest.py`
- Create: `api/tests/test_routes.py`
- Modify: `api/app/main.py`

- [ ] **Step 5.1: Create `api/tests/conftest.py`**

```python
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
def client(graphs_dir: Path):
    def override() -> Settings:
        return Settings(graphs_dir=graphs_dir)

    app.dependency_overrides[get_settings] = override
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
```

- [ ] **Step 5.2: Write failing tests in `api/tests/test_routes.py` — happy path only**

```python
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
```

- [ ] **Step 5.3: Run tests, confirm collection error or 404s**

Run:

```bash
pytest tests/test_routes.py -v
```

Expected: import error (no `app.routes`) or all tests fail.

- [ ] **Step 5.4: Create `api/app/routes.py`**

```python
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.schemas import Graph, GraphSummary
from app.store import GraphNotFound, GraphStore
from app.translate import translate

router = APIRouter()


def get_store(settings: Settings = Depends(get_settings)) -> GraphStore:
    return GraphStore(settings.graphs_dir)


@router.get("/graphs", response_model=list[GraphSummary])
def list_graphs(store: GraphStore = Depends(get_store)) -> list[GraphSummary]:
    summaries: list[GraphSummary] = []
    for graph_id in store.list_ids():
        raw = store.load_raw(graph_id)
        summaries.append(GraphSummary(
            id=graph_id,
            nodeCount=len(raw.get("nodes") or []),
            edgeCount=len(raw.get("links") or []),
        ))
    return summaries


@router.get("/graphs/{graph_id}", response_model=Graph)
def get_graph(graph_id: str, store: GraphStore = Depends(get_store)) -> Graph:
    try:
        raw = store.load_raw(graph_id)
    except GraphNotFound:
        raise HTTPException(status_code=404, detail="graph not found")
    return translate(raw)
```

Error mapping for invalid ids and malformed files is added in Task 6. For now the happy path works and bad input yields uncontrolled errors.

- [ ] **Step 5.5: Modify `api/app/main.py` to mount the router**

Replace entire contents:

```python
from fastapi import FastAPI

from app.routes import router

app = FastAPI(title="TTL Quick Viz API")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(router)
```

- [ ] **Step 5.6: Run tests, confirm happy-path tests pass**

Run:

```bash
pytest tests/test_routes.py -v
```

Expected: 4 passed.

- [ ] **Checkpoint 5:** Happy path green — `GET /graphs` lists and `GET /graphs/{id}` returns the translated shape. Error paths still uncontrolled; Task 6 locks them down. Hand off for commit.

---

## Task 6: Error handling — 404, 400, 500 (TDD)

**Files:**
- Modify: `api/app/routes.py`
- Modify: `api/tests/test_routes.py`

- [ ] **Step 6.1: Append failing error-handling tests to `api/tests/test_routes.py`**

Append:

```python
def test_get_graph_404_on_unknown_id(client):
    resp = client.get("/graphs/does-not-exist")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "graph not found"}


def test_get_graph_400_on_dot_dot_id(client):
    # '..' matches the regex (dots allowed) but is caught by the explicit
    # traversal guard.
    resp = client.get("/graphs/..")
    assert resp.status_code == 400
    assert resp.json() == {"detail": "invalid graph id"}


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
```

- [ ] **Step 6.2: Run tests, confirm error-handling tests fail**

Run:

```bash
pytest tests/test_routes.py -v
```

Expected: 4 prior tests pass; 6 new tests fail (404 works via FastAPI default but the body is `{"detail":"Not Found"}`, traversal/malformed/etc return 500 with generic messages or route mismatches).

- [ ] **Step 6.3: Rewrite `api/app/routes.py` with explicit validation + error mapping**

Replace entire contents:

```python
from __future__ import annotations

import logging
import re
from json import JSONDecodeError

from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.schemas import Graph, GraphSummary
from app.store import GraphNotFound, GraphStore
from app.translate import translate

logger = logging.getLogger(__name__)

_ID_RE = re.compile(r"^[A-Za-z0-9_.-]+$")

router = APIRouter()


def get_store(settings: Settings = Depends(get_settings)) -> GraphStore:
    return GraphStore(settings.graphs_dir)


def _validate_id(graph_id: str) -> None:
    # The regex already forbids '/' etc.; '..' passes the regex (dots allowed),
    # so block it explicitly as a belt-and-braces traversal guard.
    if not _ID_RE.match(graph_id) or ".." in graph_id:
        raise HTTPException(status_code=400, detail="invalid graph id")


@router.get("/graphs", response_model=list[GraphSummary])
def list_graphs(store: GraphStore = Depends(get_store)) -> list[GraphSummary]:
    summaries: list[GraphSummary] = []
    for graph_id in store.list_ids():
        try:
            raw = store.load_raw(graph_id)
        except (JSONDecodeError, ValueError) as exc:
            logger.warning("skipping malformed graph %r: %s", graph_id, exc)
            continue
        summaries.append(GraphSummary(
            id=graph_id,
            nodeCount=len(raw.get("nodes") or []),
            edgeCount=len(raw.get("links") or []),
        ))
    return summaries


@router.get("/graphs/{graph_id}", response_model=Graph)
def get_graph(graph_id: str, store: GraphStore = Depends(get_store)) -> Graph:
    _validate_id(graph_id)
    try:
        raw = store.load_raw(graph_id)
    except GraphNotFound:
        raise HTTPException(status_code=404, detail="graph not found")
    except (JSONDecodeError, ValueError) as exc:
        # json.JSONDecodeError is a subclass of ValueError; both surface here
        # if the file exists but is unreadable.
        logger.exception("failed to read graph %r", graph_id)
        raise HTTPException(
            status_code=500,
            detail=f"failed to read graph: {exc}",
        )
    try:
        return translate(raw)
    except ValueError as exc:
        logger.exception("failed to translate graph %r", graph_id)
        raise HTTPException(
            status_code=500,
            detail=f"failed to read graph: {exc}",
        )
```

- [ ] **Step 6.4: Run tests, confirm all pass**

Run:

```bash
pytest tests/test_routes.py -v
```

Expected: 10 passed.

- [ ] **Step 6.5: Full suite green**

Run:

```bash
pytest -v
```

Expected: all test files pass.

- [ ] **Checkpoint 6:** Error taxonomy complete — 404/400/500 all behave as specified. Hand off for commit.

---

## Task 7: Startup validation — fail fast on missing `GRAPHS_DIR`

**Files:**
- Modify: `api/app/main.py`

- [ ] **Step 7.1: Add a startup event in `api/app/main.py`**

Replace entire contents:

```python
import logging
import sys

from fastapi import FastAPI

from app.config import get_settings
from app.routes import router

logger = logging.getLogger(__name__)

app = FastAPI(title="TTL Quick Viz API")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(router)


@app.on_event("startup")
def _verify_graphs_dir() -> None:
    settings = get_settings()
    if not settings.graphs_dir.is_dir():
        logger.error(
            "GRAPHS_DIR does not exist or is not a directory: %s",
            settings.graphs_dir,
        )
        sys.exit(1)
    logger.info("serving graphs from: %s", settings.graphs_dir)
```

- [ ] **Step 7.2: Smoke-test with a bad `GRAPHS_DIR`**

Run (from `api/`, venv active):

```bash
GRAPHS_DIR=/does/not/exist uvicorn app.main:app --port 8765 &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8765/healthz || true
kill %1 2>/dev/null || true
wait 2>/dev/null || true
```

Expected: `uvicorn` logs the error and the process exits; curl either times out or reports a connection refused (non-200).

- [ ] **Step 7.3: Smoke-test with the real default dir**

Run:

```bash
uvicorn app.main:app --port 8765 &
sleep 1
curl -s http://localhost:8765/graphs
echo
kill %1
```

Expected: JSON array including at least `{"id":"R-HSA-1059683","nodeCount":...,"edgeCount":...}`.

- [ ] **Step 7.4: Confirm existing tests still green**

Run:

```bash
pytest -v
```

Expected: all tests pass. (`TestClient` executes startup events; tests run under the default dir unless the fixture overrides it — the `client` fixture in `conftest.py` DOES override `get_settings` but the startup check fires when `TestClient(app)` is entered. Since the test fixture always writes the `tmp_path` dir before the client requests, `is_dir()` returns True and startup succeeds.)

If Step 7.4 fails because startup fires before `app.dependency_overrides` takes effect on `get_settings`, adjust the `conftest.py` `client` fixture to also override the `_verify_graphs_dir` dependency or call `Settings()` directly inside the startup. Simplest fix: move the check into a dependency on each route OR read `graphs_dir` via `get_settings()` which already respects overrides. `get_settings()` is `@lru_cache`'d — clear it when overriding:

```python
# in conftest.py, inside client fixture, before yielding:
get_settings.cache_clear()
```

Add that if Step 7.4 fails.

- [ ] **Checkpoint 7:** App fails fast on misconfiguration; startup check does not interfere with tests. Hand off for commit.

---

## Task 8: API README

**Files:**
- Create: `api/README.md`

- [ ] **Step 8.1: Create `api/README.md`**

```markdown
# TTL Quick Viz API

Read-only FastAPI service that serves graph JSON (produced by
`../conversion/ttl2json.py`) to the `site/` SPA.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

OpenAPI docs: http://localhost:8000/docs

## Endpoints

- `GET /graphs` — list available graphs as `[{ id, nodeCount, edgeCount }]`.
- `GET /graphs/{id}` — return one graph as `{ nodes, edges }` (translated into the site's shape).
- `GET /healthz` — liveness probe.

## Config

| Env var | Default | Meaning |
|---|---|---|
| `GRAPHS_DIR` | `../conversion/downloads/output` | Directory scanned for `<id>.json` files. |

## Test

```bash
pytest -v
```
```

- [ ] **Checkpoint 8:** README documents the run loop. Hand off for commit.

---

## Task 9: Site — add `GraphSummary` type

**Files:**
- Modify: `site/src/features/graph/types.ts`
- Modify: `site/src/features/graph/index.ts`

- [ ] **Step 9.1: Append to `site/src/features/graph/types.ts`**

After the existing `Graph` type, add:

```ts
export type GraphSummary = {
  id: string;
  nodeCount: number;
  edgeCount: number;
};
```

- [ ] **Step 9.2: Update `site/src/features/graph/index.ts`**

Replace the first line:

```ts
export type { Graph, GraphNode, GraphEdge } from '@/features/graph/types';
```

With:

```ts
export type { Graph, GraphNode, GraphEdge, GraphSummary } from '@/features/graph/types';
```

- [ ] **Step 9.3: Typecheck**

Run (from `site/`):

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Checkpoint 9:** `GraphSummary` exported from the graph feature barrel. Hand off for commit.

---

## Task 10: Site — Vite dev proxy

**Files:**
- Modify: `site/vite.config.ts`

- [ ] **Step 10.1: Edit `site/vite.config.ts`**

Replace entire contents:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: false,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

The `rewrite` strips the `/api` prefix so the browser request `/api/graphs` becomes `http://localhost:8000/graphs` on the upstream — matching the API's actual routes (mounted at root, not under `/api`).

- [ ] **Step 10.2: Typecheck**

Run (from `site/`):

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Checkpoint 10:** Vite proxies `/api/*` to uvicorn. Hand off for commit.

---

## Task 11: Site — swap `graphApi.ts` to real `fetchBaseQuery` (TDD)

**Files:**
- Modify: `site/src/features/graph/graphApi.ts`
- Modify: `site/src/features/graph/graphApi.test.ts`

- [ ] **Step 11.1: Read the existing test for context**

Run (from `site/`):

```bash
cat src/features/graph/graphApi.test.ts
```

Use the output to understand how the existing test dispatches the query. If it relies on `fakeBaseQuery` behavior (synchronous return of the bundled sample), the replacement test will mock `fetch`.

- [ ] **Step 11.2: Rewrite `site/src/features/graph/graphApi.test.ts`**

Replace entire contents:

```ts
import { configureStore } from '@reduxjs/toolkit';
import { graphApi } from '@/features/graph/graphApi';
import type { Graph, GraphSummary } from '@/features/graph/types';

function makeStore() {
  return configureStore({
    reducer: { [graphApi.reducerPath]: graphApi.reducer },
    middleware: (gDM) => gDM().concat(graphApi.middleware),
  });
}

describe('graphApi', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('getGraphs hits /api/graphs and returns summaries', async () => {
    const summaries: GraphSummary[] = [
      { id: 'one', nodeCount: 2, edgeCount: 1 },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(summaries), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const store = makeStore();
    const result = await store.dispatch(
      graphApi.endpoints.getGraphs.initiate(),
    );

    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0])
      .toMatch(/\/api\/graphs$/);
    expect(result.data).toEqual(summaries);
  });

  it('getGraph hits /api/graphs/:id and returns a Graph', async () => {
    const graph: Graph = {
      nodes: [{ id: 'a' }],
      edges: [],
    };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(graph), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const store = makeStore();
    const result = await store.dispatch(
      graphApi.endpoints.getGraph.initiate('one'),
    );

    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0])
      .toMatch(/\/api\/graphs\/one$/);
    expect(result.data).toEqual(graph);
  });
});
```

- [ ] **Step 11.3: Run the test, confirm it fails**

Run:

```bash
npx vitest run src/features/graph/graphApi.test.ts
```

Expected: failures — `graphApi.endpoints.getGraphs` does not exist yet, or `getGraph` still returns the bundled sample instead of hitting fetch.

- [ ] **Step 11.4: Replace `site/src/features/graph/graphApi.ts`**

Replace entire contents:

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Graph, GraphSummary } from '@/features/graph/types';

export const graphApi = createApi({
  reducerPath: 'graphApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (build) => ({
    getGraphs: build.query<GraphSummary[], void>({
      query: () => '/graphs',
    }),
    getGraph: build.query<Graph, string>({
      query: (id) => `/graphs/${id}`,
    }),
  }),
});

export const { useGetGraphsQuery, useGetGraphQuery } = graphApi;
```

- [ ] **Step 11.5: Update the feature barrel `site/src/features/graph/index.ts`**

Replace the `graphApi` export line:

```ts
export { graphApi, useGetGraphQuery } from '@/features/graph/graphApi';
```

With:

```ts
export { graphApi, useGetGraphsQuery, useGetGraphQuery } from '@/features/graph/graphApi';
```

- [ ] **Step 11.6: Run the test, confirm it passes**

Run:

```bash
npx vitest run src/features/graph/graphApi.test.ts
```

Expected: 2 passed.

- [ ] **Step 11.7: Typecheck the whole project**

Run:

```bash
npx tsc -b --noEmit
```

Expected: no errors. If `GraphCanvas.tsx` now errors because it passes `'sample'` to a hook that hits the network — that's fine; Task 12 rewrites that component.

If the typecheck errors on `GraphCanvas.tsx`'s imports of `useGetGraphQuery`, that's a signal the barrel re-export is wrong — fix before moving on.

- [ ] **Checkpoint 11:** `graphApi` talks to the real endpoint path; tests cover both hooks. Hand off for commit.

---

## Task 12: Site — `GraphCanvas` fetches the list, renders the first (TDD)

**Files:**
- Modify: `site/src/features/graph/GraphCanvas.tsx`
- Modify: `site/src/features/graph/GraphCanvas.test.tsx`

- [ ] **Step 12.1: Read the existing component and test for context**

Run (from `site/`):

```bash
cat src/features/graph/GraphCanvas.tsx
cat src/features/graph/GraphCanvas.test.tsx
```

Use the output to model your test on the existing mocking pattern. Typical shape: mock `@/features/graph/graphApi` module to return controlled data per test.

- [ ] **Step 12.2: Rewrite `site/src/features/graph/GraphCanvas.test.tsx`**

Replace entire contents:

```tsx
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { GraphCanvas } from '@/features/graph/GraphCanvas';

// Mock the elk layout hook so GraphCanvas is the unit under test.
vi.mock('@/features/graph/useElkLayout', () => ({
  useElkLayout: () => ({ status: 'ready', nodes: [], edges: [] }),
}));

// Controlled API hooks
const useGetGraphsQueryMock = vi.fn();
const useGetGraphQueryMock = vi.fn();
vi.mock('@/features/graph/graphApi', () => ({
  useGetGraphsQuery: (...args: unknown[]) => useGetGraphsQueryMock(...args),
  useGetGraphQuery: (...args: unknown[]) => useGetGraphQueryMock(...args),
}));

function renderCanvas() {
  return render(
    <MantineProvider>
      <GraphCanvas />
    </MantineProvider>,
  );
}

afterEach(() => {
  useGetGraphsQueryMock.mockReset();
  useGetGraphQueryMock.mockReset();
});

describe('<GraphCanvas />', () => {
  it('shows loading while the graph list is loading', () => {
    useGetGraphsQueryMock.mockReturnValue({ isLoading: true });
    useGetGraphQueryMock.mockReturnValue({ isLoading: false });
    renderCanvas();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when the list is empty', () => {
    useGetGraphsQueryMock.mockReturnValue({ data: [], isLoading: false });
    useGetGraphQueryMock.mockReturnValue({ isLoading: false });
    renderCanvas();
    expect(screen.getByText(/no graphs/i)).toBeInTheDocument();
  });

  it('requests the first graph id from the list', () => {
    useGetGraphsQueryMock.mockReturnValue({
      data: [
        { id: 'alpha', nodeCount: 1, edgeCount: 0 },
        { id: 'zeta', nodeCount: 2, edgeCount: 1 },
      ],
      isLoading: false,
    });
    useGetGraphQueryMock.mockReturnValue({
      data: { nodes: [], edges: [] },
      isLoading: false,
    });
    renderCanvas();
    expect(useGetGraphQueryMock).toHaveBeenCalledWith('alpha', { skip: false });
  });

  it('shows error state when the graph fetch errors', () => {
    useGetGraphsQueryMock.mockReturnValue({
      data: [{ id: 'alpha', nodeCount: 1, edgeCount: 0 }],
      isLoading: false,
    });
    useGetGraphQueryMock.mockReturnValue({
      isLoading: false,
      error: { status: 500 },
    });
    renderCanvas();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 12.3: Run the test, confirm failures**

Run:

```bash
npx vitest run src/features/graph/GraphCanvas.test.tsx
```

Expected: multiple failures — component still uses the old single-hook flow.

- [ ] **Step 12.4: Rewrite `site/src/features/graph/GraphCanvas.tsx`**

Replace entire contents:

```tsx
import { ReactFlow, Background, MiniMap, Controls } from '@xyflow/react';
import {
  useGetGraphQuery,
  useGetGraphsQuery,
} from '@/features/graph/graphApi';
import { useElkLayout } from '@/features/graph/useElkLayout';

export function GraphCanvas() {
  const { data: list, isLoading: listLoading } = useGetGraphsQuery();
  const firstId = list?.[0]?.id;
  const { data, isLoading, error } = useGetGraphQuery(firstId ?? '', {
    skip: !firstId,
  });
  const layout = useElkLayout(data);

  if (
    listLoading ||
    isLoading ||
    layout.status === 'laying-out' ||
    layout.status === 'idle'
  ) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Loading…
      </div>
    );
  }

  if (list && list.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        No graphs available.
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-600">
        Failed to load graph.
      </div>
    );
  }

  return (
    <ReactFlow nodes={layout.nodes} edges={layout.edges} fitView nodesDraggable>
      <Background />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  );
}
```

- [ ] **Step 12.5: Run the test, confirm it passes**

Run:

```bash
npx vitest run src/features/graph/GraphCanvas.test.tsx
```

Expected: 4 passed.

- [ ] **Step 12.6: Run the full site test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 12.7: Typecheck**

Run:

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Checkpoint 12:** `GraphCanvas` now drives both hooks, handles empty + loading + error + ready states. Hand off for commit.

---

## Task 13: Manual end-to-end smoke

**Files:** none (verification only)

- [ ] **Step 13.1: Start the API**

In terminal 1, from repo root:

```bash
cd api
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Expected: uvicorn boots, logs `serving graphs from: /.../conversion/downloads/output`.

- [ ] **Step 13.2: Hit the API directly**

In terminal 2:

```bash
curl -s http://localhost:8000/graphs | head -c 400
echo
curl -s http://localhost:8000/graphs/R-HSA-1059683 | head -c 400
echo
```

Expected: first curl prints an array with at least one entry including `"id":"R-HSA-1059683"`; second prints a `{"nodes":[...],"edges":[...]}` document.

- [ ] **Step 13.3: Start the site**

In terminal 2, from repo root:

```bash
cd site
npm run dev
```

- [ ] **Step 13.4: Browser check**

Open http://localhost:5173 in a browser.

Expected:
- No network errors in the browser console.
- In the Network panel, requests to `/api/graphs` and `/api/graphs/R-HSA-1059683` return 200.
- React Flow renders a pannable/zoomable graph with more than a handful of nodes.
- Minimap visible; Controls in the corner.

If rendering fails: open the console, check for shape-mismatch errors in `useElkLayout` (elk wants a specific input), or for 404s on the proxy (indicates Vite proxy rewrite is wrong).

- [ ] **Step 13.5: Error-path spot-check**

In the browser, manually visit (or `curl`) `http://localhost:5173/api/graphs/not-real`.

Expected: 404 with `{"detail":"graph not found"}`.

- [ ] **Step 13.6: Stop both servers**

Terminal 1: Ctrl-C uvicorn.
Terminal 2: Ctrl-C vite.

- [ ] **Checkpoint 13:** Real data flows end-to-end: `.ttl` on disk → `ttl2json.py` → `api/` → `site/`. Hand off for final commit / PR.

---

## Success criteria

- [ ] `pytest -v` in `api/` passes with at least: 10 translator tests, 8 store tests, 10 route tests.
- [ ] `npm test` in `site/` passes with updated `graphApi.test.ts` (2 tests) and `GraphCanvas.test.tsx` (4 tests).
- [ ] `npx tsc -b --noEmit` in `site/` reports no errors.
- [ ] `GET /graphs` and `GET /graphs/{id}` serve real data from `conversion/downloads/output/`.
- [ ] Site at http://localhost:5173 renders the real graph through the Vite proxy.
- [ ] `GET /graphs/../etc/passwd` → 400; `GET /graphs/not-real` → 404; a deliberately malformed file → 500; all via `HTTPException` with the documented `{"detail": "..."}` body.
- [ ] Uvicorn fails fast (exits) when `GRAPHS_DIR` doesn't exist.
