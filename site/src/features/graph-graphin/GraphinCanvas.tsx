import { useEffect, useMemo, useRef } from 'react';
import { Graphin } from '@antv/graphin';
import type { Graph as G6Graph, GraphOptions } from '@antv/g6';
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
  selectMinDegree,
  selectRevealedNodeIds,
  selectSizeByDegree,
  selectStandaloneMode,
  useGraphDerivedData,
} from '@/features/view-config';
import { revealNode } from '@/features/view-config/viewConfigSlice';

const DBLCLICK_MS = 300;

export function GraphinCanvas() {
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
  const relayoutNonce = useAppSelector((s) => s.ui.relayoutNonce);
  const revealNonce = useAppSelector((s) => s.ui.revealNonce);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((s) => s.ui.selectedEdgeId);

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
      standaloneMode,
      minDegree,
    });
  }, [
    data,
    hiddenPredicates,
    hiddenTypes,
    derived.nodeTypes,
    focusNodeId,
    focusDepth,
    revealedNodeIds,
    standaloneMode,
    minDegree,
  ]);

  const options = useMemo<GraphOptions | undefined>(() => {
    if (!filteredGraph) return undefined;
    const nodes = filteredGraph.nodes.map((n) => {
      const deg = derived.degree.get(n.id) ?? 0;
      const size = sizeByDegree ? Math.max(16, Math.min(60, 16 + Math.sqrt(deg) * 6)) : 24;
      return {
        id: n.id,
        data: {
          label: formatIri(n.id, labelMode, { label: n.label }),
          color: colorForType(derived.nodeTypes.get(n.id) ?? null),
          size,
        },
      };
    });
    const edges = filteredGraph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: { label: e.label ? formatIri(e.label, labelMode) : '' },
    }));
    return {
      data: { nodes, edges },
      autoFit: 'view',
      animation: false,
      padding: 40,
      node: {
        style: {
          fill: (d: { data?: { color?: string } }) => d.data?.color ?? '#94a3b8',
          stroke: '#ffffff',
          lineWidth: 2,
          size: (d: { data?: { size?: number } }) => d.data?.size ?? 24,
          labelText: (d: { data?: { label?: string } }) => d.data?.label ?? '',
          labelFill: '#0f172a',
          labelFontSize: 11,
          labelPlacement: 'bottom',
          labelOffsetY: 4,
          labelBackground: true,
          labelBackgroundFill: '#ffffff',
          labelBackgroundOpacity: 0.85,
          labelBackgroundRadius: 4,
          labelPadding: [2, 4],
        },
        state: {
          selected: {
            stroke: '#60a5fa',
            lineWidth: 3,
            halo: true,
            haloStroke: '#60a5fa',
            haloStrokeOpacity: 0.3,
          },
        },
      },
      edge: {
        style: {
          stroke: '#cbd5e1',
          lineWidth: 1.5,
          endArrow: true,
          endArrowSize: 6,
          labelText: (d: { data?: { label?: string } }) => d.data?.label ?? '',
          labelFill: '#64748b',
          labelFontSize: 9,
          labelBackground: true,
          labelBackgroundFill: '#ffffff',
          labelBackgroundOpacity: 0.8,
          labelBackgroundRadius: 4,
          labelPadding: [1, 3],
        },
      },
      layout: {
        type: 'd3-force',
        link: { distance: 140 },
        manyBody: { strength: -420 },
        center: { strength: 0.1 },
        preventOverlap: true,
        nodeSize: 40,
      },
      behaviors: [
        'drag-canvas',
        'zoom-canvas',
        'drag-element',
        { type: 'click-select', multiple: false },
      ],
    } as unknown as GraphOptions;
  }, [filteredGraph, derived.nodeTypes, derived.degree, labelMode, sizeByDegree]);

  const graphRef = useRef<G6Graph | null>(null);
  const lastClickRef = useRef<{ id: string; at: number } | null>(null);

  // Run an imperative call on the live graph, no-op if destroyed or unmounted.
  // G6 throws synchronously on destroyed instances; the catch silences async
  // layout/draw races on instances Graphin tore down underneath us.
  const safeCall = (fn: (g: G6Graph) => void) => {
    const g = graphRef.current;
    if (!g || g.destroyed) return;
    try {
      fn(g);
    } catch {
      /* graph was destroyed mid-operation — ignore */
    }
  };

  useEffect(() => {
    if (fitViewNonce === 0) return;
    safeCall((g) => g.fitView());
  }, [fitViewNonce]);

  useEffect(() => {
    if (relayoutNonce === 0) return;
    safeCall((g) => {
      const p = g.layout();
      if (p && typeof (p as Promise<unknown>).catch === 'function') {
        (p as Promise<unknown>).catch(() => { /* destroyed mid-layout */ });
      }
    });
  }, [relayoutNonce]);

  const lastRevealNonce = useRef(0);
  useEffect(() => {
    if (revealNonce === lastRevealNonce.current) return;
    lastRevealNonce.current = revealNonce;
    if (revealNonce === 0) return;
    const targetId = selectedNodeId ?? selectedEdgeId;
    if (!targetId) return;
    safeCall((g) => g.focusElement(targetId));
  }, [revealNonce, selectedNodeId, selectedEdgeId]);

  const onReady = (g: G6Graph) => {
    graphRef.current = g;
    g.on('node:click', ((ev: unknown) => {
      const id = (ev as { target?: { id?: string } })?.target?.id;
      if (!id) return;
      const now = Date.now();
      const prev = lastClickRef.current;
      if (prev && prev.id === id && now - prev.at < DBLCLICK_MS) {
        dispatch(revealNode(id));
        lastClickRef.current = null;
        return;
      }
      lastClickRef.current = { id, at: now };
      dispatch(selectNode(id));
    }) as never);
    g.on('canvas:click', () => dispatch(clearSelection()));
  };

  const onDestroy = () => {
    graphRef.current = null;
    lastClickRef.current = null;
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
  if (!options) {
    return <div className="h-full w-full bg-white" />;
  }

  return (
    <Graphin
      // Force a clean remount when the underlying graph changes — prevents
      // the "draw of undefined" race where the previous instance's pending
      // layout/render promises run after Graphin swapped its options.
      key={selectedGraphId ?? 'none'}
      style={{ height: '100%', width: '100%', background: '#ffffff' }}
      options={options}
      onReady={onReady}
      onDestroy={onDestroy}
    />
  );
}
