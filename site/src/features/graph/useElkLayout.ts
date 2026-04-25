import { useEffect, useRef, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Graph } from '@/features/graph/types';
import {
  getElkOptions,
  MIN_NODE_WIDTH,
  NODE_HEIGHT,
} from '@/features/graph/elkOptions';

type LayoutStatus = 'idle' | 'laying-out' | 'ready' | 'error';

type GraphNodeData = { label: string; color?: string; width?: number };

export type UseElkLayoutResult = {
  status: LayoutStatus;
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
  error?: Error;
};

type Side = 'top' | 'right' | 'bottom' | 'left';

type Rect = { x: number; y: number; w: number; h: number };

const elk = new ELK();

const EDGE_COLOR = '#64748b';

function pickSides(s: Rect, t: Rect): { sourceSide: Side; targetSide: Side } {
  const sCx = s.x + s.w / 2;
  const sCy = s.y + s.h / 2;
  const tCx = t.x + t.w / 2;
  const tCy = t.y + t.h / 2;
  const dx = tCx - sCx;
  const dy = tCy - sCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left',  targetSide: 'right' };
  }
  return dy >= 0
    ? { sourceSide: 'bottom', targetSide: 'top' }
    : { sourceSide: 'top',    targetSide: 'bottom' };
}

function buildEdge(
  e: { id: string; source: string; target: string; label?: string },
  sourceHandle: string,
  targetHandle: string,
): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle,
    targetHandle,
    type: 'smoothstep',
    label: e.label,
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9, stroke: '#e2e8f0' },
    labelStyle: { fontSize: 11, fill: '#475569', fontWeight: 500 },
    style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: EDGE_COLOR,
      width: 16,
      height: 16,
    },
  };
}

export function useElkLayout(
  graph: Graph | undefined,
  algo: string = 'layered',
  nonce: number = 0,
  widthFor?: (nodeId: string) => number,
): UseElkLayoutResult {
  const [result, setResult] = useState<UseElkLayoutResult>({
    status: 'idle',
    nodes: [],
    edges: [],
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!graph) {
      setResult({ status: 'idle', nodes: [], edges: [] });
      return;
    }

    let cancelled = false;
    const myRequest = ++requestIdRef.current;
    setResult((prev) => ({ ...prev, status: 'laying-out' }));

    const widthOf = (id: string): number => widthFor?.(id) ?? MIN_NODE_WIDTH;

    const elkInput = {
      id: 'root',
      layoutOptions: getElkOptions(algo),
      children: graph.nodes.map((n) => ({
        id: n.id,
        width: widthOf(n.id),
        height: NODE_HEIGHT,
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };

    elk
      .layout(elkInput)
      .then((layouted) => {
        if (cancelled || myRequest !== requestIdRef.current) return;

        const positionedNodes: Node<GraphNodeData>[] = (layouted.children ?? []).map((c) => {
          const original = graph.nodes.find((n) => n.id === c.id);
          return {
            id: c.id,
            type: 'pretty',
            position: { x: c.x ?? 0, y: c.y ?? 0 },
            data: {
              label: original?.label ?? c.id,
              width: c.width ?? widthOf(c.id),
            },
          };
        });

        const rects = new Map<string, Rect>();
        (layouted.children ?? []).forEach((c) => {
          rects.set(c.id, {
            x: c.x ?? 0,
            y: c.y ?? 0,
            w: c.width ?? widthOf(c.id),
            h: c.height ?? NODE_HEIGHT,
          });
        });

        const handleCounters = new Map<string, number>();
        const pickHandle = (nodeId: string, side: Side, role: 's' | 't'): string => {
          const key = `${nodeId}|${side}|${role}`;
          const n = handleCounters.get(key) ?? 0;
          handleCounters.set(key, n + 1);
          return `${role}-${side}-${n % 3}`;
        };

        const positionedEdges: Edge[] = graph.edges.map((e) => {
          const s = rects.get(e.source);
          const t = rects.get(e.target);
          if (!s || !t) {
            return buildEdge(e, 's-right-1', 't-left-1');
          }
          const { sourceSide, targetSide } = pickSides(s, t);
          return buildEdge(
            e,
            pickHandle(e.source, sourceSide, 's'),
            pickHandle(e.target, targetSide, 't'),
          );
        });

        setResult({
          status: 'ready',
          nodes: positionedNodes,
          edges: positionedEdges,
        });
      })
      .catch((err: unknown) => {
        if (cancelled || myRequest !== requestIdRef.current) return;
        const fallbackNodes: Node<GraphNodeData>[] = graph.nodes.map((n) => ({
          id: n.id,
          type: 'pretty',
          position: { x: 0, y: 0 },
          data: { label: n.label ?? n.id },
        }));
        const fallbackEdges: Edge[] = graph.edges.map((e) =>
          buildEdge(e, 's-right-1', 't-left-1'),
        );
        setResult({
          status: 'error',
          nodes: fallbackNodes,
          edges: fallbackEdges,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => { cancelled = true; };
  }, [graph, algo, nonce]);

  return result;
}
