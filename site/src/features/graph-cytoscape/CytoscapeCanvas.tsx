import { useEffect, useMemo, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { Core, ElementDefinition, EventObject } from 'cytoscape';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
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
  selectRevealedNodeIds,
  selectSizeByDegree,
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
  const revealNonce = useAppSelector((s) => s.ui.revealNonce);
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || !filteredGraph) return;

    const elements: ElementDefinition[] = [
      ...filteredGraph.nodes.map((n) => ({
        data: {
          id: n.id,
          label: formatIri(n.id, labelMode, { label: n.label }),
          color: colorForType(derived.nodeTypes.get(n.id) ?? null),
          degree: derived.degree.get(n.id) ?? 0,
        },
      })),
      ...filteredGraph.edges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label ? formatIri(e.label, labelMode) : '',
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': `data(color)`,
            label: 'data(label)',
            color: '#0f172a',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 6,
            'font-size': 11,
            'font-family': 'system-ui, sans-serif',
            'font-weight': 500,
            'text-wrap': 'ellipsis',
            'text-max-width': '160px',
            width: sizeByDegree ? ('mapData(degree, 0, 30, 40, 140)' as never) : 52,
            height: sizeByDegree ? ('mapData(degree, 0, 30, 40, 140)' as never) : 52,
            'border-width': 2,
            'border-color': '#ffffff',
            'border-opacity': 0.9,
            'overlay-padding': 6,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#60a5fa',
            'border-width': 4,
            'border-opacity': 1,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.9,
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 9,
            'font-family': 'system-ui, sans-serif',
            'text-rotation': 'autorotate',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.85,
            'text-background-padding': '2',
            'text-max-width': '200px',
            'text-wrap': 'ellipsis',
            color: '#64748b',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#60a5fa',
            'target-arrow-color': '#60a5fa',
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
  }, [filteredGraph, derived.nodeTypes, derived.degree, labelMode, layoutAlgo, sizeByDegree, dispatch]);

  useEffect(() => {
    if (fitViewNonce === 0) return;
    cyRef.current?.fit(undefined, 60);
  }, [fitViewNonce]);

  useEffect(() => {
    if (revealNonce === 0 || !selectedNodeId) return;
    const cy = cyRef.current;
    if (!cy) return;
    const ele = cy.getElementById(selectedNodeId);
    if (ele.nonempty()) {
      cy.animate({ center: { eles: ele }, zoom: 1.2 }, { duration: 400 });
    }
  }, [revealNonce, selectedNodeId]);

  useEffect(() => {
    if (relayoutNonce === 0) return;
    cyRef.current?.layout(getCytoscapeLayout(layoutAlgo)).run();
  }, [relayoutNonce, layoutAlgo]);

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

  return <div ref={containerRef} className="h-full w-full bg-white" />;
}
