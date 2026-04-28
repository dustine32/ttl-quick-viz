# Task: Bring val_analysis label enrichment + markdown changelog into ttl-quick-viz

**Status:** ACTIVE
**Issue:** none (user request, brainstorm 2026-04-28)
**Branch:** clean-up-2

## Goal

Pull the two parts of `C:\work\go\val_analysis` that complement the just-shipped
graph-topology diff feature, **without** spinning up a 4th subproject. Barista
log analysis stays in val_analysis for now; come back to it later.

"Done" looks like:

1. Every renderer shows `protein folding (GO:0006457)` instead of bare
   `GO:0006457` — labels baked into the JSON at conversion time, served from
   a committed cache, refreshable on demand via a CLI and an api route.
2. A new "Changelog" tab in the right panel renders a date-grouped markdown
   narrative of every TTL-semantic change across the last N commits for the
   selected model, served by a new api route. This is **complementary** to
   the existing toolbar "Compare" feature (which is a pairwise topology
   delta on the canvas) — different artifact, different audience, both kept.

Nothing in the existing diff feature changes.

## Context

- **Triggered by:** user discussion 2026-04-28 about how to merge val_analysis
  into ttl-quick-viz. Decision: defer barista logs, scope to label enrichment
  + markdown changelog. When barista logs come back, the same code lifts
  cleanly into a new `analysis/` 4th subproject.
- **Reuse, don't re-implement.** Git history fetching is already done in
  `api/src/app/services/git_history_service.py`. The new changelog service
  reuses it; no new subprocess code in this plan.
- **Wire-shape impact:** none for `Graph`. New response model
  `ChangelogResponse { model_id, n, markdown, stats }` is additive. Node
  `data.label` already exists; we just start populating it from the cache.

### Source files in val_analysis (reference, not imported)

- `src/resolve_ontology.py` — EBI OLS4 lookup + `ontology_cache.json`
  (GO/ECO/RO/BFO/SO/CHEBI/CL/UBERON → label).
- `src/resolve_metadata.py` — `users.yaml` / `groups.yaml` from
  `geneontology/go-site` → `metadata_cache.json` (ORCID → nickname,
  group URL → shorthand).
- `src/diff_versions.py` — rdflib walk producing `Individual`
  (`uri`, `short_id`, `types`, `relationships`, `annotations`); `Uri.shorten`;
  `SemanticDiff` (added/removed/changed across two `dict[str, Individual]`).
- `src/changelog.py` — parses `changes_human.log` text → `VersionDiff` list
  → date-grouped markdown with `<details>` collapses.
- `ontology_cache.json`, `metadata_cache.json` — committed cache files.

### Target files in ttl-quick-viz

