import { useEffect, useMemo, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { Core, ElementDefinition, EventObject } from 'cytoscape';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { diffStyleFor, useDiffOverlay } from '@/features/diff';
import { useGetGraphQuery } from '@/features/graph';
import { clearSelection, selectEdge, selectNode } from '@/features/ui';
import {
  applyView,
  colorForType,
  formatIri,
  selectFocusDepth,
  selectFocusNodeId,
  selectHiddenPredicates,
  selectHiddenTypes,
  selectLabelMode,
  selectLayoutAlgoCytoscape,
  selectMinDegree,
  selectRevealedNodeIds,
  selectSizeByDegree,
  selectStandaloneMode,
  useGraphDerivedData,
} from '@/features/view-config';
import { revealNode } from '@/features/view-config/viewConfigSlice';
import { getCytoscapeLayout } from '@/features/graph-cytoscape/layouts';
import { registerCytoscapeExtensions } from '@/features/graph-cytoscape/register';

registerCytoscapeExtensions();

export function CytoscapeCanvas() {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const fitViewNonce = useAppSelector((s) => s.ui.fitViewNonce);
  const relayoutNonce = useAppSelector((s) => s.ui.relayoutNonce);
  const hiddenPredicates = useAppSelector(selectHiddenPredicates);
  const hiddenTypes = useAppSelector(selectHiddenTypes);
  const labelMode = useAppSelector(selectLabelMode);
  const layoutAlgo = useAppSelector(selectLayoutAlgoCytoscape);
  const sizeByDegree = useAppSelector(selectSizeByDegree);
  const focusNodeId = useAppSelector(selectFocusNodeId);
  const focusDepth = useAppSelector(selectFocusDepth);
  const revealedNodeIds = useAppSelector(selectRevealedNodeIds);
  const standaloneMode = useAppSelector(selectStandaloneMode);
  const minDegree = useAppSelector(selectMinDegree);
  const revealNonce = useAppSelector((s) => s.ui.revealNonce);
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || !filteredGraph) return;

    const elements: ElementDefinition[] = [
      ...filteredGraph.nodes.map((n) => {
        const status = diffOverlay.active ? diffOverlay.nodeStatus(n.id) : undefined;
        const ds = status ? diffStyleFor(status) : null;
        return {
          data: {
            id: n.id,
            label: formatIri(n.id, labelMode, { label: n.label }),
            color: ds ? ds.fill : colorForType(derived.nodeTypes.get(n.id) ?? null),
            degree: derived.degree.get(n.id) ?? 0,
            diffOpacity: ds ? ds.opacity : 1,
            diffBorder: ds ? ds.stroke : '#1B1F2A',
            diffBorderWidth: ds && status !== 'unchanged' ? 4 : 2,
          },
        };
      }),
      ...filteredGraph.edges.map((e) => {
        const status = diffOverlay.active ? diffOverlay.edgeStatus(e.id) : undefined;
        const ds = status ? diffStyleFor(status) : null;
        return {
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label ? formatIri(e.label, labelMode) : '',
            diffStroke: ds ? ds.stroke : '#5B6478',
            diffOpacity: ds ? ds.opacity : 1,
            diffWidth: ds && status !== 'unchanged' ? 3 : 1.5,
            diffDashed: ds?.dashed ? 1 : 0,
          },
        };
      }),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            shape: 'ellipse',
            'background-color': `data(color)`,
            'background-opacity': diffOverlay.active
              ? ('data(diffOpacity)' as never)
              : 0.9,
            opacity: diffOverlay.active ? ('data(diffOpacity)' as never) : 1,
            label: 'data(label)',
            color: '#0F1218',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'font-size': 11,
            'font-family': 'system-ui, sans-serif',
            'font-weight': 600,
            'text-wrap': 'wrap',
            'text-max-width': '180px',
            'text-outline-color': '#FAFBFC',
            'text-outline-width': 3,
            width: sizeByDegree
              ? ('mapData(degree, 0, 30, 28, 70)' as never)
              : 38,
            height: sizeByDegree
              ? ('mapData(degree, 0, 30, 28, 70)' as never)
              : 38,
            'border-width': diffOverlay.active
              ? ('data(diffBorderWidth)' as never)
              : 2,
            'border-color': diffOverlay.active
              ? ('data(diffBorder)' as never)
              : '#1B1F2A',
            'border-opacity': 1,
            'overlay-padding': 6,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#4FB3FF',
            'border-width': 4,
            'border-opacity': 1,
          },
        },
        {
          selector: 'edge',
          style: {
            width: diffOverlay.active ? ('data(diffWidth)' as never) : 1.5,
            'line-color': diffOverlay.active
              ? ('data(diffStroke)' as never)
              : '#5B6478',
            'line-style': diffOverlay.active
              ? (((ele: cytoscape.EdgeSingular) =>
                  ele.data('diffDashed') ? 'dashed' : 'solid') as never)
              : 'solid',
            'target-arrow-color': diffOverlay.active
              ? ('data(diffStroke)' as never)
              : '#5B6478',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.9,
            'curve-style': 'bezier',
            opacity: diffOverlay.active ? ('data(diffOpacity)' as never) : 1,
            label: 'data(label)',
            'font-size': 9,
            'font-family': 'system-ui, sans-serif',
            'text-rotation': 'autorotate',
            'text-background-color': '#1B1F2A',
            'text-background-opacity': 0.9,
            'text-background-padding': '3',
            'text-background-shape': 'roundrectangle',
            'text-max-width': '200px',
            'text-wrap': 'ellipsis',
            color: '#CBD5E1',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#4FB3FF',
            'target-arrow-color': '#4FB3FF',
            width: 2.5,
          },
        },
      ],
      layout: getCytoscapeLayout(layoutAlgo),
      wheelSensitivity: 1.5,
      minZoom: 0.05,
      maxZoom: 4,
    });

    cyRef.current = cy;

    cy.on('tap', 'node', (e: EventObject) => {
      dispatch(selectNode(e.target.id()));
    });
    cy.on('tap', 'edge', (e: EventObject) => {
      dispatch(selectEdge(e.target.id()));
    });
    cy.on('tap', (e: EventObject) => {
      if (e.target === cy) dispatch(clearSelection());
    });
    cy.on('dblclick', 'node', (e: EventObject) => {
      dispatch(revealNode(e.target.id()));
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [filteredGraph, derived.nodeTypes, derived.degree, labelMode, layoutAlgo, sizeByDegree, diffOverlay, dispatch]);

  useEffect(() => {
    if (fitViewNonce === 0) return;
    cyRef.current?.fit(undefined, 60);
  }, [fitViewNonce]);

  const lastRevealNonce = useRef(0);
  useEffect(() => {
    if (revealNonce === lastRevealNonce.current) return;
    lastRevealNonce.current = revealNonce;
    if (revealNonce === 0) return;
    const targetId = selectedNodeId ?? selectedEdgeId;
    if (!targetId) return;
    const cy = cyRef.current;
    if (!cy) return;
    const ele = cy.getElementById(targetId);
    if (ele.nonempty()) {
      cy.animate({ center: { eles: ele }, zoom: 1.2 }, { duration: 400 });
    }
  }, [revealNonce, selectedNodeId, selectedEdgeId]);

  useEffect(() => {
    if (relayoutNonce === 0) return;
    cyRef.current?.layout(getCytoscapeLayout(layoutAlgo)).run();
  }, [relayoutNonce, layoutAlgo]);

  if (!selectedGraphId) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        Select a graph to view.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
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
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: 'var(--color-canvas-bg)' }}
    />
  );
}
