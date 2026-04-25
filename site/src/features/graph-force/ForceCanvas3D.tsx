import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type {
  ForceGraphMethods,
  NodeObject,
  LinkObject,
} from 'react-force-graph-3d';
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

  const graphData = useMemo(() => {
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
    fgRef.current?.zoomToFit(600, 80);
  }, [fitViewNonce]);

  useEffect(() => {
    if (relayoutNonce === 0) return;
    fgRef.current?.d3ReheatSimulation();
  }, [relayoutNonce]);

  useEffect(() => {
    if (revealNonce === 0 || !selectedNodeId) return;
    const node = graphData.nodes.find((n) => n.id === selectedNodeId);
    if (!node || !fgRef.current) return;
    const distance = 120;
    const x = typeof node.x === 'number' ? node.x : 0;
    const y = typeof node.y === 'number' ? node.y : 0;
    const z = typeof node.z === 'number' ? node.z : 0;
    const dist = Math.hypot(x, y, z) || 1;
    fgRef.current.cameraPosition(
      { x: x * (1 + distance / dist), y: y * (1 + distance / dist), z: z * (1 + distance / dist) },
      { x, y, z },
      800,
    );
  }, [revealNonce, selectedNodeId, graphData.nodes]);

  const nodeSize = (deg: number): number => {
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
    <div ref={containerRef} className="relative h-full w-full bg-slate-900">
      <ForceGraph3D<ForceNode, ForceLink>
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="#0f172a"
        nodeColor={(n) => n.color}
        nodeVal={(n) => nodeSize(n.degree)}
        nodeLabel={(n) => n.label}
        linkColor={() => 'rgba(148, 163, 184, 0.4)'}
        linkOpacity={0.6}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={0.95}
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
