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
      <p className="text-xs italic text-neutral-400">
        No rdf:type information in this graph.
      </p>
    );
  }

  return (
    <div className="flex max-h-60 flex-col gap-0.5 overflow-auto">
      {types.map(({ type, count, color }) => {
        const isHidden = hidden.has(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => dispatch(toggleTypeHidden(type))}
            className={`flex w-full items-center justify-between gap-2 rounded px-1.5 py-0.5 text-left text-xs hover:bg-neutral-100 ${
              isHidden ? 'opacity-40' : ''
            }`}
            title={type}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="truncate">{formatIri(type, labelMode)}</span>
            </span>
            <span className="tabular-nums text-neutral-400">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
