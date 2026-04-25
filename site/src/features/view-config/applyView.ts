import type { Graph, GraphEdge, GraphNode } from '@/features/graph';
import { bfsFocus } from '@/features/view-config/focus';

export type ApplyViewInput = {
  graph: Graph;
  hiddenPredicates: Set<string>;
  hiddenTypes: Set<string>;
  nodeTypes: Map<string, string | null>;
  focusNodeId?: string | null;
  focusDepth?: number;
  revealedNodeIds?: Set<string>;
};

export type ApplyViewOutput = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export function applyView(input: ApplyViewInput): ApplyViewOutput {
  const {
    graph,
    hiddenPredicates,
    hiddenTypes,
    nodeTypes,
    focusNodeId,
    focusDepth = 2,
    revealedNodeIds,
  } = input;

  const visibleNodeIds = new Set<string>();
  const nodesByType: GraphNode[] = [];
  for (const n of graph.nodes) {
    const t = nodeTypes.get(n.id);
    if (t !== null && t !== undefined && hiddenTypes.has(t)) continue;
    visibleNodeIds.add(n.id);
    nodesByType.push(n);
  }

  const edgesByPredicate: GraphEdge[] = [];
  for (const e of graph.edges) {
    if (hiddenPredicates.has(e.label ?? '')) continue;
    if (!visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)) continue;
    edgesByPredicate.push(e);
  }

  if (!focusNodeId) {
    return { nodes: nodesByType, edges: edgesByPredicate };
  }

  const focusVisible = bfsFocus({
    graph: { nodes: nodesByType, edges: edgesByPredicate },
    focusNodeId,
    focusDepth,
    revealedNodeIds: revealedNodeIds ?? new Set(),
  });

  const nodes = nodesByType.filter((n) => focusVisible.has(n.id));
  const edges = edgesByPredicate.filter(
    (e) => focusVisible.has(e.source) && focusVisible.has(e.target),
  );

  return { nodes, edges };
}
