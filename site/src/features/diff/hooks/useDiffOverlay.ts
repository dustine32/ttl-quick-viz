import { useMemo } from 'react';
import { useAppSelector } from '@/app/hooks';
import type { Graph, GraphEdge, GraphNode } from '@/features/graph/types';
import { diffStyleFor } from '@/features/diff/services/diffStyling';
import type { DiffStatus } from '@/features/diff/services/computeDiff';

export type DiffOverlay = {
  active: boolean;
  /** Graph augmented with "removed" nodes/edges so they render. */
  graph: Graph;
  /** Per-node diff status, keyed by node id. */
  nodeStatus: (id: string) => DiffStatus | undefined;
  /** Per-edge diff status, keyed by edge id. */
  edgeStatus: (id: string) => DiffStatus | undefined;
  /** Convenience helpers — null if the element has no status. */
  nodeColor: (id: string) => string | null;
  edgeColor: (id: string) => string | null;
};

const NO_DIFF: DiffOverlay = {
  active: false,
  graph: { nodes: [], edges: [] },
  nodeStatus: () => undefined,
  edgeStatus: () => undefined,
  nodeColor: () => null,
  edgeColor: () => null,
};

/** Synthesize a "removed" edge id stable enough to round-trip in renderers. */
const removedEdgeId = (e: GraphEdge) => `__removed__|${e.id}`;

export function useDiffOverlay(currentGraph: Graph | undefined | null): DiffOverlay {
  const compareGraph = useAppSelector((s) => s.diff.compareGraph);
  const diffMap = useAppSelector((s) => s.diff.diffMap);

  return useMemo(() => {
    if (!currentGraph) return { ...NO_DIFF, graph: { nodes: [], edges: [] } };
    if (!compareGraph || !diffMap) {
      return {
        ...NO_DIFF,
        active: false,
        graph: currentGraph,
      };
    }

    const currentNodeIds = new Set(currentGraph.nodes.map((n) => n.id));
    const currentEdgeKeys = new Set(
      currentGraph.edges.map((e) => `${e.source}|${e.label ?? ''}|${e.target}`),
    );

    const removedNodes: GraphNode[] = compareGraph.nodes.filter(
      (n) => !currentNodeIds.has(n.id),
    );
    const removedEdges: GraphEdge[] = compareGraph.edges
      .filter(
        (e) => !currentEdgeKeys.has(`${e.source}|${e.label ?? ''}|${e.target}`),
      )
      .map((e) => ({ ...e, id: removedEdgeId(e) }));

    const merged: Graph = {
      nodes: [...currentGraph.nodes, ...removedNodes],
      edges: [...currentGraph.edges, ...removedEdges],
    };

    const nodeMap = diffMap.nodes;
    const edgeMap = diffMap.edges;

    const nodeStatus = (id: string): DiffStatus | undefined => {
      const direct = nodeMap[id];
      if (direct) return direct;
      // Removed nodes injected from compareGraph are not in diffMap.nodes;
      // they were synthesized here. Mark them as removed.
      if (!currentNodeIds.has(id) && removedNodes.some((n) => n.id === id)) {
        return 'removed';
      }
      return undefined;
    };

    const edgeStatus = (id: string): DiffStatus | undefined => {
      const direct = edgeMap[id];
      if (direct) return direct;
      if (id.startsWith('__removed__|')) return 'removed';
      return undefined;
    };

    const nodeColor = (id: string) => {
      const s = nodeStatus(id);
      return s ? diffStyleFor(s).stroke : null;
    };
    const edgeColor = (id: string) => {
      const s = edgeStatus(id);
      return s ? diffStyleFor(s).stroke : null;
    };

    return {
      active: true,
      graph: merged,
      nodeStatus,
      edgeStatus,
      nodeColor,
      edgeColor,
    };
  }, [currentGraph, compareGraph, diffMap]);
}
