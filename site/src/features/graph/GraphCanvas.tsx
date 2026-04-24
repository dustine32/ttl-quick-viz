import { useMemo } from 'react';
import { ReactFlow, Background, MiniMap, Controls } from '@xyflow/react';
import {
  useGetGraphQuery,
  useGetGraphsQuery,
} from '@/features/graph/graphApi';
import { useElkLayout } from '@/features/graph/useElkLayout';
import { PrettyNode } from '@/features/graph/PrettyNode';

const nodeTypes = { pretty: PrettyNode };

export function GraphCanvas() {
  const { data: list, isLoading: listLoading } = useGetGraphsQuery();
  const firstId = list?.[0]?.id;
  const { data, isLoading, error } = useGetGraphQuery(firstId ?? '', {
    skip: !firstId,
  });
  const layout = useElkLayout(data);
  const types = useMemo(() => nodeTypes, []);

  if (
    listLoading ||
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

  if (list && list.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        No graphs available.
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
    <ReactFlow nodes={layout.nodes} edges={layout.edges} nodeTypes={types} fitView nodesDraggable>
      <Background />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  );
}
