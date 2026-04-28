import { useEffect, useMemo, useRef } from 'react';
import Graph from 'graphology';
import circular from 'graphology-layout/circular';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { diffStyleFor, useDiffOverlay } from '@/features/diff';
import { useGetGraphQuery } from '@/features/graph';
import { clearSelection, selectNode } from '@/features/ui';

const withOpacity = (hex: string, opacity: number): string => {
  // sigma accepts `#RRGGBBAA` — bake opacity into the color directly.
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const a = Math.max(0, Math.min(255, Math.round(opacity * 255)))
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
};
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
  const standaloneMode = useAppSelector(selectStandaloneMode);
  const minDegree = useAppSelector(selectMinDegree);
  const fitViewNonce = useAppSelector((s) => s.ui.fitViewNonce);
  const revealNonce = useAppSelector((s) => s.ui.revealNonce);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((s) => s.ui.selectedEdgeId);

  const { data } = useGetGraphQuery(selectedGraphId, { skip: !selectedGraphId });
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

  useEffect(() => {
    if (!filteredGraph) {
      loadGraph(new Graph());
      return;
    }
    const g = new Graph({ multi: true, type: 'directed' });
    filteredGraph.nodes.forEach((n) => {
      const deg = derived.degree.get(n.id) ?? 0;
      const status = diffOverlay.active ? diffOverlay.nodeStatus(n.id) : undefined;
      const ds = status ? diffStyleFor(status) : null;
      const baseSize = sizeByDegree ? Math.max(4, Math.min(22, 4 + Math.sqrt(deg) * 2.2)) : 8;
      const size = ds && status !== 'unchanged' ? baseSize * 1.3 : baseSize;
      const baseColor = ds ? ds.fill : colorForType(derived.nodeTypes.get(n.id) ?? null);
      const color = ds ? withOpacity(baseColor, ds.opacity) : baseColor;
      g.addNode(n.id, {
        x: 0,
        y: 0,
        size,
        label: formatIri(n.id, labelMode, { label: n.label }),
        color,
      });
    });
    filteredGraph.edges.forEach((e) => {
      if (!g.hasNode(e.source) || !g.hasNode(e.target)) return;
      const status = diffOverlay.active ? diffOverlay.edgeStatus(e.id) : undefined;
      const ds = status ? diffStyleFor(status) : null;
      const baseColor = ds ? ds.stroke : '#94A3B8';
      const color = ds ? withOpacity(baseColor, ds.opacity) : 'rgba(148, 163, 184, 0.55)';
      g.addEdgeWithKey(e.id, e.source, e.target, {
        label: e.label ? formatIri(e.label, labelMode) : '',
        color,
        size: ds && status !== 'unchanged' ? 2.4 : 1.1,
        type: 'arrow',
      });
    });

    // Seed positions on a circle so forceAtlas2 has something to work with —
    // FA2 won't disambiguate from a single point.
    const N = g.order;
    circular.assign(g, { scale: Math.max(300, Math.sqrt(N) * 60) });

    // Run forceAtlas2 in-place. linLog separates clusters far better than
    // linear mode for the typical GO-CAM hairball; strong gravity keeps
    // disconnected components from drifting off-screen.
    if (N > 1) {
      const iterations = N > 2000 ? 200 : N > 500 ? 350 : 600;
      forceAtlas2.assign(g, {
        iterations,
        settings: {
          barnesHutOptimize: N > 500,
          barnesHutTheta: 0.5,
          linLogMode: true,
          outboundAttractionDistribution: true,
          adjustSizes: true,
          edgeWeightInfluence: 0,
          scalingRatio: 8,
          gravity: 1.5,
          strongGravityMode: false,
          slowDown: 1 + Math.log(Math.max(2, N)),
        },
      });

      // Post-pass: spread overlapping nodes apart. Bounded iteration count
      // — converges fast for the small overlap residue FA2 leaves behind.
      noverlap.assign(g, {
        maxIterations: 80,
        settings: {
          margin: 4,
          ratio: 1.05,
          speed: 3,
          gridSize: 20,
        },
      });
    }

    loadGraph(g);
  }, [filteredGraph, derived.nodeTypes, derived.degree, labelMode, sizeByDegree, diffOverlay, loadGraph]);

  useEffect(() => {
    if (fitViewNonce === 0) return;
    const camera = sigma.getCamera();
    camera.animatedReset({ duration: 400 });
  }, [fitViewNonce, sigma]);

  const lastRevealNonce = useRef(0);
  useEffect(() => {
    if (revealNonce === lastRevealNonce.current) return;
    lastRevealNonce.current = revealNonce;
    if (revealNonce === 0) return;
    const g = sigma.getGraph();
    let target: { x: number; y: number } | null = null;
    if (selectedNodeId && g.hasNode(selectedNodeId)) {
      const d = sigma.getNodeDisplayData(selectedNodeId);
      if (d) target = { x: d.x, y: d.y };
    } else if (selectedEdgeId && g.hasEdge(selectedEdgeId)) {
      const sourceId = g.source(selectedEdgeId);
      const targetId = g.target(selectedEdgeId);
      const sd = sigma.getNodeDisplayData(sourceId);
      const td = sigma.getNodeDisplayData(targetId);
      if (sd && td) target = { x: (sd.x + td.x) / 2, y: (sd.y + td.y) / 2 };
    }
    if (!target) return;
    const camera = sigma.getCamera();
    camera.animate(
      { x: target.x, y: target.y, ratio: 0.4 },
      { duration: 500 },
    );
  }, [revealNonce, selectedNodeId, selectedEdgeId, sigma]);

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
      style={{ height: '100%', width: '100%', background: '#0F172A' }}
      settings={{
        renderEdgeLabels: true,
        defaultEdgeType: 'arrow',
        labelDensity: 0.07,
        labelGridCellSize: 60,
        labelRenderedSizeThreshold: 6,
        labelColor: { color: '#E2E8F0' },
        edgeLabelColor: { color: '#94A3B8' },
        labelFont: 'system-ui, sans-serif',
        labelSize: 12,
        labelWeight: '500',
        zIndex: true,
      }}
    >
      <SigmaLoader />
    </SigmaContainer>
  );
}
