import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert } from './convert';
import type { Graph, GraphEdge, GraphNode } from './types';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '../../../conversion/downloads');

describe('convert (synthetic)', () => {
  it('builds nodes and edges from simple triples', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:a rdfs:label "Alice" ; ex:knows ex:b .
      ex:b rdfs:label "Bob" .
    `;
    const g = convert(ttl);
    const a = byId(g.nodes, 'http://example.org/a');
    const b = byId(g.nodes, 'http://example.org/b');
    expect(a.label).toBe('Alice');
    expect(b.label).toBe('Bob');
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({
      source: 'http://example.org/a',
      target: 'http://example.org/b',
      label: 'http://example.org/knows',
    });
    expect(g.edges[0].id).toBe('http://example.org/a|http://example.org/knows|http://example.org/b|0');
  });

  it('promotes rdf:type triples into node attrs and excludes them from edges', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      ex:a rdf:type ex:Thing , ex:Other .
    `;
    const g = convert(ttl);
    const a = byId(g.nodes, 'http://example.org/a');
    expect(a.attrs?.['rdf:type']).toEqual(expect.arrayContaining(['http://example.org/Thing', 'http://example.org/Other']));
    expect(g.edges).toHaveLength(0);
  });

  it('keys parallel edges between the same nodes with incrementing idx', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      ex:a ex:rel ex:b .
      ex:a ex:rel ex:b .
      ex:a ex:rel ex:b .
    `;
    const g = convert(ttl);
    expect(g.edges).toHaveLength(3);
    const ids = g.edges.map((e) => e.id).sort();
    expect(ids).toEqual([
      'http://example.org/a|http://example.org/rel|http://example.org/b|0',
      'http://example.org/a|http://example.org/rel|http://example.org/b|1',
      'http://example.org/a|http://example.org/rel|http://example.org/b|2',
    ]);
  });

  it('collapses owl:Axiom reifications into edge attrs and excludes the axiom bnode', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      ex:a ex:rel ex:b .
      [ rdf:type owl:Axiom ;
        owl:annotatedSource ex:a ;
        owl:annotatedProperty ex:rel ;
        owl:annotatedTarget ex:b ;
        ex:provenance "pathways2GO" ;
        ex:confidence "0.9" ] .
    `;
    const g = convert(ttl);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].attrs).toEqual({
      'http://example.org/provenance': ['pathways2GO'],
      'http://example.org/confidence': ['0.9'],
    });
    expect(g.nodes.every((n) => !n.id.startsWith('_:'))).toBe(true);
  });

  it('emits nodes in sorted order', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      ex:c ex:rel ex:a .
      ex:b ex:rel ex:c .
    `;
    const g = convert(ttl);
    expect(g.nodes.map((n) => n.id)).toEqual([
      'http://example.org/a',
      'http://example.org/b',
      'http://example.org/c',
    ]);
  });

  it('serializes blank nodes with _: prefix', () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      ex:a ex:has [ ex:p "v" ] .
    `;
    const g = convert(ttl);
    const bnodes = g.nodes.filter((n) => n.id.startsWith('_:'));
    expect(bnodes.length).toBeGreaterThan(0);
  });
});

describe('convert (Reactome fixture parity)', () => {
  it('matches translated python output for R-HSA-69273', () => {
    const ttl = readFileSync(`${fixtureRoot}/input/R-HSA-69273.ttl`, 'utf-8');
    const raw = JSON.parse(readFileSync(`${fixtureRoot}/output/R-HSA-69273.json`, 'utf-8'));
    const expected = translateNodeLink(raw);
    const actual = convert(ttl);

    // Python preserves rdflib walk order; the TS port sorts. Compare as sets.
    expect(actual.nodes.map((n) => n.id).sort()).toEqual(expected.nodes.map((n) => n.id).sort());
    expect(actual.edges.map((e) => e.id).sort()).toEqual(expected.edges.map((e) => e.id).sort());

    const aById = new Map(actual.nodes.map((n) => [n.id, n]));
    for (const exp of expected.nodes) {
      const got = aById.get(exp.id);
      expect(got).toBeDefined();
      expect(got!.label).toBe(exp.label);
      expect(normalizeAttrs(got!.attrs)).toEqual(normalizeAttrs(exp.attrs));
    }

    const aByEdge = new Map(actual.edges.map((e) => [e.id, e]));
    for (const exp of expected.edges) {
      const got = aByEdge.get(exp.id);
      expect(got, 'missing edge ' + exp.id).toBeDefined();
      expect(got!.source).toBe(exp.source);
      expect(got!.target).toBe(exp.target);
      expect(got!.label).toBe(exp.label);
      expect(normalizeAttrs(got!.attrs)).toEqual(normalizeAttrs(exp.attrs));
    }
  });
});

function byId(nodes: GraphNode[], id: string): GraphNode {
  const found = nodes.find((n) => n.id === id);
  if (!found) throw new Error('node not found: ' + id);
  return found;
}

function normalizeAttrs(attrs: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!attrs) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      // Sort to ignore walk-order differences between rdflib and n3.
      out[k] = [...v].map(String).sort();
      continue;
    }
    out[k] = v;
  }
  return out;
}

// Mirror api/src/app/domain/translate.py against the python node_link_data
// JSON so we can compare the TS port output without shelling out to Python.
function translateNodeLink(raw: { nodes: any[]; links: any[] }): Graph {
  const nodes: GraphNode[] = raw.nodes.map((n) => {
    const attrs: Record<string, unknown> = { ...(n.attributes ?? {}) };
    const types = n.types ?? [];
    if (types.length > 0) attrs['rdf:type'] = [...types];
    const node: GraphNode = { id: String(n.id) };
    if (n.label != null) node.label = n.label;
    if (Object.keys(attrs).length > 0) node.attrs = attrs;
    return node;
  });

  const counts = new Map<string, number>();
  const edges: GraphEdge[] = raw.links.map((l) => {
    const src = String(l.source);
    const tgt = String(l.target);
    const pred = String(l.predicate ?? '');
    const sig = src + '|' + pred + '|' + tgt;
    const idx = counts.get(sig) ?? 0;
    counts.set(sig, idx + 1);
    const edge: GraphEdge = {
      id: src + '|' + pred + '|' + tgt + '|' + idx,
      source: src,
      target: tgt,
    };
    if (pred !== '') edge.label = pred;
    if (l.annotations && Object.keys(l.annotations).length > 0) edge.attrs = { ...l.annotations };
    return edge;
  });

  return { nodes, edges };
}
