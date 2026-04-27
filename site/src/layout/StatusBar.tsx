import { useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';

export function StatusBar() {
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(selectedGraphId, {
    skip: !selectedGraphId,
  });

  const nodeCount = data?.nodes.length ?? 0;
  const edgeCount = data?.edges.length ?? 0;

  return (
    <div className="flex h-full flex-nowrap items-center justify-between gap-5 px-4">
      <div className="flex flex-nowrap items-center gap-4">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${selectedGraphId ? 'bg-green-500' : 'bg-gray-500'
              }`}
          />
          {selectedGraphId ? selectedGraphId : 'No graph selected'}
        </span>
        <span className="text-xs tabular-nums text-slate-500">
          <span className="text-gray-900">{nodeCount}</span> nodes ·{' '}
          <span className="text-gray-900">{edgeCount}</span> edges
        </span>
      </div>
      <span className="text-xs text-gray-400">
        Ctrl+K · Ctrl+J · F · R · Ctrl+B
      </span>
    </div>
  );
}
