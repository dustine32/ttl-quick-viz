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
import { estimateNodeWidth } from '@/features/graph/services/elkOptions';

type NodeData = {
  label: string;
  color?: string;
  width?: number;
  subtitle?: string | null;
};
type FlowInstance = ReactFlowInstance<Node<NodeData>, Edge>;
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph/slices/graphApiSlice';
import { useElkLayout } from '@/features/graph/hooks/useElkLayout';
import { PrettyNode } from '@/features/graph/components/PrettyNode';
import { LaneNode } from '@/features/graph/components/LaneNode';
import {
  computeSwimlaneLayout,
  type SwimlaneLayoutResult,
} from '@/features/graph/services/swimlaneLayout';
import {
  computeRadialLayout,
  type RadialLayoutResult,
} from '@/features/graph/services/radialLayout';
import {
  computeDagreLayout,
  type DagreLayoutResult,
} from '@/features/graph/services/dagreLayout';
import { computeConnectedComponents } from '@/features/graph/services/connectedComponents';
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
  selectMinDegree,
  selectRevealedNodeIds,
  selectStandaloneMode,
  selectSwimlaneGroupBy,
  selectSwimlaneHideOther,
  selectSwimlaneMaxLanes,
  selectSwimlaneSubGroupBy,
  useGraphDerivedData,
} from '@/features/view-config';
import { revealNode } from '@/features/view-config/viewConfigSlice';

const nodeTypes = { pretty: PrettyNode, lane: LaneNode };
const EMPTY_LANE_NODES: Node[] = [];

