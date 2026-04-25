import { useEffect, useMemo } from 'react';
import Graph from 'graphology';
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
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

const DBLCLICK_MS = 300;

function SigmaLoader() {
  const dispatch = useAppDispatch();
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();

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
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);

  const { data } = useGetGraphQuery(selectedGraphId, { skip: !selectedGraphId });
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

  useEffect(() => {
    if (!filteredGraph) {
      loadGraph(new Graph());
      return;
    }
    const g = new Graph({ multi: true, type: 'directed' });
    const N = filteredGraph.nodes.length;
    const cx = 0;
    const cy = 0;
    const R = Math.max(200, Math.sqrt(N) * 40);
    filteredGraph.nodes.forEach((n, i) => {
      const angle = (i / Math.max(1, N)) * Math.PI * 2;
      const deg = derived.degree.get(n.id) ?? 0;
      const size = sizeByDegree ? Math.max(4, Math.min(22, 4 + Math.sqrt(deg) * 2.2)) : 8;
      g.addNode(n.id, {
        x: cx + Math.cos(angle) * R,
        y: cy + Math.sin(angle) * R,
        size,
        label: formatIri(n.id, labelMode, { label: n.label }),
        color: colorForType(derived.nodeTypes.get(n.id) ?? null),
      });
    });
    filteredGraph.edges.forEach((e) => {
      if (!g.hasNode(e.source) || !g.hasNode(e.target)) return;
      g.addEdgeWithKey(e.id, e.source, e.target, {
        label: e.label ? formatIri(e.label, labelMode) : '',
        color: '#cbd5e1',
        size: 1,
        type: 'arrow',
      });
    });
    loadGraph(g);
  }, [filteredGraph, derived.nodeTypes, derived.degree, labelMode, sizeByDegree, loadGraph]);

  useEffect(() => {
    if (fitViewNonce === 0) return;
    const camera = sigma.getCamera();
    camera.animatedReset({ duration: 400 });
  }, [fitViewNonce, sigma]);

  useEffect(() => {
    if (revealNonce === 0 || !selectedNodeId) return;
    const g = sigma.getGraph();
    if (!g.hasNode(selectedNodeId)) return;
    const display = sigma.getNodeDisplayData(selectedNodeId);
    if (!display) return;
    const camera = sigma.getCamera();
    camera.animate(
      { x: display.x, y: display.y, ratio: 0.4 },
      { duration: 500 },
    );
  }, [revealNonce, selectedNodeId, sigma]);

  useEffect(() => {
    let lastClick: { id: string; at: number } | null = null;
    registerEvents({
      clickNode: (e) => {
        const now = Date.now();
        if (lastClick && lastClick.id === e.node && now - lastClick.at < DBLCLICK_MS) {
          dispatch(revealNode(e.node));
          lastClick = null;
          return;
        }
        lastClick = { id: e.node, at: now };
        dispatch(selectNode(e.node));
      },
      clickStage: () => dispatch(clearSelection()),
    });
  }, [registerEvents, dispatch]);

  return null;
}

export function SigmaCanvas() {
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { isLoading, error } = useGetGraphQuery(selectedGraphId, {
    skip: !selectedGraphId,
  });

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
    <SigmaContainer
      style={{ height: '100%', width: '100%', background: '#ffffff' }}
      settings={{
        renderEdgeLabels: true,
        defaultEdgeType: 'arrow',
        labelDensity: 0.07,
        labelGridCellSize: 60,
        labelRenderedSizeThreshold: 6,
        zIndex: true,
      }}
    >
      <SigmaLoader />
    </SigmaContainer>
  );
}
