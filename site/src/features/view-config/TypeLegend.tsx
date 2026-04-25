import { ScrollArea, Stack } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';
import { formatIri } from '@/features/view-config/prefixes';
import { toggleTypeHidden } from '@/features/view-config/viewConfigSlice';
import {
  selectHiddenTypes,
  selectLabelMode,
} from '@/features/view-config/selectors';
import { useGraphDerivedData } from '@/features/view-config/useGraphDerivedData';

export function TypeLegend() {
  const dispatch = useAppDispatch();
  const graphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(graphId, { skip: !graphId });
  const { types } = useGraphDerivedData(data);
  const hidden = useAppSelector(selectHiddenTypes);
  const labelMode = useAppSelector(selectLabelMode);

  if (types.length === 0) {
    return (
      <p className="text-xs text-neutral-400 italic">
        No rdf:type information in this graph.
      </p>
    );
  }

  return (
    <ScrollArea.Autosize mah={240} type="auto">
      <Stack gap={2}>
        {types.map(({ type, count, color }) => {
          const isHidden = hidden.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => dispatch(toggleTypeHidden(type))}
              className={`flex items-center justify-between gap-2 w-full rounded px-1.5 py-0.5 text-left text-xs hover:bg-neutral-100 ${
                isHidden ? 'opacity-40' : ''
              }`}
              title={type}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate">{formatIri(type, labelMode)}</span>
              </span>
              <span className="text-neutral-400 tabular-nums">{count}</span>
            </button>
          );
        })}
      </Stack>
    </ScrollArea.Autosize>
  );
}
