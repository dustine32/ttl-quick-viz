import { Button, Checkbox, Group, ScrollArea, Stack } from '@mantine/core';
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
      <p className="text-xs text-neutral-400 italic">
        No predicates in this graph.
      </p>
    );
  }

  const allPredicateKeys = predicates.map((p) => p.predicate);
  const allHidden = allPredicateKeys.every((k) => hidden.has(k));
  const noneHidden = hidden.size === 0;

  return (
    <Stack gap={6}>
      <Group gap={4} wrap="nowrap">
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
      </Group>
      <ScrollArea.Autosize mah={240} type="auto">
        <Stack gap={2}>
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
                  <span className="flex items-center justify-between gap-2 w-full">
                    <span className="truncate" title={predicate}>
                      {display}
                    </span>
                    <span className="text-neutral-400 tabular-nums">{count}</span>
                  </span>
                }
                styles={{ label: { width: '100%' } }}
              />
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
