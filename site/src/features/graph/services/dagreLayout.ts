import dagre from 'dagre';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Graph } from '@/features/graph/types';
import {
  estimateNodeWidth,
  NODE_HEIGHT,
} from '@/features/graph/services/elkOptions';

const EDGE_COLOR = '#5B6478';

export type DagreNodeData = {
  label: string;
  color?: string;
  width?: number;
  subtitle?: string | null;
};

export type DagreLayoutResult = {
  nodes: Node<DagreNodeData>[];
  edges: Edge[];
};

export type DagreRankDir = 'TB' | 'BT' | 'LR' | 'RL';

export type DagreLayoutOptions = {
  widthFor?: (id: string) => number;
  heightFor?: (id: string) => number;
  displayLabelFor?: (id: string) => string;
  rankDir?: DagreRankDir;
  ranker?: 'network-simplex' | 'tight-tree' | 'longest-path';
  nodeSep?: number;
  rankSep?: number;
  edgeSep?: number;
};

export function computeDagreLayout(
  graph: Graph,
  options: DagreLayoutOptions = {},
): DagreLayoutResult {
  const widthOf = (id: string) =>
    options.widthFor?.(id) ??
    estimateNodeWidth(options.displayLabelFor?.(id) ?? id);
  const heightOf = (id: string) => options.heightFor?.(id) ?? NODE_HEIGHT;

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: options.rankDir ?? 'TB',
    ranker: options.ranker ?? 'network-simplex',
    nodesep: options.nodeSep ?? 80,
    ranksep: options.rankSep ?? 140,
    edgesep: options.edgeSep ?? 40,
  });

  for (const n of graph.nodes) {
    g.setNode(n.id, { width: widthOf(n.id), height: heightOf(n.id) });
  }
  // Multigraph mode requires a per-edge name so parallel edges don't collide.
  for (const e of graph.edges) {
    g.setEdge(e.source, e.target, {}, e.id);
  }

  dagre.layout(g);

  const labelByNode = new Map<string, string>();
  for (const n of graph.nodes) {
    labelByNode.set(
      n.id,
      options.displayLabelFor?.(n.id) ?? n.label ?? n.id,
    );
  }

  const nodes: Node<DagreNodeData>[] = graph.nodes.map((n) => {
    const node = g.node(n.id);
    const w = node?.width ?? widthOf(n.id);
    const h = node?.height ?? heightOf(n.id);
    // dagre returns the node center; React Flow expects the top-left corner.
    const x = (node?.x ?? 0) - w / 2;
    const y = (node?.y ?? 0) - h / 2;
    return {
      id: n.id,
      type: 'pretty',
      position: { x, y },
      data: {
        label: labelByNode.get(n.id) ?? n.id,
        width: w,
      },
      draggable: true,
    };
  });

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'default',
    style: { stroke: EDGE_COLOR, strokeWidth: 1.6, strokeOpacity: 0.95 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: EDGE_COLOR,
      width: 18,
      height: 18,
    },
  }));

  return { nodes, edges };
}
