import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Graph } from '@/features/graph/types';
import {
  estimateNodeWidth,
  MIN_NODE_WIDTH,
  NODE_HEIGHT,
} from '@/features/graph/services/elkOptions';
import { computeConnectedComponents } from '@/features/graph/services/connectedComponents';

const EDGE_COLOR = '#5B6478';
const COMPONENT_GAP_X = 120;
const COMPONENT_GAP_Y = 120;
const TARGET_ROW_WIDTH = 2400;

export type RadialNodeData = {
  label: string;
  color?: string;
  width?: number;
  subtitle?: string | null;
};

export type RadialLayoutResult = {
  nodes: Node<RadialNodeData>[];
  edges: Edge[];
};

export type RadialLayoutOptions = {
  widthFor?: (id: string) => number;
  heightFor?: (id: string) => number;
  displayLabelFor?: (id: string) => string;
  /** Pixel gap between consecutive rings. Falls back to a width-aware default. */
  ringSpacing?: number;
};

type ComponentLayout = {
  positions: Map<string, { x: number; y: number; w: number; h: number }>;
  width: number;
  height: number;
};

function layoutComponent(
  members: string[],
  graph: Graph,
  widthOf: (id: string) => number,
  heightOf: (id: string) => number,
  ringSpacingOverride: number | undefined,
): ComponentLayout {
  const memberSet = new Set(members);
  const adj = new Map<string, Set<string>>();
  for (const id of members) adj.set(id, new Set());
  for (const e of graph.edges) {
    if (e.source === e.target) continue;
    if (!memberSet.has(e.source) || !memberSet.has(e.target)) continue;
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }

  // Pick root: highest undirected degree, ties broken by id for determinism.
  let root = members[0];
  let bestDeg = adj.get(root)!.size;
  for (const id of members) {
    const d = adj.get(id)!.size;
    if (d > bestDeg || (d === bestDeg && id.localeCompare(root) < 0)) {
      root = id;
      bestDeg = d;
    }
  }

  // BFS tree (parent + children) from root.
  const parent = new Map<string, string | null>();
  const level = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const id of members) children.set(id, []);
  parent.set(root, null);
  level.set(root, 0);
  const queue: string[] = [root];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const curLevel = level.get(cur)!;
    // Sort neighbors deterministically so layout is stable.
    const neighbors = [...adj.get(cur)!].sort();
    for (const nb of neighbors) {
      if (!parent.has(nb)) {
        parent.set(nb, cur);
        level.set(nb, curLevel + 1);
        children.get(cur)!.push(nb);
        queue.push(nb);
      }
    }
  }

  // Post-order leaf counts (iterative to avoid stack overflow on big graphs).
  const leafCount = new Map<string, number>();
  const order: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    order.push(cur);
    for (const k of children.get(cur)!) stack.push(k);
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const kids = children.get(id)!;
    if (kids.length === 0) {
      leafCount.set(id, 1);
    } else {
      let s = 0;
      for (const k of kids) s += leafCount.get(k)!;
      leafCount.set(id, s);
    }
  }

  // Ring spacing: large enough that the widest node on any ring fits between
  // adjacent rings. We don't know the per-ring max angle yet, so use a global
  // upper bound.
  let maxNodeWidth = MIN_NODE_WIDTH;
  for (const id of members) {
    const w = widthOf(id);
    if (w > maxNodeWidth) maxNodeWidth = w;
  }
  const ringSpacing = ringSpacingOverride ?? Math.max(220, maxNodeWidth + 80);

  // Recursive angular sector assignment via explicit stack to avoid recursion
  // limits on long chains.
  const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
  type Frame = { id: string; angleStart: number; angleEnd: number };
  const frames: Frame[] = [{ id: root, angleStart: 0, angleEnd: Math.PI * 2 }];
  while (frames.length) {
    const f = frames.pop()!;
    const lvl = level.get(f.id)!;
    const mid = (f.angleStart + f.angleEnd) / 2;
    const r = lvl === 0 ? 0 : lvl * ringSpacing;
    const w = widthOf(f.id);
    const h = heightOf(f.id);
    // x/y are top-left corners (matches React Flow + ELK convention).
    const cx = r * Math.cos(mid);
    const cy = r * Math.sin(mid);
    positions.set(f.id, { x: cx - w / 2, y: cy - h / 2, w, h });

    const kids = children.get(f.id)!;
    if (kids.length === 0) continue;
    const total = leafCount.get(f.id)!;
    const span = f.angleEnd - f.angleStart;
    let cur = f.angleStart;
    for (const k of kids) {
      const share = (leafCount.get(k)! / total) * span;
      frames.push({ id: k, angleStart: cur, angleEnd: cur + share });
      cur += share;
    }
  }

  // Normalize so positions start at (0, 0) and report bounding box.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of positions.values()) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x + p.w > maxX) maxX = p.x + p.w;
    if (p.y + p.h > maxY) maxY = p.y + p.h;
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  for (const [id, p] of positions) {
    positions.set(id, { x: p.x - minX, y: p.y - minY, w: p.w, h: p.h });
  }
  return {
    positions,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function computeRadialLayout(
  graph: Graph,
  options: RadialLayoutOptions = {},
): RadialLayoutResult {
  const widthOf = (id: string) =>
    options.widthFor?.(id) ??
    estimateNodeWidth(options.displayLabelFor?.(id) ?? id);
  const heightOf = (id: string) => options.heightFor?.(id) ?? NODE_HEIGHT;

  const { components } = computeConnectedComponents(graph);
  // Largest components first so the eye lands on the most-connected blob.
  const sorted = [...components].sort((a, b) => b.members.length - a.members.length);

  type Placed = {
    members: string[];
    layout: ComponentLayout;
    x: number;
    y: number;
  };

  const placed: Placed[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  for (const c of sorted) {
    const layout = layoutComponent(
      c.members,
      graph,
      widthOf,
      heightOf,
      options.ringSpacing,
    );
    if (cursorX > 0 && cursorX + layout.width > TARGET_ROW_WIDTH) {
      cursorX = 0;
      cursorY += rowHeight + COMPONENT_GAP_Y;
      rowHeight = 0;
    }
    placed.push({ members: c.members, layout, x: cursorX, y: cursorY });
    cursorX += layout.width + COMPONENT_GAP_X;
    if (layout.height > rowHeight) rowHeight = layout.height;
  }

  const labelByNode = new Map<string, string>();
  for (const n of graph.nodes) {
    labelByNode.set(
      n.id,
      options.displayLabelFor?.(n.id) ?? n.label ?? n.id,
    );
  }

  const nodes: Node<RadialNodeData>[] = [];
  const nodeIds = new Set<string>();
  for (const p of placed) {
    for (const id of p.members) {
      const local = p.layout.positions.get(id);
      if (!local) continue;
      nodes.push({
        id,
        type: 'pretty',
        position: { x: p.x + local.x, y: p.y + local.y },
        data: {
          label: labelByNode.get(id) ?? id,
          width: local.w,
        },
        draggable: true,
      });
      nodeIds.add(id);
    }
  }

  const edges: Edge[] = [];
  for (const e of graph.edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    edges.push({
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
    });
  }

  return { nodes, edges };
}
