import { Parser, type Quad, type Term } from 'n3';
import type { Graph, GraphEdge, GraphNode } from './types';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const OWL_AXIOM = 'http://www.w3.org/2002/07/owl#Axiom';
const OWL_ANNOTATED_SOURCE = 'http://www.w3.org/2002/07/owl#annotatedSource';
const OWL_ANNOTATED_PROPERTY = 'http://www.w3.org/2002/07/owl#annotatedProperty';
const OWL_ANNOTATED_TARGET = 'http://www.w3.org/2002/07/owl#annotatedTarget';

const AXIOM_INTERNAL_PREDICATES = new Set<string>([
  RDF_TYPE,
  OWL_ANNOTATED_SOURCE,
  OWL_ANNOTATED_PROPERTY,
  OWL_ANNOTATED_TARGET,
]);

export function convert(ttlText: string): Graph {
  const quads = new Parser().parse(ttlText);
  return quadsToGraph(quads);
}

function quadsToGraph(quads: Quad[]): Graph {
  const { annotations, axiomNodes } = collapseAxioms(quads);

  const labels = new Map<string, string>();
  const types = new Map<string, string[]>();
  const attributes = new Map<string, Map<string, string[]>>();
  const referenced = new Set<string>();

  type RawEdge = {
    source: string;
    target: string;
    predicate: string;
    annotations: Record<string, string[]>;
  };
  const rawEdges: RawEdge[] = [];

  for (const q of quads) {
    if (axiomNodes.has(termKey(q.subject))) continue;

    const sid = nodeId(q.subject);
    referenced.add(sid);

    const p = q.predicate.value;

    if (q.object.termType === 'Literal') {
      if (p === RDFS_LABEL && !labels.has(sid)) {
        labels.set(sid, q.object.value);
      }
      pushAttr(attributes, sid, p, q.object.value);
      continue;
    }

    if (p === RDF_TYPE) {
      pushType(types, sid, q.object.value);
      continue;
    }

    const tid = nodeId(q.object);
    referenced.add(tid);
    rawEdges.push({
      source: sid,
      target: tid,
      predicate: p,
      annotations: annotations.get(tripleKey(q.subject, q.predicate, q.object)) ?? {},
    });
  }

  const sortedIds = [...referenced].sort();
  const nodes: GraphNode[] = sortedIds.map((id) => {
    const attrs: Record<string, unknown> = {};
    const attrMap = attributes.get(id);
    if (attrMap) {
      for (const [k, v] of attrMap) attrs[k] = v;
    }
    const t = types.get(id);
    if (t && t.length > 0) attrs['rdf:type'] = [...t];
    const node: GraphNode = { id };
    const label = labels.get(id);
    if (label !== undefined) node.label = label;
    if (Object.keys(attrs).length > 0) node.attrs = attrs;
    return node;
  });

  const edges = toEdges(rawEdges);
  return { nodes, edges };
}

function toEdges(raw: { source: string; target: string; predicate: string; annotations: Record<string, string[]> }[]): GraphEdge[] {
  const counts = new Map<string, number>();
  const out: GraphEdge[] = [];
  for (const r of raw) {
    const tripleSig = r.source + '|' + r.predicate + '|' + r.target;
    const idx = counts.get(tripleSig) ?? 0;
    counts.set(tripleSig, idx + 1);
    const edge: GraphEdge = {
      id: r.source + '|' + r.predicate + '|' + r.target + '|' + idx,
      source: r.source,
      target: r.target,
    };
    if (r.predicate !== '') edge.label = r.predicate;
    if (Object.keys(r.annotations).length > 0) edge.attrs = { ...r.annotations };
    out.push(edge);
  }
  return out;
}

type CollapseResult = {
  annotations: Map<string, Record<string, string[]>>;
  axiomNodes: Set<string>;
};

function collapseAxioms(quads: Quad[]): CollapseResult {
  const axiomNodes = new Set<string>();
  for (const q of quads) {
    if (q.predicate.value === RDF_TYPE && q.object.termType === 'NamedNode' && q.object.value === OWL_AXIOM) {
      axiomNodes.add(termKey(q.subject));
    }
  }

  const bySubject = new Map<string, Quad[]>();
  for (const q of quads) {
    const k = termKey(q.subject);
    if (!axiomNodes.has(k)) continue;
    const list = bySubject.get(k) ?? [];
    list.push(q);
    bySubject.set(k, list);
  }

  const annotations = new Map<string, Record<string, string[]>>();
  const valid = new Set<string>();

  for (const [axiomKey, axiomQuads] of bySubject) {
    let src: Term | undefined;
    let prop: Term | undefined;
    let tgt: Term | undefined;
    for (const q of axiomQuads) {
      if (q.predicate.value === OWL_ANNOTATED_SOURCE) src = q.object;
      else if (q.predicate.value === OWL_ANNOTATED_PROPERTY) prop = q.object;
      else if (q.predicate.value === OWL_ANNOTATED_TARGET) tgt = q.object;
    }
    if (!src || !prop || !tgt) continue;

    valid.add(axiomKey);

    const ann: Record<string, string[]> = {};
    for (const q of axiomQuads) {
      if (AXIOM_INTERNAL_PREDICATES.has(q.predicate.value)) continue;
      const list = ann[q.predicate.value] ?? [];
      list.push(termToJson(q.object));
      ann[q.predicate.value] = list;
    }
    annotations.set(tripleKeyRaw(src, prop, tgt), ann);
  }

  for (const k of [...axiomNodes]) {
    if (!valid.has(k)) axiomNodes.delete(k);
  }

  return { annotations, axiomNodes };
}

function pushAttr(map: Map<string, Map<string, string[]>>, id: string, predicate: string, value: string): void {
  let inner = map.get(id);
  if (!inner) {
    inner = new Map();
    map.set(id, inner);
  }
  const list = inner.get(predicate) ?? [];
  list.push(value);
  inner.set(predicate, list);
}

function pushType(map: Map<string, string[]>, id: string, type: string): void {
  const list = map.get(id) ?? [];
  list.push(type);
  map.set(id, list);
}

function nodeId(t: Term): string {
  return termToJson(t);
}

function termToJson(t: Term): string {
  if (t.termType === 'BlankNode') return '_:' + t.value;
  return t.value;
}

function termKey(t: Term): string {
  return t.termType + ' ' + t.value;
}

function tripleKey(s: Term, p: Term, o: Term): string {
  return tripleKeyRaw(s, p, o);
}

function tripleKeyRaw(s: Term, p: Term, o: Term): string {
  return termKey(s) + termKey(p) + termKey(o);
}
