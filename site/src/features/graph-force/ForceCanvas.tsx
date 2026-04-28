import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type {
  ForceGraphMethods,
  NodeObject,
  LinkObject,
} from 'react-force-graph-2d';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { diffStyleFor, useDiffOverlay } from '@/features/diff';
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
  selectMinDegree,
  selectRevealedNodeIds,
  selectSizeByDegree,
  selectStandaloneMode,
  UNTYPED_NODE_COLOR,
  useGraphDerivedData,
} from '@/features/view-config';
import { revealNode } from '@/features/view-config/viewConfigSlice';

type ForceNode = NodeObject & {
  id: string;
  label: string;
  color: string;
  degree: number;
  diffOpacity?: number;
  diffBorder?: string | null;
};

type ForceLink = LinkObject & {
  id: string;
  source: string;
  target: string;
  label: string;
  diffStroke?: string;
  diffOpacity?: number;
  diffWidth?: number;
  diffDashed?: boolean;
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
  const standaloneMode = useAppSelector(selectStandaloneMode);
  const minDegree = useAppSelector(selectMinDegree);
  const fitViewNonce = useAppSelector((s) => s.ui.fitViewNonce);
  const revealNonce = useAppSelector((s) => s.ui.revealNonce);
  const relayoutNonce = useAppSelector((s) => s.ui.relayoutNonce);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((s) => s.ui.selectedEdgeId);

  const { data, isLoading, error } = useGetGraphQuery(selectedGraphId, {
    skip: !selectedGraphId,
  });
  const diffOverlay = useDiffOverlay(data);
  const derived = useGraphDerivedData(data);

  const filteredGraph = useMemo(() => {
    const sourceGraph = diffOverlay.active ? diffOverlay.graph : data;
    if (!sourceGraph) return undefined;
    return applyView({
      graph: sourceGraph,
      hiddenPredicates,
      hiddenTypes,
      nodeTypes: derived.nodeTypes,
      focusNodeId,
      focusDepth,
      revealedNodeIds,
      standaloneMode,
      minDegree,
    });
  }, [
    data,
    diffOverlay,
    hiddenPredicates,
    hiddenTypes,
    derived.nodeTypes,
    focusNodeId,
    focusDepth,
    revealedNodeIds,
    standaloneMode,
    minDegree,
  ]);

  const graphData: ForceData = useMemo(() => {
    if (!filteredGraph) return { nodes: [], links: [] };
    const nodes: ForceNode[] = filteredGraph.nodes.map((n) => {
      const status = diffOverlay.active ? diffOverlay.nodeStatus(n.id) : undefined;
      const ds = status ? diffStyleFor(status) : null;
      return {
        id: n.id,
        label: formatIri(n.id, labelMode, { label: n.label }),
        color: ds ? ds.fill : colorForType(derived.nodeTypes.get(n.id) ?? null),
        degree: derived.degree.get(n.id) ?? 0,
        diffOpacity: ds ? ds.opacity : 1,
        diffBorder: ds && status !== 'unchanged' ? ds.stroke : null,
      };
    });
    const links: ForceLink[] = filteredGraph.edges.map((e) => {
      const status = diffOverlay.active ? diffOverlay.edgeStatus(e.id) : undefined;
      const ds = status ? diffStyleFor(status) : null;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label ? formatIri(e.label, labelMode) : '',
        diffStroke: ds ? ds.stroke : undefined,
        diffOpacity: ds ? ds.opacity : 1,
        diffWidth: ds && status !== 'unchanged' ? 2.6 : undefined,
        diffDashed: ds?.dashed ?? false,
      };
    });
    return { nodes, links };
  }, [filteredGraph, derived.nodeTypes, derived.degree, labelMode, diffOverlay]);

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

  const lastRevealNonce = useRef(0);
  useEffect(() => {
    if (revealNonce === lastRevealNonce.current) return;
    lastRevealNonce.current = revealNonce;
    if (revealNonce === 0) return;
    const xy = (n: ForceNode) => ({
      x: typeof n.x === 'number' ? n.x : 0,
      y: typeof n.y === 'number' ? n.y : 0,
    });
    if (selectedNodeId) {
      const node = graphData.nodes.find((n) => n.id === selectedNodeId);
      if (!node) return;
      const p = xy(node);
      fgRef.current?.centerAt(p.x, p.y, 400);
      fgRef.current?.zoom(4, 400);
    } else if (selectedEdgeId && filteredGraph) {
      const edge = filteredGraph.edges.find((e) => e.id === selectedEdgeId);
      if (!edge) return;
      const s = graphData.nodes.find((n) => n.id === edge.source);
      const t = graphData.nodes.find((n) => n.id === edge.target);
      if (!s || !t) return;
      const sp = xy(s);
      const tp = xy(t);
      fgRef.current?.centerAt((sp.x + tp.x) / 2, (sp.y + tp.y) / 2, 400);
      fgRef.current?.zoom(4, 400);
    }
  }, [revealNonce, selectedNodeId, selectedEdgeId, graphData.nodes, filteredGraph]);

  const baseRadius = (deg: number): number => {
    if (!sizeByDegree) return 6;
    return Math.max(4, Math.min(24, 4 + Math.sqrt(deg) * 2.5));
  };

  // Particles are pretty but eat CPU on big graphs; gate by edge count.
  const particleCount = graphData.links.length < 800 ? 2 : 0;
  const linkCurvature = graphData.links.length < 1500 ? 0.12 : 0;

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

  const isLinkedToSelected = (l: ForceLink): boolean => {
    if (!selectedNodeId) return false;
    const sId = typeof l.source === 'object' ? (l.source as ForceNode).id : (l.source as string);
    const tId = typeof l.target === 'object' ? (l.target as ForceNode).id : (l.target as string);
    return sId === selectedNodeId || tId === selectedNodeId;
  };

  return (
    <div ref={containerRef} className="relative h-full w-full bg-[#0F172A]">
      <ForceGraph2D<ForceNode, ForceLink>
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="#0F172A"
        cooldownTicks={140}
        warmupTicks={60}
        d3AlphaDecay={0.022}
        d3VelocityDecay={0.32}
        linkColor={(l) => {
          if (l.diffStroke) {
            // Mix stroke color with opacity (force-graph doesn't accept rgba via opacity prop on links).
            const op = l.diffOpacity ?? 1;
            return op < 1 ? `${l.diffStroke}${Math.round(op * 255).toString(16).padStart(2, '0')}` : l.diffStroke;
          }
          return isLinkedToSelected(l) ? 'rgba(96, 165, 250, 0.95)' : 'rgba(148, 163, 184, 0.45)';
        }}
        linkWidth={(l) => l.diffWidth ?? (isLinkedToSelected(l) ? 2.2 : 1.2)}
        linkLineDash={(l) => (l.diffDashed ? [6, 4] : null)}
        linkCurvature={linkCurvature}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={0.95}
        linkDirectionalArrowColor={(l) => (isLinkedToSelected(l) ? '#93C5FD' : '#94A3B8')}
        linkDirectionalParticles={(l) => (isLinkedToSelected(l) ? 4 : particleCount)}
        linkDirectionalParticleWidth={(l) => (isLinkedToSelected(l) ? 2.6 : 1.6)}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={(l) => (isLinkedToSelected(l) ? '#BFDBFE' : '#94A3B8')}
        linkLabel={(l) => l.label}
        enableNodeDrag
        nodeLabel={(n) => n.label}
        nodeColor={(n) => n.color}
        nodeVal={(n) => baseRadius(n.degree)}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const r = baseRadius(node.degree);
          const x = node.x ?? 0;
          const y = node.y ?? 0;
          const fill = node.color ?? UNTYPED_NODE_COLOR;

          const isSelected = node.id === selectedNodeId;
          ctx.save();
          if (typeof node.diffOpacity === 'number') {
            ctx.globalAlpha = node.diffOpacity;
          }
          // Outer glow — soft halo for everything, brighter when selected.
          const glowR = r + (isSelected ? 9 : 5);
          const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, glowR);
          glow.addColorStop(0, isSelected ? 'rgba(147, 197, 253, 0.55)' : 'rgba(148, 163, 184, 0.18)');
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.beginPath();
          ctx.arc(x, y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          // Body — radial gradient for a slight 3D feel.
          const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
          body.addColorStop(0, '#FFFFFF');
          body.addColorStop(0.25, fill);
          body.addColorStop(1, fill);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = body;
          ctx.fill();
          ctx.lineWidth = node.diffBorder ? 2.4 / globalScale : 1.2 / globalScale;
          ctx.strokeStyle = node.diffBorder ?? (isSelected ? '#BFDBFE' : 'rgba(15, 23, 42, 0.7)');
          ctx.stroke();

          if (globalScale > 1.2) {
            const fontSize = Math.max(10, 12 / globalScale);
            ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const maxChars = 40;
            const text =
              node.label.length > maxChars ? `${node.label.slice(0, maxChars)}…` : node.label;
            // Halo for legibility on dark bg.
            ctx.lineWidth = 3 / globalScale;
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.strokeText(text, x, y + r + 3);
            ctx.fillStyle = '#E2E8F0';
            ctx.fillText(text, x, y + r + 3);
          }
          ctx.restore();
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
