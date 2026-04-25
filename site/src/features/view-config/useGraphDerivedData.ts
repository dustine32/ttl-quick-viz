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

function primaryType(attrs: Record<string, unknown> | undefined): string | null {
  const t = attrs?.['rdf:type'];
  if (Array.isArray(t) && t.length > 0 && typeof t[0] === 'string') {
    return t[0];
  }
  return null;
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
