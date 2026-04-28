import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react';
import { Badge } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { diffStyleFor, useDiffOverlay } from '@/features/diff';
import { useGetGraphQuery } from '@/features/graph';
import { useElkLayout } from '@/features/graph/hooks/useElkLayout';
import { estimateNodeWidth } from '@/features/graph/services/elkOptions';
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
  selectMinDegree,
  selectRevealedNodeIds,
  selectStandaloneMode,
  useGraphDerivedData,
} from '@/features/view-config';
import { revealNode } from '@/features/view-config/viewConfigSlice';
import { buildTree } from '@/features/graph-tree/buildTree';
import { expandAll, selectCollapsedIds } from '@/features/graph-tree/treeSlice';
import { MindMapNode } from '@/features/graph-tree/MindMapNode';

type NodeData = {
  label: string;
  color?: string;
  width?: number;
  subtitle?: string | null;
  hiddenChildCount?: number;
  isRoot?: boolean;
  subtreeColor?: string;
  hasChildren?: boolean;
};
type FlowInstance = ReactFlowInstance<Node<NodeData>, Edge>;

const nodeTypes = { mindmap: MindMapNode };

const SUBTREE_PALETTE = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#F43F5E',
  '#84CC16',
  '#EAB308',
  '#14B8A6',
];

const TREE_LAYOUT_OVERRIDE: Record<string, string> = {
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '40',
  'elk.mrtree.searchOrder': 'DFS',
};