**conversion/**
- `src/ttl2json/labels.py` — NEW. Cache load/save, `enrich(graph)` that
  rewrites node `label` from cache, refresh CLI plumbing.
- `src/ttl2json/individuals.py` — NEW. `parse_individuals(text|path)`,
  `diff_individuals(old, new)` returning a structured diff object that the
  api layer can turn into markdown.
- `src/ttl2json/core.py` — call `labels.enrich(...)` at the end of
  `_walk_rdflib_graph` (or in `build_graph` / `build_graph_from_string`).
- `src/ttl2json/__init__.py` — re-export new public names.
- `src/ttl2json/cli.py` — add `ttl-viz-refresh-labels` entry point that
  scans a directory, finds new IDs, hits OLS, updates the cache.
- `pyproject.toml` — add `httpx`, `pyyaml` deps; register the new script.
- `ontology_cache.json`, `metadata_cache.json` — committed at the
  conversion package root (alongside `pyproject.toml`).

**api/**
- `src/app/services/changelog_service.py` — NEW. Orchestrates:
  `git_history_service.list_history(id, n)` → for each consecutive pair,
  `git_history_service.read_ttl_at(sha, id)` → `parse_individuals(text)` →
  `diff_individuals(old, new)` → markdown emitter → joined string.
- `src/app/services/markdown_changelog.py` — NEW (or fold into the service).
  Pure function: `list[VersionDiff] -> markdown_string`. Ports
  `val_analysis/src/changelog.py::generate_changelog_md` minus the file-IO
  parser (we already have structured diffs in memory).
- `src/app/domain/models.py` — `ChangelogStats { diffs, dates, total_changes }`,
  `ChangelogResponse { model_id, n, markdown, stats }`.
- `src/app/api/routes/graphs.py` — `GET /api/graphs/{id}/changelog?n=20`.
- `src/app/api/deps.py` — `get_changelog_service`.
- `src/app/api/errors.py` — reuse existing `GitRepoNotConfigured → 503`,
  `GitFileNotFound → 404`. No new exceptions.
- `src/app/api/routes/labels.py` — NEW. `POST /api/labels/refresh` (scans
  `INPUT_DIR`, updates the cache, returns counts). Optional Phase 7.

**site/**
- `src/features/changelog/` — NEW feature folder, mirrors `features/diff/`:
  - `services/changelogApi.ts` — `getChangelog({ id, n })` RTK Query
    (or extend `graphApiSlice.ts` with a new endpoint + tag).
  - `components/ChangelogPanel.tsx` — markdown render. Use
    `react-markdown` (already a peer of one of the deps probably; if not,
    add it — small, well-known, supports `<details>`).
  - `components/ChangelogTab.tsx` — wraps the panel with a header / loading
    / 503 / 404 / empty states.
  - `index.ts` — barrel.
- `src/layout/RightPanel.tsx` — add a tab next to Inspector for "Changelog".
  Tab visible only when a graph is selected. (Or: add as IconRail item if
  the right panel is already tabbed elsewhere.)

## Current State

### What works now

- Graph load + render across 7 engines (`xyflow | cytoscape | force | force3d
  | sigma | graphin | tree`).
- Pairwise topology diff on the canvas (`features/diff/`): pick a SHA from
  the picker, click "Compare", see node/edge added/removed/changed colors,
  with side-by-side TTL pane via `TtlDiffPane.tsx`.
- Git history infrastructure: `GitHistoryService.list_history`, `read_ttl_at`,
  `is_enabled` — exposed as `GET /api/graphs/{id}/history` and
  `GET /api/graphs/{id}/ttl/at/{sha}`.
- `build_graph_from_string` exists in conversion/, used by the diff service.

### What's missing

- Labels: every node renders the bare ID (`GO:0006457`, `ECO:0000314`,
  `R-HSA-69273`). The `label` field on the wire is sparse — only present
  when an `rdfs:label` literal is in the TTL itself (which Reactome /
  pathways2GO output rarely has).
- Changelog: no markdown narrative across N commits. The existing diff is
  per-pair on the canvas. There's no "what's been changing in this model
  over the last month?" view.
- Semantic Individual diff: the existing diff is graph-topology
  (`computeDiff.ts` on `Graph`). val_analysis's diff is at TTL Individual
  level (types / relationships / annotations) — finer-grained, captures
  things the topology diff doesn't (e.g. an annotation date change with no
  topology change).

## Steps

### Phase 1 — `conversion/`: label enrichment scaffold

- [ ] Add `httpx` and `pyyaml` to `conversion/pyproject.toml`. Run
  `poetry lock --no-update && poetry install` in the conversion venv.
- [ ] Create `conversion/src/ttl2json/labels.py`:
  - `_CACHE_DIR = Path(__file__).resolve().parents[2]` so caches live at
    `conversion/ontology_cache.json` + `metadata_cache.json` (same level
    as `pyproject.toml` — committed).
  - `load_ontology_cache() / save_ontology_cache(labels)`.
  - `load_metadata_cache() / save_metadata_cache(meta)`.
  - `_ONTOLOGY_PREFIXES`, `_ONTOLOGY_ID_RE` (port from val_analysis).
  - `fetch_label(obo_id) -> str | None` — port `resolve_ontology.fetch_label`.
  - `fetch_users()`, `fetch_groups()` — port from `resolve_metadata.py`.
  - `resolve(ids: set[str], labels: dict[str,str]) -> int` — populates
    missing entries.
- [ ] Seed the caches: copy `val_analysis/ontology_cache.json` and
  `val_analysis/metadata_cache.json` into `conversion/`. They're small
  (~35 KB combined) and pre-fill the common GO/ECO/RO terms so first-run
  conversion already shows labels.
- [ ] `__init__.py` — re-export `load_ontology_cache`, `load_metadata_cache`,
  `enrich_graph` (Phase 2). Keep `__all__` honest.
- [ ] **Test:** `conversion/tests/test_labels.py` — cache round-trip
  load/save, `_ONTOLOGY_ID_RE` matches/misses, `fetch_label` mocked via
  `respx` or a `monkeypatch` on `httpx.get`.

### Phase 2 — `conversion/`: wire enrichment into `build_graph`

- [ ] Add `enrich_graph(g: nx.MultiDiGraph) -> None` in `labels.py`. Walks
  nodes, for each node id matching `_ONTOLOGY_ID_RE`, looks up
  `ontology_cache[id]`, sets `g.nodes[id]["label"] = f"{label} ({id})"` if
  the existing label is empty. Stable: no API calls during conversion;
  cache miss = no change.
- [ ] In `core.py::build_graph` and `build_graph_from_string`, call
  `enrich_graph(graph)` after the `_walk_rdflib_graph` call. Behavior is
  always-on with empty-cache fallback (no flag).
- [ ] **Test:** `tests/test_ttl2json.py` — extend the R-HSA snapshot test to
  assert that at least one node label contains a parenthesized ID (e.g.
  `mating projection actin fusion focus assembly (GO:1904600)`), or add
  a small fixture TTL where every node's expected enriched label is
  asserted explicitly.
- [ ] **Re-snapshot:** running tests will regenerate JSON output for the
  Reactome fixtures. Inspect the diff to confirm labels are populated and
  no shape change. Commit the updated snapshots.
- [ ] **Decision point:** do enriched labels land in `attrs["rdfs:label"]`
  too, or only in the top-level `label` field? Recommendation: only top-
  level `label`. Don't pollute `attrs` with synthetic data — `attrs` is for
  triples that came out of the TTL. The site already prefers
  `node.label` for display.

### Phase 3 — `conversion/`: refresh CLI

- [ ] Add `cli.py::refresh_labels(argv)` — scans a directory of `.ttl`
  files, finds OBO IDs not in cache, hits OLS, updates the cache, prints
  a summary.
- [ ] Register `ttl-viz-refresh-labels` in `pyproject.toml [tool.poetry.scripts]`.
- [ ] **Test:** `tests/test_labels.py` — `refresh_labels` against a fixture
  TTL with `GO:9999999` (mocked OLS response), assert cache is updated.
- [ ] Document in `conversion/CLAUDE.md`: new entry point, when to run
  (once when adding new pathways), where the cache lives.

### Phase 4 — `conversion/`: Individual parser + semantic diff

- [ ] Create `conversion/src/ttl2json/individuals.py`:
  - Port `Individual` dataclass from `val_analysis/src/diff_versions.py`
    (uri, short_id, types, relationships, annotations).
  - Port `Uri` shortener (the `_PATTERNS` list).
  - Port `_REL_PREDICATES`, `_ANNOTATION_MAP`, `_MODEL_NS`, `_OBO_NS`.
  - `parse_individuals_from_string(ttl_text: str) -> dict[str, Individual]`
    and `parse_individuals(path: Path) -> dict[str, Individual]`. Both
    parse via `rdflib.Graph().parse(...)` then walk
    `subjects(RDF.type, OWL.NamedIndividual)`.
  - `IndividualDiff` dataclass: `added: list[Individual]`,
    `removed: list[Individual]`, `changed: list[ChangedIndividual]`.
    `ChangedIndividual { short_id, type_change, rel_changes, annotation_changes }`.
  - `diff_individuals(old: dict, new: dict) -> IndividualDiff`. Pure;
    no IO; no markdown.
- [ ] `__init__.py` — re-export `Individual`, `IndividualDiff`,
  `parse_individuals`, `parse_individuals_from_string`, `diff_individuals`.
- [ ] **Test:** `tests/test_individuals.py` — parse a fixture TTL with one
  NamedIndividual, assert types/relationships/annotations populate. Diff
  two fixtures (added, removed, type change, rel add/remove, annotation
  date change), assert each lands in the right bucket.

### Phase 5 — `api/`: changelog service + route

- [ ] `api/src/app/services/changelog_service.py`:
  - `class ChangelogService` injected with `GitHistoryService` (already
    exists).
  - `get_changelog(model_id: str, n: int) -> ChangelogResponse`. Steps:
    1. `git.list_history(model_id, n)` → list of `(sha, subject, date)`.
       If git is not configured, raises `GitRepoNotConfigured` (existing
       exception → 503).
    2. For each commit: `git.read_ttl_at(sha, model_id)` → text →
       `parse_individuals_from_string(text)` → `dict[str, Individual]`.
       Skip commits where parsing fails (log + continue, like
       `DiffService.get_history` does).
    3. Walk consecutive pairs (oldest-first), `diff_individuals(old, new)`
       for each → `list[IndividualDiff]` plus the `(old_sha, new_sha,
       old_date, new_date)` envelopes.
    4. `markdown_changelog.render(diffs, model_id) -> str`. Returns the
       full markdown text.
    5. Compute `ChangelogStats`.
- [ ] `api/src/app/services/markdown_changelog.py`:
  - Port `val_analysis/src/changelog.py::generate_changelog_md`. Adjust
    the input shape: instead of parsing text back into `VersionDiff`, the
    caller passes structured `IndividualDiff` objects directly. Output
    unchanged.
  - Apply ontology label substitution at the end:
    `text = labels.substitute_ontology_labels(text)` and
    `text = labels.substitute_metadata(text)` (port these substitution
    helpers from val_analysis into `conversion/src/ttl2json/labels.py`
    in Phase 1). This way the markdown is human-readable without the
    site doing per-ID lookups.
- [ ] `domain/models.py`:
  ```
  class ChangelogStats(BaseModel):
      diffs: int
      dates: int
      total_changes: int
  class ChangelogResponse(BaseModel):
      model_id: str
      n: int
      markdown: str
      stats: ChangelogStats
  ```
  Both `extra="forbid"`.
- [ ] `api/deps.py` — `get_changelog_service(git=Depends(get_git_history_service))`.
- [ ] `routes/graphs.py` — new endpoint:
  ```
  @router.get("/graphs/{graph_id}/changelog", response_model=ChangelogResponse)
  def get_graph_changelog(
      graph_id: str,
      n: int = Query(default=10, ge=1, le=100),
      service: ChangelogService = Depends(get_changelog_service),
  ) -> ChangelogResponse:
      return service.get_changelog(graph_id, n)
  ```
- [ ] **Tests:** `api/tests/test_routes_changelog.py` — happy path against
  the same ephemeral git repo fixture used by `test_routes_history.py`,
  shape validation, n-range, 404, 400, 503 paths.

### Phase 6 — `site/`: Changelog feature

- [ ] Pick markdown lib. **Recommendation:** `react-markdown` (small,
  battle-tested, supports `<details>` via `rehype-raw`). Add to
  `site/package.json`.
- [ ] `site/src/features/changelog/services/changelogApi.ts` — extend
  `graphApiSlice.ts` rather than create a separate slice. New endpoint
  `getChangelog({ id, n })`, new tag `GraphChangelog` keyed by
  `${id}@${n}`.
- [ ] `components/ChangelogPanel.tsx`:
  - Props: `id: string`. Reads `n` from a local `useState` (default 10).
  - Calls `useGetChangelogQuery({ id, n })`.
  - Loading: skeleton.
  - 503: "Configure `MODELS_GIT_REPO` to enable changelog." (mirror the
    DiffPicker copy.)
  - 404: "No history for this model in the configured repo."
  - Success: `<ReactMarkdown>` rendering `data.markdown` with `rehype-raw`
    so `<details>` collapses survive. Header shows
    `data.stats.total_changes` + date range.
  - Tailwind for layout, no Mantine `Stack`/`Group` (per repo convention).
- [ ] `components/ChangelogTab.tsx` — minimal wrapper exporting the panel
  with a `<PanelHeader title="Changelog" />`.
- [ ] `index.ts` — barrel: `export * from './components/...'` only the
  pieces the layout imports.
- [ ] `RightPanel.tsx` — make tabbed if not already. Tabs: `Inspector`,
  `Changelog`. `Changelog` tab disabled when `state.graph.selectedId` is
  null. Persist active tab in url-state if other tabs already do; otherwise
  local `useState` is fine for v1.
- [ ] **Tests:** `site/tests/features/changelog/` — slice/api test if a
  slice exists, panel render test against MSW-mocked `/changelog` response
  (loading / 503 / 404 / success).

### Phase 7 — Verify

- [ ] `cd conversion && pytest` — all green, including new `test_labels.py`
  and `test_individuals.py`.
- [ ] `cd api && pytest` — all green, including new
  `test_routes_changelog.py`. Pre-existing `FakeRepo.mtime` failures noted
  in `diff-graphs.md` Phase 7 may still be present; confirm they are not
  new regressions.
- [ ] `cd site && npm test -- --run` — all green, including new changelog
  tests. Confirm test stores include any new slices the changelog
  components touch.
- [ ] `cd site && npm run build` — clean.
- [ ] `cd site && npm run lint` — no new errors beyond the two pre-existing
  ones in `useElkLayout.ts` and `vite.config.ts`.
- [ ] **Manual smoke (skipped per repo convention).** The user verifies in
  the browser by setting `MODELS_GIT_REPO=/path/to/reactome-go-cams`,
  loading a model with a few commits, opening the Changelog tab, and
  checking that node tooltips on the canvas now show enriched labels.

### Phase 8 — (Optional) historical extraction → INPUT_DIR

This phase is **deferred** until Phases 1–7 have been used in anger and a
need is felt. Nothing here is required for the goal.

- [ ] Add `extract_versions` as a CLI in `conversion/src/ttl2json/cli.py`
  (port `val_analysis/src/extract_versions.py`). Outputs to a directory
  layout `<outdir>/<model_id>__<timestamp>.ttl` so each version becomes a
  distinct model in the existing watcher. (val_analysis uses
  `by_folder/<timestamp>/<id>.ttl` which collides with the watcher's
  per-file model; flatten for ttl-quick-viz.)
- [ ] OR: a route `POST /api/graphs/{id}/extract-history` that writes
  flattened files into `INPUT_DIR` and lets the watcher pick them up.
- [ ] Site affordance: "Extract history to library" item in the More menu,
  similar to "Rebuild all".

### Phase 9 — Future: barista logs (not in this plan)

When barista logs come back, the migration target is a new `analysis/`
4th subproject:

```
ttl-quick-viz/
├── conversion/
├── api/
├── site/
└── analysis/        # NEW — Poetry, in-project venv
    ├── src/analysis/
    │   ├── clean.py
    │   ├── filter_model.py
    │   ├── humanize.py
    │   ├── report.py
    │   └── pipeline.py
    └── pyproject.toml
```

`labels.py` and `individuals.py` stay in `conversion/` (already used by
api). `analysis/` adds the log-pipeline modules and exposes them via the
api with the same orchestration shape (`api → service → analysis package`).
Out of scope here.

## Recovery Checkpoint

> **⚠ UPDATE THIS AFTER EVERY CHANGE**

- **Last completed action:** plan written. No code changes yet.
- **Next immediate action:** Phase 1, step 1 — add `httpx` + `pyyaml` to
  `conversion/pyproject.toml` and run `poetry lock --no-update`.
- **Recent commands run:** none.
- **Uncommitted changes:** plan file only.
- **Environment state:** none.

## Failed Approaches

| What was tried | Why it failed | Date |
| -------------- | ------------- | ---- |
|                |               |      |

## Files Modified

| File | Action | Status |
| ---- | ------ | ------ |
| `.plans/feature/val-analysis-integration.md` | NEW — this plan | ✅ |
| `conversion/pyproject.toml` | add httpx, pyyaml; register `ttl-viz-refresh-labels` script | ⬜ |
| `conversion/src/ttl2json/labels.py` | NEW — caches, OLS/go-site fetchers, `enrich_graph`, label substitution helpers | ⬜ |
| `conversion/src/ttl2json/individuals.py` | NEW — `Individual`, `parse_individuals_*`, `diff_individuals`, `IndividualDiff` | ⬜ |
| `conversion/src/ttl2json/core.py` | call `enrich_graph` in `build_graph` / `build_graph_from_string` | ⬜ |
| `conversion/src/ttl2json/__init__.py` | re-export new public symbols | ⬜ |
| `conversion/src/ttl2json/cli.py` | `refresh_labels` subcommand | ⬜ |
| `conversion/ontology_cache.json` | NEW — seeded from val_analysis | ⬜ |
| `conversion/metadata_cache.json` | NEW — seeded from val_analysis | ⬜ |
| `conversion/tests/test_labels.py` | NEW | ⬜ |
| `conversion/tests/test_individuals.py` | NEW | ⬜ |
| `conversion/tests/test_ttl2json.py` | re-snapshot R-HSA fixtures with enriched labels | ⬜ |
| `conversion/CLAUDE.md` | document new caches + CLI | ⬜ |
| `api/src/app/services/changelog_service.py` | NEW orchestrator | ⬜ |
| `api/src/app/services/markdown_changelog.py` | NEW pure markdown generator | ⬜ |
| `api/src/app/domain/models.py` | `ChangelogStats`, `ChangelogResponse` | ⬜ |
| `api/src/app/api/deps.py` | `get_changelog_service` | ⬜ |
| `api/src/app/api/routes/graphs.py` | `GET /graphs/{id}/changelog` | ⬜ |
| `api/tests/test_routes_changelog.py` | NEW | ⬜ |
| `site/package.json` | add `react-markdown`, `rehype-raw` | ⬜ |
| `site/src/features/graph/slices/graphApiSlice.ts` | `getChangelog` query + tag | ⬜ |
| `site/src/features/changelog/components/ChangelogPanel.tsx` | NEW | ⬜ |
| `site/src/features/changelog/components/ChangelogTab.tsx` | NEW | ⬜ |
| `site/src/features/changelog/index.ts` | NEW barrel | ⬜ |
| `site/src/layout/RightPanel.tsx` | tabbed: Inspector + Changelog | ⬜ |
| `site/tests/features/changelog/ChangelogPanel.test.tsx` | NEW | ⬜ |

## Blockers

- None currently. Two design decisions called out in **Notes** to confirm
  before starting Phase 1.

## Notes

- **No 4th subproject yet.** The user's scope is "diff history + visualizing
  graphs," barista logs deferred. This plan keeps the change set inside the
  existing three subprojects. Phase 9 sketches the `analysis/` migration
  for when logs come back.
- **Topology diff vs. semantic Individual diff coexist.** Toolbar "Compare"
  → existing canvas-coloring topology diff. RightPanel "Changelog" tab →
  new markdown narrative across N commits, semantic-Individual level.
  Different artifact, different audience. The UI must label them
  distinctly so users don't confuse them.
- **Labels are committed cache, not live API.** Conversion never blocks on
  network. New IDs land via `ttl-viz-refresh-labels` (or
  `POST /api/labels/refresh` if Phase 7's optional route ships). This
  matches val_analysis's pre-pipeline pattern and the conversion package's
  "no network at conversion time" expectation.
- **Cache lives in `conversion/`.** Both `api/` (via path-dep) and the
  optional future `analysis/` read it through the conversion package. Don't
  put caches in `api/` — that inverts the dependency direction (api depends
  on conversion, not the other way around).
- **Markdown on the wire, not structured JSON.** `ChangelogResponse.markdown`
  is a string. The site renders it directly via `react-markdown`. Pros:
  simple wire, simple component, val_analysis's existing markdown layout
  ports cleanly with `<details>` collapses preserved. Cons: site can't
  filter/sort changelog entries client-side. For v1, fine — the markdown
  is a narrative artifact, not a queryable list. If filtering becomes a
  need, switch the wire to structured `list[VersionDiff]` and render in
  React.
- **Edge identity in `diff_individuals` differs from topology diff's
  edge identity.** Individuals diff doesn't deal with edges directly; it
  diffs an Individual's `relationships` map (predicate → list of target
  short_ids). The existing topology diff uses
  `(source, predicate, target)` tuples. Both are correct for their
  respective artifacts; they don't need to be reconciled.
- **`Uri.shorten` overlaps with conversion's existing IRI handling.**
  `core.py::_term_to_json` returns `str(uri)` unchanged. val_analysis's
  shortener turns `http://purl.obolibrary.org/obo/GO_0006457` into
  `GO:0006457`. The shortener should live in `individuals.py` (used only
  there) — don't apply it inside `core.py::build_graph`, which would
  break the wire shape (`Graph.nodes[].id` would change form).
- **Decision point: do enriched labels also populate `attrs["rdfs:label"]`?**
  Recommendation: no. `attrs` mirrors TTL triples; enriched labels are
  synthetic. Putting them in `attrs` muddies the inspector's "what's in
  the TTL?" semantics. Top-level `label` only.
- **Decision point: tabs vs. accordion in RightPanel.** v1 just adds a tab
  bar. If RightPanel is already accordion-style elsewhere, match that. The
  layout-doc takes precedence over personal taste here.
- **No `Co-Authored-By` trailer** on commits per repo convention.
- **No git commands run by Claude** per user preference. The user runs
  git themselves; Claude inspects state via Read/Grep.

## Lessons Learned

<!-- Fill during and after task. -->

## Additional Context (Claude)

- **Sequencing.** Phase 1–2 (label enrichment) is genuinely independent of
  Phase 4–6 (changelog). Recommend opening a draft PR after Phase 2 — the
  label win lands on its own and is the lowest-risk, highest-immediate-
  user-value piece. Changelog can follow in a second PR.
- **Why not pull `extract_versions.py` upfront.** ttl-quick-viz's git
  history fetch is in-memory only by design (the api's `read_ttl_at` doesn't
  write to disk). Disk extraction was val_analysis's choice because its
  diff was a separate process; ours is a service. Adding disk extraction
  would let users browse historical versions as standalone models in the
  existing site, which is nice — but it's a different feature ("temporal
  library") not on the critical path here. Phase 8 covers it as optional.
- **The metadata cache is small but networked-fetch.** `users.yaml` from
  go-site is ~1 MB. First refresh takes a few seconds. The committed
  starter cache (~35 KB) covers the populated subset val_analysis already
  saw. Document this in `conversion/CLAUDE.md` so a developer with a
  blank cache knows what to expect.
- **`react-markdown` adds ~50 KB gz.** Acceptable. Alternative is `markdown-it`
  + `dangerouslySetInnerHTML`, slightly smaller, less safe with
  user-controlled markdown. Our markdown is server-generated from rdflib
  output — safer than user input but not zero risk. `react-markdown` +
  `rehype-raw` (for `<details>`) is the safest balance.
- **The committed caches will grow.** Each new model with new GO/ECO/RO
  terms expands `ontology_cache.json`. Plan: don't worry about size until
  it crosses ~500 KB, then either (a) trim by ontology prefix or (b) move
  cache out of git into a downloadable artifact. Today's cache is 2.5 KB.
- **Test fixtures.** The R-HSA-69273 snapshot in `conversion/downloads/`
  will change once labels land. Inspect the diff carefully — it should be
  pure additions to the `label` field on existing nodes, no shape
  changes, no new nodes/edges, no attr changes. If the diff shows
  anything else, the enrichment hook is doing too much.
- **The Phase 5 markdown-substitution step uses `labels.py` substitution
  helpers.** That's why Phase 1 ports `substitute_ontology_labels` and
  `substitute_metadata` from val_analysis even though they're not used in
  Phase 2's `enrich_graph` (which works on graph nodes, not text). They
  earn their keep in Phase 5 when applied to the rendered markdown. Worth
  flagging in the docstring of `labels.py` so a reader doesn't wonder why
  there are two enrichment paths.