export function GraphCanvas() {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const fitViewNonce = useAppSelector((s) => s.ui.fitViewNonce);
  const revealNonce = useAppSelector((s) => s.ui.revealNonce);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((s) => s.ui.selectedEdgeId);
  const hiddenPredicates = useAppSelector(selectHiddenPredicates);
  const hiddenTypes = useAppSelector(selectHiddenTypes);
  const labelMode = useAppSelector(selectLabelMode);
  const layoutAlgo = useAppSelector(selectLayoutAlgoXyflow);
  const focusNodeId = useAppSelector(selectFocusNodeId);
  const focusDepth = useAppSelector(selectFocusDepth);
  const revealedNodeIds = useAppSelector(selectRevealedNodeIds);
  const standaloneMode = useAppSelector(selectStandaloneMode);
  const minDegree = useAppSelector(selectMinDegree);
  const swimlaneMaxLanes = useAppSelector(selectSwimlaneMaxLanes);
  const swimlaneGroupBy = useAppSelector(selectSwimlaneGroupBy);
  const swimlaneSubGroupBy = useAppSelector(selectSwimlaneSubGroupBy);
  const swimlaneHideOther = useAppSelector(selectSwimlaneHideOther);
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
  const useSwimlane = layoutAlgo === 'swimlane';
  const useRadial = layoutAlgo === 'radial';
  const useDagre = layoutAlgo === 'dagre';
  const elkLayout = useElkLayout(
    useSwimlane || useRadial || useDagre ? undefined : filteredGraph,
    layoutAlgo,
    relayoutNonce,
    widthFor,
  );
  const radialLayout: RadialLayoutResult | null = useMemo(() => {
    if (!useRadial || !filteredGraph) return null;
    return computeRadialLayout(filteredGraph, {
      widthFor,
      displayLabelFor: (id) => displayLabelIndex.get(id) ?? id,
    });
    // relayoutNonce drives a recompute on the 'R' hotkey even though the
    // result is deterministic — matches the swimlane path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRadial, filteredGraph, widthFor, displayLabelIndex, relayoutNonce]);
  const dagreLayout: DagreLayoutResult | null = useMemo(() => {
    if (!useDagre || !filteredGraph) return null;
    return computeDagreLayout(filteredGraph, {
      widthFor,
      displayLabelFor: (id) => displayLabelIndex.get(id) ?? id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDagre, filteredGraph, widthFor, displayLabelIndex, relayoutNonce]);
  const swimlaneLayout: SwimlaneLayoutResult | null = useMemo(() => {
    if (!useSwimlane || !filteredGraph) return null;
    const componentInfo =
      swimlaneGroupBy === 'component' || swimlaneSubGroupBy === 'component'
        ? computeConnectedComponents(filteredGraph)
        : null;
    const componentLabels = new Map<string, string>();
    if (componentInfo) {
      for (const c of componentInfo.components) {
        const repLabel = displayLabelIndex.get(c.representative) ?? c.representative;
        componentLabels.set(c.key, `Subgraph: ${repLabel}`);
      }
    }
    const groupByFn =
      swimlaneGroupBy === 'component'
        ? (id: string) => componentInfo!.byNode.get(id) ?? null
        : (id: string) => derived.nodeTypes.get(id) ?? null;
    const labelForFn =
      swimlaneGroupBy === 'component'
        ? (k: string) => componentLabels.get(k) ?? k
        : (k: string) => formatIri(k, labelMode);
    let subGroupByFn: ((id: string) => string | null | undefined) | undefined;
    let subLabelForFn: ((k: string) => string) | undefined;
    if (swimlaneSubGroupBy === 'type') {
      subGroupByFn = (id) => derived.nodeTypes.get(id) ?? null;
      subLabelForFn = (k) => formatIri(k, labelMode);
    } else if (swimlaneSubGroupBy === 'component') {
      subGroupByFn = (id) => componentInfo!.byNode.get(id) ?? null;
      subLabelForFn = (k) => componentLabels.get(k) ?? k;
    }
    return computeSwimlaneLayout(filteredGraph, {
      groupBy: groupByFn,
      labelFor: labelForFn,
      subGroupBy: subGroupByFn,
      subLabelFor: subLabelForFn,
      displayLabelFor: (id) => displayLabelIndex.get(id) ?? id,
      maxLanes: swimlaneMaxLanes,
      hideOther: swimlaneHideOther,
    });
    // relayoutNonce is included so 'R' re-runs the memo even though the
    // result is deterministic — keeps parity with the ELK path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    useSwimlane,
    filteredGraph,
    derived.nodeTypes,
    labelMode,
    displayLabelIndex,
    swimlaneMaxLanes,
    swimlaneGroupBy,
    swimlaneSubGroupBy,
    swimlaneHideOther,
    relayoutNonce,
  ]);
  const layout = useSwimlane && swimlaneLayout
    ? { status: 'ready' as const, nodes: swimlaneLayout.nodes, edges: swimlaneLayout.edges }
    : useRadial && radialLayout
      ? { status: 'ready' as const, nodes: radialLayout.nodes, edges: radialLayout.edges }
      : useDagre && dagreLayout
        ? { status: 'ready' as const, nodes: dagreLayout.nodes, edges: dagreLayout.edges }
        : elkLayout;
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
          labelBgStyle: { fill: '#1B1F2A', fillOpacity: 0.95, stroke: '#353B4D' },
          labelStyle: {
            fontSize: 11,
            fill: '#CBD5E1',
            fontWeight: 500,
            letterSpacing: -0.1,
          },
          style: {
            stroke: '#5B6478',
            strokeWidth: 1.6,
            strokeOpacity: 0.95,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#5B6478',
            width: 18,
            height: 18,
          },
        };
      }),
    [layout.edges, labelMode],
  );
  const laneFlowNodes = useMemo<Node[]>(() => {
    if (!swimlaneLayout) return EMPTY_LANE_NODES;
    return swimlaneLayout.groups.map((g) => ({
      id: `__group__:${g.key}`,
      type: 'lane',
      position: { x: g.x, y: g.y },
      data: {
        label: g.label,
        count: g.count,
        width: g.width,
        height: g.height,
        isOther: g.isOther,
        level: g.level,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      // Top-level groups deepest (-2), sub-groups in front of them (-1),
      // regular pretty nodes default (0).
      zIndex: g.level === 0 ? -2 : -1,
    }));
  }, [swimlaneLayout]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const layoutNodesRef = useRef(layout.nodes);

  useEffect(() => {
    const combined = [...laneFlowNodes, ...coloredNodes] as Node<NodeData>[];
    if (layoutNodesRef.current !== layout.nodes) {
      layoutNodesRef.current = layout.nodes;
      setNodes(combined);
      return;
    }
    setNodes((current) => {
      const byId = new Map(combined.map((n) => [n.id, n]));
      const patched = current.map((n) => {
        const next = byId.get(n.id);
        if (!next) return n;
        return { ...n, data: next.data };
      });
      const existing = new Set(current.map((n) => n.id));
      for (const n of combined) if (!existing.has(n.id)) patched.push(n);
      return patched.filter((n) => byId.has(n.id));
    });
  }, [coloredNodes, laneFlowNodes, layout.nodes, setNodes]);

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

  const lastRevealNonce = useRef(0);
  useEffect(() => {
    if (revealNonce === lastRevealNonce.current) return;
    lastRevealNonce.current = revealNonce;
    if (revealNonce === 0 || !instanceRef.current) return;
    const center = (n: Node<NodeData>) => ({
      x: n.position.x + (n.data.width ?? 180) / 2,
      y: n.position.y + 24,
    });
    if (selectedNodeId) {
      const target = nodes.find((n) => n.id === selectedNodeId);
      if (!target) return;
      const c = center(target);
      instanceRef.current.setCenter(c.x, c.y, { zoom: 1.2, duration: 400 });
    } else if (selectedEdgeId) {
      const edge = edges.find((e) => e.id === selectedEdgeId);
      if (!edge) return;
      const s = nodes.find((n) => n.id === edge.source);
      const t = nodes.find((n) => n.id === edge.target);
      if (!s || !t) return;
      const sc = center(s);
      const tc = center(t);
      instanceRef.current.setCenter((sc.x + tc.x) / 2, (sc.y + tc.y) / 2, {
        zoom: 1.2,
        duration: 400,
      });
    }
  }, [revealNonce, selectedNodeId, selectedEdgeId, nodes, edges]);

  if (!selectedGraphId) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
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
      <Background color="#2A3345" gap={28} size={1.2} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => (n.data as NodeData).color ?? '#5B6478'}
        nodeBorderRadius={6}
        maskColor="rgba(0, 0, 0, 0.45)"
        style={{
          border: '1px solid #2A2F3D',
          borderRadius: 8,
          background: '#1B1F2A',
        }}
      />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
