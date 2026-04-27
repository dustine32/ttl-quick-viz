import dagre from 'dagre';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Graph } from '@/features/graph/types';
import { estimateNodeWidth, NODE_HEIGHT } from '@/features/graph/services/elkOptions';

export const GROUP_HEADER_H = 36;
export const GROUP_PADDING_X = 24;
export const GROUP_PADDING_Y = 20;
export const GROUP_GAP_X = 32;
export const GROUP_GAP_Y = 32;
export const SUBGROUP_HEADER_H = 24;
export const SUBGROUP_PADDING_X = 16;
export const SUBGROUP_PADDING_Y = 14;
export const SUBGROUP_GAP_X = 20;
export const SUBGROUP_GAP_Y = 20;
export const TARGET_ROW_WIDTH = 1800;
export const SUBGROUP_TARGET_ROW_WIDTH = 720;
export const OTHER_LANE_KEY = '__other__';

const EDGE_COLOR = '#94A3B8';

export type Group = {
  key: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  count: number;
  isOther: boolean;
  level: 0 | 1;
  parentKey?: string;
};

export type SwimlaneNodeData = {
  label: string;
  color?: string;
  width?: number;
  subtitle?: string | null;
};

export type SwimlaneLayoutResult = {
  nodes: Node<SwimlaneNodeData>[];
  edges: Edge[];
  /** Both top-level (level=0) and sub-groups (level=1) returned in one list. */
  groups: Group[];
};

export type SwimlaneLayoutOptions = {
  groupBy: (nodeId: string) => string | null | undefined;
  /** Optional second-level grouping inside each top-level group. */
  subGroupBy?: (nodeId: string) => string | null | undefined;
  labelFor?: (key: string) => string;
  subLabelFor?: (key: string) => string;
  colorFor?: (nodeId: string) => string | undefined;
  subtitleFor?: (nodeId: string) => string | null | undefined;
  displayLabelFor?: (nodeId: string) => string;
  maxLanes?: number;
  laneOrder?: string[];
  /** Drop the catch-all "Other" group entirely (its nodes won't appear). */
  hideOther?: boolean;
  /** Approximate canvas width to wrap top-level groups into rows. */
  targetRowWidth?: number;
};

type LocalLayout = {
  positions: Map<string, { x: number; y: number; w: number; h: number }>;
  width: number;
  height: number;
};

