import { Button } from '@mantine/core';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';
import { CountPill } from '@/features/view-config/CountPill';
import { formatIri } from '@/features/view-config/prefixes';
import { toggleTypeHidden } from '@/features/view-config/viewConfigSlice';
import {
  selectHiddenTypes,
  selectLabelMode,
} from '@/features/view-config/selectors';
import { useGraphDerivedData } from '@/features/view-config/useGraphDerivedData';
import { MoreListModal } from '@/shared/components/MoreListModal';

const VISIBLE_LIMIT = 20;

type LabelMode = ReturnType<typeof selectLabelMode>;

type TypeEntry = { type: string; count: number; color: string };

export function TypeLegend() {
  const dispatch = useAppDispatch();
  const graphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(graphId, { skip: !graphId });
  const { types } = useGraphDerivedData(data);
  const hidden = useAppSelector(selectHiddenTypes);
  const labelMode = useAppSelector(selectLabelMode);
  const [modalOpen, setModalOpen] = useState(false);

  if (types.length === 0) {
    return (
      <p className="text-xs italic text-neutral-400">
        No rdf:type information in this graph.
      </p>
    );
  }

  const visibleTypes = types.slice(0, VISIBLE_LIMIT);
  const hasMore = types.length > VISIBLE_LIMIT;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-0.5">
        {visibleTypes.map((entry) => (
          <TypeRow
            key={entry.type}
            entry={entry}
            isHidden={hidden.has(entry.type)}
            labelMode={labelMode}
            onToggle={() => dispatch(toggleTypeHidden(entry.type))}
          />
        ))}
      </div>
      {hasMore && (
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          fullWidth
          onClick={() => setModalOpen(true)}
        >
          View all ({types.length})
        </Button>
      )}

      <MoreListModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Types"
        total={types.length}
        placeholder="Filter types…"
        renderItems={(query) => {
          const filtered = query
            ? types.filter((entry) => {
                const display = formatIri(entry.type, labelMode);
                return (
                  display.toLowerCase().includes(query) ||
                  entry.type.toLowerCase().includes(query)
                );
              })
            : types;
          if (filtered.length === 0) {
            return <p className="px-1.5 text-xs text-slate-500">No matches.</p>;
          }
          return filtered.map((entry) => (
            <TypeRow
              key={entry.type}
              entry={entry}
              isHidden={hidden.has(entry.type)}
              labelMode={labelMode}
              onToggle={() => dispatch(toggleTypeHidden(entry.type))}
            />
          ));
        }}
      />
    </div>
  );
}

function TypeRow({
  entry,
  isHidden,
  labelMode,
  onToggle,
}: {
  entry: TypeEntry;
  isHidden: boolean;
  labelMode: LabelMode;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1 text-left text-xs transition-colors hover:border-slate-200 hover:bg-slate-50 ${
        isHidden ? 'opacity-40' : ''
      }`}
      title={entry.type}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-black/10 shadow-sm"
          style={{ backgroundColor: entry.color }}
        />
        <span className="truncate text-slate-800">
          {formatIri(entry.type, labelMode)}
        </span>
      </span>
      <CountPill count={entry.count} dim={isHidden} />
    </button>
  );
}