export function TreeCanvas() {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const fitViewNonce = useAppSelector((s) => s.ui.fitViewNonce);
  const revealNonce = useAppSelector((s) => s.ui.revealNonce);
  const relayoutNonce = useAppSelector((s) => s.ui.relayoutNonce);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((s) => s.ui.selectedEdgeId);
  const hiddenPredicates = useAppSelector(selectHiddenPredicates);
  const hiddenTypes = useAppSelector(selectHiddenTypes);
  const labelMode = useAppSelector(selectLabelMode);
  const focusNodeId = useAppSelector(selectFocusNodeId);
  const focusDepth = useAppSelector(selectFocusDepth);
  const revealedNodeIds = useAppSelector(selectRevealedNodeIds);
  const standaloneMode = useAppSelector(selectStandaloneMode);
  const minDegree = useAppSelector(selectMinDegree);
  const collapsedIds = useAppSelector(selectCollapsedIds);

  const { data, isLoading, error } = useGetGraphQuery(selectedGraphId, {
    skip: !selectedGraphId,
  });
  const diffOverlay = useDiffOverlay(data);
  const derived = useGraphDerivedData(data);

  // Default to fully-expanded whenever the user lands on a different graph.
  // Manual collapses persist within a graph; switching graphs resets them.
  useEffect(() => {
    dispatch(expandAll());
  }, [dispatch, selectedGraphId]);

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

  const treeResult = useMemo(() => {
    if (!filteredGraph) return null;
    return buildTree(
      { nodes: filteredGraph.nodes, edges: filteredGraph.edges },
      { rootId: focusNodeId ?? null, collapsedIds },
    );
  }, [filteredGraph, focusNodeId, collapsedIds]);

  const treeGraph = useMemo(() => {
    if (!treeResult) return undefined;
    return treeResult.tree;
  }, [treeResult]);

  const subtreeColors = useMemo(() => {
    const colors = new Map<string, string>();
    if (!treeResult || treeResult.rootId === null) return colors;
    const root = treeResult.rootId;
    const childMap = new Map<string, string[]>();
    for (const e of treeResult.tree.edges) {
      if (!childMap.has(e.source)) childMap.set(e.source, []);
      childMap.get(e.source)?.push(e.target);
    }
    const trunks = childMap.get(root) ?? [];
    trunks.forEach((trunkId, i) => {
      const color = SUBTREE_PALETTE[i % SUBTREE_PALETTE.length];
      const stack = [trunkId];
      while (stack.length > 0) {
        const id = stack.pop() as string;
        colors.set(id, color);
        for (const k of childMap.get(id) ?? []) stack.push(k);
      }
    });
    return colors;
  }, [treeResult]);

  const displayLabelIndex = useMemo(() => {
    const m = new Map<string, string>();
    if (treeGraph) {
      for (const n of treeGraph.nodes) {
        m.set(n.id, formatIri(n.id, labelMode, { label: n.label }));
      }
    }
    return m;
  }, [treeGraph, labelMode]);

  const hasChildrenSet = useMemo(() => {
    const set = new Set<string>();
    if (!treeResult) return set;
    for (const e of treeResult.tree.edges) set.add(e.source);
    for (const [id, count] of treeResult.hiddenChildCount) {
      if (count > 0) set.add(id);
    }
    return set;
  }, [treeResult]);

  const widthFor = useCallback(
    (id: string) => estimateNodeWidth(displayLabelIndex.get(id) ?? id),
    [displayLabelIndex],
  );

  const heightFor = useCallback(
    (id: string) => {
      const label = displayLabelIndex.get(id) ?? id;
      const w = widthFor(id);
      const isRoot = treeResult?.rootId === id;
      const hasSubtitle = (derived.nodeTypes.get(id) ?? null) !== null;
      const charWidth = 7.2;
      const reservedX = isRoot ? 36 : 50;
      const charsPerLine = Math.max(8, Math.floor((w - reservedX) / charWidth));
      const lines = Math.max(1, Math.ceil(label.length / charsPerLine));
      const lineHeight = isRoot ? 19 : 17;
      const verticalPadding = isRoot ? 24 : 16;
      const subtitleBlock = hasSubtitle ? 18 : 0;
      return Math.max(36, lines * lineHeight + verticalPadding + subtitleBlock);
    },
    [displayLabelIndex, widthFor, derived.nodeTypes, treeResult],
  );

  const layout = useElkLayout(
    treeGraph,
    'mrtree',
    relayoutNonce,
    widthFor,
    TREE_LAYOUT_OVERRIDE,
    heightFor,
  );

  const styledNodes = useMemo<Node<NodeData>[]>(() => {
    const rootId = treeResult?.rootId ?? null;
    const hiddenMap = treeResult?.hiddenChildCount ?? new Map<string, number>();
    return layout.nodes.map((n) => {
      const type = derived.nodeTypes.get(n.id) ?? null;
      const status = diffOverlay.active ? diffOverlay.nodeStatus(n.id) : undefined;
      const ds = status ? diffStyleFor(status) : null;
      return {
        ...n,
        type: 'mindmap',
        data: {
          ...n.data,
          label: displayLabelIndex.get(n.id) ?? n.id,
          color: ds ? ds.fill : colorForType(type),
          width: n.data.width,
          subtitle: type ? formatIri(type, labelMode) : null,
          hiddenChildCount: hiddenMap.get(n.id) ?? 0,
          isRoot: rootId === n.id,
          subtreeColor: subtreeColors.get(n.id),
          hasChildren: hasChildrenSet.has(n.id),
        },
        style: ds
          ? {
              ...n.style,
              opacity: ds.opacity,
            }
          : n.style,
      };
    });
  }, [
    layout.nodes,
    derived.nodeTypes,
    displayLabelIndex,
    labelMode,
    treeResult,
    subtreeColors,
    hasChildrenSet,
    diffOverlay,
  ]);

  const styledEdges = useMemo<Edge[]>(
    () =>
      layout.edges.map((e) => {
        const raw = typeof e.label === 'string' ? e.label : '';
        const displayLabel = raw ? formatIri(raw, labelMode) : undefined;
        const status = diffOverlay.active ? diffOverlay.edgeStatus(e.id) : undefined;
        const ds = status ? diffStyleFor(status) : null;
        const stroke = ds ? ds.stroke : (subtreeColors.get(e.target) ?? '#94A3B8');
        return {
          ...e,
          type: 'default',
          label: displayLabel,
          labelShowBg: false,
          labelStyle: {
            fontSize: 10.5,
            fill: stroke,
            fontWeight: 500,
            letterSpacing: -0.1,
          },
          style: {
            stroke,
            strokeWidth: ds && status !== 'unchanged' ? 3 : 2,
            strokeOpacity: ds ? ds.opacity : 0.85,
            strokeDasharray: ds?.dashed ? '6 4' : undefined,
          },
          markerEnd: undefined,
        };
      }),
    [layout.edges, labelMode, subtreeColors, diffOverlay],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const layoutNodesRef = useRef(layout.nodes);

  useEffect(() => {
    if (layoutNodesRef.current !== layout.nodes) {
      layoutNodesRef.current = layout.nodes;
      setNodes(styledNodes);
      return;
    }
    setNodes((current) => {
      const byId = new Map(styledNodes.map((n) => [n.id, n]));
      const patched = current.map((n) => {
        const next = byId.get(n.id);
        if (!next) return n;
        return { ...n, data: next.data };
      });
      const existing = new Set(current.map((n) => n.id));
      for (const n of styledNodes) if (!existing.has(n.id)) patched.push(n);
      return patched.filter((n) => byId.has(n.id));
    });
  }, [styledNodes, layout.nodes, setNodes]);

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

  if (treeResult && treeResult.rootId === null) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        No nodes to show as a tree.
      </div>
    );
  }

  const backEdgeCount = treeResult?.backEdges.length ?? 0;
  const orphanCount = treeResult?.orphans.length ?? 0;

  return (
    <div className="relative h-full w-full">
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

      {(backEdgeCount > 0 || orphanCount > 0) && (
        <div className="absolute right-3 top-3 z-[5] flex flex-nowrap items-center gap-1.5">
          {backEdgeCount > 0 && (
            <Badge
              size="sm"
              variant="light"
              color="orange"
              title={`${backEdgeCount} edge(s) hidden because they would re-introduce cycles into the tree`}
            >
              {backEdgeCount} back-edge{backEdgeCount === 1 ? '' : 's'}
            </Badge>
          )}
          {orphanCount > 0 && (
            <Badge
              size="sm"
              variant="light"
              color="gray"
              title={`${orphanCount} node(s) not reachable from the chosen root`}
            >
              {orphanCount} unreachable
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