function layoutBucket(
  ids: string[],
  graph: Graph,
  labelByNode: Map<string, string>,
): LocalLayout {
  const nodeSet = new Set(ids);
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: 24,
    edgesep: 12,
    ranksep: 64,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) {
    const w = estimateNodeWidth(labelByNode.get(id) ?? id);
    g.setNode(id, { width: w, height: NODE_HEIGHT });
  }
  for (const e of graph.edges) {
    if (nodeSet.has(e.source) && nodeSet.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }
  dagre.layout(g);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const id of ids) {
    const n = g.node(id);
    if (!n) continue;
    const x = n.x - n.width / 2;
    const y = n.y - n.height / 2;
    positions.set(id, { x, y, w: n.width, h: n.height });
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + n.width > maxX) maxX = x + n.width;
    if (y + n.height > maxY) maxY = y + n.height;
  }
  if (Number.isFinite(minX) && Number.isFinite(minY)) {
    for (const [id, p] of positions) {
      positions.set(id, { x: p.x - minX, y: p.y - minY, w: p.w, h: p.h });
    }
  } else {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  return {
    positions,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function bucketBy(
  ids: string[],
  groupFn: (id: string) => string | null | undefined,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const id of ids) {
    const raw = groupFn(id);
    const key = raw == null || raw === '' ? OTHER_LANE_KEY : raw;
    const list = out.get(key);
    if (list) list.push(id);
    else out.set(key, [id]);
  }
  return out;
}

function applyOrdering(
  entries: [string, string[]][],
  laneOrder?: string[],
): [string, string[]][] {
  const orderIndex = new Map<string, number>();
  if (laneOrder) laneOrder.forEach((k, i) => orderIndex.set(k, i));
  return [...entries].sort(([a, aIds], [b, bIds]) => {
    if (a === OTHER_LANE_KEY) return 1;
    if (b === OTHER_LANE_KEY) return -1;
    const ia = orderIndex.has(a) ? (orderIndex.get(a) as number) : Infinity;
    const ib = orderIndex.has(b) ? (orderIndex.get(b) as number) : Infinity;
    if (ia !== ib) return ia - ib;
    if (aIds.length !== bIds.length) return bIds.length - aIds.length;
    return a.localeCompare(b);
  });
}

export function computeSwimlaneLayout(
  graph: Graph,
  opts: SwimlaneLayoutOptions,
): SwimlaneLayoutResult {
  const {
    groupBy,
    subGroupBy,
    labelFor,
    subLabelFor,
    colorFor,
    subtitleFor,
    displayLabelFor,
    maxLanes = 8,
    laneOrder,
    hideOther = false,
    targetRowWidth = TARGET_ROW_WIDTH,
  } = opts;

  if (graph.nodes.length === 0) {
    return { nodes: [], edges: [], groups: [] };
  }

  // 1. Top-level bucketing.
  const topBuckets = bucketBy(graph.nodes.map((n) => n.id), groupBy);

  // 2. Cap top-level group count; merge overflow into Other.
  let entries = [...topBuckets.entries()];
  if (entries.length > maxLanes) {
    const others = entries.filter((e) => e[0] === OTHER_LANE_KEY);
    const named = entries.filter((e) => e[0] !== OTHER_LANE_KEY);
    named.sort((a, b) => b[1].length - a[1].length);
    const kept = named.slice(0, maxLanes - 1);
    const dropped = named.slice(maxLanes - 1);
    const otherIds = [
      ...others.flatMap((e) => e[1]),
      ...dropped.flatMap((e) => e[1]),
    ];
    entries = otherIds.length ? [...kept, [OTHER_LANE_KEY, otherIds]] : kept;
  }

  // 3. Hide Other if requested.
  if (hideOther) {
    entries = entries.filter(([k]) => k !== OTHER_LANE_KEY);
  }

  // 4. Order top-level groups.
  entries = applyOrdering(entries, laneOrder);

  // 5. Display labels.
  const labelByNode = new Map<string, string>();
  const colorByNode = new Map<string, string | undefined>();
  const subtitleByNode = new Map<string, string | null | undefined>();
  for (const n of graph.nodes) {
    const display = displayLabelFor ? displayLabelFor(n.id) : n.label ?? n.id;
    labelByNode.set(n.id, display);
    colorByNode.set(n.id, colorFor?.(n.id));
    subtitleByNode.set(n.id, subtitleFor?.(n.id));
  }

  // 6. Per-top-group layout. With subGroupBy, run dagre per sub-bucket and
  //    tile sub-buckets within the top group's interior.
  type SubBucketLayout = {
    key: string;
    label: string;
    ids: string[];
    layout: LocalLayout;
    boxWidth: number;
    boxHeight: number;
    offsetX: number;
    offsetY: number;
    isOther: boolean;
  };
  type TopBucketLayout = {
    key: string;
    label: string;
    ids: string[];
    isOther: boolean;
    /** When subGroupBy is set, each sub-bucket has its own dagre layout. */
    subs: SubBucketLayout[] | null;
    /** Single layout used when subGroupBy is null. */
    flat: LocalLayout | null;
    interiorWidth: number;
    interiorHeight: number;
  };

  const topLayouts: TopBucketLayout[] = entries.map(([key, ids]) => {
    const isOther = key === OTHER_LANE_KEY;
    const label = isOther ? 'Other' : labelFor?.(key) ?? key;
    if (!subGroupBy) {
      const flat = layoutBucket(ids, graph, labelByNode);
      return {
        key,
        label,
        ids,
        isOther,
        subs: null,
        flat,
        interiorWidth: flat.width,
        interiorHeight: flat.height,
      };
    }
    const subBuckets = bucketBy(ids, subGroupBy);
    const subEntries = applyOrdering([...subBuckets.entries()]);
    const subs: SubBucketLayout[] = subEntries.map(([sKey, sIds]) => {
      const layout = layoutBucket(sIds, graph, labelByNode);
      const boxWidth = layout.width + SUBGROUP_PADDING_X * 2;
      const boxHeight = layout.height + SUBGROUP_HEADER_H + SUBGROUP_PADDING_Y * 2;
      const sIsOther = sKey === OTHER_LANE_KEY;
      return {
        key: sKey,
        label: sIsOther ? 'Other' : subLabelFor?.(sKey) ?? sKey,
        ids: sIds,
        layout,
        boxWidth,
        boxHeight,
        offsetX: 0,
        offsetY: 0,
        isOther: sIsOther,
      };
    });
    // Tile sub-buckets in rows.
    let cx = 0;
    let cy = 0;
    let rowH = 0;
    for (const s of subs) {
      if (cx > 0 && cx + s.boxWidth > SUBGROUP_TARGET_ROW_WIDTH) {
        cx = 0;
        cy += rowH + SUBGROUP_GAP_Y;
        rowH = 0;
      }
      s.offsetX = cx;
      s.offsetY = cy;
      cx += s.boxWidth + SUBGROUP_GAP_X;
      if (s.boxHeight > rowH) rowH = s.boxHeight;
    }
    const interiorWidth = subs.reduce((m, s) => Math.max(m, s.offsetX + s.boxWidth), 0);
    const interiorHeight = subs.reduce(
      (m, s) => Math.max(m, s.offsetY + s.boxHeight),
      0,
    );
    return {
      key,
      label,
      ids,
      isOther,
      subs,
      flat: null,
      interiorWidth,
      interiorHeight,
    };
  });

  // 7. Pack top-level groups into rows.
  type Placed = TopBucketLayout & {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  const placed: Placed[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  for (const t of topLayouts) {
    const width = t.interiorWidth + GROUP_PADDING_X * 2;
    const height = GROUP_HEADER_H + t.interiorHeight + GROUP_PADDING_Y * 2;
    if (cursorX > 0 && cursorX + width > targetRowWidth) {
      cursorX = 0;
      cursorY += rowHeight + GROUP_GAP_Y;
      rowHeight = 0;
    }
    placed.push({ ...t, x: cursorX, y: cursorY, width, height });
    cursorX += width + GROUP_GAP_X;
    if (height > rowHeight) rowHeight = height;
  }

  // 8. Emit groups (level 0 + level 1) and node positions.
  const groups: Group[] = [];
  const nodes: Node<SwimlaneNodeData>[] = [];

  for (const t of placed) {
    groups.push({
      key: t.key,
      label: t.label,
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      count: t.ids.length,
      isOther: t.isOther,
      level: 0,
    });

    if (t.subs) {
      const innerOriginX = t.x + GROUP_PADDING_X;
      const innerOriginY = t.y + GROUP_HEADER_H + GROUP_PADDING_Y;
      for (const s of t.subs) {
        const subX = innerOriginX + s.offsetX;
        const subY = innerOriginY + s.offsetY;
        groups.push({
          key: `${t.key}::${s.key}`,
          label: s.label,
          x: subX,
          y: subY,
          width: s.boxWidth,
          height: s.boxHeight,
          count: s.ids.length,
          isOther: s.isOther,
          level: 1,
          parentKey: t.key,
        });
        const nodeBaseX = subX + SUBGROUP_PADDING_X;
        const nodeBaseY = subY + SUBGROUP_HEADER_H + SUBGROUP_PADDING_Y;
        for (const id of s.ids) {
          const p = s.layout.positions.get(id);
          if (!p) continue;
          nodes.push({
            id,
            type: 'pretty',
            position: { x: nodeBaseX + p.x, y: nodeBaseY + p.y },
            data: {
              label: labelByNode.get(id) ?? id,
              color: colorByNode.get(id),
              width: p.w,
              subtitle: subtitleByNode.get(id) ?? null,
            },
            draggable: true,
          });
        }
      }
    } else if (t.flat) {
      const nodeBaseX = t.x + GROUP_PADDING_X;
      const nodeBaseY = t.y + GROUP_HEADER_H + GROUP_PADDING_Y;
      for (const id of t.ids) {
        const p = t.flat.positions.get(id);
        if (!p) continue;
        nodes.push({
          id,
          type: 'pretty',
          position: { x: nodeBaseX + p.x, y: nodeBaseY + p.y },
          data: {
            label: labelByNode.get(id) ?? id,
            color: colorByNode.get(id),
            width: p.w,
            subtitle: subtitleByNode.get(id) ?? null,
          },
          draggable: true,
        });
      }
    }
  }

  // 9. Edges with consistent styling.
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = [];
  for (const e of graph.edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: 'default',
      style: { stroke: EDGE_COLOR, strokeWidth: 1.6, strokeOpacity: 0.85 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: EDGE_COLOR,
        width: 18,
        height: 18,
      },
    });
  }

  return { nodes, edges, groups };
}
