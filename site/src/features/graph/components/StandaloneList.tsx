import { useMemo } from 'react';
import { Loader, NavLink } from '@mantine/core';
import { LuCircle } from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph/slices/graphApiSlice';
import { selectNode } from '@/features/ui';
import {
  applyView,
  colorForType,
  formatIri,
  selectHiddenPredicates,
  selectHiddenTypes,
  selectLabelMode,
  useGraphDerivedData,
} from '@/features/view-config';

export function StandaloneList() {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const hiddenPredicates = useAppSelector(selectHiddenPredicates);
  const hiddenTypes = useAppSelector(selectHiddenTypes);
  const labelMode = useAppSelector(selectLabelMode);

  const { data, isLoading, error } = useGetGraphQuery(selectedGraphId, {
    skip: !selectedGraphId,
  });
  const derived = useGraphDerivedData(data);

  const orphans = useMemo(() => {
    if (!data) return [];
    // Orphans = degree-0 nodes after the predicate/type filters apply, so the
    // list mirrors what 'hide' mode would drop in the current view.
    const filtered = applyView({
      graph: data,
      hiddenPredicates,
      hiddenTypes,
      nodeTypes: derived.nodeTypes,
      standaloneMode: 'both',
      minDegree: 0,
    });
    const degree = new Map<string, number>();
    for (const n of filtered.nodes) degree.set(n.id, 0);
    for (const e of filtered.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      if (e.target !== e.source) {
        degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
      }
    }
    return filtered.nodes
      .filter((n) => (degree.get(n.id) ?? 0) === 0)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [data, hiddenPredicates, hiddenTypes, derived.nodeTypes]);

  if (!selectedGraphId) {
    return (
      <Empty>Select a graph to view its standalone nodes.</Empty>
    );
  }
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader size="sm" color="gray" />
      </div>
    );
  }
  if (error) {
    return <Empty>Failed to load graph.</Empty>;
  }
  if (orphans.length === 0) {
    return (
      <Empty>
        No standalone nodes — every node has at least one connection in the
        current view.
      </Empty>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white text-gray-900">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-[0.4px] text-neutral-500">
          Standalone nodes
        </span>
        <span className="tabular-nums text-xs text-neutral-500">
          {orphans.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0.5 p-1">
          {orphans.map((n) => {
            const type = derived.nodeTypes.get(n.id) ?? null;
            const label = formatIri(n.id, labelMode, { label: n.label });
            const subtitle = type ? formatIri(type, labelMode) : null;
            return (
              <NavLink
                key={n.id}
                label={label}
                description={subtitle ?? undefined}
                active={n.id === selectedNodeId}
                leftSection={
                  <LuCircle size={10} fill={colorForType(type)} stroke="none" />
                }
                onClick={() => {
                  dispatch(selectNode(n.id));
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
      {children}
    </div>
  );
}
