import type { Graph, GraphEdge, GraphNode } from '@/features/graph';
import { bfsFocus } from '@/features/view-config/focus';
import type { StandaloneMode } from '@/features/view-config/viewConfigSlice';

export type ApplyViewInput = {
  graph: Graph;
  hiddenPredicates: Set<string>;
  hiddenTypes: Set<string>;
  nodeTypes: Map<string, string | null>;
  focusNodeId?: string | null;
  focusDepth?: number;
  revealedNodeIds?: Set<string>;
  standaloneMode?: StandaloneMode;
  minDegree?: number;
};

export type ApplyViewOutput = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function computeDegree(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const degree = new Map<string, number>();
  for (const n of nodes) degree.set(n.id, 0);
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    if (e.target !== e.source) {
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
  }
  return degree;
}

export function applyView(input: ApplyViewInput): ApplyViewOutput {
  const {
    graph,
    hiddenPredicates,
    hiddenTypes,
    nodeTypes,
    focusNodeId,
    focusDepth = 2,
    revealedNodeIds,
    standaloneMode = 'both',
    minDegree = 0,
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

  let filteredNodes = nodesByType;
  let filteredEdges = edgesByPredicate;

  if (minDegree > 0) {
    const degree = computeDegree(filteredNodes, filteredEdges);
    const keep = new Set<string>();
    for (const [id, d] of degree) if (d >= minDegree) keep.add(id);
    filteredNodes = filteredNodes.filter((n) => keep.has(n.id));
    filteredEdges = filteredEdges.filter(
      (e) => keep.has(e.source) && keep.has(e.target),
    );
  }

  if (standaloneMode === 'hide') {
    const degree = computeDegree(filteredNodes, filteredEdges);
    filteredNodes = filteredNodes.filter((n) => (degree.get(n.id) ?? 0) > 0);
    const ids = new Set(filteredNodes.map((n) => n.id));
    filteredEdges = filteredEdges.filter(
      (e) => ids.has(e.source) && ids.has(e.target),
    );
  }

  if (!focusNodeId) {
    return { nodes: filteredNodes, edges: filteredEdges };
  }

  const focusVisible = bfsFocus({
    graph: { nodes: filteredNodes, edges: filteredEdges },
    focusNodeId,
    focusDepth,
    revealedNodeIds: revealedNodeIds ?? new Set(),
  });

  const nodes = filteredNodes.filter((n) => focusVisible.has(n.id));
  const edges = filteredEdges.filter(
    (e) => focusVisible.has(e.source) && focusVisible.has(e.target),
  );

  return { nodes, edges };
}
