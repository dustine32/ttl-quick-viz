import { useMemo } from 'react';
import type { Graph } from '@/features/graph';
import { colorForType } from '@/features/view-config/palette';

export type PredicateStat = { predicate: string; count: number };
export type TypeStat = { type: string; count: number; color: string };

export type GraphDerivedData = {
  predicates: PredicateStat[];
  types: TypeStat[];
  nodeTypes: Map<string, string | null>;
  degree: Map<string, number>;
};

const EMPTY: GraphDerivedData = {
  predicates: [],
  types: [],
  nodeTypes: new Map(),
  degree: new Map(),
};

// OWL/RDFS meta-types — useful as supporting info in the inspector, but
// uninformative for canvas coloring, swimlane grouping, or "what kind of
// thing is this." When a node has both `owl:NamedIndividual` and a real
// class IRI (the GO-CAM pattern), the real class wins.
const META_TYPES = new Set([
  'http://www.w3.org/2002/07/owl#NamedIndividual',
  'http://www.w3.org/2002/07/owl#Class',
  'http://www.w3.org/2002/07/owl#Thing',
  'http://www.w3.org/2002/07/owl#ObjectProperty',
  'http://www.w3.org/2002/07/owl#DatatypeProperty',
  'http://www.w3.org/2002/07/owl#AnnotationProperty',
  'http://www.w3.org/2000/01/rdf-schema#Resource',
]);

function primaryType(attrs: Record<string, unknown> | undefined): string | null {
  const t = attrs?.['rdf:type'];
  if (!Array.isArray(t) || t.length === 0) return null;
  for (const v of t) {
    if (typeof v === 'string' && v && !META_TYPES.has(v)) return v;
  }
  // All entries are meta-types — fall back to the first one rather than
  // dropping the node into the "untyped" bucket.
  const first = t[0];
  return typeof first === 'string' && first ? first : null;
}

export function useGraphDerivedData(graph: Graph | undefined): GraphDerivedData {
  return useMemo(() => {
    if (!graph) return EMPTY;

    const predCounts = new Map<string, number>();
    for (const e of graph.edges) {
      const key = e.label ?? '';
      predCounts.set(key, (predCounts.get(key) ?? 0) + 1);
    }

    const typeCounts = new Map<string, number>();
    const nodeTypes = new Map<string, string | null>();
    for (const n of graph.nodes) {
      const t = primaryType(n.attrs);
      nodeTypes.set(n.id, t);
      if (t !== null) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }

    const degree = new Map<string, number>();
    for (const n of graph.nodes) degree.set(n.id, 0);
    for (const e of graph.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }

    const predicates: PredicateStat[] = Array.from(predCounts, ([predicate, count]) => ({
      predicate,
      count,
    })).sort((a, b) => b.count - a.count || a.predicate.localeCompare(b.predicate));

    const types: TypeStat[] = Array.from(typeCounts, ([type, count]) => ({
      type,
      count,
      color: colorForType(type),
    })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

    return { predicates, types, nodeTypes, degree };
  }, [graph]);
}
