import { useAppSelector } from '@/app/hooks';
import { EdgeInspector } from '@/features/inspector/EdgeInspector';
import { NodeInspector } from '@/features/inspector/NodeInspector';

export function InspectorPanel() {
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((s) => s.ui.selectedEdgeId);

  if (selectedNodeId) return <NodeInspector nodeId={selectedNodeId} />;
  if (selectedEdgeId) return <EdgeInspector edgeId={selectedEdgeId} />;

  return (
    <p className="text-xs text-neutral-500">
      Select a node or edge to inspect.
    </p>
  );
}
