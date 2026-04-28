import { LuMousePointer2 } from 'react-icons/lu';
import { useAppSelector } from '@/app/hooks';
import { EdgeInspector } from '@/features/inspector/EdgeInspector';
import { NodeInspector } from '@/features/inspector/NodeInspector';

export function InspectorPanel() {
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((s) => s.ui.selectedEdgeId);

  if (selectedNodeId) return <NodeInspector nodeId={selectedNodeId} />;
  if (selectedEdgeId) return <EdgeInspector edgeId={selectedEdgeId} />;

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
        <LuMousePointer2 size={18} className="text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-700">Nothing selected</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Click a node or edge in the graph to inspect its details, attributes,
        and connections.
      </p>
    </div>
  );
}
