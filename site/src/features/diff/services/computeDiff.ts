import type { Graph, GraphEdge, GraphNode } from '@/features/graph/types';

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export type DiffMap = {
  nodes: Map<string, DiffStatus>;
  edges: Map<string, DiffStatus>;
};

const isBnode = (id: string) => id.startsWith('_:');

const edgeKey = (e: { source: string; predicate: string; target: string }) =>
  `${e.source}|${e.predicate}|${e.target}`;

const stableAttrs = (attrs: Record<string, unknown> | undefined): string =>
  attrs ? JSON.stringify(attrs, Object.keys(attrs).sort()) : '';

const nodeAttrsEqual = (a: GraphNode, b: GraphNode) =>
  a.label === b.label && stableAttrs(a.attrs) === stableAttrs(b.attrs);

const edgeAttrsEqual = (a: GraphEdge, b: GraphEdge) =>
  a.label === b.label && stableAttrs(a.attrs) === stableAttrs(b.attrs);

export function computeDiff(current: Graph, other: Graph): DiffMap {
  const result: DiffMap = { nodes: new Map(), edges: new Map() };

  const currentNodes = new Map(current.nodes.map((n) => [n.id, n] as const));
  const otherNodes = new Map(other.nodes.map((n) => [n.id, n] as const));

  for (const [id, node] of currentNodes) {
    const prev = otherNodes.get(id);
    if (!prev) {
      result.nodes.set(id, 'added');
    } else if (isBnode(id)) {
      // Bnodes mint fresh on each converter run; treat as unchanged when
      // present on both sides regardless of attrs to avoid noise.
      result.nodes.set(id, 'unchanged');
    } else {
      result.nodes.set(id, nodeAttrsEqual(node, prev) ? 'unchanged' : 'changed');
    }
  }
  for (const [id] of otherNodes) {
    if (!currentNodes.has(id)) result.nodes.set(id, 'removed');
  }

  // Identity by (source, predicate, target). Drops the multigraph index — two
  // parallel same-predicate edges between the same pair collapse for diff
  // purposes. Acceptable for MVP; pathways2GO rarely produces them.
  const indexEdges = (edges: GraphEdge[]) => {
    const m = new Map<string, GraphEdge>();
    for (const e of edges) {
      const pred = e.label ?? '';
      m.set(edgeKey({ source: e.source, predicate: pred, target: e.target }), e);
    }
    return m;
  };
  const currentEdges = indexEdges(current.edges);
  const otherEdges = indexEdges(other.edges);

  for (const [k, edge] of currentEdges) {
    const prev = otherEdges.get(k);
    if (!prev) {
      result.edges.set(edge.id, 'added');
    } else if (isBnode(edge.source) || isBnode(edge.target)) {
      result.edges.set(edge.id, 'unchanged');
    } else {
      result.edges.set(edge.id, edgeAttrsEqual(edge, prev) ? 'unchanged' : 'changed');
    }
  }
  for (const [k, edge] of otherEdges) {
    if (!currentEdges.has(k)) result.edges.set(edge.id, 'removed');
  }

  return result;
}

export { edgeKey };
