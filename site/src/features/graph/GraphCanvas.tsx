import { ReactFlow, Background, BackgroundVariant, MiniMap, Controls } from '@xyflow/react';
import { useGetGraphQuery } from '@/features/graph/graphApi';
import { useElkLayout } from '@/features/graph/useElkLayout';
import { PrettyNode } from '@/features/graph/PrettyNode';

const nodeTypes = { pretty: PrettyNode };

const panelStyle = {
  background: 'rgba(255, 255, 255, 0.9)',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
  backdropFilter: 'blur(4px)',
};

export function GraphCanvas() {
  const { data, isLoading, error } = useGetGraphQuery('sample');
  const layout = useElkLayout(data);

  if (isLoading || layout.status === 'laying-out' || layout.status === 'idle') {
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
    <div className="h-full w-full bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <ReactFlow
        nodes={layout.nodes}
        edges={layout.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        nodesDraggable
        minZoom={0.2}
        maxZoom={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.4}
          color="#cbd5e1"
        />
        <MiniMap
          pannable
          zoomable
          nodeColor="#cbd5e1"
          nodeStrokeColor="#64748b"
          nodeStrokeWidth={2}
          nodeBorderRadius={4}
          maskColor="rgba(15, 23, 42, 0.06)"
          style={panelStyle}
        />
        <Controls style={panelStyle} />
      </ReactFlow>
    </div>
  );
}
