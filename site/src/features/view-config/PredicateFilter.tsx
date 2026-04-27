import { Button, Checkbox } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';
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

export function PredicateFilter() {
  const dispatch = useAppDispatch();
  const graphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(graphId, { skip: !graphId });
  const { predicates } = useGraphDerivedData(data);
  const hidden = useAppSelector(selectHiddenPredicates);
  const labelMode = useAppSelector(selectLabelMode);

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
      <div className="flex max-h-60 flex-col gap-0.5 overflow-auto">
        {predicates.map(({ predicate, count }) => {
          const isHidden = hidden.has(predicate);
          const display =
            predicate === '' ? '(no predicate)' : formatIri(predicate, labelMode);
          return (
            <Checkbox
              key={predicate}
              size="xs"
              checked={!isHidden}
              onChange={() => dispatch(togglePredicateHidden(predicate))}
              label={
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate" title={predicate}>
                    {display}
                  </span>
                  <span className="tabular-nums text-neutral-400">{count}</span>
                </span>
              }
              styles={{ label: { width: '100%' } }}
            />
          );
        })}
      </div>
    </div>
  );
}
