import { Button } from '@mantine/core';
import { useState } from 'react';
import { LuArrowRightLeft } from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';
import { CountPill } from '@/features/view-config/CountPill';
import { formatIri } from '@/features/view-config/prefixes';
import {
  setHiddenPredicates,
  togglePredicateHidden,
} from '@/features/view-config/viewConfigSlice';
import {
  selectHiddenPredicates,
  selectLabelMode,
} from '@/features/view-config/selectors';
import { useGraphDerivedData } from '@/features/view-config/useGraphDerivedData';
import { MoreListModal } from '@/shared/components/MoreListModal';

const VISIBLE_LIMIT = 20;

type LabelMode = ReturnType<typeof selectLabelMode>;

type PredicateEntry = { predicate: string; count: number };

export function PredicateFilter() {
  const dispatch = useAppDispatch();
  const graphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(graphId, { skip: !graphId });
  const { predicates } = useGraphDerivedData(data);
  const hidden = useAppSelector(selectHiddenPredicates);
  const labelMode = useAppSelector(selectLabelMode);
  const [modalOpen, setModalOpen] = useState(false);

  if (predicates.length === 0) {
    return (
      <p className="text-xs italic text-neutral-400">
        No predicates in this graph.
      </p>
    );
  }

  const allPredicateKeys = predicates.map((p) => p.predicate);
  const allHidden = allPredicateKeys.every((k) => hidden.has(k));
  const noneHidden = hidden.size === 0;
  const visiblePredicates = predicates.slice(0, VISIBLE_LIMIT);
  const hasMore = predicates.length > VISIBLE_LIMIT;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-nowrap items-center gap-1">
        <Button
          size="compact-xs"
          variant="default"
          disabled={noneHidden}
          onClick={() => dispatch(setHiddenPredicates([]))}
        >
          Show all
        </Button>
        <Button
          size="compact-xs"
          variant="default"
          disabled={allHidden}
          onClick={() => dispatch(setHiddenPredicates(allPredicateKeys))}
        >
          Hide all
        </Button>
      </div>
      <div className="flex flex-col gap-0.5">
        {visiblePredicates.map((p) => (
          <PredicateRow
            key={p.predicate}
            entry={p}
            isHidden={hidden.has(p.predicate)}
            labelMode={labelMode}
            onToggle={() => dispatch(togglePredicateHidden(p.predicate))}
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
          View all ({predicates.length})
        </Button>
      )}

      <MoreListModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Predicates"
        total={predicates.length}
        placeholder="Filter predicates…"
        renderItems={(query) => {
          const filtered = query
            ? predicates.filter((p) => {
                const display =
                  p.predicate === ''
                    ? '(no predicate)'
                    : formatIri(p.predicate, labelMode);
                return (
                  display.toLowerCase().includes(query) ||
                  p.predicate.toLowerCase().includes(query)
                );
              })
            : predicates;
          if (filtered.length === 0) {
            return <p className="px-1.5 text-xs text-slate-500">No matches.</p>;
          }
          return filtered.map((p) => (
            <PredicateRow
              key={p.predicate}
              entry={p}
              isHidden={hidden.has(p.predicate)}
              labelMode={labelMode}
              onToggle={() => dispatch(togglePredicateHidden(p.predicate))}
            />
          ));
        }}
      />
    </div>
  );
}

function PredicateRow({
  entry,
  isHidden,
  labelMode,
  onToggle,
}: {
  entry: PredicateEntry;
  isHidden: boolean;
  labelMode: LabelMode;
  onToggle: () => void;
}) {
  const display =
    entry.predicate === '' ? '(no predicate)' : formatIri(entry.predicate, labelMode);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1 text-left text-xs transition-colors hover:border-slate-200 hover:bg-slate-50 ${
        isHidden ? 'opacity-40' : ''
      }`}
      title={entry.predicate}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
            isHidden
              ? 'border-slate-200 bg-slate-50 text-slate-300'
              : 'border-violet-200 bg-violet-50 text-violet-600'
          }`}
        >
          <LuArrowRightLeft size={9} />
        </span>
        <span className="truncate text-slate-800">{display}</span>
      </span>
      <CountPill count={entry.count} dim={isHidden} />
    </button>
  );
}
