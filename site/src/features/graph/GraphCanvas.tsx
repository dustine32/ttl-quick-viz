import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react';
import { estimateNodeWidth } from '@/features/graph/elkOptions';

type NodeData = {
  label: string;
  color?: string;
  width?: number;
  subtitle?: string | null;
};
type FlowInstance = ReactFlowInstance<Node<NodeData>, Edge>;
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph/graphApi';
import { useElkLayout } from '@/features/graph/useElkLayout';
import { PrettyNode } from '@/features/graph/PrettyNode';
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
  selectLayoutAlgoXyflow,
  selectRevealedNodeIds,
  useGraphDerivedData,
} from '@/features/view-config';
import { revealNode } from '@/features/view-config/viewConfigSlice';

const nodeTypes = { pretty: PrettyNode };

export function GraphCanvas() {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const fitViewNonce = useAppSelector((s) => s.ui.fitViewNonce);
  const revealNonce = useAppSelector((s) => s.ui.revealNonce);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const hiddenPredicates = useAppSelector(selectHiddenPredicates);
  const hiddenTypes = useAppSelector(selectHiddenTypes);
  const labelMode = useAppSelector(selectLabelMode);
  const layoutAlgo = useAppSelector(selectLayoutAlgoXyflow);
  const focusNodeId = useAppSelector(selectFocusNodeId);
  const focusDepth = useAppSelector(selectFocusDepth);
  const revealedNodeIds = useAppSelector(selectRevealedNodeIds);
  const relayoutNonce = useAppSelector((s) => s.ui.relayoutNonce);
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
  const displayLabelIndex = useMemo(() => {
    const m = new Map<string, string>();
    if (filteredGraph) {
      for (const n of filteredGraph.nodes) {
        m.set(n.id, formatIri(n.id, labelMode, { label: n.label }));
      }
    }
    return m;
  }, [filteredGraph, labelMode]);
  const widthFor = useCallback(
    (id: string) => estimateNodeWidth(displayLabelIndex.get(id) ?? id),
    [displayLabelIndex],
  );
  const layout = useElkLayout(filteredGraph, layoutAlgo, relayoutNonce, widthFor);
  const coloredNodes = useMemo<Node<NodeData>[]>(
    () =>
      layout.nodes.map((n) => {
        const type = derived.nodeTypes.get(n.id) ?? null;
        return {
          ...n,
          data: {
            ...n.data,
            label: displayLabelIndex.get(n.id) ?? n.id,
            color: colorForType(type),
            width: n.data.width,
            subtitle: type ? formatIri(type, labelMode) : null,
          },
        };
      }),
    [layout.nodes, derived.nodeTypes, displayLabelIndex, labelMode],
  );
  const styledEdges = useMemo<Edge[]>(
    () =>
      layout.edges.map((e) => {
        const raw = typeof e.label === 'string' ? e.label : '';
        const displayLabel = raw ? formatIri(raw, labelMode) : undefined;
        return {
          ...e,
          type: 'default',
          label: displayLabel,
          labelBgPadding: [8, 4],
          labelBgBorderRadius: 6,
          labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92, stroke: '#e2e8f0' },
          labelStyle: {
            fontSize: 11,
            fill: '#475569',
            fontWeight: 500,
            letterSpacing: -0.1,
          },
          style: {
            stroke: '#94a3b8',
            strokeWidth: 1.6,
            strokeOpacity: 0.85,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#94a3b8',
            width: 18,
            height: 18,
          },
        };
      }),
    [layout.edges, labelMode],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const layoutNodesRef = useRef(layout.nodes);

  useEffect(() => {
    if (layoutNodesRef.current !== layout.nodes) {
      layoutNodesRef.current = layout.nodes;
      setNodes(coloredNodes);
      return;
    }
    setNodes((current) => {
      const byId = new Map(coloredNodes.map((n) => [n.id, n]));
      const patched = current.map((n) => {
        const next = byId.get(n.id);
        if (!next) return n;
        return { ...n, data: next.data };
      });
      const existing = new Set(current.map((n) => n.id));
      for (const n of coloredNodes) if (!existing.has(n.id)) patched.push(n);
      return patched.filter((n) => byId.has(n.id));
    });
  }, [coloredNodes, layout.nodes, setNodes]);

  useEffect(() => {
    setEdges(styledEdges);
  }, [styledEdges, setEdges]);
  const types = useMemo(() => nodeTypes, []);
  const instanceRef = useRef<FlowInstance | null>(null);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => dispatch(selectNode(node.id)),
    [dispatch],
  );
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => dispatch(selectEdge(edge.id)),
    [dispatch],
  );
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => dispatch(revealNode(node.id)),
    [dispatch],
  );
  const onPaneClick = useCallback(() => dispatch(clearSelection()), [dispatch]);

  useEffect(() => {
    if (fitViewNonce === 0) return;
    instanceRef.current?.fitView({ padding: 0.1, duration: 200 });
  }, [fitViewNonce]);

  useEffect(() => {
    if (revealNonce === 0 || !selectedNodeId) return;
    const target = nodes.find((n) => n.id === selectedNodeId);
    if (!target || !instanceRef.current) return;
    const w = target.data.width ?? 180;
    const x = target.position.x + w / 2;
    const y = target.position.y + 24;
    instanceRef.current.setCenter(x, y, { zoom: 1.2, duration: 400 });
  }, [revealNonce, selectedNodeId, nodes]);

  if (!selectedGraphId) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Select a graph to view.
      </div>
    );
  }

  if (
    isLoading ||
    layout.status === 'laying-out' ||
    layout.status === 'idle'
  ) {
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
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={types}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onInit={(instance) => {
        instanceRef.current = instance;
      }}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      fitView
      fitViewOptions={{ padding: 0.2, duration: 300 }}
      minZoom={0.05}
      maxZoom={4}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ type: 'default' }}
    >
      <Background color="#cbd5e1" gap={24} size={1.2} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => (n.data as NodeData).color ?? '#cbd5e1'}
        nodeBorderRadius={6}
        maskColor="rgba(15, 23, 42, 0.05)"
        style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
