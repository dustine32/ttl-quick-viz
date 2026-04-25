import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type {
  ForceGraphMethods,
  NodeObject,
  LinkObject,
} from 'react-force-graph-2d';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';
import { clearSelection, selectNode } from '@/features/ui';
import {
  applyView,
  colorForType,
  formatIri,
  selectFocusDepth,
  selectFocusNodeId,
  selectHiddenPredicates,
  selectHiddenTypes,
  selectLabelMode,
  selectRevealedNodeIds,
  selectSizeByDegree,
  UNTYPED_NODE_COLOR,
  useGraphDerivedData,
} from '@/features/view-config';
import { revealNode } from '@/features/view-config/viewConfigSlice';

type ForceNode = NodeObject & {
  id: string;
  label: string;
  color: string;
  degree: number;
};

type ForceLink = LinkObject & {
  source: string;
  target: string;
  label: string;
};

type ForceData = { nodes: ForceNode[]; links: ForceLink[] };

const DBLCLICK_MS = 300;

export function ForceCanvas() {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const hiddenPredicates = useAppSelector(selectHiddenPredicates);
  const hiddenTypes = useAppSelector(selectHiddenTypes);
  const labelMode = useAppSelector(selectLabelMode);
  const focusNodeId = useAppSelector(selectFocusNodeId);
  const focusDepth = useAppSelector(selectFocusDepth);
  const revealedNodeIds = useAppSelector(selectRevealedNodeIds);
  const sizeByDegree = useAppSelector(selectSizeByDegree);
  const fitViewNonce = useAppSelector((s) => s.ui.fitViewNonce);
  const revealNonce = useAppSelector((s) => s.ui.revealNonce);
  const relayoutNonce = useAppSelector((s) => s.ui.relayoutNonce);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);

  const { data, isLoading, error } = useGetGraphQuery(selectedGraphId, {
    skip: !selectedGraphId,
  });
  const derived = useGraphDerivedData(data);

  const filteredGraph = useMemo(() => {
    if (!data) return undefined;
    return applyView({
      graph: data,
      hiddenPredicates,
      hiddenTypes,
      nodeTypes: derived.nodeTypes,
      focusNodeId,
      focusDepth,
      revealedNodeIds,
    });
  }, [
    data,
    hiddenPredicates,
    hiddenTypes,
    derived.nodeTypes,
    focusNodeId,
    focusDepth,
    revealedNodeIds,
  ]);

  const graphData: ForceData = useMemo(() => {
    if (!filteredGraph) return { nodes: [], links: [] };
    const nodes: ForceNode[] = filteredGraph.nodes.map((n) => ({
      id: n.id,
      label: formatIri(n.id, labelMode, { label: n.label }),
      color: colorForType(derived.nodeTypes.get(n.id) ?? null),
      degree: derived.degree.get(n.id) ?? 0,
    }));
    const links: ForceLink[] = filteredGraph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      label: e.label ? formatIri(e.label, labelMode) : '',
    }));
    return { nodes, links };
  }, [filteredGraph, derived.nodeTypes, derived.degree, labelMode]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<ForceGraphMethods<ForceNode, ForceLink> | undefined>(undefined);
  const lastClickRef = useRef<{ id: string; at: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(200, rect.width), h: Math.max(200, rect.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (fitViewNonce === 0) return;
    fgRef.current?.zoomToFit(400, 60);
  }, [fitViewNonce]);

  useEffect(() => {
    if (relayoutNonce === 0) return;
    fgRef.current?.d3ReheatSimulation();
  }, [relayoutNonce]);

  useEffect(() => {
    if (revealNonce === 0 || !selectedNodeId) return;
    const node = graphData.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    const x = typeof node.x === 'number' ? node.x : 0;
    const y = typeof node.y === 'number' ? node.y : 0;
    fgRef.current?.centerAt(x, y, 400);
    fgRef.current?.zoom(4, 400);
  }, [revealNonce, selectedNodeId, graphData.nodes]);

  const baseRadius = (deg: number): number => {
    if (!sizeByDegree) return 6;
    return Math.max(4, Math.min(24, 4 + Math.sqrt(deg) * 2.5));
  };

  if (!selectedGraphId) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Select a graph to view.
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-600">
        Failed to load graph.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-white">
      <ForceGraph2D<ForceNode, ForceLink>
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="#ffffff"
        cooldownTicks={120}
        warmupTicks={40}
        d3AlphaDecay={0.025}
        d3VelocityDecay={0.35}
        linkColor={(l) => (selectedNodeId && (l.source === selectedNodeId || l.target === selectedNodeId ||
          (typeof l.source === 'object' && (l.source as ForceNode).id === selectedNodeId) ||
          (typeof l.target === 'object' && (l.target as ForceNode).id === selectedNodeId))
          ? '#60a5fa'
          : '#cbd5e1')}
        linkWidth={(l) => (selectedNodeId && (
          (typeof l.source === 'object' && (l.source as ForceNode).id === selectedNodeId) ||
          (typeof l.target === 'object' && (l.target as ForceNode).id === selectedNodeId)
        ) ? 2 : 1)}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={0.95}
        linkDirectionalArrowColor={() => '#94a3b8'}
        linkLabel={(l) => l.label}
        enableNodeDrag
        nodeLabel={(n) => n.label}
        nodeColor={(n) => n.color}
        nodeVal={(n) => baseRadius(n.degree)}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const r = baseRadius(node.degree);
          const x = node.x ?? 0;
          const y = node.y ?? 0;

          const isSelected = node.id === selectedNodeId;
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(x, y, r + 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(96, 165, 250, 0.35)';
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = node.color ?? UNTYPED_NODE_COLOR;
          ctx.fill();
          ctx.lineWidth = 1.5 / globalScale;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          if (globalScale > 1.2) {
            const fontSize = Math.max(10, 12 / globalScale);
            ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
            ctx.fillStyle = '#0f172a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const maxChars = 40;
            const text =
              node.label.length > maxChars ? `${node.label.slice(0, maxChars)}…` : node.label;
            ctx.fillText(text, x, y + r + 3);
          }
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const r = baseRadius(node.degree) + 4;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
          ctx.fill();
        }}
        onNodeClick={(node) => {
          const now = Date.now();
          const prev = lastClickRef.current;
          if (prev && prev.id === node.id && now - prev.at < DBLCLICK_MS) {
            dispatch(revealNode(node.id));
            lastClickRef.current = null;
            return;
          }
          lastClickRef.current = { id: node.id, at: now };
          dispatch(selectNode(node.id));
        }}
        onBackgroundClick={() => dispatch(clearSelection())}
      />
    </div>
  );
}
