import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type {
  ForceGraphMethods,
  NodeObject,
  LinkObject,
} from 'react-force-graph-3d';
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
  useGraphDerivedData,
} from '@/features/view-config';
import { revealNode } from '@/features/view-config/viewConfigSlice';

type ForceNode = NodeObject & {
  id: string;
  label: string;
  color: string;
  degree: number;
  diffOpacity?: number;
};

type ForceLink = LinkObject & {
  id: string;
  source: string;
  target: string;
  label: string;
  diffStroke?: string;
  diffOpacity?: number;
  diffWidth?: number;
};

const DBLCLICK_MS = 300;

export function ForceCanvas3D() {
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

  const graphData = useMemo(() => {
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
        diffWidth: ds && status !== 'unchanged' ? 2.4 : undefined,
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
    fgRef.current?.zoomToFit(600, 80);
  }, [fitViewNonce]);

  useEffect(() => {
    if (relayoutNonce === 0) return;
    fgRef.current?.d3ReheatSimulation();
  }, [relayoutNonce]);

  const lastRevealNonce = useRef(0);
  useEffect(() => {
    if (revealNonce === lastRevealNonce.current) return;
    lastRevealNonce.current = revealNonce;
    if (revealNonce === 0 || !fgRef.current) return;
    const xyz = (n: ForceNode) => ({
      x: typeof n.x === 'number' ? n.x : 0,
      y: typeof n.y === 'number' ? n.y : 0,
      z: typeof n.z === 'number' ? n.z : 0,
    });
    let lookAt: { x: number; y: number; z: number } | null = null;
    if (selectedNodeId) {
      const node = graphData.nodes.find((n) => n.id === selectedNodeId);
      if (node) lookAt = xyz(node);
    } else if (selectedEdgeId && filteredGraph) {
      const edge = filteredGraph.edges.find((e) => e.id === selectedEdgeId);
      if (edge) {
        const s = graphData.nodes.find((n) => n.id === edge.source);
        const t = graphData.nodes.find((n) => n.id === edge.target);
        if (s && t) {
          const sp = xyz(s);
          const tp = xyz(t);
          lookAt = {
            x: (sp.x + tp.x) / 2,
            y: (sp.y + tp.y) / 2,
            z: (sp.z + tp.z) / 2,
          };
        }
      }
    }
    if (!lookAt) return;
    const distance = 120;
    const dist = Math.hypot(lookAt.x, lookAt.y, lookAt.z) || 1;
    fgRef.current.cameraPosition(
      {
        x: lookAt.x * (1 + distance / dist),
        y: lookAt.y * (1 + distance / dist),
        z: lookAt.z * (1 + distance / dist),
      },
      lookAt,
      800,
    );
  }, [revealNonce, selectedNodeId, selectedEdgeId, graphData.nodes, filteredGraph]);

  const nodeSize = (deg: number): number => {
    if (!sizeByDegree) return 6;
    return Math.max(4, Math.min(24, 4 + Math.sqrt(deg) * 2.5));
  };

  const isLinkedToSelected = (l: ForceLink): boolean => {
    if (!selectedNodeId) return false;
    const sId = typeof l.source === 'object' ? (l.source as ForceNode).id : (l.source as string);
    const tId = typeof l.target === 'object' ? (l.target as ForceNode).id : (l.target as string);
    return sId === selectedNodeId || tId === selectedNodeId;
  };

  // Particles cost CPU per-frame; gate by edge count so big graphs stay smooth.
  const particleCount = graphData.links.length < 800 ? 2 : 0;

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
    <div ref={containerRef} className="relative h-full w-full bg-slate-900">
      <ForceGraph3D<ForceNode, ForceLink>
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="#0F172A"
        nodeColor={(n) => (n.id === selectedNodeId ? '#BFDBFE' : n.color)}
        nodeVal={(n) => nodeSize(n.degree)}
        nodeOpacity={diffOverlay.active ? 1 : 0.92}
        nodeVisibility={(n) => !diffOverlay.active || (n.diffOpacity ?? 1) > 0.5}
        nodeResolution={16}
        nodeLabel={(n) => n.label}
        linkColor={(l) => l.diffStroke ?? (isLinkedToSelected(l) ? '#93C5FD' : 'rgba(148, 163, 184, 0.55)')}
        linkOpacity={diffOverlay.active ? 0.9 : 0.75}
        linkVisibility={(l) => !diffOverlay.active || (l.diffOpacity ?? 1) > 0.5}
        linkWidth={(l) => l.diffWidth ?? (isLinkedToSelected(l) ? 1.4 : 0.6)}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={0.95}
        linkDirectionalArrowColor={(l) => (isLinkedToSelected(l) ? '#BFDBFE' : '#94A3B8')}
        linkDirectionalParticles={(l) => (isLinkedToSelected(l) ? 4 : particleCount)}
        linkDirectionalParticleWidth={(l) => (isLinkedToSelected(l) ? 2.4 : 1.4)}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={(l) => (isLinkedToSelected(l) ? '#BFDBFE' : '#94A3B8')}
        linkLabel={(l) => l.label}
        enableNodeDrag
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
