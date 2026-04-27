# Debugging-features roadmap — pathways2GO converter inspection

**Date:** 2026-04-26
**Scope:** Forward-looking feature ideas for `ttl-quick-viz` framed around its primary use case: debugging the [pathways2GO](https://github.com/geneontology/pathways2GO) converter, which transforms Reactome pathway TTL into GO-CAM TTL. The user inspects converter output; they do not author TTL.
**Status:** Brainstorm. Item 1 (TTL source pane) has an active implementation plan at [`.plans/feature/ttl-source-pane.md`](../.plans/feature/ttl-source-pane.md). Items 2–5 are speculative.

## Purpose

The viewer today answers "what does this graph look like?" Debugging pathways2GO output requires the harder questions: "*why* is this edge here?", "did my converter change break this pathway?", "does this graph satisfy GO-CAM shape?" This roadmap collects features that move the tool toward a debugging surface, ordered by debugging payoff.

## Guiding principle

Favor features that answer concrete debugging questions over generic UX polish. If a feature doesn't help diagnose a bad conversion, it's not on this roadmap.

---

## 1. Provenance — TTL source pane

**Question it answers:** "Why is this edge here? Where in the original TTL did it come from?"

**Sketch:** When the user selects an edge (or node) in the graph, a side or bottom pane shows the original `.ttl` and scrolls / highlights the line(s) that produced it. Read-only.

**Why high-value:** Most pathways2GO debugging is "this edge looks wrong — what produced it?" Today the answer is grep by hand. With a synced pane, it's a click.

**Levels of polish:**

- **MVP:** raw TTL pane + best-effort line search (`subject … predicate target` matches one line in stanza-style TTL ~95% of the time on GO-CAM output).
- **v1.5:** N3.js parser builds a `(s, p, o) → lineRange` index for sub-line precision, including blank-node `[ ... ]` and `;` / `,` grouping.
- **v2:** "Why this edge?" shows the *rule* in pathways2GO that fired (requires converter cooperation — needs an upstream contract, not just a viewer feature).

**Status:** Active. See [`.plans/feature/ttl-source-pane.md`](../.plans/feature/ttl-source-pane.md).

---

## 2. Diff two graphs

**Question it answers:** "I tweaked the pathways2GO converter. What actually changed across these 50 pathways?"

**Sketch:** Load two converted JSONs side-by-side (or overlay on one canvas). Color edges and nodes added / removed / changed. A list of mutated pathways at a glance; click in to see the topology delta.

**Why high-value:** Every converter change is a regression risk. Without a diff tool, "did this change break anything?" is unanswerable except by visual eyeballing. With one, regressions are visible in seconds.

**Where it lives:**

- `api/` gains a `GET /api/graphs/{id}/diff?against={other_id}` (or the diff is computed client-side once both graphs are loaded — cheaper, no schema change).
- `site/` gains a "Compare" toggle in the toolbar that switches the canvas into diff mode.

**Edge cases:**

- IRI stability across converter runs is an *assumption*; if the converter mints new bnodes each run, diffs become noisy. May need a canonicalisation pass.
- Multi-pathway diff (50 files at once) needs a summary view, not 50 canvases. Probably a sortable table: `pathway | +nodes | -nodes | +edges | -edges`, click → open the canvas in diff mode.

**Status:** Speculative. Pre-req for serious converter regression testing. Hold until item 1 is shipped — and only build if regression checks become a recurring pain.

---

## 3. GO-CAM shape validation overlay

**Question it answers:** "Does this graph satisfy the GO-CAM patterns the downstream tools expect?"

**Sketch:** Encode a small set of GO-CAM shape rules and flag violations on the canvas: dangling IRIs, missing required predicates (`enabled_by`, `occurs_in`, `part_of`), wrong-typed objects, type-set contradictions. Lint badges on the offending nodes/edges.

**Why high-value:** Converts the viewer into a passive linter. The user notices conversion bugs *without looking for them*.

**Where rules come from:**

- pathways2GO and GO-CAM SHACL shapes if those exist (worth checking — would let us reuse the rule corpus instead of re-encoding by hand).
- Otherwise: hand-rolled rule list, growable. Each rule is a pure function `(graph) → violation[]`.

**Implementation shape:**

- Rules live in a new `site/src/features/validation/rules.ts`.
- A `ValidationOverlay` component reads selected rules from `viewConfig` and decorates nodes/edges via `applyView()` (the existing single chokepoint that all 6 renderers respect — same pattern as the recent filter feature).

**Risks:**

- Encoding the wrong rules creates noise that erodes trust in the linter. Start with a small, conservative set (3–5 rules) and expand only when each rule has caught a real bug.

**Status:** Speculative. Strong candidate after items 1 and 2 — but only if a clear initial rule set is on hand. Otherwise it's a feature looking for a use case.

---

## 4. Subgraph extract for bug reports

**Question it answers:** "I found something busted. How do I drop a self-contained repro into a pathways2GO issue?"

**Sketch:** Right-click a node (or use a toolbar button on the selected node) → "Extract neighborhood" → choose N hops → export the subgraph as `.ttl` or `.json` or a permalink (URL with embedded selection + view state).

**Why high-value:** Cuts the cycle time on filing converter bugs. Without it, the user has to find and copy a minimal subset of TTL by hand — which is the exact pain item 1 already solves once, but for *one triple*. This generalises.

**Implementation shape:**

- Pure graph operation: BFS from the selected node, collect node ids within N hops, project the original graph down. Lives in `features/view-config/applyView.ts` or a sibling module.
- Export formats: JSON is trivial (`Graph` subset). TTL requires either a server round-trip (api re-serializes the slice via rdflib) or a JS Turtle writer (N3.js can write quads back to Turtle).
- Permalink: encode `{graphId, selectedIds, layout, viewport}` in `useUrlSync` and let the recipient open the same view.

**Status:** Speculative. Naturally pairs with item 1 — once you can see *the triple*, the next ask is "let me see the *neighborhood* and share it."

---

## 5. Search / navigate / inspect quality-of-life

**Question it answers:** A bag of small things — "what came from Reactome vs. what was inferred?", "is X actually connected to Y?", "show me everything of type ChEBI."

**Sketch (each is small):**

- **Filter by IRI namespace.** Toggle Reactome / GO / RO / ChEBI / (other) on. Cheap addition to the existing `applyView()` filter chokepoint.
- **Path between two nodes.** Pick A and B → BFS → highlight the shortest path. Tells the user immediately if A leaks into B.
- **Triple inspector.** Already partly there in `EdgeInspector` — add a "Copy as triple" button (`<s> <p> <o> .`) and a link to the TTL pane location (synergises with item 1).

**Why grouped:** These are individually small but together polish the inspection workflow. Worth picking up opportunistically rather than as a planned phase.

**Status:** Speculative. Add as paper cuts emerge.

---

## Sequencing recommendation

1. **Ship item 1 (TTL source pane).** Plan exists. This is the highest-leverage single feature.
2. **Pause.** Use the tool. See which of items 2–5 the user actually reaches for.
3. **Item 2 (diff)** if converter regression checking becomes a recurring pain.
4. **Item 3 (validation)** only after a concrete starting rule set is on hand (ideally borrowed from existing GO-CAM SHACL).
5. **Items 4 and 5** opportunistically.

## What this roadmap deliberately omits

- More renderers / theming / layout polish — already 6 renderers; UX polish is not the bottleneck.
- TTL *editing* — out of scope. The user inspects converter output; they do not author TTL.
- A general-purpose property-graph tool — this is a pathways2GO debugging tool that happens to render property graphs. Don't over-generalize.

## Tradeoffs to revisit

- **Feature sprawl risk.** Each item makes the SPA more capable but also more crowded. Item 1 is a clear win; items 2–5 should each prove their use before being built.
- **Wire-shape impact.** Items 1 and 5 require **no** wire-shape change. Item 2 may want one (canonical IRIs across runs). Item 3 is purely view-side. Item 4 may want a server-side TTL writer endpoint. Cross-cutting invariant from root `CLAUDE.md` ("wire-shape changes are two-subproject changes") applies — flag any such change explicitly when it comes up.
- **Rule encoding effort vs. payoff (item 3).** Hand-rolling shape rules is real work; if a SHACL corpus exists upstream, the math changes substantially.
